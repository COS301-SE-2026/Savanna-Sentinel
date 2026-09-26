import { describe, it, expect } from "vitest";

import {
    addStop,
    createStop,
    firstUnsetStop,
    initialStops,
    moveStop,
    removeStop,
    reverseStops,
    stopLabel,
    stopsFromSaved,
    toStopsPayload,
} from "@/lib/patrolStops";
import { MAX_STOPS } from "@/types/patrol";
import { SAVED_ROUTE } from "./mocks/savedRouteHandlers";

const A = { lat: -24.3, lon: 31.05 };
const B = { lat: -24.31, lon: 31.06 };
const C = { lat: -24.32, lon: 31.08 };

describe("patrolStops", () => {
    it("starts with an empty start and end point", () => {
        const stops = initialStops();
        expect(stops).toHaveLength(2);
        expect(stops.every((s) => s.point === null)).toBe(true);
    });

    it("inserts a new stop before the end point", () => {
        const stops = [createStop(A), createStop(C)];
        const next = addStop(stops);
        expect(next).toHaveLength(3);
        expect(next[0].id).toBe(stops[0].id);
        expect(next[2].id).toBe(stops[1].id);
        expect(next[1].point).toBeNull();
    });

    it("stops adding once the limit is reached", () => {
        let stops = initialStops();
        for (let i = 0; i < 10; i++) stops = addStop(stops);
        expect(stops).toHaveLength(MAX_STOPS);
    });

    it("never removes below a start and an end point", () => {
        const stops = initialStops();
        expect(removeStop(stops, stops[0].id)).toBe(stops);
    });

    it("moves a stop to the position of another", () => {
        const stops = [createStop(A), createStop(B), createStop(C)];
        const next = moveStop(stops, stops[2].id, stops[0].id);
        expect(next.map((s) => s.point)).toEqual([C, A, B]);
    });

    it("reverses the stop order for the swap button", () => {
        const stops = [createStop(A), createStop(C)];
        expect(reverseStops(stops).map((s) => s.point)).toEqual([C, A]);
    });

    it("labels stops by position", () => {
        expect([0, 1, 2, 3].map((i) => stopLabel(i, 4))).toEqual([
            "Start point",
            "Stop 1",
            "Stop 2",
            "End point",
        ]);
    });

    it("names the first stop still missing a location", () => {
        const stops = [createStop(A), createStop(), createStop(C)];
        expect(firstUnsetStop(stops)).toBe("Stop 1");
    });

    it("splits stops into start, waypoints and end in GeoJSON order", () => {
        const payload = toStopsPayload([
            createStop(A),
            createStop(B),
            createStop(C),
        ]);
        expect(payload).toEqual({
            start_point: { type: "Point", coordinates: [31.05, -24.3] },
            end_point: { type: "Point", coordinates: [31.08, -24.32] },
            waypoints: [{ type: "Point", coordinates: [31.06, -24.31] }],
        });
    });

    it("returns no payload while any stop is unset", () => {
        expect(toStopsPayload([createStop(A), createStop()])).toBeNull();
    });

    it("rebuilds stops from a saved route, tolerating old cached routes", () => {
        expect(stopsFromSaved(SAVED_ROUTE)).toHaveLength(3);
        expect(
            stopsFromSaved({ ...SAVED_ROUTE, waypoints: undefined }),
        ).toHaveLength(2);
    });
});
