from dataclasses import dataclass
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, EmailStr, field_validator


class RequestedRole(str, Enum):
    ranger = "ranger"
    analyst = "analyst"
    community_liaison = "community_liaison"


class RegisterRequest(BaseModel):
    """Body sent by the client to POST /v1/auth/register."""

    username: str
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    requested_role: RequestedRole

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class UserResponse(BaseModel):
    """Returned after successful registration by user management endpoints."""

    id: str
    username: str
    email: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


@dataclass
class LoginRequest:
    """Body sent by the client to POST /v1/auth/login."""

    username: str
    password: str


@dataclass
class TokenUser:
    """Minimal user info embedded in every token response."""

    id: str
    username: str
    role: str


@dataclass
class TokenResponse:
    """
    Returned on successful login or refresh.

    Field names here MUST match what the frontends TokenResponse
    interface expects.
    """

    access_token: str
    refresh_token: str
    user: TokenUser
    token_type: str = "bearer"
    expires_in: int = 3600


@dataclass
class RefreshRequest:
    """Body sent by the client to POST /v1/auth/refresh."""

    refresh_token: str


@dataclass
class LogoutRequest:
    """Body sent by the client to POST /v1/auth/logout."""

    refresh_token: str


@dataclass
class MFAChallengeResponse:
    """Returned from /login instead of tokens when the account requires MFA."""

    mfa_token: str
    expires_in: int
    mfa_required: bool = True


@dataclass
class MFAVerifyRequest:
    """Body sent by the client to POST /v1/auth/mfa/verify."""

    mfa_token: str
    code: str


@dataclass
class MFAResendRequest:
    """Body sent by the client to POST /v1/auth/mfa/resend."""

    mfa_token: str
