export type FeatureGeometryType = "point" | "line" | "polygon";

export interface FeatureStyle {
    colour: string;
    opacity: number;
    icon?: string;
    iconColour?: string;
    iconOpacity?: number;
    strokeWidth?: number;
    lineDash?: "solid" | "dashed" | "dotted";
    label?: string;
    labelOpacity?: number;
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
    iconOpacity: 1,
    strokeWidth: 2,
    lineDash: "solid",
    labelOpacity: 1,
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
    rules: FeatureRules;
}

export interface WorkspaceLayer {
    id: string;
    name?: string;
    parentId: string | null;
    order: number;
    defaultStyle: Partial<FeatureStyle>;
    defaultRules: FeatureRules;
}

export interface WorkspaceMembership {
    id: string;
    featureId: string;
    layerId: string;
    order: number;
    styleOverride: Partial<FeatureStyle>;
    visible: boolean;
}

export const RULE_INTENTS = [
    "increase_risk",
    "decrease_risk",
    "prefer",
    "avoid",
] as const;
export type RuleIntent = (typeof RULE_INTENTS)[number];

export interface RuleSettings {
    enabled?: boolean;
    strength?: number;
    bufferDecay?: number;
    priority?: number;
}

export type FeatureRules = Partial<Record<RuleIntent, RuleSettings>>;

export const MIN_RULE_STRENGTH = 0.1;
export const MAX_RULE_STRENGTH = 1;
export const MIN_RULE_PRIORITY = 1;
export const MAX_RULE_PRIORITY = 99;

export const DEFAULT_RULE: Required<RuleSettings> = {
    enabled: true,
    strength: 0.5,
    bufferDecay: 0,
    priority: 1,
};
