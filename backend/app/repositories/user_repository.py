"""Repository used by auth to resolve users and refresh tokens."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import uuid
from typing import Optional

from app.core.security import JWTError, decode_token, get_password_hash

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


# Stub data model
# Mirrors the real User ORM model that will exist once the DB is wired up.

@dataclass
class UserRecord:
    id: str
    username: str
    hashed_password: str
    is_active: bool
    role: str


# Seed data
# Two test users pre loaded so the frontend team can log in immediately.
# DB NOTE: Delete this entire block when connecting to the real database.

_STUB_USERS: dict[str, UserRecord] = {
    "ranger": UserRecord(
        id="user-001",
        username="ranger",
        hashed_password=get_password_hash("SecurePass1!"),
        is_active=True,
        role="ranger",
    ),
    "inactive": UserRecord(
        id="user-002",
        username="inactive",
        hashed_password=get_password_hash("SecurePass1!"),
        is_active=False,      # tests the inactive-account 401 path
        role="analyst",
    ),
}

# In memory refresh token store (user_id to set of valid token strings)
# DB NOTE: Replace with a refresh_tokens table in the real database.
_REFRESH_TOKENS: dict[str, set[str]] = {}


# Repository class
class UserRepository:
    """
    Provides data access for the auth service.

    STUB IMPLEMENTATION all data lives in the dicts above.

    DB NOTE: Replace this class body with async SQLAlchemy queries.
    Constructor signature must stay the same:
        def __init__(self, db: AsyncSession): ...
    """

    def __init__(self, db=None):
        self.db = db

    async def get_by_username(self, username: str) -> Optional[UserRecord]:
        """
        Returns a UserRecord for the given username, or None if not found.

        DB NOTE: Replace with:
            result = await self.db.execute(
                select(User).where(User.username == username)
            )
            return result.scalar_one_or_none()
        """
        if _SQLALCHEMY_AVAILABLE and self.db is not None:
            stmt = select(User).where((User.username == username) | (User.email == username))
            result = await self.db.execute(stmt)
            user = result.scalar_one_or_none()
            if user is not None:
                return user

        user = _STUB_USERS.get(username)
        if user is not None:
            return user

        local_part = username.split("@", 1)[0]
        return _STUB_USERS.get(local_part)

    async def save_refresh_token(self, user_id: str, token: str) -> None:
        """
        Persists a refresh token so it can be validated and later revoked.

        DB NOTE: Replace with an INSERT into a refresh_tokens table.
        Store a hash of the token, not the raw token string, for security.
        """
        if _SQLALCHEMY_AVAILABLE and self.db is not None:
            try:
                payload = decode_token(token)
            except JWTError:
                return

            self.db.add(
                RefreshToken(
                    jti=uuid.UUID(payload["jti"]),
                    user_id=uuid.UUID(str(user_id)),
                    expires_at=datetime.fromtimestamp(int(payload["exp"]), tz=timezone.utc),
                )
            )
            await self.db.commit()
            return

        if user_id not in _REFRESH_TOKENS:
            _REFRESH_TOKENS[user_id] = set()
        _REFRESH_TOKENS[user_id].add(token)

    async def get_user_by_refresh_token(self, token: str) -> Optional[UserRecord]:
        """
        Returns the user who owns this refresh token, or None if it is
        invalid or has been revoked.

        DB NOTE: Replace with a JOIN query between refresh_tokens and users,
        filtering by token hash and checking expiry and is_revoked.
        """
        if _SQLALCHEMY_AVAILABLE and self.db is not None:
            try:
                payload = decode_token(token)
            except JWTError:
                return None

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

        for user_id, tokens in _REFRESH_TOKENS.items():
            if token in tokens:
                for user in _STUB_USERS.values():
                    if user.id == user_id:
                        return user
        return None

    async def revoke_refresh_token(self, token: str) -> None:
        """
        Marks a refresh token as revoked so it cannot be used again.

        DB NOTE: Replace with:
            UPDATE refresh_tokens SET is_revoked = true WHERE token_hash = hash(token)
        """
        if _SQLALCHEMY_AVAILABLE and self.db is not None:
            try:
                payload = decode_token(token)
            except JWTError:
                return

            stmt = update(RefreshToken).where(RefreshToken.jti == uuid.UUID(payload["jti"])).values(
                revoked_at=datetime.now(timezone.utc)
            )
            await self.db.execute(stmt)
            await self.db.commit()
            return

        for tokens in _REFRESH_TOKENS.values():
            tokens.discard(token)

    async def revoke_all_refresh_tokens(self, user_id: str) -> None:
        """
        Revokes every refresh token for this user.

        DB NOTE: Replace with:
            UPDATE refresh_tokens SET is_revoked = true WHERE user_id = :user_id
        """
        if _SQLALCHEMY_AVAILABLE and self.db is not None:
            stmt = update(RefreshToken).where(RefreshToken.user_id == uuid.UUID(str(user_id))).values(
                revoked_at=datetime.now(timezone.utc)
            )
            await self.db.execute(stmt)
            await self.db.commit()
            return

        _REFRESH_TOKENS.pop(user_id, None)