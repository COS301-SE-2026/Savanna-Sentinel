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


async def get_db() -> AsyncGenerator[Optional[object], None]:
    """
    Stub database session dependency.

    Currently yields None — the stub UserRepository ignores this value.

    DB NOTE: Replace this entire function with a real AsyncSession
    generator as shown in the module docstring above.
    """
    yield None