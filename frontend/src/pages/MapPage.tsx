import { useEffect, useMemo, useState } from "react";
import type * as maplibregl from "maplibre-gl";

import { MapView } from "@/components/map/MapView";
import { MapControls } from "@/components/map/MapControls";
import { MapLegend } from "@/components/map/MapLegend";
import { HeatmapLayer } from "@/components/map/HeatmapLayer";
import { LoadingPill } from "@/components/map/LoadingPill";
import { ExplainabilityPanel } from "@/components/map/ExplainabilityPanel";
import { NoDataBanner } from "@/components/map/NoDataBanner";
import { UserLocationLayer } from "@/components/map/UserLocationLayer";
import { UserLocationNotice } from "@/components/map/UserLocationNotice";
import { PatrolRouteLayer } from "@/components/map/PatrolRouteLayer";
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerTitle,
} from "@/components/ui/drawer";
import { useMapStore } from "@/store/mapStore";
import { useAuthStore } from "@/store/authStore";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserLocation } from "@/hooks/useUserLocation";
import { getSnapHeightPx } from "@/lib/utils";
import { toLatLon, toPlannedRoute } from "@/lib/patrolRoute";
import { clearPinnedRoute, loadPinnedRoute } from "@/offline/pinnedRouteCache";
import type { SavedRoute } from "@/services/routeApi";
import {
    PARK_CENTER_FALLBACK,
    getGridCenterAndBounds,
    parseGridCells,
    scoresByCell,
} from "@/lib/riskGrid";
import { LayerTreePanel } from "@/components/workspace/LayerTreePanel";
import { WorkspaceMapLayers } from "@/components/workspace/WorkspaceMapLayers";
import type { WorkspaceSelection } from "@/components/workspace/StyleEditorPanel";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { resolveVisibleFeatures } from "@/lib/workspace/resolveVisibleFeatures";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Layers, SlidersHorizontal } from "lucide-react";

const DEFAULT_ZOOM = 10;

const COLLAPSED_SNAP = "24px";
const EXPANDED_SNAP = 0.6;
const FULL_SNAP = 1;

const DEFAULT_OPACITY_PERCENT = 55;

