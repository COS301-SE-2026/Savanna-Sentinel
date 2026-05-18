from pydantic import BaseModel, EmailStr

class Token_Body(BaseModel):
    sub: str
    exp: int
    type: str = "access"
    iat: int
    jti: str
    username: str | None = None
    email: str | None = None
    is_active: bool | None = None


class Refresh_Token_Body(BaseModel):
    sub: str
    iat: int
    exp: int
    jti: str
    type: str = "refresh"