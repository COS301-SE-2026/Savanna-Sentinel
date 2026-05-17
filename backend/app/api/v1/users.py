from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession


from app.core.dependencies import get_db
from app.schemas.user import UsersRequest, UsersResponse, UsersResultResponse, SetUsersStatusRequest
from app.services.user_service import UserService
from app.repositories.user_repository import UserRepository

router = APIRouter()

# Add exceptions here
@router.get(
    "/v1/users",
    response_model=UsersResultResponse,
    status_code=status.HTTP_200_OK,
    summary="Filter and get all user accounts"
)
async def users(req: UsersRequest, db, AsyncSession=Depends(get_db)):
    repo = UserRepository(db)

    service = UserService(repo)

    response_data = await service.get_users(req)

    return response_data