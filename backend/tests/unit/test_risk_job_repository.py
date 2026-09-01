import pytest

from app.repositories.risk_repository import create_risk_job, risk_job_exists


@pytest.mark.asyncio
async def test_create_risk_job_then_exists_is_true(db_session):
    await create_risk_job(
        db_session,
        job_id="a1111111-1111-1111-1111-111111111111",
        job_type="train",
        park_id="klaserie",
        triggered_by="user-1",
    )

    assert (
        await risk_job_exists(
            db_session,
            "a1111111-1111-1111-1111-111111111111",
            "train",
        )
        is True
    )


@pytest.mark.asyncio
async def test_risk_job_exists_is_false_for_unknown_id(db_session):
    assert await risk_job_exists(db_session, "nonexistent", "train") is False


@pytest.mark.asyncio
async def test_risk_job_exists_is_false_for_wrong_job_type(db_session):
    await create_risk_job(
        db_session,
        job_id="b2222222-2222-2222-2222-222222222222",
        job_type="score",
        park_id="klaserie",
        triggered_by="user-1",
    )

    assert (
        await risk_job_exists(
            db_session,
            "b2222222-2222-2222-2222-222222222222",
            "train",
        )
        is False
    )


@pytest.mark.asyncio
async def test_risk_job_exists_is_false_for_malformed_id(db_session):
    assert await risk_job_exists(db_session, "not-a-uuid", "train") is False
