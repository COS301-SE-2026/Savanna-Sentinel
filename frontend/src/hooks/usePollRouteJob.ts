import { useEffect, useState } from "react";

import { routeApi } from "@/services/routeApi";
import type { PlannedRoute } from "@/services/routeApi";
import type { RouteJobStatus } from "@/types/patrol";

const POLL_INTERVAL_MS = 2000;

export interface UsePollRouteJobResult {
    status: RouteJobStatus;
    routes: PlannedRoute[];
    numAlternativesRequested: number | null;
    numAlternativesFound: number | null;
}

export function usePollRouteJob(
    requestId: string | null,
): UsePollRouteJobResult {
    const [status, setStatus] = useState<RouteJobStatus>("idle");
    const [routes, setRoutes] = useState<PlannedRoute[]>([]);
    const [numAlternativesRequested, setNumAlternativesRequested] = useState<
        number | null
    >(null);
    const [numAlternativesFound, setNumAlternativesFound] = useState<
        number | null
    >(null);

    const [prevRequestId, setPrevRequestId] = useState<string | null>(null);
    if (requestId !== prevRequestId) {
        setPrevRequestId(requestId);
        setStatus(requestId ? "queued" : "idle");
        setRoutes([]);
        setNumAlternativesRequested(null);
        setNumAlternativesFound(null);
    }

    useEffect(() => {
        if (!requestId) return;

        let isCancelled = false;
        let pollId = 0;

        const intervalId = setInterval(poll, POLL_INTERVAL_MS);

        async function poll() {
            const myPollId = ++pollId;
            try {
                const result = await routeApi.getRouteJob(requestId as string);
                if (isCancelled || myPollId !== pollId) return;

                const nextStatus = (result.status ??
                    "queued") as RouteJobStatus;
                setStatus(nextStatus);

                if (nextStatus === "completed") {
                    setRoutes(result.results);
                    setNumAlternativesRequested(
                        result.num_alternatives_requested,
                    );
                    setNumAlternativesFound(result.num_alternatives_found);
                    clearInterval(intervalId);
                } else if (nextStatus === "failed") {
                    clearInterval(intervalId);
                }
            } catch {
                if (!isCancelled && myPollId === pollId) {
                    setStatus("failed");
                    clearInterval(intervalId);
                }
            }
        }

        poll();

        return () => {
            isCancelled = true;
            clearInterval(intervalId);
        };
    }, [requestId]);

    return { status, routes, numAlternativesRequested, numAlternativesFound };
}
