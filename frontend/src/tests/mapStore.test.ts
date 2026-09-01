import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { beforeAll, afterEach, afterAll, describe, it, expect } from "vitest";

import { useMapStore, initialMapState } from "@/store/mapStore";
import type { HeatmapCell } from "@/services/riskApi";
import {
    TEST_GRID,
    TEST_HEATMAP,
    TEST_HEATMAP_ID,
    TEST_HEATMAP_SNAPSHOTS,
    TEST_CELL_EXPLAIN,
    TEST_ACTIVE_MODEL,
} from "./mocks/riskHandlers";

const BASE = "http://localhost:8000/v1";
const server = setupServer(
    http.get(`${BASE}/risk/grid`, () => HttpResponse.json(TEST_GRID)),
    http.get(`${BASE}/risk/heatmap/snapshots`, () =>
        HttpResponse.json(TEST_HEATMAP_SNAPSHOTS),
    ),
    http.get(`${BASE}/risk/heatmap`, () => HttpResponse.json(TEST_HEATMAP)),
    http.get(`${BASE}/risk/heatmap/cells/:cellId/explain`, () =>
        HttpResponse.json(TEST_CELL_EXPLAIN),
    ),
    http.get(`${BASE}/risk/models/active`, () =>
        HttpResponse.json(TEST_ACTIVE_MODEL),
    ),
);
beforeAll(() => server.listen());
afterEach(() => {
    server.resetHandlers();
    useMapStore.setState(initialMapState, true);
});
afterAll(() => server.close());

describe("mapStore", () => {
    it("loadGrid populates grid without sending a park_id param", async () => {
        let capturedUrl: URL | null = null;
        server.use(
            http.get(`${BASE}/risk/grid`, ({ request }) => {
                capturedUrl = new URL(request.url);
                return HttpResponse.json(TEST_GRID);
            }),
        );

        await useMapStore.getState().loadGrid();

        expect(useMapStore.getState().grid).toEqual(TEST_GRID);
        expect(useMapStore.getState().gridStatus).toBe("idle");
        expect(capturedUrl!.searchParams.has("park_id")).toBe(false);
    });

    it("loadGrid sets gridStatus to error on failure", async () => {
        server.use(
            http.get(`${BASE}/risk/grid`, () =>
                HttpResponse.json({ detail: "boom" }, { status: 500 }),
            ),
        );

        await useMapStore.getState().loadGrid();

        expect(useMapStore.getState().gridStatus).toBe("error");
    });

    it("loadSnapshots auto-selects the newest snapshot and joins its heatmap", async () => {
        await useMapStore.getState().loadSnapshots();

        const state = useMapStore.getState();
        expect(state.selectedSnapshotId).toBe(TEST_HEATMAP_ID);
        expect(state.heatmapStatus).toBe("idle");
        expect(state.cellsByRef.get("cell-1")?.risk_score).toBe(0.1);
        expect(state.cellsByRef.get("cell-1")?.cell_id).toBe("cell-1-uuid");
    });

    it("loadSnapshots sets heatmapStatus to no-data when the list is empty", async () => {
        server.use(
            http.get(`${BASE}/risk/heatmap/snapshots`, () =>
                HttpResponse.json({ snapshots: [] }),
            ),
        );

        await useMapStore.getState().loadSnapshots();

        const state = useMapStore.getState();
        expect(state.heatmapStatus).toBe("no-data");
        expect(state.cellsByRef.size).toBe(0);
        expect(state.selectedSnapshotId).toBeNull();
    });

    it("selectSnapshot sets no-data status on a 404", async () => {
        server.use(
            http.get(`${BASE}/risk/heatmap`, () =>
                HttpResponse.json(
                    { detail: "No heatmap has been computed yet" },
                    { status: 404 },
                ),
            ),
        );

        await useMapStore.getState().selectSnapshot("missing-heatmap");

        const state = useMapStore.getState();
        expect(state.heatmapStatus).toBe("no-data");
        expect(state.cellsByRef.size).toBe(0);
    });

    it("selectSnapshot clears any previously-cached explainByCellRef entries", async () => {
        useMapStore.setState({
            explainByCellRef: new Map([["cell-1", TEST_CELL_EXPLAIN]]),
        });

        await useMapStore.getState().selectSnapshot(TEST_HEATMAP_ID);

        expect(useMapStore.getState().explainByCellRef.size).toBe(0);
    });

    it("loadCellExplain caches results and does not refetch on a second call", async () => {
        const cell1: HeatmapCell = TEST_HEATMAP.cells[0];
        useMapStore.setState({
            cellsByRef: new Map([["cell-1", cell1]]),
        });
        let callCount = 0;
        server.use(
            http.get(`${BASE}/risk/heatmap/cells/:cellId/explain`, () => {
                callCount++;
                return HttpResponse.json(TEST_CELL_EXPLAIN);
            }),
        );

        const first = await useMapStore.getState().loadCellExplain("cell-1");
        const second = await useMapStore.getState().loadCellExplain("cell-1");

        expect(first).toEqual(TEST_CELL_EXPLAIN);
        expect(second).toEqual(TEST_CELL_EXPLAIN);
        expect(callCount).toBe(1);
    });

    it("loadCellExplain returns null when the cell has no known UUID", async () => {
        const result = await useMapStore.getState().loadCellExplain("cell-9");
        expect(result).toBeNull();
    });

    it("loadActiveModel fetches once and caches", async () => {
        let callCount = 0;
        server.use(
            http.get(`${BASE}/risk/models/active`, () => {
                callCount++;
                return HttpResponse.json(TEST_ACTIVE_MODEL);
            }),
        );

        await useMapStore.getState().loadActiveModel();
        await useMapStore.getState().loadActiveModel();

        expect(useMapStore.getState().activeModel).toEqual(TEST_ACTIVE_MODEL);
        expect(callCount).toBe(1);
    });
});
