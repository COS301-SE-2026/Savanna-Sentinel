import type { WorkspaceFeature, WorkspaceLayer } from "./types";

export function getFeatureTypeLabel(feature: WorkspaceFeature): string {
    return `${feature.type[0].toUpperCase()}${feature.type.slice(1)}`;
}

export function getFeatureDisplayName(feature: WorkspaceFeature): string {
    const trimmed = feature.name?.trim();
    if (trimmed) return trimmed;
    return getFeatureTypeLabel(feature);
}

export function getLayerDisplayName(layer: WorkspaceLayer): string {
    const trimmed = layer.name?.trim();
    if (trimmed) return trimmed;
    return "New layer";
}
