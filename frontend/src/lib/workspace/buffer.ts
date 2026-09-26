import buffer from "@turf/buffer";

export type BufferedShape = GeoJSON.Feature<
    GeoJSON.Polygon | GeoJSON.MultiPolygon
>;

export function bufferFeatureMetres(
    geometry: GeoJSON.Geometry,
    distanceM: number,
): BufferedShape | null {
    if (!Number.isFinite(distanceM) || distanceM <= 0) return null;
    try {
        const result = buffer(
            { type: "Feature", geometry, properties: {} },
            distanceM,
            { units: "meters" },
        );
        return (result as BufferedShape | undefined) ?? null;
    } catch {
        return null;
    }
}
