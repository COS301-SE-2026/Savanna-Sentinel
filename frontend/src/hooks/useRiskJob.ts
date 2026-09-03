import { usePollJob } from "@/hooks/usePollJob";
import type { UsePollJobResult } from "@/hooks/usePollJob";
import { riskApi } from "@/services/riskApi";
import type {
    RiskTrainJobStatus,
    RiskScoreJobStatus,
} from "@/services/riskApi";

export function useRiskTrainJob(
    jobId: string | null,
): UsePollJobResult<RiskTrainJobStatus> {
    return usePollJob<RiskTrainJobStatus>(jobId, riskApi.getTrainJob);
}

export function useRiskScoreJob(
    jobId: string | null,
): UsePollJobResult<RiskScoreJobStatus> {
    return usePollJob<RiskScoreJobStatus>(jobId, riskApi.getScoreJob);
}
