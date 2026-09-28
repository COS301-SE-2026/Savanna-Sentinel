import type { GeoPoint, SavedRoute } from "@/services/routeApi";
import { toLatLon } from "@/lib/patrolRoute";
import {
    MAX_STOPS,
    MIN_STOPS,
    type LatLon,
    type PlannerStop,
} from "@/types/patrol";

export interface StopsPayload {
    start_point: GeoPoint;
    end_point: GeoPoint;
    waypoints: GeoPoint[];
}

let stopCounter = 0;

export function createStop(point: LatLon | null = null): PlannerStop {
    stopCounter += 1;
    return { id: `stop-${stopCounter}`, point };
}

export function initialStops(): PlannerStop[] {
    return [createStop(), createStop()];
}

export function canAddStop(stops: PlannerStop[]): boolean {
    return stops.length < MAX_STOPS;
}

export function canRemoveStop(stops: PlannerStop[]): boolean {
    return stops.length > MIN_STOPS;
}

export function addStop(stops: PlannerStop[]): PlannerStop[] {
    if (!canAddStop(stops)) return stops;
    return [...stops.slice(0, -1), createStop(), stops[stops.length - 1]];
}

export function removeStop(stops: PlannerStop[], id: string): PlannerStop[] {
    if (!canRemoveStop(stops)) return stops;
    return stops.filter((stop) => stop.id !== id);
}

export function updateStop(
    stops: PlannerStop[],
    id: string,
    point: LatLon | null,
): PlannerStop[] {
    return stops.map((stop) => (stop.id === id ? { ...stop, point } : stop));
}

export function moveStop(
    stops: PlannerStop[],
    activeId: string,
    overId: string,
): PlannerStop[] {
    const from = stops.findIndex((stop) => stop.id === activeId);
    const to = stops.findIndex((stop) => stop.id === overId);
    if (from === -1 || to === -1 || from === to) return stops;
    const next = [...stops];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
}

export function reverseStops(stops: PlannerStop[]): PlannerStop[] {
    return [...stops].reverse();
}

export function stopLabel(index: number, total: number): string {
    if (index === 0) return "Start point";
    if (index === total - 1) return "End point";
    return `Stop ${index}`;
}

export function firstUnsetStop(stops: PlannerStop[]): string | null {
    const index = stops.findIndex((stop) => stop.point === null);
    return index === -1 ? null : stopLabel(index, stops.length);
}

export function waypointPoints(stops: PlannerStop[]): (LatLon | null)[] {
    return stops.slice(1, -1).map((stop) => stop.point);
}

function toGeoPoint(point: LatLon): GeoPoint {
    return { type: "Point", coordinates: [point.lon, point.lat] };
}

export function toStopsPayload(stops: PlannerStop[]): StopsPayload | null {
    const points = stops.map((stop) => stop.point);
    if (points.length < MIN_STOPS) return null;
    if (!points.every((point): point is LatLon => point !== null)) return null;
    const geo = points.map(toGeoPoint);
    return {
        start_point: geo[0],
        end_point: geo[geo.length - 1],
        waypoints: geo.slice(1, -1),
    };
}

export function stopsFromSaved(saved: SavedRoute): PlannerStop[] {
    return [saved.start_point, ...(saved.waypoints ?? []), saved.end_point].map(
        (point) => createStop(toLatLon(point)),
    );
}

export function formatPoint(point: LatLon | null): string {
    return point ? `${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}` : "";
}

export function parsePoint(value: string): LatLon | null {
    const parts = value.split(",").map((p) => Number(p.trim()));
    if (parts.length !== 2 || parts.some((n) => Number.isNaN(n))) return null;
    const [lat, lon] = parts;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return { lat, lon };
}

export function pointsEqual(a: LatLon | null, b: LatLon | null): boolean {
    if (a === null || b === null) return a === b;
    return a.lat === b.lat && a.lon === b.lon;
}
