import { useEffect, useMemo, useState } from "react";
import type maplibregl from "maplibre-gl";

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
import type { SavedRoute, PlannedRoute } from "@/services/routeApi";
import { usePollRouteJob } from "@/hooks/usePollRouteJob";
import { parseGridCells, scoresByCell } from "@/lib/riskGrid";
import { notifySafe, notifyCritical } from "@/components/ui/toast";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ArmedField, LatLon } from "@/types/patrol";
import { getSnapHeightPx } from "@/lib/utils";
import { useMapStore } from "@/store/mapStore";

const DEFAULT_ZOOM = 10;

const COLLAPSED_SNAP = "24px";
const EXPANDED_SNAP = 0.6;
const FULL_SNAP = 1;

interface SidebarContentProps {
    startPoint: LatLon | null;
    endPoint: LatLon | null;
    armedField: ArmedField;
    onArmField: (field: "start" | "end") => void;
    onStartPointChange: (point: LatLon | null) => void;
    onEndPointChange: (point: LatLon | null) => void;
    maxTime: string;
    maxFuel: string;
    onMaxTimeChange: (v: string) => void;
    onMaxFuelChange: (v: string) => void;
    onGenerate: () => void;
    isGenerating: boolean;
    heatmapHasNoData: boolean;
    jobStatus: ReturnType<typeof usePollRouteJob>["status"];
    routes: ReturnType<typeof usePollRouteJob>["routes"];
    selectedIndex: number;
    onSelectRoute: (index: number) => void;
    onClearRoutes: () => void;
    onSaveRoute: (index: number) => void;
    savingIndex: number | null;
    savedIndices: Set<number>;
    canSave: boolean;
    isLoadDialogOpen: boolean;
    onLoadDialogOpenChange: (open: boolean) => void;
    onLoadRoute: (saved: SavedRoute) => void;
}

