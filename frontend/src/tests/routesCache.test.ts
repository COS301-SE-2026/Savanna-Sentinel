import { describe, it, expect, beforeEach, vi } from "vitest";

import {
    cacheSavedRoute,
    loadSavedRoutes,
    MAX_CACHED_ROUTES,
} from "@/offline/routesCache";
import { routeApi, type SavedRoute } from "@/services/routeApi";
import { db } from "@/offline/db";

vi.mock("@/services/routeApi", () => ({
    routeApi: { listSavedRoutes: vi.fn() },
}));

const USER = "user-1";

function route(id: string, createdAt: string): SavedRoute {
    return {
        id,
        request_id: `req-${id}`,
        start_point: { type: "Point", coordinates: [31.0, -24.3] },
        end_point: { type: "Point", coordinates: [31.2, -24.1] },
        max_time: null,
        max_fuel: null,
        risk_by_cell: {},
        path_geometry: {
            type: "LineString",
            coordinates: [
                [31.0, -24.3],
                [31.2, -24.1],
            ],
        },
        estimated_time_min: 40,
        estimated_fuel_l: 9,
        risk_coverage: 0.5,
        created_at: createdAt,
    };
}

function listOf(...routes: SavedRoute[]) {
    vi.mocked(routeApi.listSavedRoutes).mockResolvedValue({
        results: routes,
        total: routes.length,
        page: 1,
        page_size: 20,
    });
}

beforeEach(() => {
    vi.mocked(routeApi.listSavedRoutes).mockReset();
});

describe("loadSavedRoutes online", () => {
    it("keeps only the newest few routes on the device", async () => {
        listOf(
            route("old", "2026-01-01T00:00:00Z"),
            route("mid", "2026-05-01T00:00:00Z"),
            route("new", "2026-08-01T00:00:00Z"),
            route("newest", "2026-08-20T00:00:00Z"),
        );

        await loadSavedRoutes(USER);

        const stored = await db.routes.toArray();
        expect(stored).toHaveLength(MAX_CACHED_ROUTES);
        expect(stored.map((r) => r.routeId).sort()).toEqual(
            ["mid", "new", "newest"].sort(),
        );
    });

    it("replaces the cache so a deleted route stops appearing", async () => {
        listOf(route("r1", "2026-08-01T00:00:00Z"));
        await loadSavedRoutes(USER);

        listOf(route("r2", "2026-08-02T00:00:00Z"));
        await loadSavedRoutes(USER);

        const stored = await db.routes.toArray();
        expect(stored.map((r) => r.routeId)).toEqual(["r2"]);
    });
});

describe("loadSavedRoutes offline", () => {
    it("serves the cached routes newest first", async () => {
        listOf(
            route("older", "2026-01-01T00:00:00Z"),
            route("newer", "2026-08-01T00:00:00Z"),
        );
        await loadSavedRoutes(USER);
        vi.mocked(routeApi.listSavedRoutes).mockRejectedValue(
            new Error("offline"),
        );

        const result = await loadSavedRoutes(USER);

        expect(result.isFromCache).toBe(true);
        expect(result.routes.map((r) => r.id)).toEqual(["newer", "older"]);
    });

    it("returns an empty list when the last fetch was empty", async () => {
        listOf();
        await loadSavedRoutes(USER);
        vi.mocked(routeApi.listSavedRoutes).mockRejectedValue(
            new Error("offline"),
        );

        const result = await loadSavedRoutes(USER);

        expect(result.isFromCache).toBe(true);
        expect(result.routes).toEqual([]);
    });

    it("rethrows when the list has never been fetched", async () => {
        vi.mocked(routeApi.listSavedRoutes).mockRejectedValue(
            new Error("offline"),
        );

        await expect(loadSavedRoutes(USER)).rejects.toThrow("offline");
    });
});

describe("cacheSavedRoute", () => {
    it("stores each saved route and prunes to the cap", async () => {
        for (const [id, day] of [
            ["r1", "01"],
            ["r2", "02"],
            ["r3", "03"],
            ["r4", "04"],
        ]) {
            await cacheSavedRoute(USER, route(id, `2026-08-${day}T00:00:00Z`));
        }

        const stored = await db.routes.toArray();
        expect(stored).toHaveLength(MAX_CACHED_ROUTES);
        expect(stored.map((r) => r.routeId)).not.toContain("r1");
    });

    it("does nothing without a signed-in user", async () => {
        await cacheSavedRoute(null, route("r1", "2026-08-01T00:00:00Z"));

        expect(await db.routes.count()).toBe(0);
    });
});
