import { act, renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { usePollRouteJob } from "@/hooks/usePollRouteJob";
import { routeApi } from "@/services/routeApi";
import type { RouteListResponse } from "@/services/routeApi";

vi.mock("@/services/routeApi", () => ({
    routeApi: { getRouteJob: vi.fn() },
}));

const completedResponse = (
    overrides: Partial<RouteListResponse> = {},
): RouteListResponse => ({
    request_id: "job-1",
    status: "completed",
    num_alternatives_requested: 3,
    num_alternatives_found: 1,
    total: 1,
    page: 1,
    page_size: 20,
    results: [
        {
            suggested_path: ["cell-1"],
            path_geometry: { type: "LineString", coordinates: [[31.0, -24.3]] },
            estimated_time_min: 10,
            estimated_fuel_l: 2,
            risk_coverage: 0.5,
        },
    ],
    ...overrides,
});

const processingResponse: RouteListResponse = {
    request_id: "job-4",
    status: "processing",
    num_alternatives_requested: null,
    num_alternatives_found: null,
    total: 0,
    page: 1,
    page_size: 20,
    results: [],
};

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.mocked(routeApi.getRouteJob).mockReset();
    vi.useRealTimers();
});

describe("usePollRouteJob", () => {
    it("stays idle with no requestId", () => {
        const { result } = renderHook(() => usePollRouteJob(null));
        expect(result.current.status).toBe("idle");
        expect(result.current.routes).toEqual([]);
    });

    it("transitions to completed and populates routes once the job finishes", async () => {
        vi.mocked(routeApi.getRouteJob).mockResolvedValue(completedResponse());

        const { result } = renderHook(() => usePollRouteJob("job-1"));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(result.current.status).toBe("completed");
        expect(result.current.routes).toHaveLength(1);
        expect(result.current.numAlternativesFound).toBe(1);
    });

    it("transitions to failed when the API reports a failed job", async () => {
        vi.mocked(routeApi.getRouteJob).mockResolvedValue({
            request_id: "job-2",
            status: "failed",
            num_alternatives_requested: null,
            num_alternatives_found: null,
            total: 0,
            page: 1,
            page_size: 20,
            results: [],
        });

        const { result } = renderHook(() => usePollRouteJob("job-2"));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(result.current.status).toBe("failed");
    });

    it("resets to idle when requestId changes back to null", async () => {
        vi.mocked(routeApi.getRouteJob).mockResolvedValue(
            completedResponse({
                request_id: "job-3",
                num_alternatives_requested: 1,
                num_alternatives_found: 1,
                results: [
                    {
                        suggested_path: [],
                        path_geometry: { type: "LineString", coordinates: [] },
                        estimated_time_min: 0,
                        estimated_fuel_l: 0,
                        risk_coverage: 0,
                    },
                ],
            }),
        );

        const { result, rerender } = renderHook(
            ({ id }) => usePollRouteJob(id),
            { initialProps: { id: "job-3" as string | null } },
        );

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(result.current.status).toBe("completed");

        rerender({ id: null });
        expect(result.current.status).toBe("idle");
        expect(result.current.routes).toEqual([]);
    });

    it("reflects an intermediate processing tick before the job later completes", async () => {
        vi.mocked(routeApi.getRouteJob)
            .mockResolvedValueOnce(processingResponse)
            .mockResolvedValueOnce(completedResponse({ request_id: "job-4" }));

        const { result } = renderHook(() => usePollRouteJob("job-4"));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(result.current.status).toBe("processing");
        expect(routeApi.getRouteJob).toHaveBeenCalledTimes(1);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(2000);
        });
        expect(result.current.status).toBe("completed");
        expect(routeApi.getRouteJob).toHaveBeenCalledTimes(2);
    });

    it("stops calling getRouteJob once a terminal state is reached", async () => {
        vi.mocked(routeApi.getRouteJob).mockResolvedValue(completedResponse());

        renderHook(() => usePollRouteJob("job-1"));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        const callsAtCompletion = vi.mocked(routeApi.getRouteJob).mock.calls
            .length;

        await act(async () => {
            await vi.advanceTimersByTimeAsync(10000);
        });

        expect(routeApi.getRouteJob).toHaveBeenCalledTimes(callsAtCompletion);
    });

    it("resets numAlternatives counts when requestId changes directly between two non-null jobs", async () => {
        let resolveJob7: (value: RouteListResponse) => void = () => {};
        const job7Promise = new Promise<RouteListResponse>((resolve) => {
            resolveJob7 = resolve;
        });

        vi.mocked(routeApi.getRouteJob).mockImplementation(
            (requestId: string) => {
                if (requestId === "job-6") {
                    return Promise.resolve(
                        completedResponse({
                            request_id: "job-6",
                            num_alternatives_requested: 5,
                            num_alternatives_found: 5,
                        }),
                    );
                }
                return job7Promise;
            },
        );

        const { result, rerender } = renderHook(
            ({ id }) => usePollRouteJob(id),
            { initialProps: { id: "job-6" as string | null } },
        );

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(result.current.status).toBe("completed");
        expect(result.current.numAlternativesFound).toBe(5);
        expect(result.current.numAlternativesRequested).toBe(5);

        act(() => {
            rerender({ id: "job-7" });
        });

        expect(result.current.status).toBe("queued");
        expect(result.current.numAlternativesFound).toBeNull();
        expect(result.current.numAlternativesRequested).toBeNull();

        await act(async () => {
            resolveJob7(completedResponse({ request_id: "job-7" }));
            await vi.advanceTimersByTimeAsync(0);
        });
    });
});
