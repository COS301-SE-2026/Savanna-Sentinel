"""
Auth service all login/refresh/logout business logic lives here.

This layer sits between the HTTP router and the data repository
It has no knowledge of FastAPI, HTTP status codes, or the database
"""

from typing import Optional, Union

from fastapi import HTTPException, status
from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.core.security import (
    JWTError,
    create_access_token,
    create_mfa_pending_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import (
    MFAChallengeResponse,
    RegisterRequest,
    TokenResponse,
    TokenUser,
)
from app.services.email_service import send_mfa_code
from app.services.mfa_service import MFAService

# A dummy hash used when the user does not exist.
# This ensures verify_password always runs and response time does not
# reveal whether an username is registered (timing attack prevention).
_DUMMY_HASH = get_password_hash("__dummy_password__")


class AuthService:
    def __init__(self, repo, mfa_service=None, mfa_enabled=None):
        self.repo = repo
        self.mfa_service: MFAService = mfa_service or MFAService()
        self.mfa_enabled = (
            settings.MFA_ENABLED if mfa_enabled is None else mfa_enabled
        )

    async def login(
        self,
        username: str,
        password: str,
    ) -> Optional[Union[TokenResponse, MFAChallengeResponse]]:
        user = await self.repo.get_by_username(username)

        # Always run bcrypt even if user not found prevents timing based
        # username enumeration attacks.
        stored_hash = user.hashed_password if user else _DUMMY_HASH
        password_ok = verify_password(password, stored_hash)

        # Three failure conditions all collapse into a single None return
        if not user or not password_ok or not user.is_active:
            return None

        if self.mfa_enabled and user.role == "admin":
            return await self._start_mfa_challenge(user)

        return await self._issue_tokens(user)

    async def verify_mfa(
        self,
        mfa_token: str,
        code: str,
    ) -> Optional[TokenResponse]:
        user = await self._resolve_pending_user(mfa_token)
        if user is None:
            return None

        ok = await self.mfa_service.verify_code(str(user.id), code)
        if not ok:
            return None

        return await self._issue_tokens(user)

    async def resend_mfa(self, mfa_token: str) -> bool:
        user = await self._resolve_pending_user(mfa_token)
        if user is None:
            return False

        if not await self.mfa_service.can_resend(str(user.id)):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Please wait before requesting a new code",
            )

        await self._dispatch_code(user)
        return True

    async def _start_mfa_challenge(self, user: User) -> MFAChallengeResponse:
        await self._dispatch_code(user)
        return MFAChallengeResponse(
            mfa_token=create_mfa_pending_token(str(user.id)),
            expires_in=settings.MFA_CODE_TTL_SECONDS,
        )

    async def _dispatch_code(self, user: User) -> None:
        code = await self.mfa_service.issue_code(str(user.id))
        await self.mfa_service.start_resend_cooldown(str(user.id))
        await run_in_threadpool(send_mfa_code, user.email, code)

    async def _resolve_pending_user(self, mfa_token: str) -> Optional[User]:
        try:
            payload = decode_token(mfa_token)
        except JWTError:
            return None

        if payload.get("type") != "mfa_pending":
            return None

        user = await self.repo.get_by_id(payload["sub"])
        if not user or not user.is_active:
            return None

        return user

    async def _issue_tokens(self, user: User) -> TokenResponse:
        access_token = create_access_token(str(user.id))
        refresh_token = create_refresh_token(str(user.id))

        await self.repo.save_refresh_token(user.id, refresh_token)

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=TokenUser(
                id=str(user.id),
                username=user.username,
                role=user.role,
            ),
        )

    async def refresh(self, refresh_token: str) -> Optional[TokenResponse]:
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
            user=TokenUser(
                id=str(user.id),
                username=user.username,
                role=user.role,
            ),
        )

    async def logout(self, refresh_token: str) -> None:
        await self.repo.revoke_refresh_token(refresh_token)

    async def register(self, req: RegisterRequest) -> User:
        if await self.repo.get_by_email(req.email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already in use",
            )

        if await self.repo.get_by_username(req.username):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username already in use",
            )

        hashed = get_password_hash(req.password)
        return await self.repo.create(req, hashed)
