from dataclasses import dataclass, field

from pydantic import BaseModel, Field

from app.schemas.geo import GeoLineString, GeoPoint

# Must match len(ACOConfig.phase_split) in app.workers.ml.route_planner -
# plan_routes() silently truncates to that many phases, so requesting more
# than this would otherwise be silently capped instead of rejected.
MAX_NUM_ALTERNATIVES = 3


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
    # Ceiling, not a guarantee - plan_routes() may return fewer if the
    # diversity/quality gate drops a phase.
    num_alternatives: int = Field(default=3, ge=1, le=MAX_NUM_ALTERNATIVES)
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
