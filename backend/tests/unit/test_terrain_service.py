from datetime import datetime, timezone

import pytest

from app.services import terrain_service
from app.services.terrain_service import TerrainService
from app.workers.terrain.hashing import EMPTY_HASH


class FakeTerrainRepo:
    def __init__(self, effects=None, meta=None):
        self.requested = EMPTY_HASH
        self.computed = EMPTY_HASH
        self.effects = effects or []
        self.meta = meta or {
            "requested_hash": EMPTY_HASH,
            "computed_hash": EMPTY_HASH,
            "computed_version": None,
            "computed_at": None,
        }

    async def set_requested_hash(self, new_hash):
        self.requested = new_hash
        return new_hash != self.computed

    def finish_recompute(self):
        self.computed = self.requested

    async def get_effects(self):
        return self.effects

    async def get_meta(self):
        return self.meta


def _snapshot(strength=0.5):
    return {
        "layers": [
            {
                "id": "l1",
                "parent_id": None,
                "order": 0,
                "default_rules": {"avoid": {"strength": strength}},
            },
        ],
        "features": [
            {
                "id": "f1",
                "type": "point",
                "geometry": {"type": "Point", "coordinates": [31.1, -24.4]},
                "in_effect": True,
                "buffer_enabled": False,
                "buffer_distance_m": 100.0,
                "rules": {},
            },
        ],
        "memberships": [
            {"id": "m1", "feature_id": "f1", "layer_id": "l1", "order": 0},
        ],
    }


def _empty_snapshot():
    return {"layers": [], "features": [], "memberships": []}


def _service(queued):
    return TerrainService(FakeTerrainRepo(), enqueue=lambda: queued.append(1))


@pytest.mark.asyncio
async def test_a_changed_rule_set_queues_a_recompute():
    queued = []

    assert await _service(queued).on_workspace_saved(_snapshot()) is True
    assert queued == [1]


@pytest.mark.asyncio
async def test_saving_the_same_rules_after_a_recompute_queues_nothing():
    queued = []
    repo = FakeTerrainRepo()
    service = TerrainService(repo, enqueue=lambda: queued.append(1))

    await service.on_workspace_saved(_snapshot())
    repo.finish_recompute()
    assert await service.on_workspace_saved(_snapshot()) is False
    assert queued == [1]


@pytest.mark.asyncio
async def test_saving_the_same_rules_again_retries_an_unfinished_recompute():
    queued = []
    service = _service(queued)

    await service.on_workspace_saved(_snapshot())
    assert await service.on_workspace_saved(_snapshot()) is True
    assert queued == [1, 1]


@pytest.mark.asyncio
async def test_a_workspace_with_no_rules_queues_nothing_at_first():
    queued = []

    assert await _service(queued).on_workspace_saved(_empty_snapshot()) is False
    assert queued == []


@pytest.mark.asyncio
async def test_removing_the_last_rule_queues_a_recompute_to_clear():
    queued = []
    repo = FakeTerrainRepo()
    service = TerrainService(repo, enqueue=lambda: queued.append(1))

    await service.on_workspace_saved(_snapshot())
    repo.finish_recompute()
    await service.on_workspace_saved(_empty_snapshot())

    assert queued == [1, 1]


@pytest.mark.asyncio
async def test_a_broken_queue_does_not_fail_the_save():
    def broken():
        raise ConnectionError("redis is down")

    service = TerrainService(FakeTerrainRepo(), enqueue=broken)

    assert await service.on_workspace_saved(_snapshot()) is True


@pytest.mark.asyncio
async def test_effects_split_into_risk_and_route_views_without_neutral():
    repo = FakeTerrainRepo(
        effects=[
            ("cell-1", 0.3, 1.0),
            ("cell-2", 0.0, 50.0),
            ("cell-3", -0.15, 0.4),
        ],
        meta={
            "requested_hash": "h",
            "computed_hash": "h",
            "computed_version": 7,
            "computed_at": datetime(2026, 9, 1, 12, 0, tzinfo=timezone.utc),
        },
    )
    service = TerrainService(repo)

    risk = await service.risk_adjustments()
    route = await service.route_costs()

    assert risk.cells == {"cell-1": 0.3, "cell-3": -0.15}
    assert route.cells == {"cell-2": 50.0, "cell-3": 0.4}
    assert risk.computed_version == 7
    assert risk.computed_at == "2026-09-01T12:00:00+00:00"
    assert risk.stale is False


@pytest.mark.asyncio
async def test_the_response_is_stale_while_the_requested_hash_is_ahead():
    repo = FakeTerrainRepo(
        meta={
            "requested_hash": "new",
            "computed_hash": "old",
            "computed_version": 2,
            "computed_at": None,
        },
    )

    assert (await TerrainService(repo).route_costs()).stale is True


@pytest.mark.asyncio
async def test_a_never_computed_system_reports_none_and_is_not_stale():
    response = await TerrainService(FakeTerrainRepo()).risk_adjustments()

    assert response.cells == {}
    assert response.computed_version is None
    assert response.computed_at is None
    assert response.stale is False


def test_a_grid_change_can_queue_a_recompute_even_if_the_broker_is_down(
    monkeypatch,
):
    def broken():
        raise ConnectionError("redis is down")

    monkeypatch.setattr(terrain_service, "enqueue_recompute", broken)

    terrain_service.enqueue_recompute_quietly()
