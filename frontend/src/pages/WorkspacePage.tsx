import { useEffect, useMemo, useRef, useState } from "react";
import type * as maplibregl from "maplibre-gl";
import { useBlocker } from "react-router-dom";

import { MapView } from "@/components/map/MapView";
import { MapControls } from "@/components/map/MapControls";
import { HeatmapLayer } from "@/components/map/HeatmapLayer";
import { LoadingPill } from "@/components/map/LoadingPill";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { notifyCritical, notifySafe } from "@/components/ui/toast";
import {
    STACK_BOTTOM,
    WorkspaceMapLayers,
} from "@/components/workspace/WorkspaceMapLayers";
import { DrawToolbar } from "@/components/workspace/DrawToolbar";
import { LayerTreePanel } from "@/components/workspace/LayerTreePanel";
import {
    StyleEditorPanel,
    type WorkspaceSelection,
} from "@/components/workspace/StyleEditorPanel";
import { Slider } from "@/components/ui/slider";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { resolveVisibleFeatures } from "@/lib/workspace/resolveVisibleFeatures";
import { useMapStore } from "@/store/mapStore";
import { useIsMobile } from "@/hooks/use-mobile";
import { PARK_CENTER_FALLBACK, scoresByCell } from "@/lib/riskGrid";
import { useLayerOpacityPreview } from "@/hooks/useLayerOpacityPreview";

const DEFAULT_ZOOM = 10;
const DRAW_CLICK_GUARD_MS = 300;
const DEFAULT_HEATMAP_OPACITY_PERCENT = 30;

