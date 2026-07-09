from dataclasses import dataclass, field
from app.schemas.geo import GeoPoint
from app.schemas.geo import GeoLineString

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