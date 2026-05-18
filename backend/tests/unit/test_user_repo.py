import pytest
import uuid
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.user import UsersRequest


pytestmark = pytest.mark.asyncio

async def test_get_users_excludes_admins(db_session):
    admin_id = str(uuid.uuid4())
    ranger_id = str(uuid.uuid4())

    admin = User(id=admin_id, username="admin1", role="admin", is_active=True, email="a@test.com", first_name="Admin", last_name="User", hashed_password="mocked_hash")
    ranger = User(id=ranger_id, username="ranger1", role="ranger", is_active=True, email="r@test.com", first_name="Ranger", last_name="User", hashed_password="mocked_Hash")

    db_session.add_all([admin, ranger])
    await db_session.commit()

    repo = UserRepository(db_session)
    request_params = UsersRequest(page=1, page_size=10, is_active=True, role=None)
    results = await repo.get_users(request_params)

    #Ensure only the ranger was grabbed
    assert len(results) == 1
    assert results[0].username == "ranger1"

async def test_get_users_is_active_flag_works(db_session):
    ranger_id = str(uuid.uuid4())
    ranger_id2 = str(uuid.uuid4())
    ranger_id3 = str(uuid.uuid4())
    ranger_id4 = str(uuid.uuid4())

    ranger1 = User(id=ranger_id, username="ranger1", role="ranger", is_active=True, email="r1@test.com", first_name="Ranger", last_name="User", hashed_password="mocked_Hash")
    ranger2 = User(id=ranger_id2, username="ranger2", role="ranger", is_active=False, email="r2@test.com", first_name="Ranger", last_name="User", hashed_password="mocked_Hash")
    ranger3 = User(id=ranger_id3, username="ranger3", role="ranger", is_active=True, email="r3@test.com", first_name="Ranger", last_name="User", hashed_password="mocked_Hash")
    ranger4 = User(id=ranger_id4, username="ranger4", role="ranger", is_active=False, email="r4@test.com", first_name="Ranger", last_name="User", hashed_password="mocked_Hash")
    
    db_session.add_all([ranger1, ranger2, ranger3, ranger4])
    await db_session.commit()

    repo = UserRepository(db_session)
    request_params = UsersRequest(page=1, page_size=10, is_active=True, role=None)
    results = await repo.get_users(request_params)

    request_params2 = UsersRequest(page=1, page_size=10, is_active=False, role=None)
    results2 = await repo.get_users(request_params2)

    assert len(results) == 2
    assert len(results2) == 2
    assert results[0].username == "ranger1"
    assert results[1].username == "ranger3"
    assert results2[0].username == "ranger2"
    assert results2[1].username == "ranger4"