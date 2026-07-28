from pydantic import BaseModel


class GeoPoint(BaseModel):
    type: str = "Point"
    coordinates: tuple[
        float,
        float,
    ]  # basically [longitude, latitude] - GeoJSON order, not lat/lon


class GeoLineString(BaseModel):
    type: str = "LineString"
    coordinates: list[tuple[float, float]]


class GeoPolygon(BaseModel):
    type: str = "Polygon"
    coordinates: list[list[tuple[float, float]]]
