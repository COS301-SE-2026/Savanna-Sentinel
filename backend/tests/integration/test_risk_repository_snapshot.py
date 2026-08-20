import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.core.security import get_password_hash
from app.repositories.risk_repository import (
    get_grid_cells,
    get_risk_zone_overview,
    persist_grid_cells,
    risk_level_for_score,
    save_heatmap_snapshot,
    save_model_version,
)

_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
_Session = async_sessionmaker(_engine, expire_on_commit=False)
_PARK = "klaserie"


async def _make_trained_model() -> str:
    async with _engine.begin() as conn:
        user_result = await conn.execute(
            text("""
                INSERT INTO users (
                    username, email, password_hash,
                    first_name, last_name, role, is_active
                )
                VALUES (
                    'risk_test_analyst',
                    'risk_test_analyst@sentinel.dev',
                    :pw, 'A', 'B', 'analyst', TRUE
                )
                ON CONFLICT (username)
                DO UPDATE SET username = EXCLUDED.username
                RETURNING id
            """),
            {"pw": get_password_hash("SecurePass1!")},
        )
        user_id = str(user_result.fetchone()[0])

    async with _Session() as session:
        model_id = await save_model_version(
            session,
            park_id=_PARK,
            object_storage_key="risk-models/klaserie/test.json",
            trained_by=user_id,
            window_start="2026-01-01T00:00:00+00:00",
            window_end="2026-02-01T00:00:00+00:00",
            n_examples=50,
            metrics={"precision": 0.7},
        )
        await session.commit()
    return model_id


@pytest.mark.asyncio
async def test_save_heatmap_snapshot_persists_scores_features_and_explanations(
):
    model_id = await _make_trained_model()

    async with _Session() as session:
        await persist_grid_cells(session, _PARK)
        await session.commit()
        cells = await get_grid_cells(session, _PARK)

    cell_id = cells[0]["cell_id"]
    scores = {cell_id: 0.73}
    features_per_cell = {
        cell_id: {
            "incident_density_self": 4.0,
            "incident_density_neighbors": 1.0,
            "patrol_recency_days": 5.0,
            "patrol_frequency": 2.0,
        },
    }
    explanations = {
        cell_id: [("incident_density_self", 0.6), ("patrol_recency_days", 0.4)],
    }

    async with _Session() as session:
        heatmap_id, _computed_at = await save_heatmap_snapshot(
            session, model_id, cells[:1], scores, features_per_cell,
            explanations,
        )
        await session.commit()

    async with _engine.begin() as conn:
        heatmap_row = await conn.execute(
            text("SELECT model_id FROM risk_heatmaps WHERE id = :id"),
            {"id": heatmap_id},
        )
        assert str(heatmap_row.fetchone()[0]) == model_id

        score_row = await conn.execute(
            text(
                "SELECT risk_score FROM cell_risk_scores "
                "WHERE heatmap_id = :id",
            ),
            {"id": heatmap_id},
        )
        score_result = score_row.fetchone()
        assert score_result[0] == pytest.approx(0.73)

        feature_row = await conn.execute(
            text(
                "SELECT features FROM grid_cell_features "
                "WHERE heatmap_id = :id",
            ),
            {"id": heatmap_id},
        )
        assert feature_row.fetchone()[0]["incident_density_self"] == 4.0

        explain_count = await conn.execute(
            text("""
                SELECT COUNT(*) FROM explainability_metrics em
                JOIN cell_risk_scores crs ON crs.id = em.cell_id
                WHERE crs.heatmap_id = :id
            """),
            {"id": heatmap_id},
        )
        assert explain_count.scalar_one() == 2


@pytest.mark.asyncio
async def test_save_heatmap_snapshot_returns_db_assigned_computed_at():
    model_id = await _make_trained_model()

    async with _Session() as session:
        await persist_grid_cells(session, _PARK)
        await session.commit()
        cells = await get_grid_cells(session, _PARK)

    cell_id = cells[0]["cell_id"]
    scores = {cell_id: 0.5}
    features_per_cell = {
        cell_id: {
            "incident_density_self": 1.0,
            "incident_density_neighbors": 0.0,
            "patrol_recency_days": 3.0,
            "patrol_frequency": 1.0,
        },
    }
    explanations = {cell_id: [("incident_density_self", 0.5)]}

    async with _Session() as session:
        heatmap_id, computed_at = await save_heatmap_snapshot(
            session, model_id, cells[:1], scores, features_per_cell,
            explanations,
        )
        await session.commit()

    async with _engine.begin() as conn:
        db_row = await conn.execute(
            text("SELECT computed_at FROM risk_heatmaps WHERE id = :id"),
            {"id": heatmap_id},
        )
        db_computed_at = db_row.fetchone()[0]

    assert computed_at == db_computed_at


