import pytest

from app.repositories.route_job_repository import (
    create_route_job,
    route_job_exists_for_user,
)


@pytest.mark.asyncio
async def test_create_route_job_then_exists_for_owner_is_true(db_session):
    await create_route_job(
        db_session,
        job_id="a1111111-1111-1111-1111-111111111111",
        park_id="klaserie",
        requested_by="user-1",
    )

    assert (
        await route_job_exists_for_user(
            db_session,
            "a1111111-1111-1111-1111-111111111111",
            "user-1",
        )
        is True
    )


@pytest.mark.asyncio
async def test_route_job_exists_is_false_for_unknown_id(db_session):
    assert (
        await route_job_exists_for_user(db_session, "nonexistent", "user-1")
        is False
    )


@pytest.mark.asyncio
async def test_route_job_exists_is_false_for_different_user(db_session):
    await create_route_job(
        db_session,
        job_id="b2222222-2222-2222-2222-222222222222",
        park_id="klaserie",
        requested_by="user-1",
    )

    assert (
        await route_job_exists_for_user(
            db_session,
            "b2222222-2222-2222-2222-222222222222",
            "user-2",
        )
        is False
    )


@pytest.mark.asyncio
async def test_route_job_exists_is_false_for_malformed_id(db_session):
    assert (
        await route_job_exists_for_user(db_session, "not-a-uuid", "user-1")
        is False
    )
