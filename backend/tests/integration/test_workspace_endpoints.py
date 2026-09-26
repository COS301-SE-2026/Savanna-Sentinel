import asyncio
import uuid

import pytest
from httpx2 import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.core.dependencies import get_db
from app.core.security import create_access_token, get_password_hash
from app.main import app

_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
_Session = async_sessionmaker(_engine, expire_on_commit=False)


async def _override_get_db():
    async with _Session() as session:
        yield session


app.dependency_overrides[get_db] = _override_get_db


def _client() -> AsyncClient:
    return AsyncClient(
        transport=ASGITransport(app=app),
        base_url="https://test",
    )


async def _create_user(username: str, role: str = "analyst") -> str:
    async with _engine.begin() as conn:
        result = await conn.execute(
            text("""
                INSERT INTO users
                    (email, username, first_name, last_name, password_hash,
                     role, is_active)
                VALUES
                    (:email, :username, 'Test', 'User', :pw_hash,
                     CAST(:role AS user_role), TRUE)
                RETURNING id
            """),
            {
                "email": f"{username}@savanna.test",
                "username": username,
                "pw_hash": get_password_hash("SecurePass1!"),
                "role": role,
            },
        )
        return str(result.fetchone()[0])


def _auth_header(user_id: str) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


async def _wipe():
    async with _engine.begin() as conn:
        await conn.execute(text("DELETE FROM workspace_memberships"))
        await conn.execute(text("DELETE FROM workspace_features"))
        await conn.execute(text("DELETE FROM workspace_layers"))
        await conn.execute(text("UPDATE workspace_meta SET version = 0"))
        await conn.execute(
            text("DELETE FROM users WHERE username LIKE 'test_ws_%'"),
        )


@pytest.fixture(autouse=True)
def cleanup():
    asyncio.run(_wipe())
    yield
    asyncio.run(_wipe())


def _layer(layer_id: str, **overrides) -> dict:
    payload = {
        "id": layer_id,
        "name": "Water",
        "parent_id": None,
        "order": 0,
        "default_style": {"colour": "#0070bf"},
    }
    payload.update(overrides)
    return payload


def _point_feature(feature_id: str, **overrides) -> dict:
    payload = {
        "id": feature_id,
        "type": "point",
        "name": "Waterhole",
        "geometry": {"type": "Point", "coordinates": [31.12, -24.41]},
    }
    payload.update(overrides)
    return payload


def _membership(
    membership_id: str,
    feature_id: str,
    layer_id: str,
    **overrides,
) -> dict:
    payload = {
        "id": membership_id,
        "feature_id": feature_id,
        "layer_id": layer_id,
        "order": 0,
        "style_override": {},
        "visible": True,
    }
    payload.update(overrides)
    return payload


def _one_of_each() -> tuple[dict, str, str, str]:
    layer_id = str(uuid.uuid4())
    feature_id = str(uuid.uuid4())
    membership_id = str(uuid.uuid4())
    body = {
        "base_version": 0,
        "layers": [_layer(layer_id)],
        "features": [_point_feature(feature_id)],
        "memberships": [_membership(membership_id, feature_id, layer_id)],
    }
    return body, layer_id, feature_id, membership_id


@pytest.mark.asyncio
async def test_empty_workspace_starts_at_version_zero():
    user_id = await _create_user("test_ws_analyst")

    async with _client() as client:
        response = await client.get(
            "/v1/workspace",
            headers=_auth_header(user_id),
        )

    assert response.status_code == 200
    body = response.json()
    assert body["version"] == 0
    assert body["layers"] == []
    assert body["features"] == []
    assert body["memberships"] == []


@pytest.mark.asyncio
async def test_rangers_cannot_reach_the_workspace():
    user_id = await _create_user("test_ws_ranger", role="ranger")

    async with _client() as client:
        response = await client.get(
            "/v1/workspace",
            headers=_auth_header(user_id),
        )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_save_stores_the_workspace_and_bumps_the_version():
    user_id = await _create_user("test_ws_saver")
    body, layer_id, feature_id, membership_id = _one_of_each()

    async with _client() as client:
        saved = await client.put(
            "/v1/workspace",
            json=body,
            headers=_auth_header(user_id),
        )
        reloaded = await client.get(
            "/v1/workspace",
            headers=_auth_header(user_id),
        )

    assert saved.status_code == 200
    payload = saved.json()
    assert payload["version"] == 1
    assert payload["layers"][0]["id"] == layer_id
    assert payload["layers"][0]["default_style"] == {"colour": "#0070bf"}
    assert payload["features"][0]["id"] == feature_id
    assert payload["features"][0]["geometry"]["coordinates"] == [
        31.12,
        -24.41,
    ]
    assert payload["memberships"][0]["id"] == membership_id

    assert reloaded.json() == payload


