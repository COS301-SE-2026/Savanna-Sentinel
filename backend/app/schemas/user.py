from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.auth import RequestedRole


class UpdateProfileRequest(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    current_password: str | None = None
    new_password: str | None = None

class UsersResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    email: str
    first_name: str
    last_name: str
    role: str
    is_active: bool
    created_at: datetime

class UsersResultResponse(BaseModel):
    total: int
    page: int
    page_size: int
    results: list[UsersResponse]

class UsersRequest(BaseModel):
    is_active: bool
    role: Optional[RequestedRole] = None
    page: int = 1
    page_size: int = Field(default=20, le=100)

class SetUsersStatusRequest(BaseModel):
    is_active: bool

class RoleChangeRequest(BaseModel):
    new_role: RequestedRole
