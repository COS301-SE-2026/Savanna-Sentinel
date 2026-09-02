import { setupServer } from "msw/node";
import { beforeAll, afterEach, afterAll, describe, it, expect } from "vitest";

import { routeApi } from "@/services/routeApi";
import {
    routeHandlers,
    ROUTE_REQUEST_ID,
    COMPLETED_ROUTES,
} from "./mocks/routeHandlers";
import {
    savedRouteHandlers,
    SAVED_ROUTE,
    SAVED_ROUTES_LIST,
} from "./mocks/savedRouteHandlers";

const server = setupServer(...routeHandlers, ...savedRouteHandlers);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("routeApi", () => {
    it("generateRoute posts the request and returns the queued job", async () => {
        const result = await routeApi.generateRoute({
            start_point: { type: "Point", coordinates: [31.05, -24.3] },
            end_point: { type: "Point", coordinates: [31.08, -24.32] },
            max_time: 120,
            max_fuel: 15,
            num_alternatives: 3,
        });
        expect(result.request_id).toBe(ROUTE_REQUEST_ID);
        expect(result.status).toBe("queued");
    });

    it("getRouteJob returns results for a completed job", async () => {
        const result = await routeApi.getRouteJob(ROUTE_REQUEST_ID);
        expect(result).toEqual(COMPLETED_ROUTES);
    });

    it("getRouteJob returns an empty result set for an unknown job id", async () => {
        const result = await routeApi.getRouteJob("unknown-job");
        expect(result.results).toEqual([]);
        expect(result.total).toBe(0);
    });

    it("saveRoute posts to /routes/save", async () => {
        const result = await routeApi.saveRoute({
            request_id: ROUTE_REQUEST_ID,
            start_point: { type: "Point", coordinates: [31.05, -24.3] },
            end_point: { type: "Point", coordinates: [31.08, -24.32] },
            max_time: 120,
            max_fuel: 15,
            risk_by_cell: { "cell-1": 0.5 },
            route: COMPLETED_ROUTES.results[0],
        });
        expect(result).toEqual(SAVED_ROUTE);
    });

    it("listSavedRoutes gets /routes/saved", async () => {
        const result = await routeApi.listSavedRoutes();
        expect(result).toEqual(SAVED_ROUTES_LIST);
    });
});
