import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.user import UsersRequest

pytestmark = pytest.mark.asyncio

async def test_get_users_excludes_admins(db_session):
    admin_id = str(uuid.uuid4())
    ranger_id = str(uuid.uuid4())

    admin = User(
        id=admin_id,
        username="admin1",
        role="admin",
        is_active=True,
        email="a@test.com",
        first_name="Admin",
        last_name="User",
        # NOSONAR
        hashed_password="mocked_hash",
        )
    ranger = User(
        id=ranger_id,
        username="ranger1",
        role="ranger",
        is_active=True,
        email="r@test.com",
        first_name="Ranger",
        last_name="User",
        # NOSONAR
        hashed_password="mocked_Hash",
        )

    db_session.add_all([admin, ranger])
    await db_session.commit()

    repo = UserRepository(db_session)
    request_params = UsersRequest(
        page=1,
        page_size=10,
        is_active=True,
        role=None,
        )
    results = await repo.get_users(request_params)

    #Ensure only the ranger was grabbed
    assert len(results) == 1
    assert results[0].username == "ranger1"

async def test_get_users_is_active_flag_works(db_session):
    ranger_id = str(uuid.uuid4())
    ranger_id2 = str(uuid.uuid4())
    ranger_id3 = str(uuid.uuid4())
    ranger_id4 = str(uuid.uuid4())

    ranger1 = User(
        id=ranger_id,
        username="ranger1",
        role="ranger",
        is_active=True,
        email="r1@test.com",
        first_name="Ranger",
        last_name="User",
        # NOSONAR
        hashed_password="mocked_Hash",
        )
    ranger2 = User(
        id=ranger_id2,
        username="ranger2",
        role="ranger",
        is_active=False,
        email="r2@test.com",
        first_name="Ranger",
        last_name="User",
        # NOSONAR
        hashed_password="mocked_Hash",
        )
    ranger3 = User(
        id=ranger_id3,
        username="ranger3",
        role="ranger",
        is_active=True,
        email="r3@test.com",
        first_name="Ranger",
        last_name="User",
        # NOSONAR
        hashed_password="mocked_Hash",
        )
    ranger4 = User(
        id=ranger_id4,
        username="ranger4",
        role="ranger",
        is_active=False,
        email="r4@test.com",
        first_name="Ranger",
        last_name="User",
        # NOSONAR
        hashed_password="mocked_Hash",
        )

    db_session.add_all([ranger1, ranger2, ranger3, ranger4])
    await db_session.commit()

    repo = UserRepository(db_session)
    request_params = UsersRequest(
        page=1,
        page_size=10,
        is_active=True,
        role=None,
        )
    results = await repo.get_users(request_params)

    request_params2 = UsersRequest(
        page=1,
        page_size=10,
        is_active=False,
        role=None,
        )
    results2 = await repo.get_users(request_params2)

    assert len(results) == 2
    assert len(results2) == 2
    assert results[0].username == "ranger1"
    assert results[1].username == "ranger3"
    assert results2[0].username == "ranger2"
    assert results2[1].username == "ranger4"

async def test_get_users_role_filter_works(db_session):
    ranger_id = str(uuid.uuid4())
    ranger_id2 = str(uuid.uuid4())
    analyst_id = str(uuid.uuid4())
    liasion_id = str(uuid.uuid4())

    ranger1 = User(
        id=ranger_id,
        username="ranger1",
        role="ranger",
        is_active=True,
        email="r1@test.com",
        first_name="Ranger",
        last_name="One",
        # NOSONAR
        hashed_password="mocked_Hash",
        )
    ranger2 = User(
        id=ranger_id2,
        username="ranger2",
        role="ranger",
        is_active=True,
        email="r2@test.com",
        first_name="Ranger",
        last_name="Two",
        # NOSONAR
        hashed_password="mocked_Hash",
        )
    analyst1 = User(
        id=analyst_id,
        username="analyst1",
        role="analyst",
        is_active=True,
        email="a1@test.com",
        first_name="Analyst",
        last_name="One",
        # NOSONAR
        hashed_password="mocked_Hash",
        )
    liasion1 = User(
        id=liasion_id,
        username="liasion1",
        role="community_liaison",
        is_active=True,
        email="l1@test.com",
        first_name="Liasion",
        last_name="One",
        # NOSONAR
        hashed_password="mocked_Hash",
        )

    db_session.add_all([ranger1, ranger2, analyst1, liasion1])
    await db_session.commit()

    repo = UserRepository(db_session)

    request_params_ranger = UsersRequest(
        page=1,
        page_size=10,
        is_active=True,
        role="ranger",
        )
    ranger_results = await repo.get_users(request_params_ranger)

    request_params_analyst = UsersRequest(
        page=1,
        page_size=10,
        is_active=True,
        role="analyst",
        )
    analyst_results = await repo.get_users(request_params_analyst)

    assert len(ranger_results) == 2
    assert ranger_results[0].username == "ranger1"
    assert ranger_results[1].username == "ranger2"
    assert ranger_results[0].role == "ranger"

    assert len(analyst_results) == 1
    assert analyst_results[0].username == "analyst1"
    assert analyst_results[0].role == "analyst"

