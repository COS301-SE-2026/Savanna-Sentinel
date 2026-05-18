from datetime import datetime

from pydantic import BaseModel

class UserProfileResponse(BaseModel):
	id: str
	username: str
	email: str
	first_name: str
	last_name: str
	role: str
	is_active: bool
	created_at: datetime

	model_config = {"from_attributes": True}


class UpdateProfileRequest(BaseModel):
	first_name: str | None = None
	last_name: str | None = None
	current_password: str | None = None
	new_password: str | None = None
