import { api } from "./api";
import type {
    FeatureGeometryType,
    FeatureStyle,
    WorkspaceFeature,
    WorkspaceLayer,
    WorkspaceMembership,
} from "@/lib/workspace/types";

interface ApiStyle {
    colour?: string;
    opacity?: number;
    icon?: string;
    icon_colour?: string;
    stroke_width?: number;
    line_dash?: "solid" | "dashed" | "dotted";
    label?: string;
    outline_opacity?: number;
    buffer_colour?: string;
    buffer_opacity?: number;
}

interface ApiLayer {
    id: string;
    name: string | null;
    parent_id: string | null;
    order: number;
    default_style: ApiStyle;
}

interface ApiFeature {
    id: string;
    type: FeatureGeometryType;
    name: string | null;
    geometry: GeoJSON.Geometry;
    created_at: string;
    updated_at: string;
    in_effect: boolean;
    buffer_enabled: boolean;
    buffer_distance_m: number;
}

interface ApiMembership {
    id: string;
    feature_id: string;
    layer_id: string;
    order: number;
    style_override: ApiStyle;
    visible: boolean;
}

interface ApiWorkspace {
    version: number;
    layers: ApiLayer[];
    features: ApiFeature[];
    memberships: ApiMembership[];
}

export interface WorkspaceSnapshot {
    version: number;
    layers: WorkspaceLayer[];
    features: WorkspaceFeature[];
    memberships: WorkspaceMembership[];
}

export interface VisibilityEntry {
    membershipId: string;
    visible: boolean;
}

const STYLE_KEYS: [keyof FeatureStyle, keyof ApiStyle][] = [
    ["colour", "colour"],
    ["opacity", "opacity"],
    ["icon", "icon"],
    ["iconColour", "icon_colour"],
    ["strokeWidth", "stroke_width"],
    ["lineDash", "line_dash"],
    ["label", "label"],
    ["outlineOpacity", "outline_opacity"],
    ["bufferColour", "buffer_colour"],
    ["bufferOpacity", "buffer_opacity"],
];

export function styleToApi(style: Partial<FeatureStyle>): ApiStyle {
    const out: Record<string, unknown> = {};
    for (const [local, wire] of STYLE_KEYS) {
        const value = style[local];
        if (value !== undefined) out[wire] = value;
    }
    return out as ApiStyle;
}

export function styleFromApi(style: ApiStyle | null): Partial<FeatureStyle> {
    const out: Record<string, unknown> = {};
    if (!style) return out;
    for (const [local, wire] of STYLE_KEYS) {
        const value = style[wire];
        if (value !== undefined && value !== null) out[local] = value;
    }
    return out as Partial<FeatureStyle>;
}

export class WorkspaceConflictError extends Error {
    readonly currentVersion: number;

    constructor(currentVersion: number) {
        super("The workspace was changed by someone else");
        this.name = "WorkspaceConflictError";
        this.currentVersion = currentVersion;
    }
}

function fromApi(data: ApiWorkspace): WorkspaceSnapshot {
    return {
        version: data.version,
        layers: data.layers.map((layer) => ({
            id: layer.id,
            name: layer.name ?? undefined,
            parentId: layer.parent_id,
            order: layer.order,
            defaultStyle: styleFromApi(layer.default_style),
        })),
        features: data.features.map((feature) => ({
            id: feature.id,
            type: feature.type,
            name: feature.name ?? undefined,
            geometry: feature.geometry,
            createdAt: feature.created_at,
            updatedAt: feature.updated_at,
            inEffect: feature.in_effect,
            bufferEnabled: feature.buffer_enabled,
            bufferDistanceM: feature.buffer_distance_m,
        })),
        memberships: data.memberships.map((membership) => ({
            id: membership.id,
            featureId: membership.feature_id,
            layerId: membership.layer_id,
            order: membership.order,
            styleOverride: styleFromApi(membership.style_override),
            visible: membership.visible,
        })),
    };
}

export async function fetchWorkspace(): Promise<WorkspaceSnapshot> {
    const { data } = await api.get<ApiWorkspace>("/workspace");
    return fromApi(data);
}

export async function saveWorkspace(
    baseVersion: number,
    workspace: {
        layers: WorkspaceLayer[];
        features: WorkspaceFeature[];
        memberships: WorkspaceMembership[];
    },
): Promise<WorkspaceSnapshot> {
    const body = {
        base_version: baseVersion,
        layers: workspace.layers.map((layer) => ({
            id: layer.id,
            name: layer.name ?? null,
            parent_id: layer.parentId,
            order: layer.order,
            default_style: styleToApi(layer.defaultStyle),
        })),
        features: workspace.features.map((feature) => ({
            id: feature.id,
            type: feature.type,
            name: feature.name ?? null,
            geometry: feature.geometry,
            created_at: feature.createdAt,
            updated_at: feature.updatedAt,
            in_effect: feature.inEffect,
            buffer_enabled: feature.bufferEnabled,
            buffer_distance_m: feature.bufferDistanceM,
        })),
        memberships: workspace.memberships.map((membership) => ({
            id: membership.id,
            feature_id: membership.featureId,
            layer_id: membership.layerId,
            order: membership.order,
            style_override: styleToApi(membership.styleOverride),
            visible: membership.visible,
        })),
    };

    try {
        const { data } = await api.put<ApiWorkspace>("/workspace", body);
        return fromApi(data);
    } catch (error) {
        const response = (
            error as {
                response?: {
                    status?: number;
                    data?: { detail?: { current_version?: number } };
                };
            }
        ).response;
        if (response?.status === 409) {
            throw new WorkspaceConflictError(
                response.data?.detail?.current_version ?? 0,
            );
        }
        throw error;
    }
}

export async function saveVisibility(
    entries: VisibilityEntry[],
): Promise<void> {
    if (entries.length === 0) return;
    await api.put("/workspace/visibility", {
        entries: entries.map((entry) => ({
            membership_id: entry.membershipId,
            visible: entry.visible,
        })),
    });
}