@pytest.mark.asyncio
async def test_save_heatmap_snapshot_links_explanations_to_correct_cell_when_batched():  # noqa: E501
    model_id = await _make_trained_model()

    async with _Session() as session:
        await persist_grid_cells(session, _PARK)
        await session.commit()
        cells = await get_grid_cells(session, _PARK)

    assert len(cells) >= 2
    cell_a, cell_b = cells[0]["cell_id"], cells[1]["cell_id"]
    scores = {cell_a: 0.2, cell_b: 0.9}
    features_per_cell = {
        cell_a: {
            "incident_density_self": 1.0,
            "incident_density_neighbors": 0.0,
            "patrol_recency_days": 3.0,
            "patrol_frequency": 1.0,
        },
        cell_b: {
            "incident_density_self": 5.0,
            "incident_density_neighbors": 2.0,
            "patrol_recency_days": 1.0,
            "patrol_frequency": 4.0,
        },
    }
    explanations = {
        cell_a: [("incident_density_self", 0.1)],
        cell_b: [("incident_density_self", 0.8), ("patrol_frequency", 0.6)],
    }

    async with _Session() as session:
        heatmap_id, _ = await save_heatmap_snapshot(
            session, model_id, cells[:2], scores, features_per_cell,
            explanations,
        )
        await session.commit()

    async with _engine.begin() as conn:
        rows = await conn.execute(
            text("""
                SELECT gc.id AS grid_cell_id, em.key_reason
                FROM cell_risk_scores crs
                JOIN grid_cells gc ON gc.id = crs.grid_cell_id
                JOIN explainability_metrics em ON em.cell_id = crs.id
                WHERE crs.heatmap_id = :id
                ORDER BY gc.id, em.key_reason
            """),
            {"id": heatmap_id},
        )
        by_cell: dict[str, list[str]] = {}
        for row in rows.fetchall():
            by_cell.setdefault(str(row.grid_cell_id), []).append(row.key_reason)

    assert by_cell[cell_a] == ["incident_density_self"]
    assert sorted(by_cell[cell_b]) == [
        "incident_density_self", "patrol_frequency",
    ]


@pytest.mark.asyncio
async def test_save_heatmap_snapshot_persists_non_default_time_interval():
    model_id = await _make_trained_model()

    async with _Session() as session:
        await persist_grid_cells(session, _PARK)
        await session.commit()
        cells = await get_grid_cells(session, _PARK)

    cell_id = cells[0]["cell_id"]
    scores = {cell_id: 0.4}
    features_per_cell = {
        cell_id: {
            "incident_density_self": 1.0,
            "incident_density_neighbors": 0.0,
            "patrol_recency_days": 3.0,
            "patrol_frequency": 1.0,
        },
    }
    explanations = {cell_id: [("incident_density_self", 0.4)]}

    async with _Session() as session:
        heatmap_id, _computed_at = await save_heatmap_snapshot(
            session, model_id, cells[:1], scores, features_per_cell,
            explanations,
            time_interval="ad-hoc",
        )
        await session.commit()

    async with _engine.begin() as conn:
        db_row = await conn.execute(
            text("SELECT time_interval FROM risk_heatmaps WHERE id = :id"),
            {"id": heatmap_id},
        )
        assert db_row.fetchone()[0] == "ad-hoc"


def test_risk_level_for_score_buckets_thresholds():
    assert risk_level_for_score(0.9) == "Critical"
    assert risk_level_for_score(0.6) == "High"
    assert risk_level_for_score(0.3) == "Medium"
    assert risk_level_for_score(0.1) == "Low"


@pytest.mark.asyncio
async def test_get_risk_zone_overview_returns_highest_scoring_cells_first():
    model_id = await _make_trained_model()

    async with _Session() as session:
        await persist_grid_cells(session, _PARK)
        await session.commit()
        cells = await get_grid_cells(session, _PARK)

    assert len(cells) >= 2
    low_cell, high_cell = cells[0], cells[1]
    scores = {low_cell["cell_id"]: 0.2, high_cell["cell_id"]: 0.9}
    features_per_cell = {
        low_cell["cell_id"]: {
            "incident_density_self": 1.0,
            "incident_density_neighbors": 0.0,
            "patrol_recency_days": 3.0,
            "patrol_frequency": 1.0,
        },
        high_cell["cell_id"]: {
            "incident_density_self": 5.0,
            "incident_density_neighbors": 2.0,
            "patrol_recency_days": 1.0,
            "patrol_frequency": 4.0,
        },
    }
    explanations = {
        low_cell["cell_id"]: [("incident_density_self", 0.1)],
        high_cell["cell_id"]: [("incident_density_self", 0.8)],
    }

    async with _Session() as session:
        await save_heatmap_snapshot(
            session, model_id, [low_cell, high_cell], scores,
            features_per_cell, explanations,
        )
        await session.commit()

    async with _Session() as session:
        zones = await get_risk_zone_overview(session, _PARK, limit=5)

    assert zones[0]["level"] == "Critical"
    assert zones[0]["zone"] == f"Zone {high_cell['row'] + 1}-{high_cell['col'] + 1}"
    assert zones[0]["risk_score"] == pytest.approx(0.9)
    assert any(z["level"] == "Low" for z in zones)


@pytest.mark.asyncio
async def test_get_risk_zone_overview_returns_empty_when_no_heatmap_exists():
    async with _Session() as session:
        zones = await get_risk_zone_overview(session, "no-such-park")

    assert zones == []
