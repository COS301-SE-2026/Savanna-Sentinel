import asyncio
import inspect
import os

from dotenv import load_dotenv

_ENV_PATH = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(_ENV_PATH)

os.environ.setdefault("JWT_SECRET", "Testing-secret-not-used-in-production")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://localhost/savanna_sentinel")

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.models.user import Base


def pytest_configure(config):
    config.addinivalue_line("markers", "asyncio: mark a test function as async")


def pytest_pyfunc_call(pyfuncitem):
    if "asyncio" not in pyfuncitem.keywords:
        return None

    test_function = pyfuncitem.obj
    if not inspect.iscoroutinefunction(test_function):
        return None

    test_arguments = {
        name: pyfuncitem.funcargs[name]
        for name in pyfuncitem._fixtureinfo.argnames
    }

    asyncio.run(test_function(**test_arguments))
    return True


@pytest.fixture(autouse=True)
def setup_env():
    yield

@pytest_asyncio.fixture(scope="function")
async def db_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    testing_session_local = async_sessionmaker(
        bind=engine, class_=AsyncSession, expire_on_commit=False
    )

    async with testing_session_local() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()
