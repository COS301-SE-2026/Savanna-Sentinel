from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.route import RouteJobResponse, RouteListResponse, RouteRequest
from app.services.route_service import generate_route_job, get_routes

router = APIRouter(prefix="/routes", tags=["routes"])

@router.post(
    "",
    response_model=RouteJobResponse,
    status_code=202,
    summary="Queue a new route planning job",
)
async def generate_route(
        request: RouteRequest,
        current_user: Annotated[User, Depends(get_current_user)],
    ):
    return generate_route_job(request)

@router.get(
    "",
    response_model=RouteListResponse,
    summary="List planned routes / route job status",
)
async def list_routes(
        current_user: Annotated[User, Depends(get_current_user)],
        request_id: str | None = None,
        park_id: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ):
    return get_routes(request_id, park_id, page, page_size)

@router.get(
    "/{route_id}",
    response_model=RouteListResponse,
    summary="Get a single route job by id",
)
async def get_route(
        route_id: str,
        current_user: Annotated[User, Depends(get_current_user)],
    ):
    return get_routes(request_id=route_id)
