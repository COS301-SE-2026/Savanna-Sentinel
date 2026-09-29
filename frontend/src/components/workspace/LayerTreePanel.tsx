import { useState } from "react";
import { Plus } from "lucide-react";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import {
    SortableContext,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { computeReorderedSiblingIds } from "@/lib/workspace/tree";
import { LayerTreeNode } from "./LayerTreeNode";
import { LayerPickerDialog } from "./LayerPickerDialog";
import type { WorkspaceSelection } from "./StyleEditorPanel";

const selectedRowClass = "bg-brand-primary/10";

export interface LayerTreePanelProps {
    activeLayerId: string | null;
    selection?: WorkspaceSelection;
    readOnly?: boolean;
    rootLayersCollapsed?: boolean;
    heatmapVisible?: boolean;
    onToggleHeatmap?: (visible: boolean) => void;
    heatmapSelected?: boolean;
    onSelectHeatmap?: () => void;
    heatmapOpacity?: number;
    onHeatmapOpacityChange?: (opacity: number) => void;
    showHeatmapOpacitySlider?: boolean;
    locationVisible?: boolean;
    onToggleLocation?: (visible: boolean) => void;
    hasRoute?: boolean;
    routeVisible?: boolean;
    onToggleRoute?: (visible: boolean) => void;
    onRemoveRoute?: () => void;
    patrolRouteSelected?: boolean;
    onSelectPatrolRoute?: () => void;
    onSelectLayer: (layerId: string) => void;
    onSelectMembership: (membershipId: string) => void;
}

export function LayerTreePanel({
    activeLayerId,
    selection = null,
    readOnly = false,
    rootLayersCollapsed = false,
    heatmapVisible = false,
    onToggleHeatmap = () => {},
    heatmapSelected = false,
    onSelectHeatmap = () => {},
    heatmapOpacity = 30,
    onHeatmapOpacityChange = () => {},
    showHeatmapOpacitySlider = true,
    locationVisible = false,
    onToggleLocation = () => {},
    hasRoute = false,
    routeVisible = false,
    onToggleRoute = () => {},
    onRemoveRoute,
    patrolRouteSelected = false,
    onSelectPatrolRoute,
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
                                defaultExpanded={!rootLayersCollapsed}
                                onSelectLayer={onSelectLayer}
                                onSelectMembership={onSelectMembership}
                                onMoveMembership={setMoveMembershipId}
                                onDuplicateMembership={setDuplicateMembershipId}
                            />
                        ))}
                    </SortableContext>

                    <li className="list-none">
                        <div
                            className={`flex min-h-9 items-center gap-1 pr-2 ${heatmapSelected ? selectedRowClass : ""}`}
                        >
                            {!readOnly && <span className="size-5 shrink-0" />}
                            <span className="size-5 shrink-0" />
                            <Checkbox
                                checked={heatmapVisible}
                                onChange={(e) =>
                                    onToggleHeatmap(e.target.checked)
                                }
                                aria-label="Toggle visibility for Heatmap"
                            />
                            <button
                                type="button"
                                aria-current={
                                    heatmapSelected ? "true" : undefined
                                }
                                onClick={onSelectHeatmap}
                                className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-color-text-primary"
                            >
                                Heatmap
                            </button>
                        </div>
                        {heatmapSelected && showHeatmapOpacitySlider && (
                            <div className="px-2 pb-2 pl-11">
                                <div className="mb-1 flex items-center justify-between text-sm text-color-text-primary">
                                    <span>Opacity</span>
                                    <span>{heatmapOpacity}%</span>
                                </div>
                                <Slider
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={heatmapOpacity}
                                    aria-label="Heatmap opacity"
                                    onChange={(e) =>
                                        onHeatmapOpacityChange(
                                            Number(e.target.value),
                                        )
                                    }
                                />
                            </div>
                        )}
                    </li>

                    <li className="list-none">
                        <div className="flex min-h-9 items-center gap-1 pr-2">
                            {!readOnly && <span className="size-5 shrink-0" />}
                            <span className="size-5 shrink-0" />
                            <Checkbox
                                checked={locationVisible}
                                onChange={(e) =>
                                    onToggleLocation(e.target.checked)
                                }
                                aria-label="Toggle visibility for My Location"
                            />
                            <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-color-text-primary">
                                My Location
                            </span>
                        </div>
                    </li>

                    {hasRoute && (
                        <li className="list-none">
                            <div
                                className={`flex min-h-9 items-center gap-1 pr-2 ${patrolRouteSelected ? selectedRowClass : ""}`}
                            >
                                {!readOnly && (
                                    <span className="size-5 shrink-0" />
                                )}
                                <span className="size-5 shrink-0" />
                                <Checkbox
                                    checked={routeVisible}
                                    onChange={(e) =>
                                        onToggleRoute(e.target.checked)
                                    }
                                    aria-label="Toggle visibility for Patrol Route"
                                />
                                {onSelectPatrolRoute ? (
                                    <button
                                        type="button"
                                        aria-current={
                                            patrolRouteSelected
                                                ? "true"
                                                : undefined
                                        }
                                        onClick={onSelectPatrolRoute}
                                        className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-color-text-primary"
                                    >
                                        Patrol Route
                                    </button>
                                ) : (
                                    <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-color-text-primary">
                                        Patrol Route
                                    </span>
                                )}
                                {onRemoveRoute && (
                                    <button
                                        type="button"
                                        onClick={onRemoveRoute}
                                        className="rounded-sm px-1 text-xs text-color-text-secondary underline hover:text-color-text-primary focus-visible:ring-2 focus-visible:ring-brand-primary"
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                        </li>
                    )}
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
