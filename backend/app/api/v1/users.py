from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession


from app.core.dependencies import get_db, require_admin
from app.schemas.user import UsersRequest, UsersResponse, UsersResultResponse, SetUsersStatusRequest
from app.services.user_service import UserService
from app.repositories.user_repository import UserRepository
from app.models.user import User

router = APIRouter()

# Add exceptions here
@router.get(
    "/users",
    response_model=UsersResultResponse,
    status_code=status.HTTP_200_OK,
    summary="Filter and get all user accounts"
)
async def users(req: UsersRequest = Depends(), db: AsyncSession=Depends(get_db), current_admin: User = Depends(require_admin)):
    repo = UserRepository(db)

    service = UserService(repo)

    response_data = await service.get_users(req)

    return response_data

@router.patch(
    "/users/{user_id}/status",
    response_model=UsersResponse,
    status_code=status.HTTP_200_OK,
    summary="Switch the selected users status"
)
async def status(req: SetUsersStatusRequest, db: AsyncSession=Depends(get_db), current_admin: User = Depends(require_admin)):
    