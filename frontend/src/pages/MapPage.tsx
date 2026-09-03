import { useEffect, useMemo, useState } from "react";
import type maplibregl from "maplibre-gl";

import { MapView } from "@/components/map/MapView";
import { MapControls } from "@/components/map/MapControls";
import { MapLegend } from "@/components/map/MapLegend";
import { HeatmapLayer } from "@/components/map/HeatmapLayer";
import { LoadingPill } from "@/components/map/LoadingPill";
import { ExplainabilityPanel } from "@/components/map/ExplainabilityPanel";
import { NoDataBanner } from "@/components/map/NoDataBanner";
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerTitle,
} from "@/components/ui/drawer";
import { useMapStore } from "@/store/mapStore";
import { useIsMobile } from "@/hooks/use-mobile";
import { getSnapHeightPx } from "@/lib/utils";
import { parseGridCells, scoresByCell } from "@/lib/riskGrid";

const PARK_CENTER_FALLBACK: [number, number] = [31.18, -24.2];

const DEFAULT_ZOOM = 10;

const COLLAPSED_SNAP = "24px";
const EXPANDED_SNAP = 0.6;
const FULL_SNAP = 1;

const DEFAULT_OPACITY_PERCENT = 55;

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
    const loadGrid = useMapStore((s) => s.loadGrid);
    const loadSnapshots = useMapStore((s) => s.loadSnapshots);

    const [isHeatmapVisible, setHeatmapVisible] = useState(true);
    const [opacity, setOpacity] = useState(DEFAULT_OPACITY_PERCENT);
    const [isNoDataBannerDismissed, setIsNoDataBannerDismissed] =
        useState(false);

    const [drawerSnap, setDrawerSnap] = useState<string | number | null>(
        COLLAPSED_SNAP,
    );

    useEffect(() => {
        loadGrid();
        loadSnapshots();
    }, [loadGrid, loadSnapshots]);

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

    const panelProps = {
        heatmapVisible: isHeatmapVisible,
        onHeatmapVisibleChange: setHeatmapVisible,
        opacity,
        onOpacityChange: setOpacity,
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
                    defaultExpanded={!isMobile}
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
                <NoDataBanner
                    visible={
                        heatmapStatus === "no-data" && !isNoDataBannerDismissed
                    }
                    onDismiss={() => setIsNoDataBannerDismissed(true)}
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
                        <DrawerTitle className="sr-only">Heatmap</DrawerTitle>
                        <DrawerDescription className="sr-only">
                            Choose a snapshot date, toggle map layers, adjust
                            heatmap opacity, and view the risk summary.
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
