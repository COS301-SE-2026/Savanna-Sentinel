import { describe, it, expect, beforeEach } from "vitest";

import {
    clearPinnedRoute,
    loadPinnedRoute,
    pinRouteToHeatmap,
    unpinDeletedRoute,
} from "@/offline/pinnedRouteCache";
import { cacheKeys, db, STALE_AFTER_MS } from "@/offline/db";
import type { SavedRoute } from "@/services/routeApi";

const USER = "user-1";
const OTHER_USER = "user-2";

function route(id: string): SavedRoute {
    return {
        id,
        request_id: `req-${id}`,
        start_point: { type: "Point", coordinates: [31.05, -24.3] },
        end_point: { type: "Point", coordinates: [31.08, -24.32] },
        risk_by_cell: { "cell-1": 0.5 },
        path_geometry: {
            type: "LineString",
            coordinates: [
                [31.05, -24.3],
                [31.08, -24.32],
            ],
        },
        distance_km: 6.2,
        risk_coverage: 0.42,
        created_at: "2026-01-15T09:30:00Z",
    };
}

beforeEach(async () => {
    await db.cache.clear();
});

describe("pinRouteToHeatmap", () => {
    it("round-trips the whole route so the heatmap can draw it offline", async () => {
        await pinRouteToHeatmap(USER, route("r1"));

        expect(await loadPinnedRoute(USER)).toEqual(route("r1"));
    });

    it("keeps only the most recently sent route", async () => {
        await pinRouteToHeatmap(USER, route("r1"));
        await pinRouteToHeatmap(USER, route("r2"));

        expect((await loadPinnedRoute(USER))?.id).toBe("r2");
        expect(await db.cache.count()).toBe(1);
    });

    it("survives independently of the saved-route list cap", async () => {
        await pinRouteToHeatmap(USER, route("r1"));
        await db.routes.clear();

        expect((await loadPinnedRoute(USER))?.id).toBe("r1");
    });
});

describe("loadPinnedRoute", () => {
    it("does not leak one user's route to another", async () => {
        await pinRouteToHeatmap(USER, route("r1"));

        expect(await loadPinnedRoute(OTHER_USER)).toBeNull();
    });

    it("returns null when nothing has been sent", async () => {
        expect(await loadPinnedRoute(USER)).toBeNull();
    });

    it("returns null without a signed-in user", async () => {
        await pinRouteToHeatmap(USER, route("r1"));

        expect(await loadPinnedRoute(null)).toBeNull();
    });

    it("still serves a pin older than the normal cache staleness window", async () => {
        await pinRouteToHeatmap(USER, route("r1"));
        await db.cache.update(cacheKeys.pinnedRoute(), {
            fetchedAt: Date.now() - STALE_AFTER_MS * 10,
        });

        expect((await loadPinnedRoute(USER))?.id).toBe("r1");
    });
});

describe("clearPinnedRoute", () => {
    it("removes the route from the device", async () => {
        await pinRouteToHeatmap(USER, route("r1"));
        await clearPinnedRoute();

        expect(await loadPinnedRoute(USER)).toBeNull();
    });
});

describe("unpinDeletedRoute", () => {
    it("drops the pin when the deleted route is the pinned one", async () => {
        await pinRouteToHeatmap(USER, route("r1"));
        await unpinDeletedRoute(USER, "r1");

        expect(await loadPinnedRoute(USER)).toBeNull();
    });

    it("leaves the pin alone when a different route is deleted", async () => {
        await pinRouteToHeatmap(USER, route("r1"));
        await unpinDeletedRoute(USER, "r2");

        expect((await loadPinnedRoute(USER))?.id).toBe("r1");
    });
});
