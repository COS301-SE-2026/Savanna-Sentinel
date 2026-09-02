import { describe, it, expect } from "vitest";

import {
    parseGridCells,
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

    describe("opacityOverride", () => {
        it("replaces the default opacity for a non-suppressed cell", () => {
            const riskByCell = new Map(cells.map((c) => [c.cellId, 0.1]));
            riskByCell.set("b", 0.9);
            expect(computeCellOpacity(cells[0], index, riskByCell, 0.8)).toBe(
                0.8,
            );
        });

        it("caps a suppressed cell's opacity at the suppressed ceiling instead of scaling it", () => {
            const riskByCell = new Map(cells.map((c) => [c.cellId, 0.1]));
            expect(computeCellOpacity(cells[0], index, riskByCell, 1)).toBe(
                0.15,
            );
        });

        it("lets a suppressed cell go below the ceiling for a low override", () => {
            const riskByCell = new Map(cells.map((c) => [c.cellId, 0.1]));
            expect(computeCellOpacity(cells[0], index, riskByCell, 0.05)).toBe(
                0.05,
            );
        });
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

    it("bakes the opacity override into each feature's fillOpacity", () => {
        const cells = parseGridCells(TEST_GRID);
        const riskByCell = new Map(cells.map((c) => [c.cellId, 0.1]));
        const fc = buildGridFeatureCollection(cells, riskByCell, 0.05);

        for (const feature of fc.features) {
            expect(feature.properties?.fillOpacity).toBe(0.05);
        }
    });

    it("uses a neutral fill for a cell missing from riskByCell", () => {
        const cells = parseGridCells(TEST_GRID);
        const riskByCell = new Map([[cells[0].cellId, 0.1]]);
        const fc = buildGridFeatureCollection(cells, riskByCell);

        const missingFeature = fc.features.find(
            (f) => f.properties?.cellId === cells[1].cellId,
        )!;
        expect(missingFeature.properties?.fillColor).toBe("#4f7392");
        expect(missingFeature.properties?.fillOpacity).toBe(0.15);

        const presentFeature = fc.features.find(
            (f) => f.properties?.cellId === cells[0].cellId,
        )!;
        expect(presentFeature.properties?.fillColor).toBe("#06b050");
    });
});
