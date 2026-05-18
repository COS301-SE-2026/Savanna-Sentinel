"""User profile endpoints for authenticated users."""

from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user, get_db
from app.repositories.user_repository import UserRepository
from app.schemas.user import UpdateProfileRequest, UserProfileResponse
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserProfileResponse, summary="Get the authenticated user's profile")
async def get_me(current_user=Depends(get_current_user), db=Depends(get_db)):
	service = UserService(UserRepository(db))
	user = await service.get_me(current_user)
	return UserProfileResponse.model_validate(user)


@router.patch("/me", response_model=UserProfileResponse, summary="Update the authenticated user's profile")
async def update_me(
	body: UpdateProfileRequest,
	current_user=Depends(get_current_user),
	db=Depends(get_db),
):
	service = UserService(UserRepository(db))
	user = await service.update_me(current_user, body)
	return UserProfileResponse.model_validate(user)
