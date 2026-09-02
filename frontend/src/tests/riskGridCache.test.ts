import { describe, it, expect, beforeEach, vi } from "vitest";

import {
    loadHeatmap,
    loadHeatmapSnapshots,
    loadRiskGrid,
} from "@/offline/riskGridCache";
import { riskApi } from "@/services/riskApi";
import { cacheKeys, db, STALE_AFTER_MS } from "@/offline/db";
import {
    TEST_GRID,
    TEST_HEATMAP,
    TEST_HEATMAP_ID,
    TEST_HEATMAP_SNAPSHOTS,
} from "./mocks/riskHandlers";

vi.mock("@/services/riskApi", () => ({
    riskApi: {
        getParkGrid: vi.fn(),
        getHeatmap: vi.fn(),
        getHeatmapSnapshots: vi.fn(),
    },
}));

const USER = "user-1";

beforeEach(() => {
    vi.mocked(riskApi.getParkGrid).mockReset();
    vi.mocked(riskApi.getParkGrid).mockResolvedValue(TEST_GRID);
    vi.mocked(riskApi.getHeatmap).mockReset();
    vi.mocked(riskApi.getHeatmap).mockResolvedValue(TEST_HEATMAP);
    vi.mocked(riskApi.getHeatmapSnapshots).mockReset();
    vi.mocked(riskApi.getHeatmapSnapshots).mockResolvedValue(
        TEST_HEATMAP_SNAPSHOTS,
    );
});

describe("loadRiskGrid", () => {
    it("serves the last grid and flags it as cached", async () => {
        await loadRiskGrid(USER);
        vi.mocked(riskApi.getParkGrid).mockRejectedValue(new Error("offline"));

        const result = await loadRiskGrid(USER);

        expect(result.isFromCache).toBe(true);
        expect(result.grid).toEqual(TEST_GRID);
    });

    it("reports a grid older than the refresh cycle as stale", async () => {
        await loadRiskGrid(USER);
        const row = await db.cache.get(cacheKeys.riskGrid());
        await db.cache.put({
            ...row!,
            fetchedAt: Date.now() - STALE_AFTER_MS - 1_000,
        });
        vi.mocked(riskApi.getParkGrid).mockRejectedValue(new Error("offline"));

        expect((await loadRiskGrid(USER)).isStale).toBe(true);
    });

    it("rethrows when there is nothing cached to fall back on", async () => {
        vi.mocked(riskApi.getParkGrid).mockRejectedValue(new Error("offline"));

        await expect(loadRiskGrid(USER)).rejects.toThrow("offline");
    });

    it("fetches without caching when nobody is signed in", async () => {
        const result = await loadRiskGrid(null);

        expect(result.isFromCache).toBe(false);
        expect(await db.cache.count()).toBe(0);
    });
});

describe("loadHeatmapSnapshots", () => {
    it("serves the saved snapshot list when the request fails", async () => {
        await loadHeatmapSnapshots(USER);
        vi.mocked(riskApi.getHeatmapSnapshots).mockRejectedValue(
            new Error("offline"),
        );

        const result = await loadHeatmapSnapshots(USER);

        expect(result.isFromCache).toBe(true);
        expect(result.snapshots).toEqual(TEST_HEATMAP_SNAPSHOTS.snapshots);
    });

    it("rethrows when no list has ever been cached", async () => {
        vi.mocked(riskApi.getHeatmapSnapshots).mockRejectedValue(
            new Error("offline"),
        );

        await expect(loadHeatmapSnapshots(USER)).rejects.toThrow("offline");
    });
});

describe("loadHeatmap", () => {
    it("serves the saved cells for that snapshot", async () => {
        await loadHeatmap(TEST_HEATMAP_ID, USER);
        vi.mocked(riskApi.getHeatmap).mockRejectedValue(new Error("offline"));

        const result = await loadHeatmap(TEST_HEATMAP_ID, USER);

        expect(result.isFromCache).toBe(true);
        expect(result.heatmap).toEqual(TEST_HEATMAP);
    });

    it("keeps each snapshot under its own key", async () => {
        await loadHeatmap(TEST_HEATMAP_ID, USER);
        vi.mocked(riskApi.getHeatmap).mockRejectedValue(new Error("offline"));

        await expect(loadHeatmap("other-heatmap", USER)).rejects.toThrow(
            "offline",
        );
    });
});
