import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { SectionHeader } from "@/components/map/ExplainabilityPanel";
import { notifySafe, notifyCritical } from "@/components/ui/toast";
import { useAuthStore } from "@/store/authStore";
import { useMapStore } from "@/store/mapStore";
import { riskApi } from "@/services/riskApi";
import { useRiskTrainJob, useRiskScoreJob } from "@/hooks/useRiskJob";
import type {
    RiskTrainJobStatus,
    RiskScoreJobStatus,
} from "@/services/riskApi";

const IN_FLIGHT_STATUSES = new Set(["queued", "processing"]);

type PendingAction = "train" | "score" | null;

function trainStatusText(
    status: string,
    result: RiskTrainJobStatus | null,
): string | null {
    if (status === "idle") return null;
    if (status === "queued") return "Queued...";
    if (status === "processing") return "Training model...";
    if (status === "completed") {
        const auc = result?.metrics?.auc;
        return auc !== undefined
            ? `Model trained (AUC ${auc.toFixed(2)}).`
            : "Model trained.";
    }
    if (status === "failed") return "Training failed.";
    return `Status: ${status}`;
}

function scoreStatusText(
    status: string,
    result: RiskScoreJobStatus | null,
): string | null {
    if (status === "idle") return null;
    if (status === "queued") return "Queued...";
    if (status === "processing") return "Calculating heatmap...";
    if (status === "completed") {
        const n = result?.n_cells_scored;
        return n !== null && n !== undefined
            ? `Heatmap updated (${n} cells scored).`
            : "Heatmap updated.";
    }
    if (status === "failed") return "Heatmap calculation failed.";
    return `Status: ${status}`;
}

export function RiskModelControls() {
    const user = useAuthStore((s) => s.user);
    const loadSnapshots = useMapStore((s) => s.loadSnapshots);
    const selectSnapshot = useMapStore((s) => s.selectSnapshot);

    const [pendingAction, setPendingAction] = useState<PendingAction>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [trainJobId, setTrainJobId] = useState<string | null>(null);
    const [scoreJobId, setScoreJobId] = useState<string | null>(null);

    const train = useRiskTrainJob(trainJobId);
    const score = useRiskScoreJob(scoreJobId);

    useEffect(() => {
        if (train.status === "completed") {
            notifySafe(
                "Model trained",
                trainStatusText(train.status, train.result) ?? undefined,
            );
        } else if (train.status === "failed") {
            notifyCritical(
                "Training failed",
                "Could not train the risk model.",
            );
        }
    }, [train.status, train.result]);

    useEffect(() => {
        if (score.status === "completed" && score.result?.heatmap_id) {
            notifySafe(
                "Heatmap updated",
                "A new risk heatmap has been published.",
            );
            loadSnapshots();
            selectSnapshot(score.result.heatmap_id);
        } else if (score.status === "failed") {
            notifyCritical(
                "Heatmap calculation failed",
                "Could not calculate the risk heatmap.",
            );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- loadSnapshots/selectSnapshot are stable store actions
    }, [score.status, score.result]);

    if (user?.role !== "admin" && user?.role !== "analyst") return null;

    const isTraining = IN_FLIGHT_STATUSES.has(train.status);
    const isScoring = IN_FLIGHT_STATUSES.has(score.status);

    async function handleConfirm() {
        if (isSubmitting || !pendingAction) return;
        setIsSubmitting(true);
        try {
            if (pendingAction === "train") {
                const job = await riskApi.trainModel({});
                setTrainJobId(job.job_id);
            } else {
                const job = await riskApi.scoreHeatmap();
                setScoreJobId(job.job_id);
            }
            setPendingAction(null);
        } catch {
            notifyCritical(
                pendingAction === "train"
                    ? "Could not start training"
                    : "Could not start heatmap calculation",
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    const trainText = trainStatusText(train.status, train.result);
    const scoreText = scoreStatusText(score.status, score.result);

    return (
        <div>
            <SectionHeader>Risk Model</SectionHeader>
            <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                    <Button
                        type="button"
                        variant="outline"
                        disabled={isScoring}
                        onClick={() => setPendingAction("score")}
                    >
                        {isScoring && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        Calculate Heatmap
                    </Button>
                    {scoreText && (
                        <p className="text-xs text-color-text-secondary">
                            {scoreText}
                        </p>
                    )}
                </div>

                <div className="flex flex-col gap-1">
                    <Button
                        type="button"
                        variant="outline"
                        disabled={isTraining}
                        onClick={() => setPendingAction("train")}
                    >
                        {isTraining && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        Train Model
                    </Button>
                    {trainText && (
                        <p className="text-xs text-color-text-secondary">
                            {trainText}
                        </p>
                    )}
                </div>
            </div>

            <Dialog
                open={pendingAction !== null}
                onOpenChange={(open) => {
                    if (!open && !isSubmitting) setPendingAction(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {pendingAction === "train"
                                ? "Train risk model?"
                                : "Calculate heatmap now?"}
                        </DialogTitle>
                    </DialogHeader>
                    <DialogDescription>
                        {pendingAction === "train"
                            ? "This retrains the risk model on all available history, and replaces the currently active model."
                            : "This scores the grid with the active model right now and publishes a new heatmap snapshot, outside the regular 6-hour schedule."}
                    </DialogDescription>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setPendingAction(null)}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="default"
                            onClick={handleConfirm}
                            disabled={isSubmitting}
                        >
                            {isSubmitting && (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            )}
                            {pendingAction === "train"
                                ? "Train Model"
                                : "Calculate Heatmap"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
