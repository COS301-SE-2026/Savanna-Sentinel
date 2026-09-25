import type { WorkspaceLayer, WorkspaceMembership } from "./types";

export function wouldCreateCycle(
    layers: WorkspaceLayer[],
    layerId: string,
    newParentId: string | null,
): boolean {
    if (newParentId === null) return false;
    if (newParentId === layerId) return true;
    const byId = new Map(layers.map((l) => [l.id, l]));
    let current = byId.get(newParentId);
    while (current) {
        if (current.id === layerId) return true;
        current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return false;
}

export function getDescendantLayerIds(
    layers: WorkspaceLayer[],
    layerId: string,
): string[] {
    const children = layers.filter((l) => l.parentId === layerId);
    const result: string[] = [];
    for (const child of children) {
        result.push(child.id);
        result.push(...getDescendantLayerIds(layers, child.id));
    }
    return result;
}

export type LayerCheckboxState = "checked" | "unchecked" | "indeterminate";

export function computeLayerCheckboxState(
    layers: WorkspaceLayer[],
    memberships: WorkspaceMembership[],
    layerId: string,
): LayerCheckboxState {
    const subtreeLayerIds = new Set([
        layerId,
        ...getDescendantLayerIds(layers, layerId),
    ]);
    const subtreeMemberships = memberships.filter((m) =>
        subtreeLayerIds.has(m.layerId),
    );
    if (subtreeMemberships.length === 0) return "unchecked";
    const visibleCount = subtreeMemberships.filter((m) => m.visible).length;
    if (visibleCount === 0) return "unchecked";
    if (visibleCount === subtreeMemberships.length) return "checked";
    return "indeterminate";
}

export function getPrecedenceOrderedLayerIds(
    layers: WorkspaceLayer[],
): string[] {
    const byParent = new Map<string | null, WorkspaceLayer[]>();
    for (const layer of layers) {
        const siblings = byParent.get(layer.parentId) ?? [];
        siblings.push(layer);
        byParent.set(layer.parentId, siblings);
    }
    for (const siblings of byParent.values()) {
        siblings.sort((a, b) => a.order - b.order);
    }

    const result: string[] = [];
    function visit(parentId: string | null) {
        for (const layer of byParent.get(parentId) ?? []) {
            result.push(layer.id);
            visit(layer.id);
        }
    }
    visit(null);
    return result;
}

export function computeReorderedSiblingIds(
    siblingIdsInOrder: string[],
    activeId: string,
    overId: string,
): string[] {
    const fromIndex = siblingIdsInOrder.indexOf(activeId);
    const toIndex = siblingIdsInOrder.indexOf(overId);
    if (fromIndex === -1 || toIndex === -1) return siblingIdsInOrder;
    const result = [...siblingIdsInOrder];
    result.splice(fromIndex, 1);
    result.splice(toIndex, 0, activeId);
    return result;
}