async def test_get_users_pagination_works(db_session):
    u1 = User(
        id=str(uuid.uuid4()),
        username="user1",
        role="ranger",
        is_active=True,
        email="u1@test.com",
        first_name="A",
        last_name="B",
        # NOSONAR
        hashed_password="x",
        )
    u2 = User(
        id=str(uuid.uuid4()),
        username="user2",
        role="ranger",
        is_active=True,
        email="u2@test.com",
        first_name="A",
        last_name="B",
        # NOSONAR
        hashed_password="x",
        )
    u3 = User(
        id=str(uuid.uuid4()),
        username="user3",
        role="ranger",
        is_active=True,
        email="u3@test.com",
        first_name="A",
        last_name="B",
        # NOSONAR
        hashed_password="x",
        )

    db_session.add_all([u1, u2, u3])
    await db_session.commit()

    repo = UserRepository(db_session)

    request_params = UsersRequest(
        page=2,
        page_size=2,
        is_active=True,
        role=None,
        )
    results = await repo.get_users(request_params)

    assert len(results) == 1
    assert results[0].username == "user3"


async def test_count_users_excludes_admins(db_session):
    admin1 = User(
        id=str(uuid.uuid4()),
        username="admin1",
        role="admin",
        is_active=True,
        email="a1@test.com",
        first_name="Admin",
        last_name="One",
        # NOSONAR
        hashed_password="mocked_Hash",
        )
    admin2 = User(
        id=str(uuid.uuid4()),
        username="admin2",
        role="admin",
        is_active=False,
        email="a2@test.com",
        first_name="Admin",
        last_name="Two",
        # NOSONAR
        hashed_password="mocked_Hash",
        )
    ranger1 = User(
        id=str(uuid.uuid4()),
        username="ranger1",
        role="ranger",
        is_active=True,
        email="r1@test.com",
        first_name="Ranger",
        last_name="One",
        # NOSONAR
        hashed_password="mocked_Hash",
        )
    ranger2 = User(
        id=str(uuid.uuid4()),
        username="ranger2",
        role="ranger",
        is_active=False,
        email="r2@test.com",
        first_name="Ranger",
        last_name="Two",
        # NOSONAR
        hashed_password="mocked_Hash",
        )

    db_session.add_all([admin1, admin2, ranger1, ranger2])
    await db_session.commit()

    repo = UserRepository(db_session)

    request_active = UsersRequest(
        page=1,
        page_size=10,
        is_active=True,
        role=None,
        )
    active_count = await repo.count_users(request_active)

    request_inactive = UsersRequest(
        page=1,
        page_size=10,
        is_active=False,
        role=None,
        )
    inactive_count = await repo.count_users(request_inactive)

    assert active_count == 1
    assert inactive_count == 1

async def test_switch_status_deactivate_successful(db_session):
    user_id = str(uuid.uuid4())
    test_user = User(
        id=user_id,
        username="active_user",
        role="ranger",
        is_active=True,
        email="u@test.com",
        first_name="Test",
        last_name="User",
        # NOSONAR
        hashed_password="mocked_hash",
        )

    db_session.add_all([test_user])
    await db_session.commit()

    repo = UserRepository(db_session)

    updated_user = await repo.switch_status(is_active=False, user_id=user_id)

    assert updated_user is not None
    assert updated_user.is_active is False
    await db_session.refresh(test_user)
    assert test_user.is_active is False

