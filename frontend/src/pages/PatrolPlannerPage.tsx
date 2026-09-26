import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type * as maplibregl from "maplibre-gl";

import { MapView } from "@/components/map/MapView";
import { MapControls } from "@/components/map/MapControls";
import { MapLegend } from "@/components/map/MapLegend";
import { HeatmapLayer } from "@/components/map/HeatmapLayer";
import { PatrolRouteLayer } from "@/components/map/PatrolRouteLayer";
import { LoadingPill } from "@/components/map/LoadingPill";
import { History } from "lucide-react";
import { PatrolPlannerForm } from "@/components/patrol/PatrolPlannerForm";
import { NoDataBanner } from "@/components/map/NoDataBanner";
import { RouteComparisonView } from "@/components/patrol/RouteComparisonView";
import { LoadPreviousRoutesDialog } from "@/components/patrol/LoadPreviousRoutesDialog";
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { routeApi } from "@/services/routeApi";
import { cacheSavedRoute } from "@/offline/routesCache";
import { pinRouteToHeatmap } from "@/offline/pinnedRouteCache";
import { toPlannedRoute } from "@/lib/patrolRoute";
import { useAuthStore } from "@/store/authStore";
import type { SavedRoute, PlannedRoute } from "@/services/routeApi";
import { usePollRouteJob } from "@/hooks/usePollRouteJob";
import { parseGridCells, scoresByCell } from "@/lib/riskGrid";
import { notifySafe, notifyCritical } from "@/components/ui/toast";
import { useIsMobile } from "@/hooks/use-mobile";
import {
    initialStops,
    stopsFromSaved,
    toStopsPayload,
    updateStop,
    waypointPoints,
    type StopsPayload,
} from "@/lib/patrolStops";
import type { LatLon, PlannerStop } from "@/types/patrol";
import { getSnapHeightPx } from "@/lib/utils";
import { useMapStore } from "@/store/mapStore";
import { UserLocationLayer } from "@/components/map/UserLocationLayer";
import { useUserLocation } from "@/hooks/useUserLocation";
import { UserLocationNotice } from "@/components/map/UserLocationNotice";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { MotionSimulator } from "@/components/dev/MotionSimulator";

const DEFAULT_ZOOM = 10;

const COLLAPSED_SNAP = "24px";
const EXPANDED_SNAP = 0.6;
const FULL_SNAP = 1;

interface SidebarContentProps {
    stops: PlannerStop[];
    armedStopId: string | null;
    onArmStop: (id: string) => void;
    onStopsChange: (stops: PlannerStop[]) => void;
    onGenerate: () => void;
    isGenerating: boolean;
    heatmapHasNoData: boolean;
    jobStatus: ReturnType<typeof usePollRouteJob>["status"];
    routes: ReturnType<typeof usePollRouteJob>["routes"];
    selectedIndex: number;
    numAlternativesRequested: number | null;
    shortfallReason: string | null;
    onSelectRoute: (index: number) => void;
    onClearRoutes: () => void;
    onSaveRoute: (index: number) => void;
    savingIndex: number | null;
    savedIndices: Set<number>;
    canSave: boolean;
    isLoadDialogOpen: boolean;
    onLoadDialogOpenChange: (open: boolean) => void;
    onLoadRoute: (saved: SavedRoute) => void;
    onSendRouteToHeatmap: (saved: SavedRoute) => void;
    locationVisible: boolean;
    onLocationVisibleChange: (visible: boolean) => void;
}

