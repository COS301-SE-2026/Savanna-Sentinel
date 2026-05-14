"""Repository used by auth to resolve users and refresh tokens."""

from __future__ import annotations

from datetime import datetime, timezone
import uuid
from typing import Optional

from app.core.security import decode_token

try:
    from sqlalchemy import select, update
    from app.models.refresh_token import RefreshToken
    from app.models.user import User

    _SQLALCHEMY_AVAILABLE = True
except Exception:
    select = update = None  # type: ignore[assignment]
    RefreshToken = None  # type: ignore[assignment]
    User = None  # type: ignore[assignment]
    _SQLALCHEMY_AVAILABLE = False


class UserRepository:
    """DB-backed repository for auth lookups and refresh-token persistence."""

    def __init__(self, db):
        if db is None:
            raise ValueError("UserRepository requires an async database session")
        self.db = db

    async def get_by_username(self, username: str) -> Optional[object]:
        """Return the matching user row by username only."""
        if not _SQLALCHEMY_AVAILABLE:
            raise RuntimeError("SQLAlchemy async support is required")

        stmt = select(User).where(User.username == username)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def save_refresh_token(self, user_id: str, token: str) -> None:
        """Persist a refresh token in the refresh_tokens table."""
        if not _SQLALCHEMY_AVAILABLE:
            raise RuntimeError("SQLAlchemy async support is required")

        payload = decode_token(token)
        self.db.add(
            RefreshToken(
                jti=uuid.UUID(payload["jti"]),
                user_id=uuid.UUID(str(user_id)),
                expires_at=datetime.fromtimestamp(int(payload["exp"]), tz=timezone.utc),
            )
        )
        await self.db.commit()

    async def get_user_by_refresh_token(self, token: str) -> Optional[object]:
        """Return the user that owns a valid refresh token."""
        if not _SQLALCHEMY_AVAILABLE:
            raise RuntimeError("SQLAlchemy async support is required")

        payload = decode_token(token)
        stmt = (
            select(User)
            .join(RefreshToken, RefreshToken.user_id == User.id)
            .where(
                RefreshToken.jti == uuid.UUID(payload["jti"]),
                RefreshToken.revoked_at.is_(None),
                RefreshToken.expires_at > datetime.now(timezone.utc),
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def revoke_refresh_token(self, token: str) -> None:
        """Mark one refresh token as revoked."""
        if not _SQLALCHEMY_AVAILABLE:
            raise RuntimeError("SQLAlchemy async support is required")

        payload = decode_token(token)
        stmt = update(RefreshToken).where(RefreshToken.jti == uuid.UUID(payload["jti"])).values(
            revoked_at=datetime.now(timezone.utc)
        )
        await self.db.execute(stmt)
        await self.db.commit()

    async def revoke_all_refresh_tokens(self, user_id: str) -> None:
        """Revoke every refresh token for a given user."""
        if not _SQLALCHEMY_AVAILABLE:
            raise RuntimeError("SQLAlchemy async support is required")

        stmt = update(RefreshToken).where(RefreshToken.user_id == uuid.UUID(str(user_id))).values(
            revoked_at=datetime.now(timezone.utc)
        )
        await self.db.execute(stmt)
        await self.db.commit()
