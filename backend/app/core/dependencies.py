"""FastAPI dependencies."""

from typing import AsyncGenerator, Optional

from app.core.config import settings

try:
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    _SQLALCHEMY_AVAILABLE = True
except Exception:
    async_sessionmaker = None  # type: ignore[assignment]
    create_async_engine = None  # type: ignore[assignment]
    _SQLALCHEMY_AVAILABLE = False


_async_session_local = None
if _SQLALCHEMY_AVAILABLE and settings.DATABASE_URL:
    engine = create_async_engine(settings.DATABASE_URL)
    _async_session_local = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[Optional[object], None]:
    if _async_session_local is None:
        yield None
        return

    async with _async_session_local() as session:
        yield session