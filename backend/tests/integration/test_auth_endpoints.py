"""
Integration tests for POST /v1/auth/register

Hit the real database through the FastAPI ASGI app.
All test users use the 'test_' prefix so the autouse fixture can clean them up.
"""

import asyncio
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.core.config import settings
from app.core.dependencies import get_db
from app.main import app

_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
_Session = async_sessionmaker(_engine, expire_on_commit=False)


async def _override_get_db():
    async with _Session() as session:
        yield session


app.dependency_overrides[get_db] = _override_get_db


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def _payload(**overrides):
    base = {
        "username": "test_ranger",
        "email": "test_ranger@example.com",
        "password": "SecurePass1!",
        "first_name": "Test",
        "last_name": "Ranger",
        "requested_role": "ranger",
    }
    return {**base, **overrides}


@pytest.fixture(autouse=True)
def cleanup_test_users():
    yield
    async def _delete():
        async with _engine.begin() as conn:
            await conn.execute(text("DELETE FROM users WHERE username LIKE 'test_%'"))
    asyncio.run(_delete())