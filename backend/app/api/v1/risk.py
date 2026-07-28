from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.risk import ParkGridResponse
from app.services.risk_service import get_park_grid

router = APIRouter(prefix="/risk", tags=["risk"])

_PARK_NOT_FOUND = "Park not found"


@router.get(
    "/grid",
    response_model=ParkGridResponse,
    summary="Get reprojected grid cell polygons for a park",
)
async def get_grid(
    current_user: Annotated[User, Depends(get_current_user)],
    # hardcode for now
    park_id: str = "klaserie",
):
    try:
        return get_park_grid(park_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=_PARK_NOT_FOUND,
        ) from exc
