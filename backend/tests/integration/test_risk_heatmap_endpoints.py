import uuid
from datetime import datetime, timedelta, timezone

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


async def _create_user(username: str, role: str) -> str:
    async with _Session() as session:
        async with session.begin():
            result = await session.execute(
                text("""
                    INSERT INTO users (
                        email, username, first_name, last_name,
                        password_hash, role, is_active
                    )
                    VALUES (
                        :email, :username, 'Test', 'User',
                        :pw_hash, :role, TRUE
                    )
                    ON CONFLICT (username)
                    DO UPDATE SET username = EXCLUDED.username
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


async def _seed_heatmap_snapshot(trained_by: str) -> tuple[str, str]:
    async with _engine.begin() as conn:
        await conn.execute(
            text("""
                UPDATE risk_models SET is_active = FALSE
                WHERE park_id = 'klaserie' AND is_active = TRUE
            """),
        )

        model_result = await conn.execute(
            text("""
                INSERT INTO risk_models
                    (park_id, object_storage_key, is_active, trained_by,
                     training_window_start, training_window_end,
                     n_training_examples, metrics)
                VALUES
                    ('klaserie', 'risk-models/klaserie/test.json', TRUE,
                     :trained_by, NOW() - INTERVAL '30 days',
                     NOW() - INTERVAL '1 day', 100,
                     '{"precision": 0.7, "recall": 0.6, "auc": 0.8}')
                RETURNING id
            """),
            {"trained_by": trained_by},
        )
        model_id = str(model_result.fetchone()[0])

        heatmap_result = await conn.execute(
            text("""
                INSERT INTO risk_heatmaps
                    (model_id, grid_resolution, time_interval)
                VALUES (:model_id, '1km', '6h')
                RETURNING id
            """),
            {"model_id": model_id},
        )
        heatmap_id = str(heatmap_result.fetchone()[0])

        await conn.execute(
            text("""
                DELETE FROM grid_cells
                WHERE park_id = 'klaserie' AND cell_ref = 'cell-test-1'
            """),
        )

        cell_result = await conn.execute(
            text("""
                INSERT INTO grid_cells
                    (park_id, cell_ref, row_index, col_index,
                     polygon_bounds)
                VALUES ('klaserie', 'cell-test-1', 0, 0,
                    ST_GeogFromText('POLYGON((31.0 -24.0, 31.01 -24.0,
                    31.01 -24.01, 31.0 -24.01, 31.0 -24.0))'))
                RETURNING id
            """),
        )
        cell_id = str(cell_result.fetchone()[0])

        score_result = await conn.execute(
            text("""
                INSERT INTO cell_risk_scores
                    (heatmap_id, grid_cell_id, risk_score)
                VALUES (:heatmap_id, :cell_id, 0.65)
                RETURNING id
            """),
            {"heatmap_id": heatmap_id, "cell_id": cell_id},
        )
        score_row_id = str(score_result.fetchone()[0])

        await conn.execute(
            text("""
                INSERT INTO explainability_metrics
                    (cell_id, key_reason, confidence_level)
                VALUES (:cell_id, 'incident_density_self', 0.7)
            """),
            {"cell_id": score_row_id},
        )

    return heatmap_id, cell_id


@pytest.mark.asyncio
async def test_get_heatmap_returns_latest_snapshot_for_ranger():
    user_id = await _create_user("risk_ranger_heatmap", "ranger")
    await _seed_heatmap_snapshot(user_id)
    token = create_access_token(user_id)

    async with _client() as client:
        response = await client.get(
            "/v1/risk/heatmap",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    body = response.json()
    assert len(body["cells"]) >= 1
    assert any(
        cell["risk_score"] == pytest.approx(0.65) for cell in body["cells"]
    )


@pytest.mark.asyncio
async def test_get_heatmap_forbidden_for_community_liaison():
    user_id = await _create_user("risk_liaison_heatmap", "community_liaison")
    await _seed_heatmap_snapshot(user_id)
    token = create_access_token(user_id)

    async with _client() as client:
        response = await client.get(
            "/v1/risk/heatmap",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_get_heatmap_returns_latest_snapshot_for_admin():
    user_id = await _create_user("risk_admin_heatmap", "admin")
    await _seed_heatmap_snapshot(user_id)
    token = create_access_token(user_id)

    async with _client() as client:
        response = await client.get(
            "/v1/risk/heatmap",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200


@pytest.mark.asyncio
async def test_explain_cell_forbidden_for_ranger():
    user_id = await _create_user("risk_ranger_explain", "ranger")
    _, cell_id = await _seed_heatmap_snapshot(user_id)
    token = create_access_token(user_id)

    async with _client() as client:
        response = await client.get(
            f"/v1/risk/heatmap/cells/{cell_id}/explain",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_explain_cell_returns_top_features_for_analyst():
    user_id = await _create_user("risk_analyst_explain", "analyst")
    _, cell_id = await _seed_heatmap_snapshot(user_id)
    token = create_access_token(user_id)

    async with _client() as client:
        response = await client.get(
            f"/v1/risk/heatmap/cells/{cell_id}/explain",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["top_features"][0]["feature_name"] == "incident_density_self"


@pytest.mark.asyncio
async def test_explain_cell_rejects_non_uuid_cell_id():
    user_id = await _create_user("risk_analyst_bad_cell_id", "analyst")
    await _seed_heatmap_snapshot(user_id)
    token = create_access_token(user_id)

    async with _client() as client:
        response = await client.get(
            "/v1/risk/heatmap/cells/not-a-uuid/explain",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_active_model_metrics_forbidden_for_ranger():
    user_id = await _create_user("risk_ranger_model", "ranger")
    await _seed_heatmap_snapshot(user_id)
    token = create_access_token(user_id)

    async with _client() as client:
        response = await client.get(
            "/v1/risk/models/active",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_active_model_metrics_returned_for_analyst():
    user_id = await _create_user("risk_analyst_model", "analyst")
    await _seed_heatmap_snapshot(user_id)
    token = create_access_token(user_id)

    async with _client() as client:
        response = await client.get(
            "/v1/risk/models/active",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    assert response.json()["metrics"]["precision"] == pytest.approx(0.7)


async def _seed_two_heatmaps_for_same_cell(
    trained_by: str,
) -> tuple[str, str, str]:
    async with _engine.begin() as conn:
        await conn.execute(
            text("""
                UPDATE risk_models SET is_active = FALSE
                WHERE park_id = 'klaserie' AND is_active = TRUE
            """),
        )

        model_result = await conn.execute(
            text("""
                INSERT INTO risk_models
                    (park_id, object_storage_key, is_active, trained_by,
                     training_window_start, training_window_end,
                     n_training_examples, metrics)
                VALUES
                    ('klaserie', 'risk-models/klaserie/test.json', TRUE,
                     :trained_by, NOW() - INTERVAL '30 days',
                     NOW() - INTERVAL '1 day', 100,
                     '{"precision": 0.7, "recall": 0.6, "auc": 0.8}')
                RETURNING id
            """),
            {"trained_by": trained_by},
        )
        model_id = str(model_result.fetchone()[0])

        await conn.execute(
            text("""
                DELETE FROM grid_cells
                WHERE park_id = 'klaserie'
                    AND cell_ref = 'cell-test-multi'
            """),
        )
        cell_result = await conn.execute(
            text("""
                INSERT INTO grid_cells
                    (park_id, cell_ref, row_index, col_index,
                     polygon_bounds)
                VALUES ('klaserie', 'cell-test-multi', 0, 0,
                    ST_GeogFromText('POLYGON((31.0 -24.0, 31.01 -24.0,
                    31.01 -24.01, 31.0 -24.01, 31.0 -24.0))'))
                RETURNING id
            """),
        )
        cell_id = str(cell_result.fetchone()[0])

        async def _seed_one(
            computed_at_expr: str,
            key_reason: str,
        ) -> str:
            heatmap_result = await conn.execute(
                text(f"""
                    INSERT INTO risk_heatmaps
                        (model_id, grid_resolution, time_interval,
                         computed_at)
                    VALUES (:model_id, '1km', '6h', {computed_at_expr})
                    RETURNING id
                """),
                {"model_id": model_id},
            )
            heatmap_id = str(heatmap_result.fetchone()[0])

            score_result = await conn.execute(
                text("""
                    INSERT INTO cell_risk_scores
                        (heatmap_id, grid_cell_id, risk_score)
                    VALUES (:heatmap_id, :cell_id, 0.65)
                    RETURNING id
                """),
                {"heatmap_id": heatmap_id, "cell_id": cell_id},
            )
            score_row_id = str(score_result.fetchone()[0])

            await conn.execute(
                text("""
                    INSERT INTO explainability_metrics
                        (cell_id, key_reason, confidence_level)
                    VALUES (:cell_id, :key_reason, 0.7)
                """),
                {"cell_id": score_row_id, "key_reason": key_reason},
            )
            return heatmap_id

        older_heatmap_id = await _seed_one(
            "NOW() - INTERVAL '1 day'",
            "older_reason",
        )
        newer_heatmap_id = await _seed_one("NOW()", "newer_reason")

    return newer_heatmap_id, older_heatmap_id, cell_id


@pytest.mark.asyncio
async def test_explain_cell_uses_latest_heatmap_by_computed_at():
    user_id = await _create_user("risk_analyst_multi_explain", "analyst")
    (
        newer_heatmap_id,
        older_heatmap_id,
        cell_id,
    ) = await _seed_two_heatmaps_for_same_cell(user_id)
    token = create_access_token(user_id)

    async with _client() as client:
        response = await client.get(
            f"/v1/risk/heatmap/cells/{cell_id}/explain",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["heatmap_id"] == newer_heatmap_id
    assert body["heatmap_id"] != older_heatmap_id
    reasons = [f["feature_name"] for f in body["top_features"]]
    assert "newer_reason" in reasons
    assert "older_reason" not in reasons


@pytest.mark.asyncio
async def test_get_heatmap_snapshot_param_returns_that_exact_heatmap():
    user_id = await _create_user("risk_analyst_snapshot_hit", "analyst")
    _, older_heatmap_id, _ = await _seed_two_heatmaps_for_same_cell(user_id)
    token = create_access_token(user_id)

    async with _client() as client:
        response = await client.get(
            "/v1/risk/heatmap",
            params={"snapshot": older_heatmap_id},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    assert response.json()["heatmap_id"] == older_heatmap_id


@pytest.mark.asyncio
async def test_get_heatmap_snapshot_param_404_when_not_found():
    user_id = await _create_user("risk_analyst_snapshot_miss", "analyst")
    await _seed_two_heatmaps_for_same_cell(user_id)
    token = create_access_token(user_id)

    async with _client() as client:
        response = await client.get(
            "/v1/risk/heatmap",
            params={"snapshot": str(uuid.uuid4())},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_heatmap_date_param_returns_heatmap_at_or_before():
    user_id = await _create_user("risk_analyst_date_hit", "analyst")
    _, older_heatmap_id, _ = await _seed_two_heatmaps_for_same_cell(user_id)
    token = create_access_token(user_id)
    as_of = (datetime.now(timezone.utc) - timedelta(hours=12)).isoformat()

    async with _client() as client:
        response = await client.get(
            "/v1/risk/heatmap",
            params={"date": as_of},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    assert response.json()["heatmap_id"] == older_heatmap_id


@pytest.mark.asyncio
async def test_get_heatmap_date_param_404_when_nothing_before_it():
    user_id = await _create_user("risk_analyst_date_miss", "analyst")
    await _seed_two_heatmaps_for_same_cell(user_id)
    token = create_access_token(user_id)

    async with _client() as client:
        response = await client.get(
            "/v1/risk/heatmap",
            params={"date": "2000-01-01T00:00:00Z"},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_heatmap_snapshot_param_404_when_heatmap_belongs_to_different_park():  # noqa: E501
    user_id = await _create_user("risk_analyst_snapshot_wrong_park", "analyst")
    token = create_access_token(user_id)

    async with _engine.begin() as conn:
        await conn.execute(
            text("""
                UPDATE risk_models SET is_active = FALSE
                WHERE park_id = 'other-park' AND is_active = TRUE
            """),
        )

        model_result = await conn.execute(
            text("""
                INSERT INTO risk_models
                    (park_id, object_storage_key, is_active, trained_by,
                     training_window_start, training_window_end,
                     n_training_examples, metrics)
                VALUES
                    ('other-park', 'risk-models/other-park/test.json', TRUE,
                     :trained_by, NOW() - INTERVAL '30 days',
                     NOW() - INTERVAL '1 day', 100,
                     '{"precision": 0.7, "recall": 0.6, "auc": 0.8}')
                RETURNING id
            """),
            {"trained_by": user_id},
        )
        model_id = str(model_result.fetchone()[0])

        heatmap_result = await conn.execute(
            text("""
                INSERT INTO risk_heatmaps
                    (model_id, grid_resolution, time_interval)
                VALUES (:model_id, '1km', '6h')
                RETURNING id
            """),
            {"model_id": model_id},
        )
        other_park_heatmap_id = str(heatmap_result.fetchone()[0])

    async with _client() as client:
        response = await client.get(
            "/v1/risk/heatmap",
            params={"snapshot": other_park_heatmap_id},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_heatmap_rejects_both_date_and_snapshot():
    user_id = await _create_user("risk_analyst_both_params", "analyst")
    _, older_heatmap_id, _ = await _seed_two_heatmaps_for_same_cell(user_id)
    token = create_access_token(user_id)

    async with _client() as client:
        response = await client.get(
            "/v1/risk/heatmap",
            params={
                "date": "2026-01-01T00:00:00Z",
                "snapshot": older_heatmap_id,
            },
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 422
