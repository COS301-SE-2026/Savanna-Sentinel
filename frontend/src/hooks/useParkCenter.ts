import { useEffect, useMemo } from "react";

import { useMapStore } from "@/store/mapStore";
import {
    PARK_CENTER_FALLBACK,
    getGridCenterAndBounds,
    parseGridCells,
} from "@/lib/riskGrid";

export function useParkCenter(): [number, number] {
    const grid = useMapStore((s) => s.grid);
    const gridStatus = useMapStore((s) => s.gridStatus);
    const loadGrid = useMapStore((s) => s.loadGrid);

    useEffect(() => {
        if (grid === null && gridStatus === "idle") {
            loadGrid();
        }
    }, [grid, gridStatus, loadGrid]);

    return useMemo(() => {
        if (grid === null) return PARK_CENTER_FALLBACK;
        const cells = parseGridCells(grid);
        if (cells.length === 0) return PARK_CENTER_FALLBACK;
        return getGridCenterAndBounds(cells).center;
    }, [grid]);
}
