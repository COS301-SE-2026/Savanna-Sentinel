from pydantic import BaseModel, Field
from datetime import datetime
from auth import RequestedRole

class UsersResponse(BaseModel):
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
    role: RequestedRole
    page: int
    page_size: int = Field(default=20, max=100)

class SetUsersStatusRequest(BaseModel):
    is_active: bool