export default function WorkspacePage() {
    const isMobile = useIsMobile();
    const [map, setMap] = useState<maplibregl.Map | null>(null);

    const activeLayerId = useWorkspaceStore((s) => s.activeLayerId);
    const setActiveLayer = useWorkspaceStore((s) => s.setActiveLayer);
    const memberships = useWorkspaceStore((s) => s.memberships);
    const features = useWorkspaceStore((s) => s.features);
    const hasUnsavedChanges = useWorkspaceStore((s) => s.hasUnsavedChanges);
    const workspaceStatus = useWorkspaceStore((s) => s.status);
    const saveWorkspace = useWorkspaceStore((s) => s.saveWorkspace);
    const loadWorkspace = useWorkspaceStore((s) => s.loadWorkspace);
    const resetWorkspace = useWorkspaceStore((s) => s.resetWorkspace);

    const [selection, setSelection] = useState<WorkspaceSelection>(null);
    const [editingFeatureId, setEditingFeatureId] = useState<string | null>(
        null,
    );
    const [finishEditSignal, setFinishEditSignal] = useState(0);
    const [cancelEditSignal, setCancelEditSignal] = useState(0);
    const [activeDrawMode, setActiveDrawMode] = useState("select");
    const [isDrawingStroke, setIsDrawingStroke] = useState(false);
    const [isSaving, setSaving] = useState(false);
    const [isConflictOpen, setConflictOpen] = useState(false);
    const lastDrawnAtRef = useRef(-Infinity);
    const isDrawToolActive = activeDrawMode !== "select";

    const editingFeature =
        features.find((f) => f.id === editingFeatureId) ?? null;
    const selectedFeatureId =
        selection?.kind === "membership"
            ? (memberships.find((m) => m.id === selection.membershipId)
                  ?.featureId ?? null)
            : null;

    const grid = useMapStore((s) => s.grid);
    const gridStatus = useMapStore((s) => s.gridStatus);
    const cellsByRef = useMapStore((s) => s.cellsByRef);
    const riskByCell = useMemo(() => scoresByCell(cellsByRef), [cellsByRef]);
    const loadGrid = useMapStore((s) => s.loadGrid);
    const loadSnapshots = useMapStore((s) => s.loadSnapshots);

    const [isHeatmapVisible, setHeatmapVisible] = useState(true);
    const [isHeatmapSelected, setHeatmapSelected] = useState(false);
    const [heatmapOpacity, setHeatmapOpacity] = useState(
        DEFAULT_HEATMAP_OPACITY_PERCENT,
    );

    const { previewOpacity, setPreviewOpacity, label, opacityOverrides } =
        useLayerOpacityPreview(selection);
    const opacityLabel = label ?? "Heatmap opacity";
    const opacityValue = selection ? previewOpacity : heatmapOpacity;
    const onOpacityValueChange = selection
        ? setPreviewOpacity
        : setHeatmapOpacity;
    const isOpacityDisabled = !selection && !isHeatmapVisible;

    useEffect(() => {
        loadGrid();
        loadSnapshots();
        const status = useWorkspaceStore.getState().status;
        if (status === "idle" || status === "error") loadWorkspace();
    }, [loadGrid, loadSnapshots, loadWorkspace]);

    const blocker = useBlocker(hasUnsavedChanges);

    useEffect(() => {
        if (!hasUnsavedChanges) return;
        const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
            event.preventDefault();
        };
        window.addEventListener("beforeunload", warnBeforeLeaving);
        return () =>
            window.removeEventListener("beforeunload", warnBeforeLeaving);
    }, [hasUnsavedChanges]);

    function handleSelectLayer(layerId: string) {
        setHeatmapSelected(false);
        setActiveLayer(layerId);
        setSelection({ kind: "layer", layerId });
    }

    function selectMembership(membershipId: string) {
        setHeatmapSelected(false);
        const membership = useWorkspaceStore
            .getState()
            .memberships.find((m) => m.id === membershipId);
        if (membership) setActiveLayer(membership.layerId);
        setSelection({ kind: "membership", membershipId });
    }

    function handleSelectHeatmap() {
        setHeatmapSelected((selected) => !selected);
        setSelection(null);
    }

    function handleSelectMembership(membershipId: string) {
        if (editingFeatureId) return;
        selectMembership(membershipId);
    }

    function handleFeatureClick(featureId: string | null) {
        if (editingFeatureId || isDrawToolActive) return;
        if (featureId === null) {
            if (
                performance.now() - lastDrawnAtRef.current <
                DRAW_CLICK_GUARD_MS
            )
                return;
            setSelection(null);
            return;
        }
        const current = useWorkspaceStore.getState();
        const rendered = resolveVisibleFeatures(
            current.layers,
            current.features,
            current.memberships,
        ).find((r) => r.feature.id === featureId);
        if (rendered) selectMembership(rendered.membershipId);
    }

    function handleToggleEditGeometry(featureId: string) {
        if (editingFeatureId === featureId) {
            setFinishEditSignal((n) => n + 1);
        } else {
            setEditingFeatureId(featureId);
        }
    }

    function handleCancelEditGeometry() {
        setCancelEditSignal((n) => n + 1);
    }

    function handleFeatureDrawn(membershipId: string) {
        lastDrawnAtRef.current = performance.now();
        setSelection({ kind: "membership", membershipId });
    }

    async function handleSave() {
        setSaving(true);
        const result = await saveWorkspace();
        setSaving(false);

        if (result === "saved") {
            notifySafe("Workspace saved");
            return;
        }
        if (result === "conflict") {
            setConflictOpen(true);
            return;
        }
        notifyCritical(
            "Could not save workspace",
            "The server could not be reached.",
        );
    }

    function handleLeaveAndDiscard() {
        blocker.proceed?.();
        resetWorkspace();
    }

    async function handleLoadLatest() {
        setConflictOpen(false);
        setSelection(null);
        setEditingFeatureId(null);
        await loadWorkspace();
    }

    return (
        <div className="flex h-[calc(100dvh-3.5rem)] flex-col md:flex-row">
            <aside className="flex max-h-[40%] w-full shrink-0 flex-col overflow-hidden border-r border-color-border bg-color-surface-raised md:max-h-none md:w-[280px]">
                <div className="min-h-0 flex-1">
                    <LayerTreePanel
                        activeLayerId={activeLayerId}
                        selection={selection}
                        readOnly={isMobile}
                        heatmapVisible={isHeatmapVisible}
                        onToggleHeatmap={setHeatmapVisible}
                        heatmapSelected={isHeatmapSelected}
                        onSelectHeatmap={handleSelectHeatmap}
                        showHeatmapOpacitySlider={false}
                        onSelectLayer={handleSelectLayer}
                        onSelectMembership={handleSelectMembership}
                    />
                </div>
                <div className="shrink-0 border-t border-color-border p-2">
                    <div className="mb-1 flex items-center justify-between text-sm text-color-text-primary">
                        <span>{opacityLabel}</span>
                        <span>{opacityValue}%</span>
                    </div>
                    <Slider
                        min={0}
                        max={100}
                        step={1}
                        value={opacityValue}
                        disabled={isOpacityDisabled}
                        aria-label={opacityLabel}
                        onChange={(e) =>
                            onOpacityValueChange(Number(e.target.value))
                        }
                    />
                </div>
            </aside>

            <div className="relative min-h-0 flex-1 overflow-hidden">
                <MapView
                    center={PARK_CENTER_FALLBACK}
                    zoom={DEFAULT_ZOOM}
                    onMapReady={setMap}
                    onMapRemove={() => setMap(null)}
                    className="absolute inset-0"
                />
                <WorkspaceMapLayers
                    map={map}
                    excludedFeatureId={editingFeatureId}
                    selectedFeatureId={selectedFeatureId}
                    onFeatureClick={handleFeatureClick}
                    opacityOverrides={opacityOverrides}
                />
                <MapControls
                    map={map}
                    defaultCenter={PARK_CENTER_FALLBACK}
                    defaultZoom={DEFAULT_ZOOM}
                    zoomDisabled={isDrawingStroke}
                />
                <HeatmapLayer
                    map={map}
                    grid={grid}
                    riskByCell={riskByCell}
                    pickingActive
                    isMobile={isMobile}
                    opacityOverride={heatmapOpacity / 100}
                    beforeId={STACK_BOTTOM}
                    visible={isHeatmapVisible}
                />
                {!isMobile && (
                    <DrawToolbar
                        map={map}
                        activeLayerId={activeLayerId}
                        editingFeature={editingFeature}
                        onEditingFeatureHandled={() =>
                            setEditingFeatureId(null)
                        }
                        finishEditSignal={finishEditSignal}
                        cancelEditSignal={cancelEditSignal}
                        onModeChange={setActiveDrawMode}
                        onDrawingChange={setIsDrawingStroke}
                        onFeatureDrawn={handleFeatureDrawn}
                        trailing={
                            <Button
                                type="button"
                                variant="outline"
                                className="h-auto rounded-lg border border-color-border bg-color-surface-raised px-4 shadow-md"
                                disabled={!hasUnsavedChanges || isSaving}
                                onClick={handleSave}
                            >
                                {isSaving ? "Saving..." : "Save"}
                            </Button>
                        }
                    />
                )}
                {(gridStatus === "loading" ||
                    workspaceStatus === "loading") && (
                    <LoadingPill label="Loading..." />
                )}
            </div>

            {!isMobile && (
                <aside className="w-[320px] shrink-0 overflow-y-auto border-l border-color-border bg-color-surface-raised">
                    <StyleEditorPanel
                        selection={selection}
                        editingFeatureId={editingFeatureId}
                        onToggleEditGeometry={handleToggleEditGeometry}
                        onCancelEditGeometry={handleCancelEditGeometry}
                    />
                </aside>
            )}

            <Dialog open={isConflictOpen} onOpenChange={setConflictOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Workspace changed elsewhere</DialogTitle>
                        <DialogDescription>
                            Someone else saved the workspace while you were
                            working, so nothing was saved. Loading the latest
                            version discards your unsaved edits.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setConflictOpen(false)}
                        >
                            Keep editing
                        </Button>
                        <Button type="button" onClick={handleLoadLatest}>
                            Load latest version
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={blocker.state === "blocked"}
                onOpenChange={(open) => {
                    if (!open) blocker.reset?.();
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Unsaved changes</DialogTitle>
                    </DialogHeader>
                    <DialogDescription>
                        You have workspace changes that have not been saved.
                        Leaving this page discards them.
                    </DialogDescription>
                    <DialogFooter className="grid grid-cols-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => blocker.reset?.()}
                        >
                            Stay
                        </Button>
                        <Button type="button" onClick={handleLeaveAndDiscard}>
                            Discard and leave
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
