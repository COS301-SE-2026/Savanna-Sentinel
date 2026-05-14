from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    """Body sent by the client to POST /v1/auth/login."""
    username: str
    password: str = Field(min_length=1)


class TokenResponse(BaseModel):
    """
    Returned on successful login or refresh.
    Field names here MUST match what the frontends TokenResponse interface expects.
    """
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = 3600


class RefreshRequest(BaseModel):
    """Body sent by the client to POST /v1/auth/refresh."""
    refresh_token: str


class LogoutRequest(BaseModel):
    """Body sent by the client to POST /v1/auth/logout."""
    refresh_token: str