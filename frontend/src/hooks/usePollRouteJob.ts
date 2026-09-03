import { usePollJob } from "@/hooks/usePollJob";
import { routeApi } from "@/services/routeApi";
import type { PlannedRoute, RouteListResponse } from "@/services/routeApi";
import type { RouteJobStatus } from "@/types/patrol";

export interface UsePollRouteJobResult {
    status: RouteJobStatus;
    routes: PlannedRoute[];
    numAlternativesRequested: number | null;
    numAlternativesFound: number | null;
}

async function fetchRouteJob(
    requestId: string,
): Promise<RouteListResponse & { status: string }> {
    const result = await routeApi.getRouteJob(requestId);
    return { ...result, status: result.status ?? "queued" };
}

const NO_ROUTES: PlannedRoute[] = [];

export function usePollRouteJob(
    requestId: string | null,
): UsePollRouteJobResult {
    const { status, result } = usePollJob(requestId, fetchRouteJob);

    return {
        status: status as RouteJobStatus,
        routes:
            status === "completed" ? (result?.results ?? NO_ROUTES) : NO_ROUTES,
        numAlternativesRequested:
            status === "completed"
                ? (result?.num_alternatives_requested ?? null)
                : null,
        numAlternativesFound:
            status === "completed"
                ? (result?.num_alternatives_found ?? null)
                : null,
    };
}
