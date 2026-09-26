import { create } from "zustand";

import type {
    FeatureGeometryType,
    FeatureStyle,
    WorkspaceFeature,
    WorkspaceLayer,
    WorkspaceMembership,
} from "@/lib/workspace/types";
import { wouldCreateCycle, getDescendantLayerIds } from "@/lib/workspace/tree";
import { resolveMembershipStyle } from "@/lib/workspace/styleResolution";
import {
    DEFAULT_BUFFER_DISTANCE_M,
    MAX_BUFFER_DISTANCE_M,
    MIN_BUFFER_DISTANCE_M,
} from "@/lib/workspace/types";
import {
    fetchWorkspace,
    saveVisibility,
    saveWorkspace as putWorkspace,
    WorkspaceConflictError,
    type VisibilityEntry,
} from "@/services/workspaceApi";

function newId(): string {
    return crypto.randomUUID();
}

function withoutOrphans(
    features: WorkspaceFeature[],
    memberships: WorkspaceMembership[],
    affectedFeatureIds: Set<string>,
): WorkspaceFeature[] {
    const referenced = new Set(memberships.map((m) => m.featureId));
    return features.filter(
        (f) => !affectedFeatureIds.has(f.id) || referenced.has(f.id),
    );
}

function nextOrder(siblings: { order: number }[]): number {
    return siblings.reduce((max, s) => Math.max(max, s.order + 1), 0);
}

function applyInEffect(
    features: WorkspaceFeature[],
    memberships: WorkspaceMembership[],
    featureIds: Set<string>,
    inEffect: boolean,
): { features: WorkspaceFeature[]; memberships: WorkspaceMembership[] } {
    return {
        features: features.map((f) =>
            featureIds.has(f.id) ? { ...f, inEffect } : f,
        ),
        memberships: memberships.map((m) =>
            featureIds.has(m.featureId) ? { ...m, visible: inEffect } : m,
        ),
    };
}

export type WorkspaceStatus = "idle" | "loading" | "ready" | "error";
export type WorkspaceSaveResult = "saved" | "conflict" | "error";

export interface WorkspaceDataState {
    layers: WorkspaceLayer[];
    features: WorkspaceFeature[];
    memberships: WorkspaceMembership[];
    activeLayerId: string | null;
    version: number;
    status: WorkspaceStatus;
}

const initialData: WorkspaceDataState = {
    layers: [],
    features: [],
    memberships: [],
    activeLayerId: null,
    version: 0,
    status: "idle",
};

export interface WorkspaceState extends WorkspaceDataState {
    hasUnsavedChanges: boolean;
    loadWorkspace: () => Promise<void>;
    saveWorkspace: () => Promise<WorkspaceSaveResult>;
    resetWorkspace: () => void;
    addLayer: (name: string | undefined, parentId: string | null) => string;
    renameLayer: (layerId: string, name: string) => void;
    deleteLayer: (layerId: string) => void;
    reorderLayer: (parentId: string | null, orderedLayerIds: string[]) => void;
    reparentLayer: (layerId: string, newParentId: string | null) => boolean;
    setLayerDefaultStyle: (
        layerId: string,
        style: Partial<FeatureStyle>,
    ) => void;
    clearLayerDefaultStyleProperty: (
        layerId: string,
        property: keyof FeatureStyle,
    ) => void;
    setActiveLayer: (layerId: string | null) => void;

    drawFeature: (
        type: FeatureGeometryType,
        geometry: GeoJSON.Geometry,
    ) => { featureId: string; membershipId: string } | null;
    editFeatureGeometry: (
        featureId: string,
        geometry: GeoJSON.Geometry,
    ) => void;
    renameFeature: (featureId: string, name: string) => void;
    setFeatureInEffect: (featureId: string, inEffect: boolean) => void;
    setFeatureBuffer: (
        featureId: string,
        patch: { enabled?: boolean; distanceM?: number },
    ) => void;
    setLayerChildrenInEffect: (layerId: string, inEffect: boolean) => void;
    setMembershipStyleOverride: (
        membershipId: string,
        styleOverride: Partial<FeatureStyle>,
    ) => void;
    resetMembershipStyleProperty: (
        membershipId: string,
        property: keyof FeatureStyle,
    ) => void;
    moveFeatureToLayer: (
        membershipId: string,
        targetLayerId: string,
    ) => string | null;
    duplicateFeatureToLayer: (
        membershipId: string,
        targetLayerId: string,
    ) => string | null;
    reorderMembership: (
        layerId: string,
        orderedMembershipIds: string[],
    ) => void;
    removeMembership: (membershipId: string) => void;
    deleteFeature: (featureId: string) => void;
    toggleMembershipVisibility: (
        membershipId: string,
        visible: boolean,
    ) => void;
    toggleLayerVisibility: (layerId: string, visible: boolean) => void;
}