@pytest.mark.asyncio
async def test_save_deletes_whatever_was_left_out():
    user_id = await _create_user("test_ws_pruner")
    body, layer_id, _, _ = _one_of_each()

    async with _client() as client:
        await client.put(
            "/v1/workspace",
            json=body,
            headers=_auth_header(user_id),
        )
        second = await client.put(
            "/v1/workspace",
            json={
                "base_version": 1,
                "layers": [_layer(layer_id, name="Renamed")],
                "features": [],
                "memberships": [],
            },
            headers=_auth_header(user_id),
        )

    assert second.status_code == 200
    payload = second.json()
    assert payload["version"] == 2
    assert payload["layers"][0]["name"] == "Renamed"
    assert payload["features"] == []
    assert payload["memberships"] == []


@pytest.mark.asyncio
async def test_stale_save_conflicts_and_changes_nothing():
    user_id = await _create_user("test_ws_conflict")
    body, layer_id, _, _ = _one_of_each()

    async with _client() as client:
        await client.put(
            "/v1/workspace",
            json=body,
            headers=_auth_header(user_id),
        )
        stale = await client.put(
            "/v1/workspace",
            json={
                "base_version": 0,
                "layers": [_layer(str(uuid.uuid4()), name="Other")],
                "features": [],
                "memberships": [],
            },
            headers=_auth_header(user_id),
        )
        after = await client.get(
            "/v1/workspace",
            headers=_auth_header(user_id),
        )

    assert stale.status_code == 409
    assert stale.json()["detail"]["current_version"] == 1

    reloaded = after.json()
    assert reloaded["version"] == 1
    assert [layer["id"] for layer in reloaded["layers"]] == [layer_id]


@pytest.mark.asyncio
async def test_visibility_is_personal():
    owner_id = await _create_user("test_ws_owner")
    other_id = await _create_user("test_ws_other")
    body, _, feature_id, membership_id = _one_of_each()
    body["memberships"][0]["visible"] = False

    async with _client() as client:
        await client.put(
            "/v1/workspace",
            json=body,
            headers=_auth_header(owner_id),
        )
        mine = await client.get(
            "/v1/workspace",
            headers=_auth_header(owner_id),
        )
        theirs = await client.get(
            "/v1/workspace",
            headers=_auth_header(other_id),
        )

    assert mine.json()["memberships"][0]["visible"] is False
    assert theirs.json()["memberships"][0]["visible"] is True


@pytest.mark.asyncio
async def test_visibility_endpoint_leaves_the_version_alone():
    user_id = await _create_user("test_ws_toggler")
    body, _, _, membership_id = _one_of_each()

    async with _client() as client:
        await client.put(
            "/v1/workspace",
            json=body,
            headers=_auth_header(user_id),
        )
        toggled = await client.put(
            "/v1/workspace/visibility",
            json={
                "entries": [
                    {"membership_id": membership_id, "visible": False},
                ],
            },
            headers=_auth_header(user_id),
        )
        after = await client.get(
            "/v1/workspace",
            headers=_auth_header(user_id),
        )

    assert toggled.status_code == 204
    assert after.json()["version"] == 1
    assert after.json()["memberships"][0]["visible"] is False


