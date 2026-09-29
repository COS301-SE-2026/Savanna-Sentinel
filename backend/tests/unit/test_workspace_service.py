import uuid

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.schemas.workspace import (
    WorkspaceFeaturePayload,
    WorkspaceLayerPayload,
    WorkspaceRules,
    WorkspaceSaveRequest,
    WorkspaceStyle,
)
from app.services.workspace_service import (
    MAX_VERTICES_PER_FEATURE,
    WorkspaceService,
    validate_geometry,
)


class FakeWorkspaceRepo:
    def __init__(self, version: int = 0, conflict: bool = False):
        self.version = version
        self.conflict = conflict
        self.replaced = None
        self.visibility_writes = []
        self.known_memberships: set[str] = set()

    async def load(self, user_id):
        return {
            "version": self.version,
            "layers": [],
            "features": [],
            "memberships": [],
        }

    async def get_version(self):
        return self.version

    async def replace(self, **kwargs):
        if self.conflict:
            return None
        self.replaced = kwargs
        self.version += 1
        return self.version

    async def existing_membership_ids(self, ids):
        return {i for i in ids if i in self.known_memberships}

    async def set_visibility(self, user_id, entries):
        self.visibility_writes.append((user_id, entries))


def _ids(count):
    return [str(uuid.uuid4()) for _ in range(count)]


def _request(**overrides):
    layer_id, feature_id, membership_id = _ids(3)
    body = {
        "base_version": 0,
        "layers": [
            {
                "id": layer_id,
                "name": "Water",
                "parent_id": None,
                "order": 0,
                "default_style": {},
            },
        ],
        "features": [
            {
                "id": feature_id,
                "type": "point",
                "geometry": {"type": "Point", "coordinates": [31.1, -24.4]},
            },
        ],
        "memberships": [
            {
                "id": membership_id,
                "feature_id": feature_id,
                "layer_id": layer_id,
                "order": 0,
                "style_override": {},
                "visible": True,
            },
        ],
    }
    body.update(overrides)
    return WorkspaceSaveRequest(**body)


@pytest.mark.asyncio
async def test_save_forwards_the_payload_and_stamps_timestamps():
    repo = FakeWorkspaceRepo()
    request = _request()

    await WorkspaceService(repo).save_workspace("user-1", request)

    assert repo.replaced["base_version"] == 0
    feature = repo.replaced["features"][0]
    assert feature["created_at"] is not None
    assert feature["updated_at"] == feature["created_at"]


@pytest.mark.asyncio
async def test_save_keeps_timestamps_the_client_sent():
    repo = FakeWorkspaceRepo()
    request = _request()
    base = request.features[0].model_dump()
    request = _request(
        features=[
            {
                **base,
                "created_at": "2026-01-02T03:04:05Z",
                "updated_at": "2026-02-03T04:05:06Z",
            },
        ],
        memberships=[m.model_dump() for m in request.memberships],
        layers=[layer.model_dump() for layer in request.layers],
    )

    await WorkspaceService(repo).save_workspace("user-1", request)

    feature = repo.replaced["features"][0]
    assert feature["created_at"].year == 2026
    assert feature["created_at"].month == 1
    assert feature["updated_at"].month == 2


@pytest.mark.asyncio
async def test_stale_save_raises_conflict_carrying_the_current_version():
    repo = FakeWorkspaceRepo(version=7, conflict=True)

    with pytest.raises(HTTPException) as caught:
        await WorkspaceService(repo).save_workspace("user-1", _request())

    assert caught.value.status_code == 409
    assert caught.value.detail["current_version"] == 7


@pytest.mark.asyncio
async def test_visibility_write_rejects_memberships_that_do_not_exist():
    repo = FakeWorkspaceRepo()
    missing = str(uuid.uuid4())

    with pytest.raises(HTTPException) as caught:
        await WorkspaceService(repo).set_visibility(
            "user-1",
            [{"membership_id": missing, "visible": False}],
        )

    assert caught.value.status_code == 422
    assert repo.visibility_writes == []


