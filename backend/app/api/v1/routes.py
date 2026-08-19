from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.route import (
    RouteJobResponse,
    RouteListResponse,
    RouteRequest,
    SavedRouteListResponse,
    SavedRouteResponse,
    SaveRouteRequest,
)
from app.services.route_service import (
    delete_saved_route,
    generate_route_job,
    get_routes,
    list_saved_routes,
    save_route,
)

_SAVED_ROUTE_NOT_FOUND = "Saved route not found"

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

@router.post(
    "/save",
    response_model=SavedRouteResponse,
    status_code=201,
    summary="Save a planned route",
)
async def save_route_endpoint(
        request: SaveRouteRequest,
        current_user: Annotated[User, Depends(get_current_user)],
        db: Annotated[AsyncSession, Depends(get_db)],
    ):
    return await save_route(db, current_user, request)

@router.get(
    "/saved",
    response_model=SavedRouteListResponse,
    summary="List saved patrol routes",
)
async def list_saved_routes_endpoint(
        current_user: Annotated[User, Depends(get_current_user)],
        db: Annotated[AsyncSession, Depends(get_db)],
        page: int = 1,
        page_size: int = 20,
    ):
    return await list_saved_routes(db, current_user, page, page_size)

@router.delete(
    "/saved/{route_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a saved patrol route",
)
async def delete_saved_route_endpoint(
        route_id: str,
        current_user: Annotated[User, Depends(get_current_user)],
        db: Annotated[AsyncSession, Depends(get_db)],
    ):
    deleted = await delete_saved_route(db, current_user, route_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=_SAVED_ROUTE_NOT_FOUND,
        )

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
