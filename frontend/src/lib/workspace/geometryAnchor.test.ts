import { describe, it, expect } from "vitest";
import { lineMidpoint, polygonCentroid } from "./geometryAnchor";

describe("polygonCentroid", () => {
    it("finds the centroid of a square", () => {
        const square: GeoJSON.Polygon = {
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
        const [x, y] = polygonCentroid(square);
        expect(x).toBeCloseTo(5);
        expect(y).toBeCloseTo(5);
    });

    it("stays inside an L-shaped concave polygon rather than landing outside it", () => {
        const lShape: GeoJSON.Polygon = {
            type: "Polygon",
            coordinates: [
                [
                    [0, 0],
                    [10, 0],
                    [10, 4],
                    [4, 4],
                    [4, 10],
                    [0, 10],
                    [0, 0],
                ],
            ],
        };
        const [x, y] = polygonCentroid(lShape);
        expect(x).toBeGreaterThan(0);
        expect(x).toBeLessThan(10);
        expect(y).toBeGreaterThan(0);
        expect(y).toBeLessThan(10);
    });
});

describe("lineMidpoint", () => {
    it("finds the midpoint of a straight two-point line", () => {
        const line: GeoJSON.LineString = {
            type: "LineString",
            coordinates: [
                [0, 0],
                [10, 0],
            ],
        };
        expect(lineMidpoint(line)).toEqual([5, 0]);
    });

    it("finds the point halfway along cumulative length for a multi-segment line", () => {
        const line: GeoJSON.LineString = {
            type: "LineString",
            coordinates: [
                [0, 0],
                [0, 8],
                [6, 8],
            ],
        };
        const [x, y] = lineMidpoint(line);
        expect(x).toBeCloseTo(0);
        expect(y).toBeCloseTo(7);
    });

    it("returns the single coordinate for a degenerate one-point line", () => {
        const line: GeoJSON.LineString = {
            type: "LineString",
            coordinates: [[3, 4]],
        };
        expect(lineMidpoint(line)).toEqual([3, 4]);
    });
});
