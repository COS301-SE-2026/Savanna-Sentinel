import { useEffect, useMemo, useRef, useState } from "react";
import type * as maplibregl from "maplibre-gl";

import { MapView } from "@/components/map/MapView";
import { MapControls } from "@/components/map/MapControls";
import { HeatmapLayer } from "@/components/map/HeatmapLayer";
import { LoadingPill } from "@/components/map/LoadingPill";
import { Button } from "@/components/ui/button";
import { notifyCritical, notifySafe } from "@/components/ui/toast";
import { WorkspaceMapLayers } from "@/components/workspace/WorkspaceMapLayers";
import { DrawToolbar } from "@/components/workspace/DrawToolbar";
import { LayerTreePanel } from "@/components/workspace/LayerTreePanel";
import {
    StyleEditorPanel,
    type WorkspaceSelection,
} from "@/components/workspace/StyleEditorPanel";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { resolveVisibleFeatures } from "@/lib/workspace/resolveVisibleFeatures";
import { useMapStore } from "@/store/mapStore";
import { useIsMobile } from "@/hooks/use-mobile";
import { PARK_CENTER_FALLBACK, scoresByCell } from "@/lib/riskGrid";

const DEFAULT_ZOOM = 10;
const HEATMAP_BEFORE_ID = "workspace-polygons-fill";
const DRAW_CLICK_GUARD_MS = 300;

export default function WorkspacePage() {
    const isMobile = useIsMobile();
    const [map, setMap] = useState<maplibregl.Map | null>(null);

    const activeLayerId = useWorkspaceStore((s) => s.activeLayerId);
    const setActiveLayer = useWorkspaceStore((s) => s.setActiveLayer);
    const memberships = useWorkspaceStore((s) => s.memberships);
    const features = useWorkspaceStore((s) => s.features);
    const hasUnsavedChanges = useWorkspaceStore((s) => s.hasUnsavedChanges);
    const saveWorkspace = useWorkspaceStore((s) => s.saveWorkspace);

    const [selection, setSelection] = useState<WorkspaceSelection>(null);
    const [editingFeatureId, setEditingFeatureId] = useState<string | null>(
        null,
    );
    const [finishEditSignal, setFinishEditSignal] = useState(0);
    const [cancelEditSignal, setCancelEditSignal] = useState(0);
    const [activeDrawMode, setActiveDrawMode] = useState("select");
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

    useEffect(() => {
        loadGrid();
        loadSnapshots();
    }, [loadGrid, loadSnapshots]);

    function handleSelectLayer(layerId: string) {
        setActiveLayer(layerId);
        setSelection({ kind: "layer", layerId });
    }

    function handleSelectMembership(membershipId: string) {
        if (editingFeatureId) return;
        setSelection({ kind: "membership", membershipId });
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
        if (rendered)
            setSelection({
                kind: "membership",
                membershipId: rendered.membershipId,
            });
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

    function handleSave() {
        if (saveWorkspace()) {
            notifySafe("Workspace saved");
        } else {
            notifyCritical(
                "Could not save workspace",
                "Browser storage is full or unavailable. Your changes are still open but will be lost on reload.",
            );
        }
    }

    return (
        <div className="flex h-[calc(100dvh-3.5rem)] flex-col md:flex-row">
            <aside className="max-h-[40%] w-full shrink-0 overflow-y-auto border-r border-color-border bg-color-surface-raised md:max-h-none md:w-[280px]">
                <LayerTreePanel
                    activeLayerId={activeLayerId}
                    selection={selection}
                    readOnly={isMobile}
                    heatmapVisible={isHeatmapVisible}
                    onToggleHeatmap={setHeatmapVisible}
                    onSelectLayer={handleSelectLayer}
                    onSelectMembership={handleSelectMembership}
                />
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
                />
                <MapControls
                    map={map}
                    defaultCenter={PARK_CENTER_FALLBACK}
                    defaultZoom={DEFAULT_ZOOM}
                />
                <HeatmapLayer
                    map={map}
                    grid={grid}
                    riskByCell={riskByCell}
                    pickingActive
                    isMobile={isMobile}
                    beforeId={HEATMAP_BEFORE_ID}
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
                        onFeatureDrawn={handleFeatureDrawn}
                    />
                )}
                {!isMobile && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="absolute right-2 bottom-2 z-[var(--z-sticky)] bg-color-surface-raised shadow-sm"
                        disabled={!hasUnsavedChanges}
                        onClick={handleSave}
                    >
                        Save
                    </Button>
                )}
                {gridStatus === "loading" && <LoadingPill label="Loading..." />}
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
        </div>
    );
}