export let initialWorkspaceState: WorkspaceState;

export const useWorkspaceStore = create<WorkspaceState>()((set, get) => {
    const markDirty = (partial: Partial<WorkspaceDataState>) =>
        set({ ...partial, hasUnsavedChanges: true });

    const pushVisibility = (entries: VisibilityEntry[]) => {
        if (get().status !== "ready" || get().hasUnsavedChanges) return;
        void saveVisibility(entries).catch(() => {});
    };

    const state: WorkspaceState = {
        ...initialData,
        hasUnsavedChanges: false,

        loadWorkspace: async () => {
            set({ status: "loading" });
            try {
                const snapshot = await fetchWorkspace();
                set({
                    layers: snapshot.layers,
                    features: snapshot.features,
                    memberships: snapshot.memberships,
                    version: snapshot.version,
                    activeLayerId: null,
                    status: "ready",
                    hasUnsavedChanges: false,
                });
            } catch {
                set({ status: "error" });
            }
        },

        saveWorkspace: async () => {
            const { layers, features, memberships, version } = get();
            try {
                const snapshot = await putWorkspace(version, {
                    layers,
                    features,
                    memberships,
                });
                set({
                    layers: snapshot.layers,
                    features: snapshot.features,
                    memberships: snapshot.memberships,
                    version: snapshot.version,
                    status: "ready",
                    hasUnsavedChanges: false,
                });
                return "saved";
            } catch (error) {
                if (error instanceof WorkspaceConflictError) return "conflict";
                return "error";
            }
        },

        resetWorkspace: () => {
            set({ ...initialData, hasUnsavedChanges: false });
        },

        addLayer: (name, parentId) => {
            const id = newId();
            const order = nextOrder(
                get().layers.filter((l) => l.parentId === parentId),
            );
            const layer: WorkspaceLayer = {
                id,
                name,
                parentId,
                order,
                defaultStyle: {},
            };
            markDirty({ layers: [...get().layers, layer] });
            return id;
        },

        renameLayer: (layerId, name) => {
            markDirty({
                layers: get().layers.map((l) =>
                    l.id === layerId ? { ...l, name } : l,
                ),
            });
        },

        deleteLayer: (layerId) => {
            const subtree = new Set([
                layerId,
                ...getDescendantLayerIds(get().layers, layerId),
            ]);
            const nextActiveLayerId = subtree.has(get().activeLayerId ?? "")
                ? null
                : get().activeLayerId;
            const removed = get().memberships.filter((m) =>
                subtree.has(m.layerId),
            );
            const memberships = get().memberships.filter(
                (m) => !subtree.has(m.layerId),
            );
            markDirty({
                layers: get().layers.filter((l) => !subtree.has(l.id)),
                memberships,
                features: withoutOrphans(
                    get().features,
                    memberships,
                    new Set(removed.map((m) => m.featureId)),
                ),
                activeLayerId: nextActiveLayerId,
            });
        },

        reorderLayer: (parentId, orderedLayerIds) => {
            const orderById = new Map(
                orderedLayerIds.map((id, index) => [id, index]),
            );
            markDirty({
                layers: get().layers.map((l) =>
                    l.parentId === parentId && orderById.has(l.id)
                        ? { ...l, order: orderById.get(l.id)! }
                        : l,
                ),
            });
        },

        reparentLayer: (layerId, newParentId) => {
            if (wouldCreateCycle(get().layers, layerId, newParentId))
                return false;
            const order = nextOrder(
                get().layers.filter(
                    (l) => l.parentId === newParentId && l.id !== layerId,
                ),
            );
            markDirty({
                layers: get().layers.map((l) =>
                    l.id === layerId
                        ? { ...l, parentId: newParentId, order }
                        : l,
                ),
            });
            return true;
        },

        setLayerDefaultStyle: (layerId, style) => {
            markDirty({
                layers: get().layers.map((l) =>
                    l.id === layerId
                        ? {
                              ...l,
                              defaultStyle: { ...l.defaultStyle, ...style },
                          }
                        : l,
                ),
            });
        },

        clearLayerDefaultStyleProperty: (layerId, property) => {
            markDirty({
                layers: get().layers.map((l) => {
                    if (l.id !== layerId) return l;
                    const defaultStyle = { ...l.defaultStyle };
                    delete defaultStyle[property];
                    return { ...l, defaultStyle };
                }),
            });
        },

        setActiveLayer: (layerId) => set({ activeLayerId: layerId }),

        drawFeature: (type, geometry) => {
            const activeLayerId = get().activeLayerId;
            if (!activeLayerId) return null;
            const now = new Date().toISOString();
            const featureId = newId();
            const membershipId = newId();
            const order = nextOrder(
                get().memberships.filter((m) => m.layerId === activeLayerId),
            );
            const feature: WorkspaceFeature = {
                id: featureId,
                type,
                geometry,
                createdAt: now,
                updatedAt: now,
                inEffect: true,
                bufferEnabled: false,
                bufferDistanceM: DEFAULT_BUFFER_DISTANCE_M,
            };
            const membership: WorkspaceMembership = {
                id: membershipId,
                featureId,
                layerId: activeLayerId,
                order,
                styleOverride: {},
                visible: true,
            };
            markDirty({
                features: [...get().features, feature],
                memberships: [...get().memberships, membership],
            });
            return { featureId, membershipId };
        },

        editFeatureGeometry: (featureId, geometry) => {
            markDirty({
                features: get().features.map((f) =>
                    f.id === featureId
                        ? {
                              ...f,
                              geometry,
                              updatedAt: new Date().toISOString(),
                          }
                        : f,
                ),
            });
        },

        renameFeature: (featureId, name) => {
            markDirty({
                features: get().features.map((f) =>
                    f.id === featureId ? { ...f, name } : f,
                ),
            });
        },

        setFeatureInEffect: (featureId, inEffect) => {
            markDirty(
                applyInEffect(
                    get().features,
                    get().memberships,
                    new Set([featureId]),
                    inEffect,
                ),
            );
        },

        setFeatureBuffer: (featureId, patch) => {
            const { distanceM } = patch;
            const isDistanceValid =
                distanceM === undefined ||
                (Number.isFinite(distanceM) &&
                    distanceM >= MIN_BUFFER_DISTANCE_M &&
                    distanceM <= MAX_BUFFER_DISTANCE_M);
            if (!isDistanceValid) return;
            markDirty({
                features: get().features.map((f) =>
                    f.id === featureId
                        ? {
                              ...f,
                              bufferEnabled: patch.enabled ?? f.bufferEnabled,
                              bufferDistanceM: distanceM ?? f.bufferDistanceM,
                          }
                        : f,
                ),
            });
        },

        setLayerChildrenInEffect: (layerId, inEffect) => {
            const subtree = new Set([
                layerId,
                ...getDescendantLayerIds(get().layers, layerId),
            ]);
            const featureIds = new Set(
                get()
                    .memberships.filter((m) => subtree.has(m.layerId))
                    .map((m) => m.featureId),
            );
            markDirty(
                applyInEffect(
                    get().features,
                    get().memberships,
                    featureIds,
                    inEffect,
                ),
            );
        },

        setMembershipStyleOverride: (membershipId, styleOverride) => {
            markDirty({
                memberships: get().memberships.map((m) =>
                    m.id === membershipId
                        ? {
                              ...m,
                              styleOverride: {
                                  ...m.styleOverride,
                                  ...styleOverride,
                              },
                          }
                        : m,
                ),
            });
        },

        resetMembershipStyleProperty: (membershipId, property) => {
            markDirty({
                memberships: get().memberships.map((m) => {
                    if (m.id !== membershipId) return m;
                    const styleOverride = { ...m.styleOverride };
                    delete styleOverride[property];
                    return { ...m, styleOverride };
                }),
            });
        },

        moveFeatureToLayer: (membershipId, targetLayerId) => {
            const membership = get().memberships.find(
                (m) => m.id === membershipId,
            );
            if (!membership) return null;
            const isAlreadyInTarget = get().memberships.some(
                (m) =>
                    m.featureId === membership.featureId &&
                    m.layerId === targetLayerId,
            );
            if (isAlreadyInTarget) return null;
            const resolvedStyle = resolveMembershipStyle(
                get().layers,
                membership,
            );
            const newMembershipId = newId();
            const order = nextOrder(
                get().memberships.filter((m) => m.layerId === targetLayerId),
            );
            const newMembership: WorkspaceMembership = {
                id: newMembershipId,
                featureId: membership.featureId,
                layerId: targetLayerId,
                order,
                styleOverride: resolvedStyle,
                visible: membership.visible,
            };
            markDirty({
                memberships: [
                    ...get().memberships.filter((m) => m.id !== membershipId),
                    newMembership,
                ],
            });
            return newMembershipId;
        },

        duplicateFeatureToLayer: (membershipId, targetLayerId) => {
            const membership = get().memberships.find(
                (m) => m.id === membershipId,
            );
            if (!membership) return null;

            const existing = get().memberships.find(
                (m) =>
                    m.featureId === membership.featureId &&
                    m.layerId === targetLayerId,
            );
            if (existing) return existing.id;

            const resolvedStyle = resolveMembershipStyle(
                get().layers,
                membership,
            );
            const newMembershipId = newId();
            const order = nextOrder(
                get().memberships.filter((m) => m.layerId === targetLayerId),
            );
            const newMembership: WorkspaceMembership = {
                id: newMembershipId,
                featureId: membership.featureId,
                layerId: targetLayerId,
                order,
                styleOverride: resolvedStyle,
                visible: true,
            };
            markDirty({ memberships: [...get().memberships, newMembership] });
            return newMembershipId;
        },

        reorderMembership: (layerId, orderedMembershipIds) => {
            const orderById = new Map(
                orderedMembershipIds.map((id, index) => [id, index]),
            );
            markDirty({
                memberships: get().memberships.map((m) =>
                    m.layerId === layerId && orderById.has(m.id)
                        ? { ...m, order: orderById.get(m.id)! }
                        : m,
                ),
            });
        },

        removeMembership: (membershipId) => {
            const removed = get().memberships.find(
                (m) => m.id === membershipId,
            );
            if (!removed) return;
            const memberships = get().memberships.filter(
                (m) => m.id !== membershipId,
            );
            markDirty({
                memberships,
                features: withoutOrphans(
                    get().features,
                    memberships,
                    new Set([removed.featureId]),
                ),
            });
        },

        deleteFeature: (featureId) => {
            markDirty({
                features: get().features.filter((f) => f.id !== featureId),
                memberships: get().memberships.filter(
                    (m) => m.featureId !== featureId,
                ),
            });
        },

        toggleMembershipVisibility: (membershipId, visible) => {
            set({
                memberships: get().memberships.map((m) =>
                    m.id === membershipId ? { ...m, visible } : m,
                ),
            });
            pushVisibility([{ membershipId, visible }]);
        },

        toggleLayerVisibility: (layerId, visible) => {
            const subtree = new Set([
                layerId,
                ...getDescendantLayerIds(get().layers, layerId),
            ]);
            const affected = get()
                .memberships.filter((m) => subtree.has(m.layerId))
                .map((m) => ({ membershipId: m.id, visible }));
            set({
                memberships: get().memberships.map((m) =>
                    subtree.has(m.layerId) ? { ...m, visible } : m,
                ),
            });
            pushVisibility(affected);
        },
    };

    initialWorkspaceState = state;
    return state;
});
