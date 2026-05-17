from pydantic import BaseModel
from datetime import datetime

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    first_name: str
    last_name: str
    role: str
    is_active: bool
    created_at: datetime


class UserResultResponse(BaseModel):
    total: int
    page: int
    page_size: int
    results: UserResponse