async def test_switch_status_activate_successful(db_session):
    user_id = str(uuid.uuid4())
    test_user = User(
        id=user_id,
        username="inactive_user",
        role="ranger",
        is_active=False,
        email="u@test.com",
        first_name="Test",
        last_name="User",
        # NOSONAR
        hashed_password="mocked_hash",
        )

    db_session.add_all([test_user])
    await db_session.commit()

    repo = UserRepository(db_session)

    updated_user = await repo.switch_status(is_active=True, user_id=user_id)

    assert updated_user is not None
    assert updated_user.is_active is True
    await db_session.refresh(test_user)
    assert test_user.is_active is True

async def test_swtich_status_user_not_found(db_session):
    no_user_id = str(uuid.uuid4())
    repo = UserRepository(db_session)

    result = await repo.switch_status(is_active=True, user_id=no_user_id)

    assert result is None

async def test_admin_delete_user_success(db_session):
    user_id = str(uuid.uuid4())
    test_user = User(
        id=user_id,
        username="target_user",
        role="ranger",
        is_active=False,
        email="u@test.com",
        first_name="Test",
        last_name="User",
        # NOSONAR
        hashed_password="mocked_hash",
        )

    db_session.add_all([test_user])
    await db_session.commit()

    repo = UserRepository(db_session)

    deleted_user = await repo.admin_delete(user_id=user_id)

    assert deleted_user is not None
    assert deleted_user.id == user_id
    assert deleted_user.username == "target_user"

    stmt = select(User).where(User.id == user_id)
    result = await db_session.execute(stmt)
    db_user = result.scalar_one_or_none()
    assert db_user is None

async def test_admin_delete_user_not_found(db_session):
    no_user_id = str(uuid.uuid4())
    repo = UserRepository(db_session)

    result = await repo.admin_delete(user_id=no_user_id)

    assert result is None

async def test_update_role_success(db_session):
    user_id = str(uuid.uuid4())
    test_user = User(
        id=user_id,
        username="role_user",
        role="ranger",
        is_active=True,
        email="role@test.com",
        first_name="Role",
        last_name="User",
        # NOSONAR
        hashed_password="mocked_hash",
        )

    db_session.add(test_user)
    await db_session.commit()

    repo = UserRepository(db_session)
    updated = await repo.update_role(user_id=user_id, new_role="analyst")

    assert updated is not None
    assert updated.role == "analyst"
    await db_session.refresh(test_user)
    assert test_user.role == "analyst"

async def test_update_role_user_not_found(db_session):
    repo = UserRepository(db_session)
    result = await repo.update_role(
        user_id=str(uuid.uuid4()),
        new_role="analyst",
        )
    assert result is None


async def test_save_user_persists_and_refreshes(db_session):
    """Test that save_user() commits changes and refreshes the user from DB."""
    user_id = str(uuid.uuid4())
    user = User(
        id=user_id,
        username="save_test",
        role="ranger",
        is_active=True,
        email="save@test.com",
        first_name="Save",
        last_name="Test",
        # NOSONAR
        hashed_password="hash1",
        )

    db_session.add(user)
    await db_session.commit()

    # Modify the user in memory
    user.first_name = "Modified"
    user.last_name = "Name"

    repo = UserRepository(db_session)
    saved_user = await repo.save_user(user)

    # Verify the save persisted
    assert saved_user.first_name == "Modified"
    assert saved_user.last_name == "Name"

    # Verify it was actually committed to DB by fetching fresh
    fresh_user = await repo.get_by_id(user_id)
    assert fresh_user.first_name == "Modified"
    assert fresh_user.last_name == "Name"


async def test_soft_delete_user_success(db_session):
    user_id = str(uuid.uuid4())
    user = User(
        id=user_id, username="active1", role="ranger", is_active=True,
        email="a1@test.com", first_name="A", last_name="One",
        hashed_password="hash",  # NOSONAR
    )
    db_session.add(user)
    await db_session.commit()

    repo = UserRepository(db_session)
    result = await repo.soft_delete_user(user_id)

    assert result.is_active is False
    assert result.deleted_at is not None


