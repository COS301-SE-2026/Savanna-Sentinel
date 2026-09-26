export type FeatureGeometryType = "point" | "line" | "polygon";

export interface FeatureStyle {
    colour: string;
    opacity: number;
    icon?: string;
    iconColour?: string;
    strokeWidth?: number;
    lineDash?: "solid" | "dashed" | "dotted";
    label?: string;
    outlineOpacity?: number;
    bufferColour?: string;
    bufferOpacity?: number;
}

export const DEFAULT_BUFFER_OPACITY = 0.2;
export const DEFAULT_BUFFER_DISTANCE_M = 100;
export const MIN_BUFFER_DISTANCE_M = 1;
export const MAX_BUFFER_DISTANCE_M = 20000;

export const APPLICATION_DEFAULT_STYLE: FeatureStyle = {
    colour: "#6b7280",
    opacity: 1,
    iconColour: "#1f2937",
    strokeWidth: 2,
    lineDash: "solid",
    outlineOpacity: 1,
    bufferOpacity: DEFAULT_BUFFER_OPACITY,
};

export interface WorkspaceFeature {
    id: string;
    type: FeatureGeometryType;
    name?: string;
    geometry: GeoJSON.Geometry;
    createdAt: string;
    updatedAt: string;
    inEffect: boolean;
    bufferEnabled: boolean;
    bufferDistanceM: number;
}

export interface WorkspaceLayer {
    id: string;
    name?: string;
    parentId: string | null;
    order: number;
    defaultStyle: Partial<FeatureStyle>;
}

export interface WorkspaceMembership {
    id: string;
    featureId: string;
    layerId: string;
    order: number;
    styleOverride: Partial<FeatureStyle>;
    visible: boolean;
}
