from dataclasses import dataclass


@dataclass
class LoginRequest:
    """Body sent by the client to POST /v1/auth/login."""

    username: str
    password: str


@dataclass
class TokenResponse:
    """
    Returned on successful login or refresh.
    Field names here MUST match what the frontends TokenResponse interface expects.
    """

    access_token: str
    refresh_token: str
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