from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from fastapi import HTTPException, status

if TYPE_CHECKING:
    from app.repositories.workspace_repository import WorkspaceRepository
    from app.schemas.workspace import (
        WorkspaceFeaturePayload,
        WorkspaceLayerPayload,
        WorkspaceMembershipPayload,
        WorkspaceSaveRequest,
    )

MAX_LAYERS = 1000
MAX_FEATURES = 5000
MAX_MEMBERSHIPS = 10000
MAX_VERTICES_PER_FEATURE = 10000

_GEOJSON_TYPE_FOR = {
    "point": "Point",
    "line": "LineString",
    "polygon": "Polygon",
}


def _invalid(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        detail=message,
    )


def _check_position(position: Any, where: str) -> None:
    if not isinstance(position, (list, tuple)) or not (2 <= len(position) <= 3):
        raise _invalid(f"{where}: a position needs 2 or 3 numbers")

    lon, lat = position[0], position[1]
    if isinstance(lon, bool) or isinstance(lat, bool):
        raise _invalid(f"{where}: coordinates must be numbers")
    if not isinstance(lon, (int, float)) or not isinstance(lat, (int, float)):
        raise _invalid(f"{where}: coordinates must be numbers")
    if not -180 <= lon <= 180:
        raise _invalid(f"{where}: longitude {lon} is out of range")
    if not -90 <= lat <= 90:
        raise _invalid(f"{where}: latitude {lat} is out of range")


def _count_and_check_line(coordinates: Any, where: str) -> int:
    if not isinstance(coordinates, list) or len(coordinates) < 2:
        raise _invalid(f"{where}: a line needs at least 2 positions")
    for position in coordinates:
        _check_position(position, where)
    return len(coordinates)


def validate_geometry(feature_id: str, kind: str, geometry: Any) -> None:
    where = f"feature {feature_id}"
    if not isinstance(geometry, dict):
        raise _invalid(f"{where}: geometry must be an object")

    expected = _GEOJSON_TYPE_FOR[kind]
    if geometry.get("type") != expected:
        raise _invalid(
            f"{where}: a {kind} needs a {expected} geometry, "
            f"got {geometry.get('type')}",
        )

    coordinates = geometry.get("coordinates")
    if kind == "point":
        _check_position(coordinates, where)
        return

    if kind == "line":
        vertices = _count_and_check_line(coordinates, where)
    else:
        if not isinstance(coordinates, list) or not coordinates:
            raise _invalid(f"{where}: a polygon needs at least one ring")
        vertices = 0
        for ring in coordinates:
            if not isinstance(ring, list) or len(ring) < 4:
                raise _invalid(
                    f"{where}: a polygon ring needs at least 4 positions",
                )
            vertices += _count_and_check_line(ring, where)
            if list(ring[0][:2]) != list(ring[-1][:2]):
                raise _invalid(f"{where}: polygon rings must be closed")

    if vertices > MAX_VERTICES_PER_FEATURE:
        raise _invalid(
            f"{where}: {vertices} vertices exceeds the limit of "
            f"{MAX_VERTICES_PER_FEATURE}",
        )


def _unique_ids(items: list, label: str) -> None:
    seen = set()
    for item in items:
        if item.id in seen:
            raise _invalid(f"duplicate {label} id: {item.id}")
        seen.add(item.id)


def _check_layer_tree(layers: list["WorkspaceLayerPayload"]) -> None:
    parent_of = {layer.id: layer.parent_id for layer in layers}

    for layer in layers:
        if layer.parent_id is None:
            continue
        if layer.parent_id not in parent_of:
            raise _invalid(
                f"layer {layer.id} is nested under unknown layer "
                f"{layer.parent_id}",
            )
        if layer.parent_id == layer.id:
            raise _invalid(f"layer {layer.id} cannot be its own parent")

    settled: set[str] = set()
    for layer in layers:
        walked: set[str] = set()
        current = layer.id
        while current is not None and current not in settled:
            if current in walked:
                raise _invalid(
                    f"layer {layer.id} sits inside its own subtree",
                )
            walked.add(current)
            current = parent_of[current]
        settled |= walked


