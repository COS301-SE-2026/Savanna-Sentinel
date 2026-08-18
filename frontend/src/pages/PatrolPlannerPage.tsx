import { useEffect, useState } from "react";
import type maplibregl from "maplibre-gl";

import { MapView } from "@/components/map/MapView";
import { MapControls } from "@/components/map/MapControls";
import { MapLegend } from "@/components/map/MapLegend";
import { HeatmapLayer } from "@/components/map/HeatmapLayer";
import { PatrolRouteLayer } from "@/components/map/PatrolRouteLayer";
import { PatrolPlannerForm } from "@/components/patrol/PatrolPlannerForm";
import { RouteComparisonView } from "@/components/patrol/RouteComparisonView";
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { riskApi } from "@/services/riskApi";
import { routeApi } from "@/services/routeApi";
import type { ParkGridResponse } from "@/services/riskApi";
import { usePollRouteJob } from "@/hooks/usePollRouteJob";
import { assignRandomRisk, parseGridCells } from "@/lib/riskGrid";
import { notifyCritical } from "@/components/ui/toast";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ArmedField, LatLon } from "@/types/patrol";

const PARK_ID = "reserve";
const PARK_CENTER: [number, number] = [20.330476767788639, -34.409923491276061];
const DEFAULT_ZOOM = 10;

const COLLAPSED_SNAP = "148px";
const EXPANDED_SNAP = 0.6;

function LoadingPill({ label }: { label: string }) {
    return (
        <div className="absolute top-2 left-2 z-[var(--z-sticky)] inline-flex items-center gap-2 rounded-md bg-color-surface-raised px-2 py-1 shadow-sm">
            <span className="size-2 shrink-0 rounded-full bg-brand-steel" />
            <span className="text-xs text-color-text-primary">{label}</span>
        </div>
    );
}

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
    jobStatus: ReturnType<typeof usePollRouteJob>["status"];
    routes: ReturnType<typeof usePollRouteJob>["routes"];
    selectedIndex: number;
    onSelectRoute: (index: number) => void;
    onClearRoutes: () => void;
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
    jobStatus,
    routes,
    selectedIndex,
    onSelectRoute,
    onClearRoutes,
}: SidebarContentProps) {
    return (
        <div className="flex flex-col gap-5 p-4">
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
                />
            </div>
        </div>
    );
}

