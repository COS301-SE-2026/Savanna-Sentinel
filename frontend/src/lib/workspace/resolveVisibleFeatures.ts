import type {
    FeatureGeometryType,
    FeatureStyle,
    WorkspaceFeature,
    WorkspaceLayer,
    WorkspaceMembership,
} from "./types";
import { bufferFeatureMetres } from "./buffer";
import {
    resolveBufferAppearance,
    resolveMembershipStyle,
} from "./styleResolution";
import { getPrecedenceOrderedLayerIds } from "./tree";
import { lineMidpoint, polygonCentroid } from "./geometryAnchor";

export interface ResolvedFeature {
    feature: WorkspaceFeature;
    membershipId: string;
    layerId: string;
    z: number;
    style: FeatureStyle;
}

const TYPE_STACK: Record<FeatureGeometryType, number> = {
    polygon: 0,
    line: 1,
    point: 2,
};

export function getStackedLayerIds(resolved: ResolvedFeature[]): string[] {
    return [...new Set(resolved.map((r) => r.layerId))];
}

export function resolveVisibleFeatures(
    layers: WorkspaceLayer[],
    features: WorkspaceFeature[],
    memberships: WorkspaceMembership[],
): ResolvedFeature[] {
    const layerRank = new Map(
        getPrecedenceOrderedLayerIds(layers).map((id, index) => [id, index]),
    );

    const membershipsByFeature = new Map<string, WorkspaceMembership[]>();
    for (const membership of memberships) {
        if (!membership.visible) continue;
        const list = membershipsByFeature.get(membership.featureId) ?? [];
        list.push(membership);
        membershipsByFeature.set(membership.featureId, list);
    }

    const resolved: Omit<ResolvedFeature, "z">[] = [];
    const membershipOrder = new Map<string, number>();
    for (const feature of features) {
        const visibleMemberships = membershipsByFeature.get(feature.id);
        if (!visibleMemberships || visibleMemberships.length === 0) continue;
        visibleMemberships.sort(
            (a, b) =>
                (layerRank.get(a.layerId) ?? Infinity) -
                (layerRank.get(b.layerId) ?? Infinity),
        );
        const winner = visibleMemberships[0];
        membershipOrder.set(winner.id, winner.order);
        resolved.push({
            feature,
            membershipId: winner.id,
            layerId: winner.layerId,
            style: resolveMembershipStyle(layers, winner),
        });
    }

    resolved.sort(
        (a, b) =>
            (layerRank.get(b.layerId) ?? -1) -
                (layerRank.get(a.layerId) ?? -1) ||
            TYPE_STACK[a.feature.type] - TYPE_STACK[b.feature.type] ||
            membershipOrder.get(b.membershipId)! -
                membershipOrder.get(a.membershipId)!,
    );
    return resolved.map((r, z) => ({ ...r, z }));
}

export interface WorkspaceFeatureCollections {
    points: GeoJSON.FeatureCollection;
    lines: GeoJSON.FeatureCollection;
    polygons: GeoJSON.FeatureCollection;
    lineIcons: GeoJSON.FeatureCollection;
    polygonIcons: GeoJSON.FeatureCollection;
    buffers: GeoJSON.FeatureCollection;
}

function emptyCollection(): GeoJSON.FeatureCollection {
    return { type: "FeatureCollection", features: [] };
}

export function toWorkspaceFeatureCollections(
    resolved: ResolvedFeature[],
    bufferedFeatureId: string | null = null,
): WorkspaceFeatureCollections {
    const collections: WorkspaceFeatureCollections = {
        points: emptyCollection(),
        lines: emptyCollection(),
        polygons: emptyCollection(),
        lineIcons: emptyCollection(),
        polygonIcons: emptyCollection(),
        buffers: emptyCollection(),
    };

    for (const { feature, style, layerId, z } of resolved) {
        const properties = {
            id: feature.id,
            layerId,
            z,
            colour: style.colour,
            opacity: style.opacity,
            icon: style.icon ?? null,
            iconColour: style.iconColour ?? "#1f2937",
            strokeWidth: style.strokeWidth ?? 2,
            lineDash: style.lineDash ?? "solid",
            label: style.label ?? "",
            outlineOpacity: style.outlineOpacity ?? 1,
        };
        const geoJsonFeature: GeoJSON.Feature = {
            type: "Feature",
            geometry: feature.geometry,
            properties,
        };
        if (feature.bufferEnabled && feature.id === bufferedFeatureId) {
            const buffered = bufferFeatureMetres(
                feature.geometry,
                feature.bufferDistanceM,
            );
            if (buffered) {
                collections.buffers.features.push({
                    type: "Feature",
                    geometry: buffered.geometry,
                    properties: {
                        id: feature.id,
                        ...resolveBufferAppearance(style),
                    },
                });
            }
        }
        if (feature.type === "point") {
            collections.points.features.push(geoJsonFeature);
        } else if (feature.type === "line") {
            collections.lines.features.push(geoJsonFeature);
            collections.lineIcons.features.push({
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: lineMidpoint(
                        feature.geometry as GeoJSON.LineString,
                    ),
                },
                properties,
            });
        } else {
            collections.polygons.features.push(geoJsonFeature);
            collections.polygonIcons.features.push({
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: polygonCentroid(
                        feature.geometry as GeoJSON.Polygon,
                    ),
                },
                properties,
            });
        }
    }
    return collections;
}