async def test_soft_delete_user_already_inactive_returns_none(db_session):
    user_id = str(uuid.uuid4())
    user = User(
        id=user_id, username="pending1", role="ranger", is_active=False,
        email="p1@test.com", first_name="P", last_name="One",
        hashed_password="hash",  # NOSONAR
    )
    db_session.add(user)
    await db_session.commit()

    repo = UserRepository(db_session)
    result = await repo.soft_delete_user(user_id)

    assert result is None


async def test_soft_delete_user_already_deleted_returns_none(db_session):
    user_id = str(uuid.uuid4())
    user = User(
        id=user_id, username="gone1", role="ranger", is_active=False,
        deleted_at=datetime.now(timezone.utc),
        email="g1@test.com", first_name="G", last_name="One",
        hashed_password="hash",  # NOSONAR
    )
    db_session.add(user)
    await db_session.commit()

    repo = UserRepository(db_session)
    result = await repo.soft_delete_user(user_id)

    assert result is None


async def test_soft_delete_user_not_found_returns_none(db_session):
    repo = UserRepository(db_session)
    result = await repo.soft_delete_user(str(uuid.uuid4()))

    assert result is None


async def test_get_users_excludes_soft_deleted(db_session):
    active_id = str(uuid.uuid4())
    deleted_id = str(uuid.uuid4())
    active = User(
        id=active_id, username="stays", role="ranger", is_active=True,
        email="stays@test.com", first_name="S", last_name="One",
        hashed_password="hash",  # NOSONAR
    )
    deleted = User(
        id=deleted_id, username="gone2", role="ranger", is_active=False,
        deleted_at=datetime.now(timezone.utc),
        email="gone2@test.com", first_name="G", last_name="Two",
        hashed_password="hash",  # NOSONAR
    )
    db_session.add_all([active, deleted])
    await db_session.commit()

    repo = UserRepository(db_session)
    active_results = await repo.get_users(
        UsersRequest(page=1, page_size=10, is_active=True, role=None),
    )
    pending_results = await repo.get_users(
        UsersRequest(page=1, page_size=10, is_active=False, role=None),
    )

    assert [u.username for u in active_results] == ["stays"]
    # the soft-deleted user is_active=False now, but must NOT leak into
    # the "pending registrations" list alongside real pending accounts
    assert "gone2" not in [u.username for u in pending_results]


async def test_count_users_excludes_soft_deleted(db_session):
    deleted = User(
        id=str(uuid.uuid4()), username="gone3", role="ranger",
        is_active=False, deleted_at=datetime.now(timezone.utc),
        email="gone3@test.com", first_name="G", last_name="Three",
        hashed_password="hash",  # NOSONAR
    )
    db_session.add(deleted)
    await db_session.commit()

    repo = UserRepository(db_session)
    count = await repo.count_users(
        UsersRequest(page=1, page_size=10, is_active=False, role=None),
    )

    assert count == 0


async def test_admin_delete_rejects_active_user(db_session):
    user_id = str(uuid.uuid4())
    user = User(
        id=user_id, username="active2", role="ranger", is_active=True,
        email="a2@test.com", first_name="A", last_name="Two",
        hashed_password="hash",  # NOSONAR
    )
    db_session.add(user)
    await db_session.commit()

    repo = UserRepository(db_session)
    result = await repo.admin_delete(user_id)

    assert result is None
    stmt = select(User).where(User.id == user_id)
    assert (await db_session.execute(stmt)).scalar_one_or_none() is not None


async def test_admin_delete_rejects_already_soft_deleted(db_session):
    user_id = str(uuid.uuid4())
    user = User(
        id=user_id, username="gone4", role="ranger", is_active=False,
        deleted_at=datetime.now(timezone.utc),
        email="g4@test.com", first_name="G", last_name="Four",
        hashed_password="hash",  # NOSONAR
    )
    db_session.add(user)
    await db_session.commit()

    repo = UserRepository(db_session)
    result = await repo.admin_delete(user_id)

    assert result is None


async def test_admin_delete_still_works_on_pending_account(db_session):
    user_id = str(uuid.uuid4())
    user = User(
        id=user_id, username="pending2", role="ranger", is_active=False,
        email="p2@test.com", first_name="P", last_name="Two",
        hashed_password="hash",  # NOSONAR
    )
    db_session.add(user)
    await db_session.commit()

    repo = UserRepository(db_session)
    result = await repo.admin_delete(user_id)

    assert result is not None