@pytest.mark.asyncio
async def test_visibility_write_reaches_the_repo_for_known_memberships():
    repo = FakeWorkspaceRepo()
    membership_id = str(uuid.uuid4())
    repo.known_memberships.add(membership_id)

    await WorkspaceService(repo).set_visibility(
        "user-1",
        [{"membership_id": membership_id, "visible": False}],
    )

    assert repo.visibility_writes == [
        ("user-1", [{"membership_id": membership_id, "visible": False}]),
    ]


@pytest.mark.asyncio
async def test_orphan_feature_never_reaches_the_repo():
    repo = FakeWorkspaceRepo()
    request = _request()
    request.memberships = []

    with pytest.raises(HTTPException) as caught:
        await WorkspaceService(repo).save_workspace("user-1", request)

    assert caught.value.status_code == 422
    assert repo.replaced is None


@pytest.mark.asyncio
async def test_deep_layer_chain_is_accepted():
    repo = FakeWorkspaceRepo()
    layer_ids = _ids(60)
    layers = [
        {
            "id": layer_id,
            "parent_id": layer_ids[index - 1] if index else None,
            "order": 0,
            "default_style": {},
        }
        for index, layer_id in enumerate(layer_ids)
    ]
    request = _request(layers=layers, features=[], memberships=[])

    await WorkspaceService(repo).save_workspace("user-1", request)

    assert len(repo.replaced["layers"]) == 60


@pytest.mark.asyncio
async def test_cycle_further_up_the_tree_is_caught():
    repo = FakeWorkspaceRepo()
    first, second, third = _ids(3)
    layers = [
        {"id": first, "parent_id": third, "order": 0, "default_style": {}},
        {"id": second, "parent_id": first, "order": 0, "default_style": {}},
        {"id": third, "parent_id": second, "order": 0, "default_style": {}},
    ]
    request = _request(layers=layers, features=[], memberships=[])

    with pytest.raises(HTTPException) as caught:
        await WorkspaceService(repo).save_workspace("user-1", request)

    assert caught.value.status_code == 422
    assert repo.replaced is None


@pytest.mark.asyncio
async def test_duplicate_layer_ids_are_rejected():
    repo = FakeWorkspaceRepo()
    shared = str(uuid.uuid4())
    layers = [
        {"id": shared, "parent_id": None, "order": 0, "default_style": {}},
        {"id": shared, "parent_id": None, "order": 1, "default_style": {}},
    ]
    request = _request(layers=layers, features=[], memberships=[])

    with pytest.raises(HTTPException) as caught:
        await WorkspaceService(repo).save_workspace("user-1", request)

    assert "duplicate layer id" in caught.value.detail


def test_style_drops_unset_properties():
    style = WorkspaceStyle(colour="#003a6b")

    assert style.to_stored() == {"colour": "#003a6b"}


def test_point_geometry_accepts_an_elevation():
    validate_geometry(
        "f1",
        "point",
        {
            "type": "Point",
            "coordinates": [31.1, -24.4, 812.0],
        },
    )


@pytest.mark.parametrize(
    "kind,geometry,fragment",
    [
        ("point", {"type": "Point", "coordinates": [31.1]}, "2 or 3 numbers"),
        (
            "point",
            {"type": "Point", "coordinates": ["31.1", -24.4]},
            "must be numbers",
        ),
        (
            "point",
            {"type": "Point", "coordinates": [31.1, -91.0]},
            "latitude",
        ),
        (
            "line",
            {"type": "LineString", "coordinates": [[31.1, -24.4]]},
            "at least 2 positions",
        ),
        (
            "polygon",
            {"type": "Polygon", "coordinates": []},
            "at least one ring",
        ),
        (
            "polygon",
            {
                "type": "Polygon",
                "coordinates": [[[31.1, -24.4], [31.2, -24.4]]],
            },
            "at least 4 positions",
        ),
        ("line", {"type": "Point", "coordinates": [31.1, -24.4]}, "LineString"),
    ],
)
def test_malformed_geometry_is_rejected(kind, geometry, fragment):
    with pytest.raises(HTTPException) as caught:
        validate_geometry("f1", kind, geometry)

    assert fragment in caught.value.detail


