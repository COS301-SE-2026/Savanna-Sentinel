function distance(a: GeoJSON.Position, b: GeoJSON.Position): number {
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function polygonCentroid(geometry: GeoJSON.Polygon): GeoJSON.Position {
    const ring = geometry.coordinates[0];
    let area = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < ring.length - 1; i++) {
        const [x0, y0] = ring[i];
        const [x1, y1] = ring[i + 1];
        const cross = x0 * y1 - x1 * y0;
        area += cross;
        cx += (x0 + x1) * cross;
        cy += (y0 + y1) * cross;
    }
    area /= 2;
    if (area === 0) {
        const [sumX, sumY] = ring.reduce(
            ([ax, ay], [x, y]) => [ax + x, ay + y],
            [0, 0],
        );
        return [sumX / ring.length, sumY / ring.length];
    }
    return [cx / (6 * area), cy / (6 * area)];
}

export function lineMidpoint(geometry: GeoJSON.LineString): GeoJSON.Position {
    const coords = geometry.coordinates;
    if (coords.length === 1) return coords[0];

    const cumulative = [0];
    for (let i = 1; i < coords.length; i++) {
        cumulative.push(cumulative[i - 1] + distance(coords[i - 1], coords[i]));
    }
    const half = cumulative[cumulative.length - 1] / 2;
    for (let i = 1; i < coords.length; i++) {
        if (cumulative[i] >= half) {
            const segmentLength = cumulative[i] - cumulative[i - 1];
            const t =
                segmentLength === 0
                    ? 0
                    : (half - cumulative[i - 1]) / segmentLength;
            const [x0, y0] = coords[i - 1];
            const [x1, y1] = coords[i];
            return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
        }
    }
    return coords[coords.length - 1];
}
