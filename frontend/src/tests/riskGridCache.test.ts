import { describe, it, expect, beforeEach, vi } from "vitest";

import { loadRiskGrid } from "@/offline/riskGridCache";
import { riskApi } from "@/services/riskApi";
import { cacheKeys, db, STALE_AFTER_MS } from "@/offline/db";
import { TEST_GRID } from "./mocks/riskHandlers";

vi.mock("@/services/riskApi", () => ({
    riskApi: { getParkGrid: vi.fn() },
}));

const USER = "user-1";
const PARK = "klaserie";

beforeEach(() => {
    vi.mocked(riskApi.getParkGrid).mockReset();
    vi.mocked(riskApi.getParkGrid).mockResolvedValue(TEST_GRID);
});

describe("loadRiskGrid", () => {
    it("serves the last snapshot and flags it as cached", async () => {
        const online = await loadRiskGrid(PARK, USER);
        vi.mocked(riskApi.getParkGrid).mockRejectedValue(
            new Error("Network Error"),
        );

        const offline = await loadRiskGrid(PARK, USER);

        expect(offline.isFromCache).toBe(true);
        expect(offline.grid).toEqual(TEST_GRID);
        expect([...offline.riskByCell.entries()]).toEqual([
            ...online.riskByCell.entries(),
        ]);
    });

    it("reports a snapshot older than the refresh cycle as stale", async () => {
        await loadRiskGrid(PARK, USER);
        const row = await db.cache.get(cacheKeys.riskGrid(PARK));
        await db.cache.put({
            ...row!,
            fetchedAt: Date.now() - STALE_AFTER_MS - 1_000,
        });
        vi.mocked(riskApi.getParkGrid).mockRejectedValue(new Error("offline"));

        expect((await loadRiskGrid(PARK, USER)).isStale).toBe(true);
    });

    it("rethrows when there is nothing cached to fall back on", async () => {
        vi.mocked(riskApi.getParkGrid).mockRejectedValue(new Error("offline"));

        await expect(loadRiskGrid(PARK, USER)).rejects.toThrow("offline");
    });

    it("fetches without caching when nobody is signed in", async () => {
        const result = await loadRiskGrid(PARK, null);

        expect(result.isFromCache).toBe(false);
        expect(await db.cache.count()).toBe(0);
    });
});
