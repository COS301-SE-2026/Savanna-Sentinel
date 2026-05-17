from fastapi import APIRouter, Depends, HTTPException, status


from app.core.dependencies import get_db
from app.schemas.user import UsersRequest, UsersResponse, UsersResultResponse, SetUsersStatusRequest
# Import service here
# Import Repo here

router = APIRouter()

# Add exceptions here
@router.get(
    "/users",
    response_model=UsersResultResponse,
    status_code=status.HTTP_200_OK,
    summary="Filter and get all user accounts"
)
async def users(body: UsersRequest, db=Depends(get_db)):
    return 0