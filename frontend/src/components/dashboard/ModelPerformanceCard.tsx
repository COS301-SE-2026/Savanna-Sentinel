import { Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { ModelPerformance } from "@/services/dashboardApi";

// IMPORTANT, LAST TRAINED AT IS MISSING HERE??!
export function ModelPerformanceCard({
    metrics,
}: ModelPerformance) {
    return (
        <div className="rounded-md border border-color-border bg-color-surface-bg p-4">
            <div className="mb-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Activity
                        className="h-4 w-4 text-brand-primary"
                        strokeWidth={2}
                        aria-hidden="true"
                    />
                    <h2 className="font-heading text-xl font-bold text-brand-primary">
                        Model Performance
                    </h2>
                </div>
                <Badge variant="neutral">Indicative only</Badge>
            </div>
            <div className="space-y-4">
                {metrics.length === 0 ? (
                    <p className="text-sm text-color-text-secondary">
                        No performance data available
                    </p>
                ) : (
                    metrics.map((metric) => (
                        <div key={metric.label} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-color-text-primary">
                                    {metric.label}
                                </span>
                                <span className="font-semibold text-brand-primary">
                                    {metric.value}%
                                </span>
                            </div>
                            <Progress value={metric.value} />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default ModelPerformanceCard;