def _check_memberships(
    layers: list["WorkspaceLayerPayload"],
    features: list["WorkspaceFeaturePayload"],
    memberships: list["WorkspaceMembershipPayload"],
) -> None:
    layer_ids = {layer.id for layer in layers}
    feature_ids = {feature.id for feature in features}
    pairs: set[tuple[str, str]] = set()
    attached: set[str] = set()

    for membership in memberships:
        if membership.layer_id not in layer_ids:
            raise _invalid(
                f"membership {membership.id} points at unknown layer "
                f"{membership.layer_id}",
            )
        if membership.feature_id not in feature_ids:
            raise _invalid(
                f"membership {membership.id} points at unknown feature "
                f"{membership.feature_id}",
            )
        pair = (membership.feature_id, membership.layer_id)
        if pair in pairs:
            raise _invalid(
                f"feature {membership.feature_id} appears twice under "
                f"layer {membership.layer_id}",
            )
        pairs.add(pair)
        attached.add(membership.feature_id)

    orphans = feature_ids - attached
    if orphans:
        raise _invalid(
            f"feature {sorted(orphans)[0]} belongs to no layer",
        )


class WorkspaceService:
    def __init__(self, repo: "WorkspaceRepository"):
        self.repo = repo

    async def get_workspace(self, user_id: str) -> dict[str, Any]:
        return await self.repo.load(user_id)

    async def save_workspace(
        self,
        user_id: str,
        payload: "WorkspaceSaveRequest",
    ) -> dict[str, Any]:
        self._validate(payload)

        now = datetime.now(timezone.utc)
        version = await self.repo.replace(
            user_id=user_id,
            base_version=payload.base_version,
            layers=[
                {
                    "id": layer.id,
                    "name": layer.name,
                    "parent_id": layer.parent_id,
                    "order": layer.order,
                    "default_style": layer.default_style.to_stored(),
                }
                for layer in payload.layers
            ],
            features=[
                {
                    "id": feature.id,
                    "type": feature.type,
                    "name": feature.name,
                    "geometry": feature.geometry,
                    "created_at": feature.created_at or now,
                    "updated_at": feature.updated_at or now,
                }
                for feature in payload.features
            ],
            memberships=[
                {
                    "id": membership.id,
                    "feature_id": membership.feature_id,
                    "layer_id": membership.layer_id,
                    "order": membership.order,
                    "style_override": membership.style_override.to_stored(),
                    "visible": membership.visible,
                }
                for membership in payload.memberships
            ],
        )

        if version is None:
            current = await self.repo.get_version()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": (
                        "The workspace changed since you loaded it. "
                        "Nothing was saved."
                    ),
                    "current_version": current,
                },
            )

        return await self.repo.load(user_id)

    async def set_visibility(
        self,
        user_id: str,
        entries: list[dict[str, Any]],
    ) -> None:
        ids = [entry["membership_id"] for entry in entries]
        known = await self.repo.existing_membership_ids(ids)
        unknown = [
            membership_id for membership_id in ids if membership_id not in known
        ]
        if unknown:
            raise _invalid(f"unknown membership: {unknown[0]}")

        await self.repo.set_visibility(user_id, entries)

    def _validate(self, payload: "WorkspaceSaveRequest") -> None:
        if len(payload.layers) > MAX_LAYERS:
            raise _invalid(f"a workspace holds at most {MAX_LAYERS} layers")
        if len(payload.features) > MAX_FEATURES:
            raise _invalid(
                f"a workspace holds at most {MAX_FEATURES} features",
            )
        if len(payload.memberships) > MAX_MEMBERSHIPS:
            raise _invalid(
                f"a workspace holds at most {MAX_MEMBERSHIPS} memberships",
            )

        _unique_ids(payload.layers, "layer")
        _unique_ids(payload.features, "feature")
        _unique_ids(payload.memberships, "membership")

        _check_layer_tree(payload.layers)

        for feature in payload.features:
            validate_geometry(feature.id, feature.type, feature.geometry)

        _check_memberships(
            payload.layers,
            payload.features,
            payload.memberships,
        )
