import { act, renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { useRiskTrainJob, useRiskScoreJob } from "@/hooks/useRiskJob";
import { riskApi } from "@/services/riskApi";
import type {
    RiskTrainJobStatus,
    RiskScoreJobStatus,
} from "@/services/riskApi";

vi.mock("@/services/riskApi", () => ({
    riskApi: { getTrainJob: vi.fn(), getScoreJob: vi.fn() },
}));

const processingTrainStatus: RiskTrainJobStatus = {
    job_id: "train-1",
    status: "processing",
    model_id: null,
    metrics: null,
    n_training_examples: null,
};

const completedTrainStatus: RiskTrainJobStatus = {
    job_id: "train-1",
    status: "completed",
    model_id: "model-1",
    metrics: { auc: 0.9 },
    n_training_examples: 100,
};

const failedTrainStatus: RiskTrainJobStatus = {
    job_id: "train-2",
    status: "failed",
    model_id: null,
    metrics: null,
    n_training_examples: null,
};

const skippedScoreStatus: RiskScoreJobStatus = {
    job_id: "score-1",
    status: "skipped",
    heatmap_id: null,
    computed_at: null,
    n_cells_scored: null,
};

const completedScoreStatus: RiskScoreJobStatus = {
    job_id: "score-2",
    status: "completed",
    heatmap_id: "heatmap-1",
    computed_at: "2026-09-02T00:00:00Z",
    n_cells_scored: 684,
};

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.mocked(riskApi.getTrainJob).mockReset();
    vi.mocked(riskApi.getScoreJob).mockReset();
    vi.useRealTimers();
});

describe("useRiskTrainJob", () => {
    it("stays idle with no jobId", () => {
        const { result } = renderHook(() => useRiskTrainJob(null));
        expect(result.current.status).toBe("idle");
        expect(result.current.result).toBeNull();
    });

    it("transitions to completed and exposes the result", async () => {
        vi.mocked(riskApi.getTrainJob).mockResolvedValue(completedTrainStatus);

        const { result } = renderHook(() => useRiskTrainJob("train-1"));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(result.current.status).toBe("completed");
        expect(result.current.result?.metrics?.auc).toBe(0.9);
    });

    it("transitions to failed when the API reports a failed job", async () => {
        vi.mocked(riskApi.getTrainJob).mockResolvedValue(failedTrainStatus);

        const { result } = renderHook(() => useRiskTrainJob("train-2"));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(result.current.status).toBe("failed");
    });

    it("reflects an intermediate processing tick before completing", async () => {
        vi.mocked(riskApi.getTrainJob)
            .mockResolvedValueOnce(processingTrainStatus)
            .mockResolvedValueOnce(completedTrainStatus);

        const { result } = renderHook(() => useRiskTrainJob("train-1"));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(result.current.status).toBe("processing");
        expect(riskApi.getTrainJob).toHaveBeenCalledTimes(1);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(2000);
        });
        expect(result.current.status).toBe("completed");
        expect(riskApi.getTrainJob).toHaveBeenCalledTimes(2);
    });

    it("stops polling once a terminal state is reached", async () => {
        vi.mocked(riskApi.getTrainJob).mockResolvedValue(completedTrainStatus);

        renderHook(() => useRiskTrainJob("train-1"));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        const callsAtCompletion = vi.mocked(riskApi.getTrainJob).mock.calls
            .length;

        await act(async () => {
            await vi.advanceTimersByTimeAsync(10000);
        });

        expect(riskApi.getTrainJob).toHaveBeenCalledTimes(callsAtCompletion);
    });

    it("resets to idle when jobId changes back to null", async () => {
        vi.mocked(riskApi.getTrainJob).mockResolvedValue(completedTrainStatus);

        const { result, rerender } = renderHook(
            ({ id }) => useRiskTrainJob(id),
            { initialProps: { id: "train-1" as string | null } },
        );

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(result.current.status).toBe("completed");

        rerender({ id: null });
        expect(result.current.status).toBe("idle");
        expect(result.current.result).toBeNull();
    });
});

describe("useRiskScoreJob", () => {
    it("stays idle with no jobId", () => {
        const { result } = renderHook(() => useRiskScoreJob(null));
        expect(result.current.status).toBe("idle");
        expect(result.current.result).toBeNull();
    });

    it("treats a non-completed terminal status (skipped) as terminal and stops polling", async () => {
        vi.mocked(riskApi.getScoreJob).mockResolvedValue(skippedScoreStatus);

        const { result } = renderHook(() => useRiskScoreJob("score-1"));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(result.current.status).toBe("skipped");
        const callsAtSkip = vi.mocked(riskApi.getScoreJob).mock.calls.length;

        await act(async () => {
            await vi.advanceTimersByTimeAsync(10000);
        });
        expect(riskApi.getScoreJob).toHaveBeenCalledTimes(callsAtSkip);
    });

    it("transitions to completed and exposes the heatmap_id", async () => {
        vi.mocked(riskApi.getScoreJob).mockResolvedValue(completedScoreStatus);

        const { result } = renderHook(() => useRiskScoreJob("score-2"));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(result.current.status).toBe("completed");
        expect(result.current.result?.heatmap_id).toBe("heatmap-1");
    });

    it("sets status to failed when the API call itself rejects", async () => {
        vi.mocked(riskApi.getScoreJob).mockRejectedValue(new Error("network"));

        const { result } = renderHook(() => useRiskScoreJob("score-3"));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(result.current.status).toBe("failed");
    });
});
