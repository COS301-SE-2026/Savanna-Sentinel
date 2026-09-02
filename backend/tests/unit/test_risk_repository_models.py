import pytest

from app.models.risk_model import RiskModel
from app.models.user import User
from app.repositories.risk_repository import (
    get_active_model,
    get_active_model_details,
    save_model_version,
)


async def _make_user(db_session) -> str:
    user = User(
        username="analyst1",
        email="analyst1@sentinel.dev",
        hashed_password="x",
        first_name="A",
        last_name="B",
        role="analyst",
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()
    return user.id


@pytest.mark.asyncio
async def test_save_model_version_creates_active_row(db_session):
    user_id = await _make_user(db_session)

    model_id = await save_model_version(
        db_session,
        park_id="klaserie",
        object_storage_key="risk-models/klaserie/abc.json",
        trained_by=user_id,
        window_start="2026-01-01T00:00:00+00:00",
        window_end="2026-04-01T00:00:00+00:00",
        n_examples=500,
        metrics={"precision": 0.8, "recall": 0.7, "auc": 0.85},
    )
    await db_session.commit()

    row = await db_session.get(RiskModel, model_id)
    assert row.is_active is True
    assert row.park_id == "klaserie"
    assert row.n_training_examples == 500


@pytest.mark.asyncio
async def test_save_model_version_deactivates_previous_active(db_session):
    user_id = await _make_user(db_session)

    first_id = await save_model_version(
        db_session,
        park_id="klaserie",
        object_storage_key="k1",
        trained_by=user_id,
        window_start="2026-01-01T00:00:00+00:00",
        window_end="2026-02-01T00:00:00+00:00",
        n_examples=100,
        metrics={"precision": 0.5},
    )
    await db_session.commit()

    second_id = await save_model_version(
        db_session,
        park_id="klaserie",
        object_storage_key="k2",
        trained_by=user_id,
        window_start="2026-02-01T00:00:00+00:00",
        window_end="2026-03-01T00:00:00+00:00",
        n_examples=200,
        metrics={"precision": 0.6},
    )
    await db_session.commit()

    first_row = await db_session.get(RiskModel, first_id)
    second_row = await db_session.get(RiskModel, second_id)
    assert first_row.is_active is False
    assert second_row.is_active is True


@pytest.mark.asyncio
async def test_save_model_version_assigns_incrementing_version(db_session):
    user_id = await _make_user(db_session)

    first_id = await save_model_version(
        db_session,
        park_id="klaserie",
        object_storage_key="k1",
        trained_by=user_id,
        window_start="2026-01-01T00:00:00+00:00",
        window_end="2026-02-01T00:00:00+00:00",
        n_examples=100,
        metrics={"precision": 0.5},
    )
    await db_session.commit()

    second_id = await save_model_version(
        db_session,
        park_id="klaserie",
        object_storage_key="k2",
        trained_by=user_id,
        window_start="2026-02-01T00:00:00+00:00",
        window_end="2026-03-01T00:00:00+00:00",
        n_examples=200,
        metrics={"precision": 0.6},
    )
    await db_session.commit()

    first_row = await db_session.get(RiskModel, first_id)
    second_row = await db_session.get(RiskModel, second_id)
    assert first_row.version == 1
    assert second_row.version == 2


@pytest.mark.asyncio
async def test_save_model_version_numbers_parks_independently(db_session):
    user_id = await _make_user(db_session)

    klaserie_id = await save_model_version(
        db_session,
        park_id="klaserie",
        object_storage_key="k1",
        trained_by=user_id,
        window_start="2026-01-01T00:00:00+00:00",
        window_end="2026-02-01T00:00:00+00:00",
        n_examples=100,
        metrics={"precision": 0.5},
    )
    timbavati_id = await save_model_version(
        db_session,
        park_id="timbavati",
        object_storage_key="t1",
        trained_by=user_id,
        window_start="2026-01-01T00:00:00+00:00",
        window_end="2026-02-01T00:00:00+00:00",
        n_examples=100,
        metrics={"precision": 0.5},
    )
    await db_session.commit()

    klaserie_row = await db_session.get(RiskModel, klaserie_id)
    timbavati_row = await db_session.get(RiskModel, timbavati_id)
    assert klaserie_row.version == 1
    assert timbavati_row.version == 1


@pytest.mark.asyncio
async def test_get_active_model_details_includes_version(db_session):
    user_id = await _make_user(db_session)
    await save_model_version(
        db_session,
        park_id="klaserie",
        object_storage_key="k1",
        trained_by=user_id,
        window_start="2026-01-01T00:00:00+00:00",
        window_end="2026-02-01T00:00:00+00:00",
        n_examples=100,
        metrics={"precision": 0.5},
    )
    await save_model_version(
        db_session,
        park_id="klaserie",
        object_storage_key="k2",
        trained_by=user_id,
        window_start="2026-02-01T00:00:00+00:00",
        window_end="2026-03-01T00:00:00+00:00",
        n_examples=200,
        metrics={"precision": 0.6},
    )
    await db_session.commit()

    details = await get_active_model_details(db_session, "klaserie")
    assert details["version"] == 2


@pytest.mark.asyncio
async def test_get_active_model_returns_none_when_untrained(db_session):
    result = await get_active_model(db_session, "klaserie")
    assert result is None


@pytest.mark.asyncio
async def test_get_active_model_returns_the_active_row(db_session):
    user_id = await _make_user(db_session)
    model_id = await save_model_version(
        db_session,
        park_id="klaserie",
        object_storage_key="k1",
        trained_by=user_id,
        window_start="2026-01-01T00:00:00+00:00",
        window_end="2026-02-01T00:00:00+00:00",
        n_examples=100,
        metrics={"precision": 0.5},
    )
    await db_session.commit()

    result = await get_active_model(db_session, "klaserie")
    assert result.id == model_id
