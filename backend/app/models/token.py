from pydantic import BaseModel, EmailStr

class Token_Body(BaseModel):
    id: int
    username: str
    email: EmailStr
    is_active: bool
    exp: int

class Refresh_Token_Body(BaseModel):
    id: int
    iat: int
    exp: int
    jti: str
    type: str = "refresh"