@pytest.mark.asyncio
async def test_visibility_endpoint_rejects_unknown_memberships():
    user_id = await _create_user("test_ws_badtoggle")

    async with _client() as client:
        response = await client.put(
            "/v1/workspace/visibility",
            json={
                "entries": [
                    {"membership_id": str(uuid.uuid4()), "visible": False},
                ],
            },
            headers=_auth_header(user_id),
        )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_nested_layers_survive_a_reparent_of_their_ancestor():
    user_id = await _create_user("test_ws_nesting")
    parent_id = str(uuid.uuid4())
    child_id = str(uuid.uuid4())
    feature_id = str(uuid.uuid4())
    membership_id = str(uuid.uuid4())

    async with _client() as client:
        await client.put(
            "/v1/workspace",
            json={
                "base_version": 0,
                "layers": [
                    _layer(parent_id, name="Park"),
                    _layer(child_id, name="Water", parent_id=parent_id),
                ],
                "features": [_point_feature(feature_id)],
                "memberships": [
                    _membership(membership_id, feature_id, child_id),
                ],
            },
            headers=_auth_header(user_id),
        )
        promoted = await client.put(
            "/v1/workspace",
            json={
                "base_version": 1,
                "layers": [_layer(child_id, name="Water")],
                "features": [_point_feature(feature_id)],
                "memberships": [
                    _membership(membership_id, feature_id, child_id),
                ],
            },
            headers=_auth_header(user_id),
        )

    assert promoted.status_code == 200
    payload = promoted.json()
    assert [layer["id"] for layer in payload["layers"]] == [child_id]
    assert payload["layers"][0]["parent_id"] is None
    assert payload["memberships"][0]["id"] == membership_id


@pytest.mark.asyncio
async def test_one_feature_can_sit_under_two_layers():
    user_id = await _create_user("test_ws_shared")
    first_layer = str(uuid.uuid4())
    second_layer = str(uuid.uuid4())
    feature_id = str(uuid.uuid4())

    async with _client() as client:
        response = await client.put(
            "/v1/workspace",
            json={
                "base_version": 0,
                "layers": [
                    _layer(first_layer, name="Water"),
                    _layer(second_layer, name="Camps", order=1),
                ],
                "features": [_point_feature(feature_id)],
                "memberships": [
                    _membership(str(uuid.uuid4()), feature_id, first_layer),
                    _membership(
                        str(uuid.uuid4()),
                        feature_id,
                        second_layer,
                        style_override={"colour": "#b30000", "icon": "tent"},
                    ),
                ],
            },
            headers=_auth_header(user_id),
        )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["features"]) == 1
    assert len(payload["memberships"]) == 2
    overrides = [m["style_override"] for m in payload["memberships"]]
    assert {"colour": "#b30000", "icon": "tent"} in overrides


@pytest.mark.asyncio
async def test_two_features_can_swap_layers_in_one_save():
    user_id = await _create_user("test_ws_swap")
    first_layer = str(uuid.uuid4())
    second_layer = str(uuid.uuid4())
    left = str(uuid.uuid4())
    right = str(uuid.uuid4())
    left_membership = str(uuid.uuid4())
    right_membership = str(uuid.uuid4())
    layers = [
        _layer(first_layer, name="Water"),
        _layer(second_layer, name="Camps", order=1),
    ]
    features = [_point_feature(left), _point_feature(right)]

    async with _client() as client:
        await client.put(
            "/v1/workspace",
            json={
                "base_version": 0,
                "layers": layers,
                "features": features,
                "memberships": [
                    _membership(left_membership, left, first_layer),
                    _membership(right_membership, right, second_layer),
                ],
            },
            headers=_auth_header(user_id),
        )
        swapped = await client.put(
            "/v1/workspace",
            json={
                "base_version": 1,
                "layers": layers,
                "features": features,
                "memberships": [
                    _membership(left_membership, left, second_layer),
                    _membership(right_membership, right, first_layer),
                ],
            },
            headers=_auth_header(user_id),
        )

    assert swapped.status_code == 200
    placement = {m["id"]: m["layer_id"] for m in swapped.json()["memberships"]}
    assert placement[left_membership] == second_layer
    assert placement[right_membership] == first_layer


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "mutate",
    [
        pytest.param(
            lambda b: b["layers"][0].update({"parent_id": str(uuid.uuid4())}),
            id="unknown-parent",
        ),
        pytest.param(
            lambda b: b["layers"][0].update(
                {"parent_id": b["layers"][0]["id"]},
            ),
            id="self-parent",
        ),
        pytest.param(
            lambda b: b["features"][0].update({"type": "polygon"}),
            id="geometry-type-mismatch",
        ),
        pytest.param(
            lambda b: b["features"][0]["geometry"].update(
                {"coordinates": [231.0, -24.4]},
            ),
            id="longitude-out-of-range",
        ),
        pytest.param(
            lambda b: b["memberships"].append(
                _membership(
                    str(uuid.uuid4()),
                    b["features"][0]["id"],
                    b["layers"][0]["id"],
                ),
            ),
            id="duplicate-feature-in-layer",
        ),
        pytest.param(
            lambda b: b["memberships"].clear(),
            id="orphan-feature",
        ),
        pytest.param(
            lambda b: b["layers"][0]["default_style"].update(
                {"icon": "spaceship"},
            ),
            id="unknown-icon",
        ),
        pytest.param(
            lambda b: b["layers"][0]["default_style"].update(
                {"colour": "cornflower"},
            ),
            id="non-hex-colour",
        ),
        pytest.param(
            lambda b: b["layers"][0]["default_style"].update({"opacity": 4}),
            id="opacity-out-of-range",
        ),
        pytest.param(
            lambda b: b["layers"][0]["default_style"].update(
                {"stroke_width": 40},
            ),
            id="stroke-width-out-of-range",
        ),
        pytest.param(
            lambda b: b["layers"][0]["default_style"].update(
                {"line_dash": "wiggly"},
            ),
            id="unknown-line-dash",
        ),
    ],
)
async def test_invalid_payloads_are_rejected(mutate):
    user_id = await _create_user("test_ws_invalid")
    body, _, _, _ = _one_of_each()
    mutate(body)

    async with _client() as client:
        response = await client.put(
            "/v1/workspace",
            json=body,
            headers=_auth_header(user_id),
        )
        after = await client.get(
            "/v1/workspace",
            headers=_auth_header(user_id),
        )

    assert response.status_code == 422
    assert after.json()["version"] == 0
    assert after.json()["layers"] == []


