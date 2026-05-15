"""
Auth service all login/refresh/logout business logic lives here.

This layer sits between the HTTP router and the data repository
It has no knowledge of FastAPI, HTTP status codes, or the database
"""

from typing import Optional

from app.core.security import (
    JWTError,
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.repositories.user_repository import UserRepository
from app.schemas.auth import TokenResponse


# A dummy hash used when the user does not exist.
# This ensures verify_password always runs and response time does not
# reveal whether an username is registered (timing attack prevention).
_DUMMY_HASH = get_password_hash("__dummy_password__")


class AuthService:
    def __init__(self, db=None, repo=None):
        """
        DB NOTE: Change to `def __init__(self, db: AsyncSession):`
        once the real database is connected.
        """
        self.repo = repo or UserRepository(db)

    async def login(self, username: str, password: str) -> Optional[TokenResponse]:
        """
        Validates credentials and returns tokens on success.

        Returns None on ANY failure wrong password, unknown username,
        or inactive account. The router converts None into a single
        vague 401 response.
        """
        user = await self.repo.get_by_username(username)

        # Always run bcrypt even if user not found prevents timing based
        # username enumeration attacks.
        stored_hash = user.hashed_password if user else _DUMMY_HASH
        password_ok = verify_password(password, stored_hash)

        # Three failure conditions all collapse into a single None return
        if not user or not password_ok or not user.is_active:
            return None

        access_token = create_access_token(str(user.id))
        refresh_token = create_refresh_token(str(user.id))

        await self.repo.save_refresh_token(user.id, refresh_token)

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
        )

    async def refresh(self, refresh_token: str) -> Optional[TokenResponse]:
        """
        Validates a refresh token and issues a new access token.

        Returns None if the token is invalid, expired, or revoked.
        """
        try:
            payload = decode_token(refresh_token)
        except JWTError:
            return None

        # Reject access tokens used as refresh tokens
        if payload.get("type") != "refresh":
            return None

        # Verify the token is in our store (not revoked)
        user = await self.repo.get_user_by_refresh_token(refresh_token)
        if not user or not user.is_active:
            return None

        # Rotate: revoke the old token and issue both tokens fresh
        await self.repo.revoke_refresh_token(refresh_token)
        new_access = create_access_token(str(user.id))
        new_refresh = create_refresh_token(str(user.id))
        await self.repo.save_refresh_token(user.id, new_refresh)

        return TokenResponse(
            access_token=new_access,
            refresh_token=new_refresh,
        )

    async def logout(self, refresh_token: str) -> None:
        """
        Revokes the refresh token so it cannot be used again.
        Silently succeeds even if the token was already revoked or invalid.
        """
        await self.repo.revoke_refresh_token(refresh_token)
