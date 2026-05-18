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