const getGridCenterAndBounds = (cells: ReturnType<typeof parseGridCells>) => {
    let minLng = Infinity, maxLng = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;

    for (const cell of cells) {
        // Assuming cell.corners or cell geometry contains [lng, lat] tuples
        for (const [lng, lat] of cell.corners) {
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
        }
    }

    const center: [number, number] = [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
    const bounds: [[number, number], [number, number]] = [[minLng, minLat], [maxLng, maxLat]];

    return { center, bounds };
}

export default function PatrolPlannerPage() {
    const isMobile = useIsMobile();
    const [map, setMap] = useState<maplibregl.Map | null>(null);
    const [mapCenter, setMapCenter] = useState<[number, number]>([20.33, -34.41]);

    const [startPoint, setStartPoint] = useState<LatLon | null>(null);
    const [endPoint, setEndPoint] = useState<LatLon | null>(null);
    const [armedField, setArmedField] = useState<ArmedField>(null);
    const [maxTime, setMaxTime] = useState("");
    const [maxFuel, setMaxFuel] = useState("");

    const [requestId, setRequestId] = useState<string | null>(null);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const { status: jobStatus, routes } = usePollRouteJob(requestId);

    const [prevRoutes, setPrevRoutes] = useState(routes);
    if (routes !== prevRoutes) {
        setPrevRoutes(routes);
        setSelectedIndex(0);
    }

    const [grid, setGrid] = useState<ParkGridResponse | null>(null);
    const [isGridLoading, setIsGridLoading] = useState(true);
    const [riskByCell, setRiskByCell] = useState<Map<string, number>>(
        new Map(),
    );
    const [drawerSnap, setDrawerSnap] = useState<string | number | null>(
        COLLAPSED_SNAP,
    );

    useEffect(() => {
        let isCancelled = false;
        riskApi
            .getParkGrid(PARK_ID)
            .then((response) => {
                if (isCancelled) return;
                setGrid(response);
                
                const cells = parseGridCells(response)
                setRiskByCell(assignRandomRisk(cells));

                if (cells.length > 0){
                    const {center, bounds} = getGridCenterAndBounds(cells);
                    setMapCenter(center)

                    if (map) {
                        map.fitBounds(bounds, { padding: 40, animate: false });
                    }
                }
            })
            .catch(() => {
                if (!isCancelled) notifyCritical("Could not load risk grid");
            })
            .finally(() => {
                if (!isCancelled) setIsGridLoading(false);
            });
        return () => {
            isCancelled = true;
        };
    }, [map]);

    function handleMapClick(lngLat: { lng: number; lat: number }) {
        if (!armedField) return;
        const point = { lat: lngLat.lat, lon: lngLat.lng };
        if (armedField === "start") setStartPoint(point);
        else setEndPoint(point);
        setArmedField(null);
    }

    function handleRandomizeRisk() {
        if (!grid) return;
        setRiskByCell(assignRandomRisk(parseGridCells(grid)));
    }

    async function handleGenerate() {
        if (!startPoint || !endPoint) return;
        try {
            const job = await routeApi.generateRoute({
                park_id: PARK_ID,
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
    }

    const isGenerating = jobStatus === "queued" || jobStatus === "processing";
    const isPickingActive = armedField !== null;

    const sidebarProps: SidebarContentProps = {
        startPoint,
        endPoint,
        armedField,
        onArmField: setArmedField,
        onStartPointChange: setStartPoint,
        onEndPointChange: setEndPoint,
        maxTime,
        maxFuel,
        onMaxTimeChange: setMaxTime,
        onMaxFuelChange: setMaxFuel,
        onGenerate: handleGenerate,
        isGenerating,
        onClearRoutes: handleClearRoutes,
        jobStatus,
        routes,
        selectedIndex,
        onSelectRoute: setSelectedIndex,
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
                    defaultCenter={PARK_CENTER}
                    defaultZoom={DEFAULT_ZOOM}
                />
                <MapLegend
                    bottomClassName={
                        isMobile ? "bottom-[calc(148px+0.5rem)]" : "bottom-2"
                    }
                />
                <HeatmapLayer
                    map={map}
                    grid={grid}
                    riskByCell={riskByCell}
                    pickingActive={isPickingActive}
                    isMobile={isMobile}
                />
                <PatrolRouteLayer
                    map={map}
                    startPoint={startPoint}
                    endPoint={endPoint}
                    routes={routes}
                    selectedIndex={selectedIndex}
                />
                {isGridLoading && <LoadingPill label="Loading..." />}
                {isGenerating && <LoadingPill label="Planning route..." />}
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRandomizeRisk}
                    disabled={!grid}
                    className={
                        isMobile
                            ? "absolute right-2 bottom-[calc(148px+2.5rem)] z-[var(--z-sticky)] bg-color-surface-raised shadow-sm"
                            : "absolute right-2 bottom-10 z-[var(--z-sticky)] bg-color-surface-raised shadow-sm"
                    }
                >
                    Randomise risk
                </Button>
            </div>

            {isMobile && (
                <Drawer
                    modal={false}
                    open
                    snapPoints={[COLLAPSED_SNAP, EXPANDED_SNAP]}
                    activeSnapPoint={drawerSnap}
                    setActiveSnapPoint={setDrawerSnap}
                >
                    {/*
                     * `h-full` is required, not cosmetic: vaul parks a
                     * snap-point drawer by translating the content element
                     * down by (viewport height - snap height), which only
                     * lands correctly if that element spans the full
                     * viewport. With the intrinsic height it would otherwise
                     * take, the translate pushes the whole sheet off the
                     * bottom of the screen. The inner wrapper does the
                     * scrolling instead, and only once fully expanded, so a
                     * swipe up from the collapsed snap drags the sheet rather
                     * than scrolling its contents.
                     */}
                    <DrawerContent className="h-full">
                        <DrawerTitle className="sr-only">
                            Patrol planner
                        </DrawerTitle>
                        <DrawerDescription className="sr-only">
                            Set start and end points, set time and fuel limits,
                            generate patrol routes, and compare the
                            alternatives.
                        </DrawerDescription>
                        <div
                            className={
                                typeof drawerSnap === "number" &&
                                Math.abs(drawerSnap - EXPANDED_SNAP) <
                                    Number.EPSILON
                                    ? "min-h-0 flex-1 overflow-y-auto"
                                    : "min-h-0 flex-1 overflow-hidden"
                            }
                        >
                            <SidebarContent {...sidebarProps} />
                        </div>
                    </DrawerContent>
                </Drawer>
            )}
        </div>
    );
}
