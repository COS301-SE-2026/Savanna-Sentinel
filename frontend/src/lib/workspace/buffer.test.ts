import { describe, it, expect } from "vitest";

import { bufferFeatureMetres } from "./buffer";

type Shape = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;

function coordinatesOf(feature: Shape): number[][] {
    const rings =
        feature.geometry.type === "Polygon"
            ? feature.geometry.coordinates
            : feature.geometry.coordinates.flat();
    return rings.flat();
}

function lonExtent(feature: Shape) {
    const lons = coordinatesOf(feature).map((c) => c[0]);
    return Math.max(...lons) - Math.min(...lons);
}

function latExtent(feature: Shape) {
    const lats = coordinatesOf(feature).map((c) => c[1]);
    return Math.max(...lats) - Math.min(...lats);
}

const METRES_PER_DEGREE_LAT = 111_195;

describe("bufferFeatureMetres", () => {
    it("buffers a point into a circle whose diameter is twice the distance", () => {
        const result = bufferFeatureMetres(
            { type: "Point", coordinates: [30, -25] },
            1000,
        );
        expect(result).not.toBeNull();
        const expectedLat = 2000 / METRES_PER_DEGREE_LAT;
        expect(latExtent(result!)).toBeGreaterThan(expectedLat * 0.95);
        expect(latExtent(result!)).toBeLessThan(expectedLat * 1.05);
    });

    it("buffers a line into a corridor wider than the line", () => {
        const result = bufferFeatureMetres(
            {
                type: "LineString",
                coordinates: [
                    [30, -25],
                    [30.1, -25],
                ],
            },
            500,
        );
        expect(result).not.toBeNull();
        expect(latExtent(result!)).toBeGreaterThan(
            (2 * 500 * 0.95) / METRES_PER_DEGREE_LAT,
        );
        expect(lonExtent(result!)).toBeGreaterThan(0.1);
    });

    it("buffers a polygon outward so it contains the original footprint", () => {
        const result = bufferFeatureMetres(
            {
                type: "Polygon",
                coordinates: [
                    [
                        [30, -25],
                        [30.02, -25],
                        [30.02, -25.02],
                        [30, -25.02],
                        [30, -25],
                    ],
                ],
            },
            1000,
        );
        expect(result).not.toBeNull();
        expect(lonExtent(result!)).toBeGreaterThan(0.02);
        expect(latExtent(result!)).toBeGreaterThan(0.02);
    });

    it.each([0, -10, Number.NaN])(
        "returns null for a distance of %s",
        (distance) => {
            expect(
                bufferFeatureMetres(
                    { type: "Point", coordinates: [30, -25] },
                    distance,
                ),
            ).toBeNull();
        },
    );

    it("returns null instead of throwing for a degenerate geometry", () => {
        expect(
            bufferFeatureMetres({ type: "Polygon", coordinates: [] }, 100),
        ).toBeNull();
    });
});
