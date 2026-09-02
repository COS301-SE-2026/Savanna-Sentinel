import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RiskZone } from "@/services/dashboardApi";

const LEVEL_STYLES: Record<
    string,
    { badge: "critical" | "alert" | "caution" | "safe"; bar: string }
> = {
    Critical: { badge: "critical", bar: "bg-status-critical" },
    High: { badge: "alert", bar: "bg-status-alert" },
    Medium: { badge: "caution", bar: "bg-status-caution" },
    Low: { badge: "safe", bar: "bg-status-safe" },
};

interface Data {
    riskData: RiskZone[];
}

export function RiskZoneOverviewCard({ riskData }: Data) {
    return (
        <div className="rounded-md border border-color-border bg-color-surface-bg p-4">
            <div className="mb-4 flex items-center gap-2">
                <AlertTriangle
                    className="h-4 w-4 text-brand-primary"
                    strokeWidth={2}
                    aria-hidden="true"
                />
                <h2 className="font-heading text-xl font-bold text-brand-primary">
                    Risk Zone Overview
                </h2>
            </div>
            <div className="space-y-3">
                {riskData.length === 0 ? (
                    <p className="text-sm text-color-text-secondary">
                        No risk zone data available
                    </p>
                ) : (
                    riskData.map((zone) => (
                        <div key={zone.zone}>
                            <div className="mb-1 flex items-center justify-between">
                                <span className="text-sm text-color-text-primary">
                                    {zone.zone}
                                </span>
                                <Badge variant={LEVEL_STYLES[zone.level].badge}>
                                    {zone.level}
                                </Badge>
                            </div>
                            <div
                                className="h-1.5 w-full overflow-hidden rounded-full bg-color-surface-raised"
                                role="progressbar"
                                aria-valuenow={zone.risk_score * 100}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-label={`${zone.zone} risk level: ${zone.level}`}
                            >
                                <div
                                    className={cn(
                                        "h-full rounded-full",
                                        LEVEL_STYLES[zone.level].bar,
                                    )}
                                    style={{
                                        width: `${zone.risk_score * 100}%`,
                                    }}
                                />
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default RiskZoneOverviewCard;
