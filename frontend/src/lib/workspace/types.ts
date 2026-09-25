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
}

export const APPLICATION_DEFAULT_STYLE: FeatureStyle = {
    colour: "#6b7280",
    opacity: 1,
    iconColour: "#1f2937",
    strokeWidth: 2,
    lineDash: "solid",
    outlineOpacity: 1,
};

export interface WorkspaceFeature {
    id: string;
    type: FeatureGeometryType;
    name?: string;
    geometry: GeoJSON.Geometry;
    createdAt: string;
    updatedAt: string;
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
