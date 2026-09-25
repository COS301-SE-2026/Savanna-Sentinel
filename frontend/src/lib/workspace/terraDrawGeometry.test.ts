import { describe, it, expect } from "vitest";
import type * as maplibregl from "maplibre-gl";
import {
    geoJsonTypeToFeatureType,
    pixelToleranceToDegrees,
    simplifyFreehandGeometry,
    workspaceTypeToTerraDrawMode,
} from "./terraDrawGeometry";

function makeFakeMap() {
    return {
        getCenter: () => ({ lng: 0, lat: 0 }),
        project: (lngLat: { lng: number; lat: number }) => ({
            x: lngLat.lng * 100,
            y: lngLat.lat * 100,
        }),
        unproject: ([x, y]: [number, number]) => ({
            lng: x / 100,
            lat: y / 100,
        }),
    } as unknown as maplibregl.Map;
}

describe("geoJsonTypeToFeatureType", () => {
    it("maps every supported GeoJSON geometry type", () => {
        expect(geoJsonTypeToFeatureType("Point")).toBe("point");
        expect(geoJsonTypeToFeatureType("LineString")).toBe("line");
        expect(geoJsonTypeToFeatureType("Polygon")).toBe("polygon");
    });

    it("returns null for an unsupported geometry type", () => {
        expect(geoJsonTypeToFeatureType("MultiPoint")).toBeNull();
    });
});

describe("workspaceTypeToTerraDrawMode", () => {
    it("maps every workspace feature type to its terra-draw mode name", () => {
        expect(workspaceTypeToTerraDrawMode("point")).toBe("point");
        expect(workspaceTypeToTerraDrawMode("line")).toBe("linestring");
        expect(workspaceTypeToTerraDrawMode("polygon")).toBe("polygon");
    });
});

describe("pixelToleranceToDegrees", () => {
    it("converts a screen-pixel distance to degrees using the map's current projection", () => {
        const tolerance = pixelToleranceToDegrees(makeFakeMap(), 3);
        expect(tolerance).toBeCloseTo(0.03, 10);
    });

    it("scales with the requested pixel distance", () => {
        expect(pixelToleranceToDegrees(makeFakeMap(), 6)).toBeCloseTo(
            2 * pixelToleranceToDegrees(makeFakeMap(), 3),
            10,
        );
    });
});

describe("simplifyFreehandGeometry", () => {
    it("reduces the vertex count of a densely-sampled freehand line without changing its endpoints", () => {
        const noisyLine: GeoJSON.LineString = {
            type: "LineString",
            coordinates: Array.from({ length: 200 }, (_, i) => {
                const t = i / 199;
                const jitter = (i % 2 === 0 ? 1 : -1) * 0.0001;
                return [t * 10, jitter];
            }),
        };

        const simplified = simplifyFreehandGeometry(noisyLine, makeFakeMap());

        expect(simplified.coordinates.length).toBeLessThan(
            noisyLine.coordinates.length,
        );
        expect(simplified.coordinates[0]).toEqual(noisyLine.coordinates[0]);
        expect(simplified.coordinates.at(-1)).toEqual(
            noisyLine.coordinates.at(-1),
        );
    });

    it("leaves a sparse polygon with genuine detail unchanged in shape", () => {
        const polygon: GeoJSON.Polygon = {
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

        const simplified = simplifyFreehandGeometry(polygon, makeFakeMap());

        expect(simplified.coordinates[0].length).toBe(
            polygon.coordinates[0].length,
        );
    });
});
