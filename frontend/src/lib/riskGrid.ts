import type { HeatmapCell, ParkGridResponse } from "@/services/riskApi";
import {
    getRiskLevel,
    RISK_LEVEL_COLORS,
    NO_DATA_CELL_COLOR,
    NO_DATA_CELL_OPACITY,
} from "@/lib/mapTokens";

export interface GridCell {
    cellId: string;
    row: number;
    col: number;
    corners: [number, number][];
}

export function parseGridCells(grid: ParkGridResponse): GridCell[] {
    return grid.features.map((feature) => ({
        cellId: feature.properties.cell_id,
        row: feature.properties.row,
        col: feature.properties.col,
        corners: feature.geometry.coordinates[0] as [number, number][],
    }));
}

export function scoresByCell(
    cellsByRef: Map<string, HeatmapCell>,
): Map<string, number> {
    return new Map(
        [...cellsByRef].map(([ref, cell]) => [ref, cell.risk_score]),
    );
}

export type RowColIndex = Map<string, GridCell>;

export function buildRowColIndex(cells: GridCell[]): RowColIndex {
    const index = new Map<string, GridCell>();
    for (const cell of cells) {
        index.set(`${cell.row},${cell.col}`, cell);
    }
    return index;
}

const SUPPRESSED_OPACITY = 0.15;
const DEFAULT_OPACITY = 0.3;
const NEIGHBOR_OFFSETS: [number, number][] = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
];

function isInteriorSuppressed(
    cell: GridCell,
    index: RowColIndex,
    riskByCell: Map<string, number>,
): boolean {
    const level = getRiskLevel(riskByCell.get(cell.cellId) ?? 0);
    if (level !== "safe") return false;

    for (const [dRow, dCol] of NEIGHBOR_OFFSETS) {
        const neighbor = index.get(`${cell.row + dRow},${cell.col + dCol}`);
        if (!neighbor) continue;
        if (!riskByCell.has(neighbor.cellId)) return false;
        const neighborLevel = getRiskLevel(riskByCell.get(neighbor.cellId)!);
        if (neighborLevel !== "safe") return false;
    }
    return true;
}

/**
 * Interior-suppression rule: a safe cell whose every present 8-neighbour is
 * also safe (absent neighbours at the grid edge don't count against it)
 * renders at a suppressed opacity instead of the page's default, so a large
 * safe zone doesn't paint solid green.
 */
export function computeCellOpacity(
    cell: GridCell,
    index: RowColIndex,
    riskByCell: Map<string, number>,
    opacityOverride?: number,
): number {
    if (isInteriorSuppressed(cell, index, riskByCell)) {
        return opacityOverride !== undefined
            ? Math.min(opacityOverride, SUPPRESSED_OPACITY)
            : SUPPRESSED_OPACITY;
    }
    return opacityOverride ?? DEFAULT_OPACITY;
}

export function buildGridFeatureCollection(
    cells: GridCell[],
    riskByCell: Map<string, number>,
    opacityOverride?: number,
): GeoJSON.FeatureCollection {
    const index = buildRowColIndex(cells);
    return {
        type: "FeatureCollection",
        features: cells.map((cell) => {
            const hasScore = riskByCell.has(cell.cellId);
            const score = riskByCell.get(cell.cellId) ?? 0;
            const level = getRiskLevel(score);
            return {
                type: "Feature",
                properties: {
                    cellId: cell.cellId,
                    fillColor: hasScore
                        ? RISK_LEVEL_COLORS[level]
                        : NO_DATA_CELL_COLOR,
                    fillOpacity: hasScore
                        ? computeCellOpacity(
                              cell,
                              index,
                              riskByCell,
                              opacityOverride,
                          )
                        : NO_DATA_CELL_OPACITY,
                },
                geometry: {
                    type: "Polygon",
                    coordinates: [cell.corners],
                },
            };
        }),
    };
}