@pytest.mark.asyncio
async def test_layer_cycle_is_rejected():
    user_id = await _create_user("test_ws_cycle")
    first = str(uuid.uuid4())
    second = str(uuid.uuid4())

    async with _client() as client:
        response = await client.put(
            "/v1/workspace",
            json={
                "base_version": 0,
                "layers": [
                    _layer(first, parent_id=second),
                    _layer(second, parent_id=first),
                ],
                "features": [],
                "memberships": [],
            },
            headers=_auth_header(user_id),
        )

    assert response.status_code == 422
    assert "subtree" in response.json()["detail"]


@pytest.mark.asyncio
async def test_line_and_polygon_geometry_round_trip():
    user_id = await _create_user("test_ws_shapes")
    layer_id = str(uuid.uuid4())
    line_id = str(uuid.uuid4())
    polygon_id = str(uuid.uuid4())
    ring = [
        [31.1, -24.4],
        [31.2, -24.4],
        [31.2, -24.5],
        [31.1, -24.4],
    ]

    async with _client() as client:
        response = await client.put(
            "/v1/workspace",
            json={
                "base_version": 0,
                "layers": [_layer(layer_id)],
                "features": [
                    {
                        "id": line_id,
                        "type": "line",
                        "name": "Fence",
                        "geometry": {
                            "type": "LineString",
                            "coordinates": [[31.1, -24.4], [31.3, -24.6]],
                        },
                    },
                    {
                        "id": polygon_id,
                        "type": "polygon",
                        "name": "Block",
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": [ring],
                        },
                    },
                ],
                "memberships": [
                    _membership(str(uuid.uuid4()), line_id, layer_id),
                    _membership(
                        str(uuid.uuid4()),
                        polygon_id,
                        layer_id,
                        order=1,
                    ),
                ],
            },
            headers=_auth_header(user_id),
        )

    assert response.status_code == 200
    geometries = {
        feature["id"]: feature["geometry"]
        for feature in response.json()["features"]
    }
    assert geometries[polygon_id]["coordinates"] == [ring]
    assert geometries[line_id]["coordinates"] == [
        [31.1, -24.4],
        [31.3, -24.6],
    ]


@pytest.mark.asyncio
async def test_unclosed_polygon_ring_is_rejected():
    user_id = await _create_user("test_ws_openring")
    layer_id = str(uuid.uuid4())
    polygon_id = str(uuid.uuid4())

    async with _client() as client:
        response = await client.put(
            "/v1/workspace",
            json={
                "base_version": 0,
                "layers": [_layer(layer_id)],
                "features": [
                    {
                        "id": polygon_id,
                        "type": "polygon",
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": [
                                [
                                    [31.1, -24.4],
                                    [31.2, -24.4],
                                    [31.2, -24.5],
                                    [31.3, -24.6],
                                ],
                            ],
                        },
                    },
                ],
                "memberships": [
                    _membership(str(uuid.uuid4()), polygon_id, layer_id),
                ],
            },
            headers=_auth_header(user_id),
        )

    assert response.status_code == 422
    assert "closed" in response.json()["detail"]
