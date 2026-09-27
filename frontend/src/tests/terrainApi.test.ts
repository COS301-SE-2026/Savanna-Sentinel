import { setupServer } from "msw/node";
import { beforeAll, afterEach, afterAll, describe, it, expect } from "vitest";

import { getRiskAdjustments, getRouteCosts } from "@/services/terrainApi";
import { terrainHandlers } from "./mocks/terrainHandlers";

const server = setupServer(...terrainHandlers);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("terrainApi", () => {
    it("getRiskAdjustments returns the per-cell deltas in camelCase", async () => {
        expect(await getRiskAdjustments()).toEqual({
            computedVersion: 7,
            computedAt: "2026-09-01T12:00:00+00:00",
            stale: false,
            cells: { "cell-1": 0.3, "cell-3": -0.15 },
        });
    });

    it("getRouteCosts returns the per-cell multipliers and the stale flag", async () => {
        expect(await getRouteCosts()).toEqual({
            computedVersion: null,
            computedAt: null,
            stale: true,
            cells: { "cell-2": 50, "cell-3": 0.4 },
        });
    });
});
