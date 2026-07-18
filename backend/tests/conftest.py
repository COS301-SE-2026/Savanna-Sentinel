import os

from dotenv import load_dotenv

_ENV_PATH = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(_ENV_PATH)

os.environ.setdefault("JWT_SECRET", "Testing-secret-not-used-in-production")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://localhost/savanna_sentinel")

# noqa is due to code NEEDING to be executed before all imports, to fix config errors
import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.dependencies import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.user import Base, User  # noqa: E402


def pytest_configure(config):
    config.addinivalue_line("markers", "asyncio: mark a test function as async")


@pytest.fixture(autouse=True)
def setup_env():
    yield

@pytest_asyncio.fixture(scope="function")
async def db_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    testing_session_local = async_sessionmaker(
        bind=engine, class_=AsyncSession, expire_on_commit=False,
    )

    async with testing_session_local() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest.fixture
def client(db_session):
    async def override_get_db():
        yield db_session
    def override_require_roles():
        return User(
            id="00000000-0000-0000-0000-000000000000",
            username="test_analyst",
            email="analyst@savannasentinel.com",
            first_name="Test",
            last_name="Analyst",
            hashed_password="dummy_hash_for_testing",
            role="analyst",
            is_active=True,
        )

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