function SidebarContent({
    stops,
    armedStopId,
    onArmStop,
    onStopsChange,
    onGenerate,
    isGenerating,
    heatmapHasNoData,
    jobStatus,
    routes,
    selectedIndex,
    numAlternativesRequested,
    shortfallReason,
    onSelectRoute,
    onClearRoutes,
    onSaveRoute,
    savingIndex,
    savedIndices,
    canSave,
    isLoadDialogOpen,
    onLoadDialogOpenChange,
    onLoadRoute,
    onSendRouteToHeatmap,
    locationVisible,
    onLocationVisibleChange,
}: SidebarContentProps) {
    return (
        <div className="flex flex-col gap-5 p-4">
            <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => onLoadDialogOpenChange(true)}
            >
                <History className="size-4" />
                Load Previous
            </Button>
            <LoadPreviousRoutesDialog
                open={isLoadDialogOpen}
                onOpenChange={onLoadDialogOpenChange}
                onLoad={onLoadRoute}
                onSendToHeatmap={onSendRouteToHeatmap}
            />
            <PatrolPlannerForm
                stops={stops}
                armedStopId={armedStopId}
                onArmStop={onArmStop}
                onStopsChange={onStopsChange}
                onGenerate={onGenerate}
                isGenerating={isGenerating}
                heatmapHasNoData={heatmapHasNoData}
                hasRoutes={routes.length > 0}
                onClearRoutes={onClearRoutes}
            />
            <div>
                <div className="mb-2 text-xs font-semibold text-color-text-primary uppercase tracking-wider">
                    Alternatives
                </div>
                <RouteComparisonView
                    status={jobStatus}
                    routes={routes}
                    selectedIndex={selectedIndex}
                    onSelect={onSelectRoute}
                    onSave={onSaveRoute}
                    savingIndex={savingIndex}
                    savedIndices={savedIndices}
                    canSave={canSave}
                    numAlternativesRequested={numAlternativesRequested}
                    shortfallReason={shortfallReason}
                />
            </div>
            <div className="flex min-h-11 w-full cursor-pointer items-center gap-2">
                <Checkbox
                    id="show-location"
                    checked={locationVisible}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        onLocationVisibleChange(e.target.checked)
                    }
                />
                <Label
                    htmlFor="show-location"
                    className="cursor-pointer text-sm font-medium text-color-text-primary select-none"
                >
                    My Location
                </Label>
            </div>
        </div>
    );
}

const getGridCenterAndBounds = (cells: ReturnType<typeof parseGridCells>) => {
    let minLng = Infinity,
        maxLng = -Infinity;
    let minLat = Infinity,
        maxLat = -Infinity;

    for (const cell of cells) {
        for (const [lng, lat] of cell.corners) {
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
        }
    }

    const center: [number, number] = [
        (minLng + maxLng) / 2,
        (minLat + maxLat) / 2,
    ];
    const bounds: [[number, number], [number, number]] = [
        [minLng, minLat],
        [maxLng, maxLat],
    ];

    return { center, bounds };
};

