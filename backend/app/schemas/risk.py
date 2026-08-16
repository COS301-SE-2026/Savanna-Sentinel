from datetime import datetime, timezone

from pydantic import BaseModel, model_validator

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


class RiskJobResponse(BaseModel):
    job_id: str
    status: str
    queued_at: str


class RiskTrainRequest(BaseModel):
    window_start: datetime
    window_end: datetime

    @model_validator(mode="after")
    def _validate_window(self) -> "RiskTrainRequest":
        if self.window_start.tzinfo is None:
            self.window_start = self.window_start.replace(tzinfo=timezone.utc)
        if self.window_end.tzinfo is None:
            self.window_end = self.window_end.replace(tzinfo=timezone.utc)
        if self.window_end <= self.window_start:
            raise ValueError("window_end must be after window_start")
        if self.window_end > datetime.now(timezone.utc):
            raise ValueError("window_end cannot be in the future")
        return self


class RiskTrainJobStatus(BaseModel):
    job_id: str
    status: str
    model_id: str | None = None
    metrics: dict | None = None
    n_training_examples: int | None = None


class RiskScoreJobStatus(BaseModel):
    job_id: str
    status: str
    heatmap_id: str | None = None
    computed_at: str | None = None
    n_cells_scored: int | None = None


class HeatmapCell(BaseModel):
    cell_id: str
    risk_score: float
    geometry: GeoPolygon


class HeatmapResponse(BaseModel):
    heatmap_id: str
    computed_at: str
    cells: list[HeatmapCell]


class ExplainFeature(BaseModel):
    feature_name: str
    contribution: float


class CellExplainResponse(BaseModel):
    cell_id: str
    heatmap_id: str
    top_features: list[ExplainFeature]


class ActiveModelResponse(BaseModel):
    model_id: str
    trained_at: str
    training_window_start: str
    training_window_end: str
    n_training_examples: int
    metrics: dict
