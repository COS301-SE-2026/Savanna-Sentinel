import type {
    FeatureStyle,
    WorkspaceFeature,
    WorkspaceLayer,
    WorkspaceMembership,
} from "./types";
import { resolveMembershipStyle } from "./styleResolution";
import { getPrecedenceOrderedLayerIds } from "./tree";
import { lineMidpoint, polygonCentroid } from "./geometryAnchor";

export interface ResolvedFeature {
    feature: WorkspaceFeature;
    membershipId: string;
    style: FeatureStyle;
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

    const resolved: ResolvedFeature[] = [];
    for (const feature of features) {
        const visibleMemberships = membershipsByFeature.get(feature.id);
        if (!visibleMemberships || visibleMemberships.length === 0) continue;
        visibleMemberships.sort(
            (a, b) =>
                (layerRank.get(a.layerId) ?? Infinity) -
                (layerRank.get(b.layerId) ?? Infinity),
        );
        resolved.push({
            feature,
            membershipId: visibleMemberships[0].id,
            style: resolveMembershipStyle(layers, visibleMemberships[0]),
        });
    }
    return resolved;
}

export interface WorkspaceFeatureCollections {
    points: GeoJSON.FeatureCollection;
    lines: GeoJSON.FeatureCollection;
    polygons: GeoJSON.FeatureCollection;
    lineIcons: GeoJSON.FeatureCollection;
    polygonIcons: GeoJSON.FeatureCollection;
}

function emptyCollection(): GeoJSON.FeatureCollection {
    return { type: "FeatureCollection", features: [] };
}

export function toWorkspaceFeatureCollections(
    resolved: ResolvedFeature[],
): WorkspaceFeatureCollections {
    const collections: WorkspaceFeatureCollections = {
        points: emptyCollection(),
        lines: emptyCollection(),
        polygons: emptyCollection(),
        lineIcons: emptyCollection(),
        polygonIcons: emptyCollection(),
    };

    for (const { feature, style } of resolved) {
        const properties = {
            id: feature.id,
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
