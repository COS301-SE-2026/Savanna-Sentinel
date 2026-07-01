"""
Auth router POST /v1/auth/login, /v1/auth/refresh, /v1/auth/logout.

This file is the HTTP layer only. Business logic lives in AuthService.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dependencies import get_db
from app.repositories.user_repository import UserRepository
from app.schemas.auth import (
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])

# Single reusable 401 exception
_INVALID_CREDENTIALS = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
)
async def register(
    body: RegisterRequest,
    db=Depends(get_db),
):
    service = AuthService(UserRepository(db))
    user = await service.register(body)
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Log in and receive JWT tokens",
)
async def login(
    body: LoginRequest,
    db=Depends(get_db),
):
    service = AuthService(UserRepository(db))
    result = await service.login(body.username, body.password)
    if result is None:
        raise _INVALID_CREDENTIALS
    return result


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Exchange a refresh token for new tokens",
)
async def refresh(
    body: RefreshRequest,
    db=Depends(get_db),
):
    service = AuthService(UserRepository(db))
    result = await service.refresh(body.refresh_token)
    if result is None:
        raise _INVALID_CREDENTIALS
    return result


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke a refresh token",
)
async def logout(
    body: LogoutRequest,
    db=Depends(get_db),
):
    """
    Revokes the supplied refresh token server-side.

    Always returns 204 even if the token was already revoked or never existed
    """
    service = AuthService(UserRepository(db))
    await service.logout(body.refresh_token)
