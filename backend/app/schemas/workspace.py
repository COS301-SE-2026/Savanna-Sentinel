from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

WORKSPACE_ICON_KEYS = (
    "map-pin",
    "tent",
    "droplet",
    "paw-print",
    "flag",
    "triangle-alert",
    "tree-pine",
    "camera",
    "binoculars",
    "tractor",
    "fence",
    "route",
    "anchor",
    "compass",
    "siren",
    "waves",
    "mountain",
    "sun",
    "moon",
    "star",
)

_HEX_COLOUR = r"^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$"
_UUID = (
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}"
    r"-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)

MIN_BUFFER_DISTANCE_M = 1
MAX_BUFFER_DISTANCE_M = 20000
DEFAULT_BUFFER_DISTANCE_M = 100


class WorkspaceStyle(BaseModel):
    model_config = ConfigDict(extra="forbid")

    colour: Optional[str] = Field(default=None, pattern=_HEX_COLOUR)
    opacity: Optional[float] = Field(default=None, ge=0, le=1)
    icon: Optional[str] = None
    icon_colour: Optional[str] = Field(default=None, pattern=_HEX_COLOUR)
    stroke_width: Optional[float] = Field(default=None, ge=1, le=20)
    line_dash: Optional[Literal["solid", "dashed", "dotted"]] = None
    label: Optional[str] = Field(default=None, max_length=200)
    outline_opacity: Optional[float] = Field(default=None, ge=0, le=1)
    buffer_colour: Optional[str] = Field(default=None, pattern=_HEX_COLOUR)
    buffer_opacity: Optional[float] = Field(default=None, ge=0, le=1)

    @field_validator("icon")
    @classmethod
    def _known_icon(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in WORKSPACE_ICON_KEYS:
            raise ValueError(f"unknown icon key: {value}")
        return value

    def to_stored(self) -> dict[str, Any]:
        return self.model_dump(exclude_none=True)


class WorkspaceLayerPayload(BaseModel):
    id: str = Field(pattern=_UUID)
    name: Optional[str] = Field(default=None, max_length=200)
    parent_id: Optional[str] = Field(default=None, pattern=_UUID)
    order: int = Field(ge=0)
    default_style: WorkspaceStyle = Field(default_factory=WorkspaceStyle)


class WorkspaceFeaturePayload(BaseModel):
    id: str = Field(pattern=_UUID)
    type: Literal["point", "line", "polygon"]
    name: Optional[str] = Field(default=None, max_length=200)
    geometry: dict[str, Any]
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    in_effect: bool = True
    buffer_enabled: bool = False
    buffer_distance_m: float = Field(
        default=DEFAULT_BUFFER_DISTANCE_M,
        ge=MIN_BUFFER_DISTANCE_M,
        le=MAX_BUFFER_DISTANCE_M,
    )


class WorkspaceMembershipPayload(BaseModel):
    id: str = Field(pattern=_UUID)
    feature_id: str = Field(pattern=_UUID)
    layer_id: str = Field(pattern=_UUID)
    order: int = Field(ge=0)
    style_override: WorkspaceStyle = Field(default_factory=WorkspaceStyle)
    visible: bool = True


class WorkspaceSaveRequest(BaseModel):
    base_version: int = Field(ge=0)
    layers: list[WorkspaceLayerPayload] = []
    features: list[WorkspaceFeaturePayload] = []
    memberships: list[WorkspaceMembershipPayload] = []


class WorkspaceLayerOut(BaseModel):
    id: str
    name: Optional[str] = None
    parent_id: Optional[str] = None
    order: int
    default_style: dict[str, Any] = {}


class WorkspaceFeatureOut(BaseModel):
    id: str
    type: str
    name: Optional[str] = None
    geometry: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    in_effect: bool
    buffer_enabled: bool
    buffer_distance_m: float


class WorkspaceMembershipOut(BaseModel):
    id: str
    feature_id: str
    layer_id: str
    order: int
    style_override: dict[str, Any] = {}
    visible: bool


class WorkspaceResponse(BaseModel):
    version: int
    layers: list[WorkspaceLayerOut] = []
    features: list[WorkspaceFeatureOut] = []
    memberships: list[WorkspaceMembershipOut] = []


class VisibilityEntry(BaseModel):
    membership_id: str = Field(pattern=_UUID)
    visible: bool


class WorkspaceVisibilityRequest(BaseModel):
    entries: list[VisibilityEntry] = Field(max_length=20000)
