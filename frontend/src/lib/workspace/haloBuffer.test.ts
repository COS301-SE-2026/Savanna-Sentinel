import { describe, it, expect } from "vitest";
import { bufferFeatureOutline } from "./haloBuffer";

const SQUARE: GeoJSON.Polygon = {
    type: "Polygon",
    coordinates: [
        [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
            [0, 0],
        ],
    ],
};

describe("bufferFeatureOutline", () => {
    it("returns null for a non-positive distance", () => {
        expect(bufferFeatureOutline(SQUARE, 0)).toBeNull();
        expect(bufferFeatureOutline(SQUARE, -1)).toBeNull();
    });

    it("expands a polygon's bounding box outward by roughly the buffer distance on every side", () => {
        const buffered = bufferFeatureOutline(SQUARE, 1);
        expect(buffered).not.toBeNull();
        const coords = buffered!.geometry.coordinates[0];
        const xs = coords.map((c) => c[0]);
        const ys = coords.map((c) => c[1]);
        expect(Math.min(...xs)).toBeLessThan(-0.9);
        expect(Math.max(...xs)).toBeGreaterThan(10.9);
        expect(Math.min(...ys)).toBeLessThan(-0.9);
        expect(Math.max(...ys)).toBeGreaterThan(10.9);
    });

    it("produces a valid closed polygon around a sharp acute-angle line corner, without dropping out", () => {
        const sharpTurn: GeoJSON.LineString = {
            type: "LineString",
            coordinates: [
                [0, 0],
                [10, 1],
                [0, 2],
            ],
        };
        const buffered = bufferFeatureOutline(sharpTurn, 0.5);
        expect(buffered).not.toBeNull();
        expect(buffered!.geometry.type).toBe("Polygon");
        const ring = buffered!.geometry.coordinates[0];
        expect(ring.length).toBeGreaterThan(3);
        expect(ring[0]).toEqual(ring[ring.length - 1]);
    });
});
