"""
Auth router POST /v1/auth/login, /v1/auth/refresh, /v1/auth/logout

This file is the HTTP layer only. Business logic lives in AuthService.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dependencies import get_db
from app.schemas.auth import LoginRequest, TokenResponse, RefreshRequest, LogoutRequest
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])

# Single reusable 401 exception
_INVALID_CREDENTIALS = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid credentials",
    headers={"WWW-Authenticate": "Bearer"},
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
    """
    Validates username and password.
    Returns access + refresh tokens on success.
    Returns a single vague 401 on ANY failure,
    the response must not reveal whether the username exists, the password
    is wrong, or the account is inactive.
    """
    service = AuthService(db)
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
    """
    Accepts a valid refresh token and returns a new access token
    Rotates the refresh token on every call
    Returns 401 if the token is invalid, expired, or revoked
    """
    service = AuthService(db)
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
    Revokes the supplied refresh token server-side
    Always returns 204 even if the token was already revoked or never existed
    """
    service = AuthService(db)
    await service.logout(body.refresh_token)