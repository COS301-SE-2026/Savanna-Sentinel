"""
User repository.

Currently uses an IN MEMORY stub so the auth API can be developed and tested
without a database connection.

DB NOTE: When the database is ready, replace the stub class body below with
real SQLAlchemy async queries. The method signatures (names, parameters, return
types) must not change the auth service depends on this exact interface.

The in memory USERS dict and RefreshTokenStore class should be deleted entirely
when moving to the real database.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional
import uuid as _uuid
from datetime import datetime, timezone

from app.core.security import get_password_hash, decode_token, JWTError
try:
    from sqlalchemy import select, update
    from sqlalchemy.ext.asyncio import AsyncSession
    from app.models.user import User
    from app.models.refresh_token import RefreshToken
    SQLALCHEMY_AVAILABLE = True
except Exception:
    SQLALCHEMY_AVAILABLE = False


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
        """
        db is unused in the stub.
        DB NOTE: Change to `def __init__(self, db: AsyncSession):`
        and store `self.db = db` for use in queries.
        """
        # store DB session (may be None for the in-memory stub)
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
        # If SQLAlchemy session provided, query the users table
        if SQLALCHEMY_AVAILABLE and self.db is not None:
            # support login by username or email
            stmt = select(User).where((User.username == username) | (User.email == username))
            try:
                result = await self.db.execute(stmt)
                user = result.scalar_one_or_none()
                return user
            except Exception:
                # fallback to stub if DB query fails
                pass

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
        # If SQLAlchemy is available and we have a DB session, persist the refresh token
        if SQLALCHEMY_AVAILABLE and self.db is not None:
            try:
                payload = decode_token(token)
            except JWTError:
                return

            jti = _uuid.UUID(payload.get("jti"))
            expires_at = datetime.fromtimestamp(int(payload.get("exp")), tz=timezone.utc)

            rt = RefreshToken(jti=jti, user_id=_uuid.UUID(user_id), expires_at=expires_at)
            self.db.add(rt)
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
        # If DB available, decode token and lookup refresh_tokens join users
        if SQLALCHEMY_AVAILABLE and self.db is not None:
            try:
                payload = decode_token(token)
            except JWTError:
                return None

            jti = _uuid.UUID(payload.get("jti"))
            now = datetime.now(timezone.utc)
            stmt = select(User).join(RefreshToken, User.id == RefreshToken.user_id).where(
                RefreshToken.jti == jti,
                RefreshToken.revoked_at.is_(None),
                RefreshToken.expires_at > now,
            )
            try:
                result = await self.db.execute(stmt)
                user = result.scalar_one_or_none()
                return user
            except Exception:
                return None

        for user_id, tokens in _REFRESH_TOKENS.items():
            if token in tokens:
                # Find the user record that matches this user_id
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
        if SQLALCHEMY_AVAILABLE and self.db is not None:
            try:
                payload = decode_token(token)
            except JWTError:
                return
            jti = _uuid.UUID(payload.get("jti"))
            stmt = update(RefreshToken).where(RefreshToken.jti == jti).values(revoked_at=datetime.now(timezone.utc))
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
        if SQLALCHEMY_AVAILABLE and self.db is not None:
            stmt = update(RefreshToken).where(RefreshToken.user_id == _uuid.UUID(user_id)).values(revoked_at=datetime.now(timezone.utc))
            await self.db.execute(stmt)
            await self.db.commit()
            return

        _REFRESH_TOKENS.pop(user_id, None)