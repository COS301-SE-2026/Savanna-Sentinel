import { useEffect, useState } from "react";
import type maplibregl from "maplibre-gl";

import { MapView } from "@/components/map/MapView";
import { MapControls } from "@/components/map/MapControls";
import { MapLegend } from "@/components/map/MapLegend";
import { HeatmapLayer } from "@/components/map/HeatmapLayer";
import { LoadingPill } from "@/components/map/LoadingPill";
import { ExplainabilityPanel } from "@/components/map/ExplainabilityPanel";
import { SNAPSHOTS, TIME_OF_DAY_SLOTS } from "@/lib/mapSnapshots";
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerTitle,
} from "@/components/ui/drawer";
import { riskApi } from "@/services/riskApi";
import type { ParkGridResponse } from "@/services/riskApi";
import { assignRandomRisk, parseGridCells } from "@/lib/riskGrid";
import { notifyCritical } from "@/components/ui/toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { getSnapHeightPx } from "@/lib/utils";

const PARK_ID = "klaserie";
const PARK_CENTER: [number, number] = [31.18, -24.2];
const DEFAULT_ZOOM = 10;

const COLLAPSED_SNAP = "24px";
const EXPANDED_SNAP = 0.6;
const FULL_SNAP = 1;

const DEFAULT_OPACITY_PERCENT = 55;

export default function MapPage() {
    const isMobile = useIsMobile();
    const [map, setMap] = useState<maplibregl.Map | null>(null);

    const [grid, setGrid] = useState<ParkGridResponse | null>(null);
    const [isGridLoading, setIsGridLoading] = useState(true);
    const [riskByCell, setRiskByCell] = useState<Map<string, number>>(
        new Map(),
    );

    const [dayIndex, setDayIndex] = useState(SNAPSHOTS.length - 1);
    const [timeIndex, setTimeIndex] = useState(TIME_OF_DAY_SLOTS.length - 1);
    const [isHeatmapVisible, setHeatmapVisible] = useState(true);
    const [opacity, setOpacity] = useState(DEFAULT_OPACITY_PERCENT);

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
                setRiskByCell(assignRandomRisk(parseGridCells(response)));
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
    }, []);

    const panelProps = {
        riskByCell,
        dayIndex,
        onDayIndexChange: setDayIndex,
        timeIndex,
        onTimeIndexChange: setTimeIndex,
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
                    center={PARK_CENTER}
                    zoom={DEFAULT_ZOOM}
                    onMapReady={setMap}
                    onMapRemove={() => setMap(null)}
                    className="absolute inset-0"
                />
                <MapControls
                    map={map}
                    defaultCenter={PARK_CENTER}
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
                {isGridLoading && <LoadingPill label="Loading..." />}
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
