from pydantic import BaseModel


class TokenBody(BaseModel):
    sub: str
    exp: int
    type: str = "access"
    iat: int
    jti: str
    username: str | None = None
    email: str | None = None
    is_active: bool | None = None


class RefreshTokenBody(BaseModel):
    sub: str
    iat: int
    exp: int
    jti: str
    type: str = "refresh"
