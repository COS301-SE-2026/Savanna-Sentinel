import buffer from "@turf/buffer";

export function bufferFeatureOutline(
    geometry: GeoJSON.Polygon | GeoJSON.LineString,
    distanceDegrees: number,
): GeoJSON.Feature<GeoJSON.Polygon> | null {
    if (distanceDegrees <= 0) return null;
    const buffered = buffer(
        { type: "Feature", geometry, properties: {} },
        distanceDegrees,
        {
            units: "degrees",
        },
    );
    if (!buffered || buffered.geometry.type !== "Polygon") return null;
    return buffered as GeoJSON.Feature<GeoJSON.Polygon>;
}
