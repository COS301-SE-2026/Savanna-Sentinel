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
import { GpsLossToggle } from "@/components/dev/GpsLossToggle";
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
import {
    STACK_BOTTOM,
    WorkspaceMapLayers,
} from "@/components/workspace/WorkspaceMapLayers";
import type { WorkspaceSelection } from "@/components/workspace/StyleEditorPanel";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { resolveVisibleFeatures } from "@/lib/workspace/resolveVisibleFeatures";
import { useLayerOpacityPreview } from "@/hooks/useLayerOpacityPreview";
import SelectReferenceModal, {
    type Poi,
} from "@/components/map/SelectReferenceModal";
import { useWorkspacePois } from "@/hooks/useWorkspacePois";

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
    const [isHeatmapSelected, setHeatmapSelected] = useState(false);
    const [isRouteSelected, setRouteSelected] = useState(false);
    const [routeOpacity, setRouteOpacity] = useState(100);
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
            setHeatmapSelected(false);
            setRouteSelected(false);
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

        setHeatmapSelected(false);
        setRouteSelected(false);
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

        setHeatmapSelected(false);
        setRouteSelected(false);
        setSelection({
            kind: "membership",
            membershipId,
        });
    }

    function handleSelectHeatmap() {
        setHeatmapSelected((selected) => !selected);
        setRouteSelected(false);
        setSelection(null);
    }

    function handleSelectRoute() {
        setRouteSelected((selected) => !selected);
        setHeatmapSelected(false);
        setSelection(null);
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
    const [isGpsLossForced, setGpsLossForced] = useState(false);
    const {
        location: userLocation,
        status: userLocationStatus,
        hasNoReferencePoint,
        setReferencePoint,
    } = useUserLocation(isLocationVisible, isGpsLossForced);

    const userId = useAuthStore((s) => s.user?.id ?? null);
    const [pinnedRoute, setPinnedRoute] = useState<SavedRoute | null>(null);
    const [isRouteVisible, setRouteVisible] = useState(true);
    const [isPoiModalOpen, setIsPoiModalOpen] = useState(false);

    const isGpsFixed = userLocationStatus === "tracking";
    const showReferenceButton = isLocationVisible && !isGpsFixed;
    const hasReferencePoint = !hasNoReferencePoint;

    const pois = useWorkspacePois();

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

    const pinnedWaypoints = useMemo(
        () => (pinnedRoute?.waypoints ?? []).map(toLatLon),
        [pinnedRoute],
    );
    const routeForLayer = useMemo(
        () => (pinnedRoute ? [toPlannedRoute(pinnedRoute)] : []),
        [pinnedRoute],
    );

    async function handleRemoveRoute() {
        await clearPinnedRoute().catch(() => {});
        setPinnedRoute(null);
        setRouteSelected(false);
    }

    const bottomAnchorStyle = isMobile
        ? {
              bottom: `calc(${Math.min(
                  getSnapHeightPx(drawerSnap ?? COLLAPSED_SNAP),
                  getSnapHeightPx(EXPANDED_SNAP),
              )}px + 0.5rem)`,
          }
        : undefined;

    const { previewOpacity, setPreviewOpacity, label, opacityOverrides } =
        useLayerOpacityPreview(selection);

    const handleSelectPoi = (poi: Poi) => {
        setReferencePoint({
            lat: poi.lat,
            lon: poi.lon,
            heading: 0,
            accuracy: 10,
        });
    };

    const handlePreviewPoi = (poi: Poi) => {
        if (poi.id) {
            handleFeatureClick(poi.id);
        }

        if (map) {
            map.flyTo({
                center: [poi.lon, poi.lat],
                zoom: 12,
                duration: 800,
            });
        }

        setIsPoiModalOpen(false);
    };

    const panelProps = {
        heatmapVisible: isHeatmapVisible,
        onHeatmapVisibleChange: setHeatmapVisible,
        locationVisible: isLocationVisible,
        onLocationVisibleChange: setLocationVisible,
        opacityLabel: selection
            ? (label ?? "Heatmap Opacity")
            : isRouteSelected
              ? "Patrol Route Opacity"
              : "Heatmap Opacity",
        opacityValue: selection
            ? previewOpacity
            : isRouteSelected
              ? routeOpacity
              : opacity,
        onOpacityValueChange: selection
            ? setPreviewOpacity
            : isRouteSelected
              ? setRouteOpacity
              : setOpacity,
        opacityDisabled: selection
            ? false
            : isRouteSelected
              ? !isRouteVisible
              : !isHeatmapVisible,
        gridStale: isGridStale,
        hasRoute: pinnedRoute !== null,
        routeVisible: isRouteVisible,
        onRouteVisibleChange: setRouteVisible,
        onRemoveRoute: handleRemoveRoute,
        patrolRouteSelected: isRouteSelected,
        onSelectPatrolRoute: handleSelectRoute,
        selection,
        onSelectLayer: handleSelectLayer,
        onSelectMembership: handleSelectMembership,
        heatmapSelected: isHeatmapSelected,
        onSelectHeatmap: handleSelectHeatmap,
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
                    showReferenceButton={showReferenceButton}
                    hasReferencePoint={hasReferencePoint}
                    onOpenPoiModal={() => setIsPoiModalOpen(true)}
                >
                    {isLocationVisible && (
                        <GpsLossToggle
                            active={isGpsLossForced}
                            onToggle={setGpsLossForced}
                        />
                    )}
                </MapControls>
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
                    opacityOverrides={opacityOverrides}
                />
                {isHeatmapVisible && (
                    <HeatmapLayer
                        map={map}
                        grid={grid}
                        riskByCell={riskByCell}
                        pickingActive={false}
                        isMobile={isMobile}
                        opacityOverride={opacity / 100}
                        beforeId={STACK_BOTTOM}
                    />
                )}
                {pinnedRoute && isRouteVisible && (
                    <PatrolRouteLayer
                        map={map}
                        startPoint={toLatLon(pinnedRoute.start_point)}
                        endPoint={toLatLon(pinnedRoute.end_point)}
                        waypoints={pinnedWaypoints}
                        routes={routeForLayer}
                        selectedIndex={0}
                        opacityOverride={routeOpacity / 100}
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
                <SelectReferenceModal
                    open={isPoiModalOpen}
                    onOpenChange={setIsPoiModalOpen}
                    pois={pois}
                    onSelectPoi={handleSelectPoi}
                    onPreviewPoi={handlePreviewPoi}
                />
                {gridStatus === "loading" && <LoadingPill label="Loading..." />}
            </div>

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
                            opacity, and view the risk summary.
                        </DrawerDescription>
                        <div className="min-h-0 flex-1 overflow-y-auto">
                            <ExplainabilityPanel {...panelProps} />
                        </div>
                    </DrawerContent>
                </Drawer>
            )}
        </div>
    );
}
