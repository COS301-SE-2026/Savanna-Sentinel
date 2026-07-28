from pydantic import BaseModel

from app.schemas.geo import GeoPolygon


class GridCellProperties(BaseModel):
    cell_id: str
    row: int
    col: int


class GridCellFeature(BaseModel):
    type: str = "Feature"
    properties: GridCellProperties
    geometry: GeoPolygon


class ParkGridResponse(BaseModel):
    type: str = "FeatureCollection"
    features: list[GridCellFeature]
