"""
FastAPI dependencies.

DB NOTE: When the database is ready, replace get_db with a real
async SQLAlchemy session factory:

    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
    from app.core.config import settings

    engine = create_async_engine(settings.DATABASE_URL)
    AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

    async def get_db() -> AsyncGenerator[AsyncSession, None]:
        async with AsyncSessionLocal() as session:
            yield session

Then update every router that uses Depends(get_db) the injected value
will change from None to a real AsyncSession, which UserRepository already
accepts as its constructor argument.
"""

from typing import AsyncGenerator, Optional
from app.core.config import settings

try:
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
    SQLALCHEMY_ASYNC_AVAILABLE = True
except Exception:
    SQLALCHEMY_ASYNC_AVAILABLE = False


if SQLALCHEMY_ASYNC_AVAILABLE and settings.DATABASE_URL:
    engine = create_async_engine(settings.DATABASE_URL, future=True)
    AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[Optional[object], None]:
    """
    Yields an `AsyncSession` when `DATABASE_URL` is configured and SQLAlchemy async
    is available. Otherwise yields `None` to preserve existing stub behavior.
    """
    if not (SQLALCHEMY_ASYNC_AVAILABLE and settings.DATABASE_URL):
        yield None
        return

    async with AsyncSessionLocal() as session:
        yield session