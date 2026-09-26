import uuid

import pytest
from fastapi import HTTPException

from app.schemas.workspace import WorkspaceSaveRequest, WorkspaceStyle
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
