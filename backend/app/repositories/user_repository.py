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

from app.core.security import get_password_hash


# Stub data model
# Mirrors the real User ORM model that will exist once the DB is wired up.

@dataclass
class UserRecord:
    id: str
    email: str
    hashed_password: str
    is_active: bool
    role: str


# Seed data
# Two test users pre loaded so the frontend team can log in immediately.
# DB NOTE: Delete this entire block when connecting to the real database.

_STUB_USERS: dict[str, UserRecord] = {
    "ranger@savana.test": UserRecord(
        id="user-001",
        email="ranger@savana.test",
        hashed_password=get_password_hash("SecurePass1!"),
        is_active=True,
        role="ranger",
    ),
    "inactive@savana.test": UserRecord(
        id="user-002",
        email="inactive@savana.test",
        hashed_password=get_password_hash("SecurePass1!"),
        is_active=False,      # tests the inactive-account 401 path
        role="analyst",
    ),
}

# In memory refresh token store (email to set of valid token strings)
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
        pass

    async def get_by_email(self, email: str) -> Optional[UserRecord]:
        """
        Returns a UserRecord for the given email, or None if not found.

        DB NOTE: Replace with:
            result = await self.db.execute(
                select(User).where(User.email == email)
            )
            return result.scalar_one_or_none()
        """
        return _STUB_USERS.get(email)

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