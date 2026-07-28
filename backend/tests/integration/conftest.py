"""Shared real-Postgres engine/session fixtures for integration tests."""

import os

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.dependencies import get_db
from app.main import app

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    # sonar:disable:S2068
    "postgresql+asyncpg://sentinel:sentinel_dev_password@localhost:5432/savanna_sentinel",
)


@pytest_asyncio.fixture(scope="session")
async def engine():
    eng = create_async_engine(DATABASE_URL, poolclass=NullPool)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture
async def db_session(engine):
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_session):
    """Async in-process client sharing the test's own event loop and db_session.

    Replaces the root conftest's synchronous TestClient for integration
    tests: TestClient runs requests on its own background thread/loop,
    which is incompatible with sharing an asyncpg-backed session directly.
    """
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="https://test") as ac:
        yield ac
    app.dependency_overrides.pop(get_db, None)
