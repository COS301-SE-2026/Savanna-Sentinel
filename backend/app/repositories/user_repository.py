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

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.models.user import User
from app.schemas.auth import RegisterRequest


# Stub data model
# Mirrors the real User ORM model that will exist once the DB is wired up.

@dataclass
class UserRecord:
    id: str
    username: str
    email: str
    first_name: str
    last_name: str
    hashed_password: str
    is_active: bool
    role: str
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


# Seed data
# Two test users pre loaded so the frontend team can log in immediately.
# DB NOTE: Delete this entire block when connecting to the real database.

_STUB_USERS: dict[str, UserRecord] = {
    "ranger": UserRecord(
        id="user-001",
        username="ranger",
        email="ranger@savanna.com",
        first_name="Test",
        last_name="Ranger",
        hashed_password=get_password_hash("SecurePass1!"),
        is_active=True,
        role="ranger",
    ),
    "inactive": UserRecord(
        id="user-002",
        username="inactive",
        email="inactive@savanna.com",
        first_name="Inactive",
        last_name="User",
        hashed_password=get_password_hash("SecurePass1!"),
        is_active=False,      # tests the inactive-account 401 path
        role="analyst",
    ),
}

# Secondary index by email for fast lookup
_STUB_USERS_BY_EMAIL: dict[str, UserRecord] = {
    u.email: u for u in _STUB_USERS.values()
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

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_username(self, username: str) -> Optional[User]:
        result = await self.db.execute(select(User).where(User.username == username))
        return result.scalar_one_or_none()

    async def save_refresh_token(self, user_id: str, token: str) -> None:
        """
        Persists a refresh token so it can be validated and later revoked.

        DB NOTE: Replace with an INSERT into a refresh_tokens table.
        Store a hash of the token, not the raw token string, for security.
        """
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
        for tokens in _REFRESH_TOKENS.values():
            tokens.discard(token)

    async def revoke_all_refresh_tokens(self, user_id: str) -> None:
        """
        Revokes every refresh token for this user.

        DB NOTE: Replace with:
            UPDATE refresh_tokens SET is_revoked = true WHERE user_id = :user_id
        """
        _REFRESH_TOKENS.pop(user_id, None)

    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self.db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def create(self, req: RegisterRequest, hashed_password: str) -> User:
        user = User(
            username=req.username,
            email=req.email,
            first_name=req.first_name,
            last_name=req.last_name,
            hashed_password=hashed_password,
            role=req.requested_role.value,
            is_active=False,
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user