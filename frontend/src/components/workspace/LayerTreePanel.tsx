import { useState } from "react";
import { Plus } from "lucide-react";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import {
    SortableContext,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { computeReorderedSiblingIds } from "@/lib/workspace/tree";
import { LayerTreeNode } from "./LayerTreeNode";
import { LayerPickerDialog } from "./LayerPickerDialog";
import type { WorkspaceSelection } from "./StyleEditorPanel";

export interface LayerTreePanelProps {
    activeLayerId: string | null;
    selection?: WorkspaceSelection;
    readOnly?: boolean;
    heatmapVisible?: boolean;
    onToggleHeatmap?: (visible: boolean) => void;
    onSelectLayer: (layerId: string) => void;
    onSelectMembership: (membershipId: string) => void;
}

export function LayerTreePanel({
    activeLayerId,
    selection = null,
    readOnly = false,
    heatmapVisible = false,
    onToggleHeatmap = () => {},
    onSelectLayer,
    onSelectMembership,
}: LayerTreePanelProps) {
    const layers = useWorkspaceStore((s) => s.layers);
    const memberships = useWorkspaceStore((s) => s.memberships);
    const addLayer = useWorkspaceStore((s) => s.addLayer);
    const moveFeatureToLayer = useWorkspaceStore((s) => s.moveFeatureToLayer);
    const duplicateFeatureToLayer = useWorkspaceStore(
        (s) => s.duplicateFeatureToLayer,
    );

    const [moveMembershipId, setMoveMembershipId] = useState<string | null>(
        null,
    );
    const [duplicateMembershipId, setDuplicateMembershipId] = useState<
        string | null
    >(null);
    const moveFeatureId = memberships.find(
        (m) => m.id === moveMembershipId,
    )?.featureId;
    const moveFeatureLayerIds = memberships
        .filter((m) => m.featureId === moveFeatureId)
        .map((m) => m.layerId);
    const duplicateFeatureId = memberships.find(
        (m) => m.id === duplicateMembershipId,
    )?.featureId;
    const duplicateFeatureLayerIds = memberships
        .filter((m) => m.featureId === duplicateFeatureId)
        .map((m) => m.layerId);

    const topLevelLayers = layers
        .filter((l) => l.parentId === null)
        .sort((a, b) => a.order - b.order);

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const draggedLayer = layers.find((l) => l.id === active.id);
        if (draggedLayer) {
            const siblingIds = layers
                .filter((l) => l.parentId === draggedLayer.parentId)
                .sort((a, b) => a.order - b.order)
                .map((l) => l.id);
            const reordered = computeReorderedSiblingIds(
                siblingIds,
                String(active.id),
                String(over.id),
            );
            useWorkspaceStore
                .getState()
                .reorderLayer(draggedLayer.parentId, reordered);
            return;
        }

        const draggedMembership = memberships.find((m) => m.id === active.id);
        if (!draggedMembership) return;
        const siblingIds = memberships
            .filter((m) => m.layerId === draggedMembership.layerId)
            .sort((a, b) => a.order - b.order)
            .map((m) => m.id);
        const reordered = computeReorderedSiblingIds(
            siblingIds,
            String(active.id),
            String(over.id),
        );
        useWorkspaceStore
            .getState()
            .reorderMembership(draggedMembership.layerId, reordered);
    }

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-color-border p-2">
                <span className="text-sm font-semibold text-color-text-primary">
                    Layers
                </span>
                {!readOnly && (
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => addLayer(undefined, null)}
                    >
                        <Plus className="size-4" />
                        New layer
                    </Button>
                )}
            </div>

            <DndContext onDragEnd={handleDragEnd}>
                <ul className="m-0 flex-1 list-none overflow-y-auto p-0">
                    <SortableContext
                        items={topLevelLayers.map((l) => l.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {topLevelLayers.map((layer) => (
                            <LayerTreeNode
                                key={layer.id}
                                layer={layer}
                                depth={0}
                                activeLayerId={activeLayerId}
                                selection={selection}
                                readOnly={readOnly}
                                onSelectLayer={onSelectLayer}
                                onSelectMembership={onSelectMembership}
                                onMoveMembership={setMoveMembershipId}
                                onDuplicateMembership={setDuplicateMembershipId}
                            />
                        ))}
                    </SortableContext>

                    <li className="list-none">
                        <div className="flex min-h-9 items-center gap-1 pr-2">
                            {!readOnly && <span className="size-5 shrink-0" />}
                            <span className="size-5 shrink-0" />
                            <Checkbox
                                checked={heatmapVisible}
                                onChange={(e) =>
                                    onToggleHeatmap(e.target.checked)
                                }
                                aria-label="Toggle visibility for Heatmap"
                            />
                            <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-color-text-primary">
                                Heatmap
                            </span>
                        </div>
                    </li>
                </ul>
            </DndContext>

            <LayerPickerDialog
                open={moveMembershipId !== null}
                onOpenChange={(open) => !open && setMoveMembershipId(null)}
                title="Move to layer"
                excludeLayerIds={moveFeatureLayerIds}
                onPick={(layerId) => {
                    if (moveMembershipId)
                        moveFeatureToLayer(moveMembershipId, layerId);
                }}
            />
            <LayerPickerDialog
                open={duplicateMembershipId !== null}
                onOpenChange={(open) => !open && setDuplicateMembershipId(null)}
                title="Duplicate to layer"
                excludeLayerIds={duplicateFeatureLayerIds}
                onPick={(layerId) => {
                    if (duplicateMembershipId)
                        duplicateFeatureToLayer(duplicateMembershipId, layerId);
                }}
            />
        </div>
    );
}
