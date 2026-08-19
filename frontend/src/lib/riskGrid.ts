import type { ParkGridResponse } from "@/services/riskApi";
import { getRiskLevel, RISK_LEVEL_COLORS } from "@/lib/mapTokens";

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

const HOTSPOT_COUNT_MIN = 3;
const HOTSPOT_COUNT_MAX = 6;
const HOTSPOT_SIGMA_MIN = 1.5;
const HOTSPOT_SIGMA_MAX = 3.5;
const HOTSPOT_INTENSITY_MIN = 0.75;
const HOTSPOT_INTENSITY_MAX = 1.0;
const AMBIENT_JITTER_MAX = 0.1;
const MAX_SCORE = 0.99;

/** Mock heatmap data generator, not a security context. */
function mockRandom(): number {
    return Math.random(); /* NOSONAR */
}

function randomBetween(min: number, max: number): number {
    return min + mockRandom() * (max - min);
}

interface Hotspot {
    row: number;
    col: number;
    sigma: number;
    intensity: number;
}

/**
 * seeds 3-6 random hotspots
 */
export function assignRandomRisk(cells: GridCell[]): Map<string, number> {
    const scores = new Map<string, number>();
    if (cells.length === 0) return scores;

    const hotspotCount = Math.floor(
        randomBetween(HOTSPOT_COUNT_MIN, HOTSPOT_COUNT_MAX + 1),
    );
    const hotspots: Hotspot[] = Array.from({ length: hotspotCount }, () => {
        const anchor = cells[Math.floor(mockRandom() * cells.length)];
        return {
            row: anchor.row,
            col: anchor.col,
            sigma: randomBetween(HOTSPOT_SIGMA_MIN, HOTSPOT_SIGMA_MAX),
            intensity: randomBetween(
                HOTSPOT_INTENSITY_MIN,
                HOTSPOT_INTENSITY_MAX,
            ),
        };
    });

    for (const cell of cells) {
        let peak = 0;
        for (const hotspot of hotspots) {
            const dRow = cell.row - hotspot.row;
            const dCol = cell.col - hotspot.col;
            const distSq = dRow * dRow + dCol * dCol;
            const value =
                hotspot.intensity *
                Math.exp(-distSq / (2 * hotspot.sigma * hotspot.sigma));
            if (value > peak) peak = value;
        }
        const jitter = mockRandom() * AMBIENT_JITTER_MAX;
        scores.set(cell.cellId, Math.min(peak + jitter, MAX_SCORE));
    }
    return scores;
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
        const neighborLevel = getRiskLevel(
            riskByCell.get(neighbor.cellId) ?? 0,
        );
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
            const score = riskByCell.get(cell.cellId) ?? 0;
            const level = getRiskLevel(score);
            return {
                type: "Feature",
                properties: {
                    cellId: cell.cellId,
                    fillColor: RISK_LEVEL_COLORS[level],
                    fillOpacity: computeCellOpacity(
                        cell,
                        index,
                        riskByCell,
                        opacityOverride,
                    ),
                },
                geometry: {
                    type: "Polygon",
                    coordinates: [cell.corners],
                },
            };
        }),
    };
}