function SidebarContent({
    startPoint,
    endPoint,
    armedField,
    onArmField,
    onStartPointChange,
    onEndPointChange,
    maxTime,
    maxFuel,
    onMaxTimeChange,
    onMaxFuelChange,
    onGenerate,
    isGenerating,
    heatmapHasNoData,
    jobStatus,
    routes,
    selectedIndex,
    onSelectRoute,
    onClearRoutes,
    onSaveRoute,
    savingIndex,
    savedIndices,
    canSave,
    isLoadDialogOpen,
    onLoadDialogOpenChange,
    onLoadRoute,
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
            />
            <PatrolPlannerForm
                startPoint={startPoint}
                endPoint={endPoint}
                armedField={armedField}
                onArmField={onArmField}
                onStartPointChange={onStartPointChange}
                onEndPointChange={onEndPointChange}
                maxTime={maxTime}
                maxFuel={maxFuel}
                onMaxTimeChange={onMaxTimeChange}
                onMaxFuelChange={onMaxFuelChange}
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
                />
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
    const isMobile = useIsMobile();
    const [map, setMap] = useState<maplibregl.Map | null>(null);
    const [mapCenter, setMapCenter] = useState<[number, number]>([
        20.33, -34.41,
    ]);

    const [startPoint, setStartPoint] = useState<LatLon | null>(null);
    const [endPoint, setEndPoint] = useState<LatLon | null>(null);
    const [armedField, setArmedField] = useState<ArmedField>(null);
    const [maxTime, setMaxTime] = useState("");
    const [maxFuel, setMaxFuel] = useState("");

    const [requestId, setRequestId] = useState<string | null>(null);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const { status: jobStatus, routes } = usePollRouteJob(requestId);

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
        if (!armedField) return;
        const point = { lat: lngLat.lat, lon: lngLat.lng };
        if (armedField === "start") setStartPoint(point);
        else setEndPoint(point);
        setArmedField(null);
        if (isMobile) setDrawerSnap(EXPANDED_SNAP);
    }

    function handleArmField(field: "start" | "end") {
        setArmedField(field);
        if (isMobile) setDrawerSnap(COLLAPSED_SNAP);
    }

    function handleSelectRoute(index: number) {
        setSelectedIndex(index);
        if (isMobile) setDrawerSnap(COLLAPSED_SNAP);
    }

    async function handleGenerate() {
        if (!startPoint || !endPoint || hasNoRiskData) return;
        setLoadedRoute(null);
        setSavedRiskByCell(null);
        try {
            const job = await routeApi.generateRoute({
                start_point: {
                    type: "Point",
                    coordinates: [startPoint.lon, startPoint.lat],
                },
                end_point: {
                    type: "Point",
                    coordinates: [endPoint.lon, endPoint.lat],
                },
                max_time: maxTime.trim() === "" ? undefined : Number(maxTime),
                max_fuel: maxFuel.trim() === "" ? undefined : Number(maxFuel),
                num_alternatives: 3,
                risk_by_cell: Object.fromEntries(riskByCell),
            });
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
        setLoadedRoute({
            suggested_path: [],
            path_geometry: saved.path_geometry,
            estimated_time_min: saved.estimated_time_min,
            estimated_fuel_l: saved.estimated_fuel_l,
            risk_coverage: saved.risk_coverage,
        });
        setSavedRiskByCell(new Map(Object.entries(saved.risk_by_cell)));
        setSelectedIndex(0);
        setStartPoint({
            lat: saved.start_point.coordinates[1],
            lon: saved.start_point.coordinates[0],
        });
        setEndPoint({
            lat: saved.end_point.coordinates[1],
            lon: saved.end_point.coordinates[0],
        });
        setMaxTime(saved.max_time === null ? "" : String(saved.max_time));
        setMaxFuel(saved.max_fuel === null ? "" : String(saved.max_fuel));
    }

    const canSave = requestId !== null;

    const handleSaveRoute = async (index: number) => {
        if (!requestId || !startPoint || !endPoint) return;
        setSavingIndex(index);
        try {
            await routeApi.saveRoute({
                request_id: requestId,
                start_point: {
                    type: "Point",
                    coordinates: [startPoint.lon, startPoint.lat],
                },
                end_point: {
                    type: "Point",
                    coordinates: [endPoint.lon, endPoint.lat],
                },
                max_time: maxTime.trim() === "" ? null : Number(maxTime),
                max_fuel: maxFuel.trim() === "" ? null : Number(maxFuel),
                risk_by_cell: Object.fromEntries(riskByCell),
                route: routes[index],
            });
            setSavedIndices((prev) => new Set(prev).add(index));
            notifySafe("Route saved");
        } catch {
            notifyCritical("Could not save route");
        } finally {
            setSavingIndex(null);
        }
    };

    const isGenerating = jobStatus === "queued" || jobStatus === "processing";
    const isPickingActive = armedField !== null;

    const sidebarProps: SidebarContentProps = {
        startPoint,
        endPoint,
        armedField,
        onArmField: handleArmField,
        onStartPointChange: setStartPoint,
        onEndPointChange: setEndPoint,
        maxTime,
        maxFuel,
        onMaxTimeChange: setMaxTime,
        onMaxFuelChange: setMaxFuel,
        onGenerate: handleGenerate,
        isGenerating,
        heatmapHasNoData: hasNoRiskData,
        onClearRoutes: handleClearRoutes,
        jobStatus: displayStatus,
        routes: displayRoutes,
        selectedIndex,
        onSelectRoute: handleSelectRoute,
        onSaveRoute: handleSaveRoute,
        savingIndex,
        savedIndices,
        canSave,
        isLoadDialogOpen,
        onLoadDialogOpenChange: setIsLoadDialogOpen,
        onLoadRoute: handleLoadRoute,
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
                    routes={displayRoutes}
                    selectedIndex={selectedIndex}
                />
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
                            Set start and end points, set time and fuel limits,
                            generate patrol routes, and compare the
                            alternatives.
                        </DrawerDescription>
                        <div className="min-h-0 flex-1 overflow-y-auto">
                            <SidebarContent {...sidebarProps} />
                        </div>
                    </DrawerContent>
                </Drawer>
            )}
        </div>
    );
}