def test_vertex_budget_is_enforced():
    coordinates = [[31.1, -24.4]] * (MAX_VERTICES_PER_FEATURE + 1)

    with pytest.raises(HTTPException) as caught:
        validate_geometry(
            "f1",
            "line",
            {"type": "LineString", "coordinates": coordinates},
        )

    assert "exceeds the limit" in caught.value.detail


def _feature_payload(**overrides):
    body = {
        "id": str(uuid.uuid4()),
        "type": "point",
        "geometry": {"type": "Point", "coordinates": [31.1, -24.4]},
    }
    body.update(overrides)
    return WorkspaceFeaturePayload(**body)


def test_feature_defaults_are_in_effect_with_the_buffer_off():
    feature = _feature_payload()

    assert feature.in_effect is True
    assert feature.buffer_enabled is False
    assert feature.buffer_distance_m == 100


@pytest.mark.parametrize("distance", [0, -5, 0.5, 20001, 1e9])
def test_buffer_distance_outside_the_allowed_range_is_rejected(distance):
    with pytest.raises(ValidationError):
        _feature_payload(buffer_distance_m=distance)


@pytest.mark.parametrize("distance", [1, 250.5, 20000])
def test_buffer_distance_inside_the_allowed_range_is_accepted(distance):
    assert _feature_payload(buffer_distance_m=distance).buffer_distance_m == (
        distance
    )


def test_buffer_style_keys_are_accepted_and_stored():
    style = WorkspaceStyle(buffer_colour="#00ff00", buffer_opacity=0.5)

    assert style.to_stored() == {
        "buffer_colour": "#00ff00",
        "buffer_opacity": 0.5,
    }


def test_buffer_opacity_outside_zero_to_one_is_rejected():
    with pytest.raises(ValidationError):
        WorkspaceStyle(buffer_opacity=1.5)


def test_unknown_style_keys_are_still_rejected():
    with pytest.raises(ValidationError):
        WorkspaceStyle(buffer_size=3)


def test_an_explicit_no_icon_is_accepted_and_stored():
    style = WorkspaceStyle(icon="none")

    assert style.to_stored() == {"icon": "none"}


def test_an_unknown_icon_key_is_rejected():
    with pytest.raises(ValidationError):
        WorkspaceStyle(icon="rocket")


@pytest.mark.asyncio
async def test_save_forwards_the_buffer_and_in_effect_fields():
    repo = FakeWorkspaceRepo()
    base = _request()
    feature = {
        **base.features[0].model_dump(),
        "in_effect": False,
        "buffer_enabled": True,
        "buffer_distance_m": 250.0,
    }
    request = _request(
        features=[feature],
        layers=[layer.model_dump() for layer in base.layers],
        memberships=[m.model_dump() for m in base.memberships],
    )

    await WorkspaceService(repo).save_workspace("user-1", request)

    stored = repo.replaced["features"][0]
    assert stored["in_effect"] is False
    assert stored["buffer_enabled"] is True
    assert stored["buffer_distance_m"] == 250.0


def test_rules_default_to_empty_on_features_and_layers():
    feature = _feature_payload()
    layer = WorkspaceLayerPayload(id=str(uuid.uuid4()), order=0)

    assert feature.rules.to_stored() == {}
    assert layer.default_rules.to_stored() == {}


def test_a_rule_stores_only_the_properties_that_were_set():
    rules = WorkspaceRules(avoid={"strength": 1.0, "priority": 3})

    assert rules.to_stored() == {"avoid": {"strength": 1.0, "priority": 3}}


