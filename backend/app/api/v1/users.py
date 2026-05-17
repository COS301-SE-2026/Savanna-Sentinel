from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dependencies import get_db
# Import schemas here
# Import service here
# Import Repo here

router = APIRouter()

# Add exceptions here
@router.get(
    "/users"
)
async def users(body, db=Depends(get_db)):
    return 0