export default function MapPage() {
    const isMobile = useIsMobile();
    const [map, setMap] = useState<maplibregl.Map | null>(null);
    const [mapCenter, setMapCenter] =
        useState<[number, number]>(PARK_CENTER_FALLBACK);

    const grid = useMapStore((s) => s.grid);
    const gridStatus = useMapStore((s) => s.gridStatus);
    const cellsByRef = useMapStore((s) => s.cellsByRef);
    const riskByCell = useMemo(() => scoresByCell(cellsByRef), [cellsByRef]);
    const heatmapStatus = useMapStore((s) => s.heatmapStatus);
    const isGridStale = useMapStore((s) => s.gridStale);
    const loadGrid = useMapStore((s) => s.loadGrid);
    const loadSnapshots = useMapStore((s) => s.loadSnapshots);
    const loadSummary = useMapStore((s) => s.loadSummary);

    const [isHeatmapVisible, setHeatmapVisible] = useState(true);
    const [opacity, setOpacity] = useState(DEFAULT_OPACITY_PERCENT);
    const [isNoDataBannerDismissed, setIsNoDataBannerDismissed] =
        useState(false);

    const [drawerSnap, setDrawerSnap] = useState<string | number | null>(
        COLLAPSED_SNAP,
    );
    const [selection, setSelection] = useState<WorkspaceSelection>(null);
    const memberships = useWorkspaceStore((s) => s.memberships);
    const loadWorkspace = useWorkspaceStore((s) => s.loadWorkspace);

    const selectedFeatureId =
        selection?.kind === "membership"
            ? (memberships.find((m) => m.id === selection.membershipId)
                  ?.featureId ?? null)
            : null;

    useEffect(() => {
        const status = useWorkspaceStore.getState().status;
        if (status === "idle" || status === "error") {
            loadWorkspace();
        }
    }, [loadWorkspace]);

    function handleFeatureClick(featureId: string | null) {
        if (!featureId) {
            setSelection(null);
            return;
        }

        const current = useWorkspaceStore.getState();
        const rendered = resolveVisibleFeatures(
            current.layers,
            current.features,
            current.memberships,
        ).find((r) => r.feature.id === featureId);

        if (rendered) {
            setSelection({
                kind: "membership",
                membershipId: rendered.membershipId,
            });
        }
    }

    function handleSelectLayer(layerId: string | undefined) {
        if (!layerId) {
            setSelection(null);
            return;
        }

        setSelection({
            kind: "layer",
            layerId,
        });
    }

    function handleSelectMembership(membershipId: string | undefined) {
        if (!membershipId) {
            setSelection(null);
            return;
        }

        setSelection({
            kind: "membership",
            membershipId,
        });
    }

    useEffect(() => {
        loadGrid();
        loadSnapshots();
        loadSummary();
    }, [loadGrid, loadSnapshots, loadSummary]);

    useEffect(() => {
        if (!grid || !map) return;
        const cells = parseGridCells(grid);
        if (cells.length === 0) return;
        const { center, bounds } = getGridCenterAndBounds(cells);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- recentering on a new grid is an effect sync
        setMapCenter(center);
        map.fitBounds(bounds, { padding: 40, animate: false });
    }, [grid, map]);

    useEffect(() => {
        if (heatmapStatus === "no-data") {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- re-arms the dismissal flag on a new no-data state
            setIsNoDataBannerDismissed(false);
        }
    }, [heatmapStatus]);

    const [isLocationVisible, setLocationVisible] = useState(false);
    const { location: userLocation, status: userLocationStatus } =
        useUserLocation(isLocationVisible);

    const userId = useAuthStore((s) => s.user?.id ?? null);
    const [pinnedRoute, setPinnedRoute] = useState<SavedRoute | null>(null);
    const [isRouteVisible, setRouteVisible] = useState(true);

    useEffect(() => {
        let isCurrent = true;
        loadPinnedRoute(userId)
            .then((route) => {
                if (isCurrent) setPinnedRoute(route);
            })
            .catch(() => {});
        return () => {
            isCurrent = false;
        };
    }, [userId]);

    const routeForLayer = useMemo(
        () => (pinnedRoute ? [toPlannedRoute(pinnedRoute)] : []),
        [pinnedRoute],
    );

    async function handleRemoveRoute() {
        await clearPinnedRoute().catch(() => {});
        setPinnedRoute(null);
    }

    const bottomAnchorStyle = isMobile
        ? {
              bottom: `calc(${Math.min(
                  getSnapHeightPx(drawerSnap ?? COLLAPSED_SNAP),
                  getSnapHeightPx(EXPANDED_SNAP),
              )}px + 0.5rem)`,
          }
        : undefined;

    const panelProps = {
        heatmapVisible: isHeatmapVisible,
        onHeatmapVisibleChange: setHeatmapVisible,
        locationVisible: isLocationVisible,
        onLocationVisibleChange: setLocationVisible,
        opacity,
        onOpacityChange: setOpacity,
        gridStale: isGridStale,
        hasRoute: pinnedRoute !== null,
        routeVisible: isRouteVisible,
        onRouteVisibleChange: setRouteVisible,
        onRemoveRoute: handleRemoveRoute,
    };

    return (
        <div className="flex h-[calc(100vh-3.5rem)] flex-col md:flex-row">
            {!isMobile && (
                <aside className="w-[280px] shrink-0 overflow-y-auto border-r border-color-border bg-color-surface-raised">
                    <ExplainabilityPanel {...panelProps} />
                </aside>
            )}

            <div className="relative min-h-0 flex-1 overflow-hidden">
                <MapView
                    center={mapCenter}
                    zoom={DEFAULT_ZOOM}
                    onMapReady={setMap}
                    onMapRemove={() => setMap(null)}
                    className="absolute inset-0"
                />
                <MapControls
                    map={map}
                    defaultCenter={mapCenter}
                    defaultZoom={DEFAULT_ZOOM}
                />
                <MapLegend
                    bottomClassName={isMobile ? "" : "bottom-2"}
                    style={bottomAnchorStyle}
                    defaultExpanded={!isMobile}
                    showLocation={isLocationVisible}
                    showRoute={pinnedRoute !== null && isRouteVisible}
                />
                <WorkspaceMapLayers
                    map={map}
                    excludedFeatureId={null}
                    selectedFeatureId={selectedFeatureId}
                    onFeatureClick={handleFeatureClick}
                />
                {isHeatmapVisible && (
                    <HeatmapLayer
                        map={map}
                        grid={grid}
                        riskByCell={riskByCell}
                        pickingActive={false}
                        isMobile={isMobile}
                        opacityOverride={opacity / 100}
                    />
                )}
                {pinnedRoute && isRouteVisible && (
                    <PatrolRouteLayer
                        map={map}
                        startPoint={toLatLon(pinnedRoute.start_point)}
                        endPoint={toLatLon(pinnedRoute.end_point)}
                        routes={routeForLayer}
                        selectedIndex={0}
                    />
                )}
                {isLocationVisible && (
                    <>
                        <UserLocationLayer map={map} location={userLocation} />
                        <UserLocationNotice
                            status={userLocationStatus}
                            bottomClassName={isMobile ? "" : "bottom-2"}
                            style={bottomAnchorStyle}
                        />
                    </>
                )}
                <NoDataBanner
                    visible={
                        heatmapStatus === "no-data" && !isNoDataBannerDismissed
                    }
                    onDismiss={() => setIsNoDataBannerDismissed(true)}
                />
                {gridStatus === "loading" && <LoadingPill label="Loading..." />}
            </div>

            {!isMobile && (
                <aside className="w-[280px] shrink-0 overflow-y-auto border-l border-color-border bg-color-surface-raised">
                    <LayerTreePanel
                        activeLayerId={null}
                        selection={selection}
                        readOnly={true}
                        heatmapVisible={isHeatmapVisible}
                        onToggleHeatmap={setHeatmapVisible}
                        onSelectLayer={handleSelectLayer}
                        onSelectMembership={handleSelectMembership}
                    />
                </aside>
            )}

            {isMobile && (
                <Drawer
                    modal={false}
                    open
                    dismissible={false}
                    snapPoints={[COLLAPSED_SNAP, EXPANDED_SNAP, FULL_SNAP]}
                    activeSnapPoint={drawerSnap}
                    setActiveSnapPoint={setDrawerSnap}
                >
                    <DrawerContent className="h-full">
                        <DrawerTitle className="sr-only">
                            Heatmap and Layer Control
                        </DrawerTitle>
                        <DrawerDescription className="sr-only">
                            Choose a snapshot date, toggle map layers, adjust
                            heatmap opacity, and view the risk summary, and
                            toggle map layers
                        </DrawerDescription>
                        <Tabs>
                            <div className="shrink-0 border-b border-color-border px-4 py-2 bg-color-surface-raised">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger
                                        value="layers"
                                        className="gap-2"
                                    >
                                        <Layers className="size-4" />
                                        Layers
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="controls"
                                        className="gap-2"
                                    >
                                        <SlidersHorizontal className="size-4" />
                                        Controls
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            <TabsContent
                                value="layers"
                                className="flex-1 overflow-y-auto p-2 m-0"
                            >
                                <LayerTreePanel
                                    activeLayerId={null}
                                    selection={selection}
                                    readOnly={true}
                                    heatmapVisible={isHeatmapVisible}
                                    onToggleHeatmap={setHeatmapVisible}
                                    onSelectLayer={handleSelectLayer}
                                    onSelectMembership={handleSelectMembership}
                                />
                            </TabsContent>
                            <TabsContent
                                value="controls"
                                className="flex-1 overflow-y-auto p-2 m-0"
                            >
                                <ExplainabilityPanel {...panelProps} />
                            </TabsContent>
                        </Tabs>
                    </DrawerContent>
                </Drawer>
            )}
        </div>
    );
}