def test_an_empty_rule_still_counts_as_defined():
    assert WorkspaceRules(prefer={}).to_stored() == {"prefer": {}}


def test_a_feature_can_hold_all_four_intents_at_once():
    rules = WorkspaceRules(
        increase_risk={"strength": 0.3},
        decrease_risk={"strength": 0.8, "priority": 2},
        prefer={},
        avoid={"enabled": False},
    )

    assert set(rules.to_stored()) == {
        "increase_risk",
        "decrease_risk",
        "prefer",
        "avoid",
    }


@pytest.mark.parametrize(
    "rule",
    [
        {"strength": 0.05},
        {"strength": 1.5},
        {"buffer_decay": -0.1},
        {"buffer_decay": 1.1},
        {"priority": 0},
        {"priority": 100},
        {"priority": 2.5},
        {"unknown": 1},
    ],
)
def test_invalid_rule_values_are_rejected(rule):
    with pytest.raises(ValidationError):
        WorkspaceRules(avoid=rule)


def test_an_unknown_intent_is_rejected():
    with pytest.raises(ValidationError):
        WorkspaceRules(sneak={"strength": 0.5})


@pytest.mark.parametrize(
    "rule",
    [
        {"strength": 0.1},
        {"strength": 1.0},
        {"buffer_decay": 0},
        {"buffer_decay": 1},
        {"priority": 1},
        {"priority": 99},
        {"enabled": False},
    ],
)
def test_boundary_rule_values_are_accepted(rule):
    assert WorkspaceRules(avoid=rule).to_stored() == {"avoid": rule}


@pytest.mark.asyncio
async def test_save_forwards_feature_rules_and_layer_default_rules():
    repo = FakeWorkspaceRepo()
    base = _request()
    layer = {
        **base.layers[0].model_dump(),
        "default_rules": {"avoid": {"strength": 1.0}},
    }
    feature = {
        **base.features[0].model_dump(),
        "rules": {"increase_risk": {"priority": 2}},
    }
    request = _request(
        layers=[layer],
        features=[feature],
        memberships=[m.model_dump() for m in base.memberships],
    )

    await WorkspaceService(repo).save_workspace("user-1", request)

    assert repo.replaced["layers"][0]["default_rules"] == {
        "avoid": {"strength": 1.0},
    }
    assert repo.replaced["features"][0]["rules"] == {
        "increase_risk": {"priority": 2},
    }


class FakeTerrain:
    def __init__(self):
        self.snapshots = []

    async def on_workspace_saved(self, snapshot):
        self.snapshots.append(snapshot)
        return True


@pytest.mark.asyncio
async def test_a_successful_save_tells_the_terrain_service():
    repo = FakeWorkspaceRepo()
    terrain = FakeTerrain()

    await WorkspaceService(repo, terrain).save_workspace("user-1", _request())

    assert len(terrain.snapshots) == 1
    assert {"layers", "features", "memberships"} <= set(terrain.snapshots[0])


@pytest.mark.asyncio
async def test_a_conflicting_save_does_not_tell_the_terrain_service():
    repo = FakeWorkspaceRepo(version=3, conflict=True)
    terrain = FakeTerrain()

    with pytest.raises(HTTPException):
        await WorkspaceService(repo, terrain).save_workspace(
            "user-1",
            _request(),
        )

    assert terrain.snapshots == []


class BrokenTerrain:
    async def on_workspace_saved(self, snapshot):
        raise RuntimeError("terrain is down")


@pytest.mark.asyncio
async def test_a_terrain_failure_does_not_fail_a_committed_save():
    repo = FakeWorkspaceRepo()

    result = await WorkspaceService(repo, BrokenTerrain()).save_workspace(
        "user-1",
        _request(),
    )

    assert result is not None
    assert repo.replaced is not None