export default function PatrolPlannerPage() {
    const user = useAuthStore((s) => s.user);
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const [map, setMap] = useState<maplibregl.Map | null>(null);
    const [mapCenter, setMapCenter] = useState<[number, number]>([
        20.33, -34.41,
    ]);

    const [stops, setStops] = useState<PlannerStop[]>(initialStops);
    const [armedStopId, setArmedStopId] = useState<string | null>(null);
    const [plannedStops, setPlannedStops] = useState<StopsPayload | null>(null);

    const startPoint = stops[0].point;
    const endPoint = stops[stops.length - 1].point;
    const waypoints = useMemo(() => waypointPoints(stops), [stops]);

    const [requestId, setRequestId] = useState<string | null>(null);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const {
        status: jobStatus,
        routes,
        numAlternativesRequested,
        shortfallReason,
    } = usePollRouteJob(requestId);

    const [drawerSnap, setDrawerSnap] = useState<string | number | null>(
        COLLAPSED_SNAP,
    );

    const [prevRoutes, setPrevRoutes] = useState(routes);
    if (routes !== prevRoutes) {
        setPrevRoutes(routes);
        setSelectedIndex(0);
        if (isMobile && routes.length > 0) setDrawerSnap(EXPANDED_SNAP);
    }

    const [savingIndex, setSavingIndex] = useState<number | null>(null);
    const [savedIndices, setSavedIndices] = useState<Set<number>>(new Set());

    const [prevRoutesForSave, setPrevRoutesForSave] = useState(routes);
    if (routes !== prevRoutesForSave) {
        setPrevRoutesForSave(routes);
        setSavedIndices(new Set());
    }

    const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false);
    const [loadedRoute, setLoadedRoute] = useState<PlannedRoute | null>(null);
    const [savedRiskByCell, setSavedRiskByCell] = useState<Map<
        string,
        number
    > | null>(null);

    const displayRoutes = loadedRoute ? [loadedRoute] : routes;
    const displayStatus = loadedRoute ? "completed" : jobStatus;

    const grid = useMapStore((s) => s.grid);
    const gridStatus = useMapStore((s) => s.gridStatus);
    const cellsByRef = useMapStore((s) => s.cellsByRef);
    const riskByCell = useMemo(() => scoresByCell(cellsByRef), [cellsByRef]);
    const heatmapStatus = useMapStore((s) => s.heatmapStatus);
    const hasNoRiskData = riskByCell.size === 0;
    const loadGrid = useMapStore((s) => s.loadGrid);
    const loadSnapshots = useMapStore((s) => s.loadSnapshots);
    const isGridLoading = gridStatus !== "error" && grid === null;
    const [isNoDataBannerDismissed, setIsNoDataBannerDismissed] =
        useState(false);
    const [isLocationVisible, setLocationVisible] = useState(false);
    const { location: userLocation, status: userLocationStatus } =
        useUserLocation(isLocationVisible);

    const bottomAnchorStyle = isMobile
        ? {
              bottom: `calc(${Math.min(
                  getSnapHeightPx(drawerSnap ?? COLLAPSED_SNAP),
                  getSnapHeightPx(EXPANDED_SNAP),
              )}px + 0.5rem)`,
          }
        : undefined;

    const handleLocationVisibleChange = async (visible: boolean) => {
        if (visible && typeof DeviceMotionEvent !== "undefined") {
            const deviceMotionEventPermission =
                DeviceMotionEvent as unknown as {
                    requestPermission?: () => Promise<
                        "granted" | "denied" | "default"
                    >;
                };

            if (
                typeof deviceMotionEventPermission.requestPermission ===
                "function"
            ) {
                try {
                    await deviceMotionEventPermission.requestPermission();
                } catch {
                    console.warn("Motion sensor permission failed or denied");
                }
            }
        }
        setLocationVisible(visible);
    };

    useEffect(() => {
        loadGrid();
        loadSnapshots();
    }, [loadGrid, loadSnapshots]);

    useEffect(() => {
        if (heatmapStatus === "no-data") {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- re-arms the dismissal flag on a new no-data state
            setIsNoDataBannerDismissed(false);
        }
    }, [heatmapStatus]);

    useEffect(() => {
        if (!grid || !map) return;
        const cells = parseGridCells(grid);
        if (cells.length === 0) return;
        const { center, bounds } = getGridCenterAndBounds(cells);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- recentering on a new grid is an effect sync
        setMapCenter(center);
        map.fitBounds(bounds, { padding: 40, animate: false });
    }, [grid, map]);

    function handleMapClick(lngLat: { lng: number; lat: number }) {
        if (!armedStopId) return;
        const point: LatLon = { lat: lngLat.lat, lon: lngLat.lng };
        setStops((prev) => updateStop(prev, armedStopId, point));
        setArmedStopId(null);
        if (isMobile) setDrawerSnap(EXPANDED_SNAP);
    }

    function handleArmStop(id: string) {
        setArmedStopId(id);
        if (isMobile) setDrawerSnap(COLLAPSED_SNAP);
    }

    function handleStopsChange(next: PlannerStop[]) {
        setStops(next);
        if (armedStopId && !next.some((stop) => stop.id === armedStopId)) {
            setArmedStopId(null);
        }
    }

    function handleSelectRoute(index: number) {
        setSelectedIndex(index);
        if (isMobile) setDrawerSnap(COLLAPSED_SNAP);
    }

    async function handleGenerate() {
        const payload = toStopsPayload(stops);
        if (!payload || hasNoRiskData) return;
        setLoadedRoute(null);
        setSavedRiskByCell(null);
        try {
            const job = await routeApi.generateRoute({
                ...payload,
                num_alternatives: 3,
                risk_by_cell: Object.fromEntries(riskByCell),
            });
            setPlannedStops(payload);
            setRequestId(job.request_id);
        } catch {
            notifyCritical("Could not start route planning");
        }
    }

    function handleClearRoutes() {
        setRequestId(null);
        setLoadedRoute(null);
        setSavedRiskByCell(null);
        setSelectedIndex(0);
    }

    function handleLoadRoute(saved: SavedRoute) {
        setRequestId(null);
        setLoadedRoute(toPlannedRoute(saved));
        setSavedRiskByCell(new Map(Object.entries(saved.risk_by_cell)));
        setSelectedIndex(0);
        setStops(stopsFromSaved(saved));
        setArmedStopId(null);
    }

    async function handleSendRouteToHeatmap(saved: SavedRoute) {
        if (!user?.id) {
            notifyCritical("Could not send the route to the heatmap");
            return;
        }
        try {
            await pinRouteToHeatmap(user.id, saved);
        } catch {
            notifyCritical("Could not send the route to the heatmap");
            return;
        }
        setIsLoadDialogOpen(false);
        navigate("/map");
    }

    const canSave = requestId !== null;

    const handleSaveRoute = async (index: number) => {
        if (!requestId || !plannedStops) return;
        setSavingIndex(index);
        try {
            const saved = await routeApi.saveRoute({
                request_id: requestId,
                ...plannedStops,
                risk_by_cell: Object.fromEntries(riskByCell),
                route: routes[index],
            });
            await cacheSavedRoute(user?.id ?? null, saved).catch(() => {});
            setSavedIndices((prev) => new Set(prev).add(index));
            notifySafe("Route saved");
        } catch {
            notifyCritical("Could not save route");
        } finally {
            setSavingIndex(null);
        }
    };

    const isGenerating = jobStatus === "queued" || jobStatus === "processing";
    const isPickingActive = armedStopId !== null;

    const sidebarProps: SidebarContentProps = {
        stops,
        armedStopId,
        onArmStop: handleArmStop,
        onStopsChange: handleStopsChange,
        onGenerate: handleGenerate,
        isGenerating,
        heatmapHasNoData: hasNoRiskData,
        onClearRoutes: handleClearRoutes,
        jobStatus: displayStatus,
        routes: displayRoutes,
        selectedIndex,
        numAlternativesRequested: loadedRoute ? null : numAlternativesRequested,
        shortfallReason: loadedRoute ? null : shortfallReason,
        onSelectRoute: handleSelectRoute,
        onSaveRoute: handleSaveRoute,
        savingIndex,
        savedIndices,
        canSave,
        isLoadDialogOpen,
        onLoadDialogOpenChange: setIsLoadDialogOpen,
        onLoadRoute: handleLoadRoute,
        onSendRouteToHeatmap: handleSendRouteToHeatmap,
        locationVisible: isLocationVisible,
        onLocationVisibleChange: handleLocationVisibleChange,
    };

    return (
        <div className="flex h-[calc(100vh-3.5rem)] flex-col md:flex-row">
            {!isMobile && (
                <aside className="w-[280px] shrink-0 overflow-y-auto border-r border-color-border bg-color-surface-raised">
                    <SidebarContent {...sidebarProps} />
                </aside>
            )}

            <div className="relative min-h-0 flex-1 overflow-hidden">
                {!isGridLoading && (
                    <MapView
                        center={mapCenter}
                        zoom={DEFAULT_ZOOM}
                        onMapReady={setMap}
                        onMapRemove={() => setMap(null)}
                        onMapClick={handleMapClick}
                        className={
                            isPickingActive
                                ? "absolute inset-0 cursor-crosshair"
                                : "absolute inset-0"
                        }
                    />
                )}
                <MapControls
                    map={map}
                    defaultCenter={mapCenter}
                    defaultZoom={DEFAULT_ZOOM}
                />
                <MapLegend
                    bottomClassName={isMobile ? "" : "bottom-2"}
                    style={
                        isMobile
                            ? {
                                  bottom: `calc(${Math.min(
                                      getSnapHeightPx(
                                          drawerSnap ?? COLLAPSED_SNAP,
                                      ),
                                      getSnapHeightPx(EXPANDED_SNAP),
                                  )}px + 0.5rem)`,
                              }
                            : undefined
                    }
                />
                <HeatmapLayer
                    map={map}
                    grid={grid}
                    riskByCell={
                        loadedRoute
                            ? (savedRiskByCell ?? new Map())
                            : riskByCell
                    }
                    pickingActive={isPickingActive}
                    isMobile={isMobile}
                />
                <PatrolRouteLayer
                    map={map}
                    startPoint={startPoint}
                    endPoint={endPoint}
                    waypoints={waypoints}
                    routes={displayRoutes}
                    selectedIndex={selectedIndex}
                />
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
                {isGridLoading && <LoadingPill label="Loading..." />}
                {isGenerating && <LoadingPill label="Planning route..." />}
                <NoDataBanner
                    visible={
                        heatmapStatus === "no-data" && !isNoDataBannerDismissed
                    }
                    onDismiss={() => setIsNoDataBannerDismissed(true)}
                />
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
                            Patrol planner
                        </DrawerTitle>
                        <DrawerDescription className="sr-only">
                            Set a start point, an end point and up to 5 stops,
                            generate patrol routes, and compare the
                            alternatives.
                        </DrawerDescription>
                        <div className="min-h-0 flex-1 overflow-y-auto">
                            <SidebarContent {...sidebarProps} />
                        </div>
                    </DrawerContent>
                </Drawer>
            )}

            <MotionSimulator />
        </div>
    );
}
