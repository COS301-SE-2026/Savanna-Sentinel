from dataclasses import dataclass, field

from pydantic import BaseModel

from app.schemas.geo import GeoLineString, GeoPoint


@dataclass
class GraphNode:
    node_id: str
    location : GeoPoint
    risk_score: float
@dataclass
class GraphEdge:
    from_node_id: str
    to_node_id: str
    distance_km: float
    est_time_min: float
    est_fuel_l: float
@dataclass
class ParkGraph:
    park_id : str
    nodes: list[GraphNode] = field(default_factory=list)
    edges: list[GraphEdge] = field(default_factory=list)
@dataclass
class PlannedRoute:
    suggested_path: list[str]
    path_geometry: GeoLineString
    estimated_time_min: float
    estimated_fuel_l: float
    risk_coverage: float

class RouteRequest(BaseModel):
    park_id: str
    start_point: GeoPoint
    end_point: GeoPoint
    max_time: float
    max_fuel: float
    num_alternatives: int = 3 #ceiling, not a guarantee
class RouteJobResponse(BaseModel):
    job_id: str
    request_id: str
    park_id: str
    status: str
    queued_at: str
class RouteListResponse(BaseModel):
    request_id: str | None = None
    status: str | None = None
    num_alternatives_requested: int | None = None
    num_alternatives_found: int | None = None
    total: int
    page: int
    page_size: int
    results: list[PlannedRoute]
