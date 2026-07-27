import { describe, it, expect } from "vitest";

import {
    parseGridCells,
    assignRandomRisk,
    buildRowColIndex,
    computeCellOpacity,
    buildGridFeatureCollection,
    type GridCell,
} from "@/lib/riskGrid";
import { TEST_GRID } from "./mocks/riskHandlers";

describe("parseGridCells", () => {
    it("flattens the API response into GridCell records", () => {
        const cells = parseGridCells(TEST_GRID);
        expect(cells).toHaveLength(4);
        expect(cells[0]).toEqual({
            cellId: "cell-1",
            row: 0,
            col: 0,
            corners: TEST_GRID.features[0].geometry.coordinates[0],
        });
    });
});

describe("assignRandomRisk", () => {
    it("gives every cell a score between 0 and 1", () => {
        const cells = parseGridCells(TEST_GRID);
        const scores = assignRandomRisk(cells);
        expect(scores.size).toBe(4);
        for (const score of scores.values()) {
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThan(1);
        }
    });

    it("clusters risk around hotspots instead of scoring cells independently", () => {
        const cells: GridCell[] = [];
        for (let row = 0; row < 20; row++) {
            for (let col = 0; col < 20; col++) {
                cells.push({ cellId: `${row},${col}`, row, col, corners: [] });
            }
        }
        const scores = assignRandomRisk(cells);
        const at = (row: number, col: number) => scores.get(`${row},${col}`)!;

        let neighborDiffSum = 0;
        let neighborPairs = 0;
        for (let row = 0; row < 20; row++) {
            for (let col = 0; col < 19; col++) {
                neighborDiffSum += Math.abs(at(row, col) - at(row, col + 1));
                neighborPairs++;
            }
        }
        const avgNeighborDiff = neighborDiffSum / neighborPairs;

        expect(avgNeighborDiff).toBeLessThan(0.15);
    });
});

describe("computeCellOpacity", () => {
    const cells: GridCell[] = [
        { cellId: "a", row: 1, col: 1, corners: [] },
        { cellId: "b", row: 0, col: 0, corners: [] },
        { cellId: "b2", row: 0, col: 1, corners: [] },
        { cellId: "b3", row: 0, col: 2, corners: [] },
        { cellId: "b4", row: 1, col: 0, corners: [] },
        { cellId: "b5", row: 1, col: 2, corners: [] },
        { cellId: "b6", row: 2, col: 0, corners: [] },
        { cellId: "b7", row: 2, col: 1, corners: [] },
        { cellId: "b8", row: 2, col: 2, corners: [] },
    ];
    const index = buildRowColIndex(cells);

    it("suppresses opacity to 15% for a safe cell with all-safe neighbours", () => {
        const riskByCell = new Map(cells.map((c) => [c.cellId, 0.1]));
        expect(computeCellOpacity(cells[0], index, riskByCell)).toBe(0.15);
    });

    it("uses 30% for a safe cell with at least one non-safe neighbour", () => {
        const riskByCell = new Map(cells.map((c) => [c.cellId, 0.1]));
        riskByCell.set("b", 0.9);
        expect(computeCellOpacity(cells[0], index, riskByCell)).toBe(0.3);
    });

    it("uses 30% for a non-safe cell regardless of neighbours", () => {
        const riskByCell = new Map(cells.map((c) => [c.cellId, 0.1]));
        riskByCell.set("a", 0.9);
        expect(computeCellOpacity(cells[0], index, riskByCell)).toBe(0.3);
    });

    it("treats an edge cell (fewer than 8 neighbours present) as suppressible", () => {
        const edgeCells: GridCell[] = [
            { cellId: "corner", row: 0, col: 0, corners: [] },
            { cellId: "right", row: 0, col: 1, corners: [] },
            { cellId: "below", row: 1, col: 0, corners: [] },
        ];
        const edgeIndex = buildRowColIndex(edgeCells);
        const riskByCell = new Map(edgeCells.map((c) => [c.cellId, 0.1]));
        expect(computeCellOpacity(edgeCells[0], edgeIndex, riskByCell)).toBe(
            0.15,
        );
    });
});

describe("buildGridFeatureCollection", () => {
    it("builds one Polygon feature per cell with fillColor/fillOpacity properties", () => {
        const cells = parseGridCells(TEST_GRID);
        const riskByCell = new Map(cells.map((c) => [c.cellId, 0.1]));
        const fc = buildGridFeatureCollection(cells, riskByCell);

        expect(fc.type).toBe("FeatureCollection");
        expect(fc.features).toHaveLength(4);
        expect(fc.features[0].geometry.type).toBe("Polygon");
        expect(fc.features[0].properties?.cellId).toBe("cell-1");
        expect(fc.features[0].properties?.fillColor).toBe("#06b050");
    });
});
