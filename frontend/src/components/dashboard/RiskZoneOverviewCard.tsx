import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type RiskLevel = "Critical" | "High" | "Medium" | "Low";

interface RiskZone {
    zone: string;
    level: RiskLevel;
    percent: number;
}

const RISK_ZONES: RiskZone[] = [
    { zone: "Zone A-3", level: "Critical", percent: 95 },
    { zone: "Zone C-2", level: "High", percent: 74 },
    { zone: "Zone B-4", level: "Medium", percent: 55 },
    { zone: "Zone D-1", level: "Medium", percent: 45 },
    { zone: "Zone A-1", level: "Low", percent: 20 },
];

// Reuses the same safe/caution/alert/critical status system as Badge
// elsewhere in the app, so a zone's risk level always reads the same way
// regardless of which screen shows it.
const LEVEL_STYLES: Record<
    RiskLevel,
    { badge: "critical" | "alert" | "caution" | "safe"; bar: string }
> = {
    Critical: { badge: "critical", bar: "bg-status-critical" },
    High: { badge: "alert", bar: "bg-status-alert" },
    Medium: { badge: "caution", bar: "bg-status-caution" },
    Low: { badge: "safe", bar: "bg-status-safe" },
};

export function RiskZoneOverviewCard() {
    return (
        <div className="rounded-md border border-color-border bg-color-surface-bg p-4">
            <div className="mb-4 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-brand-primary" strokeWidth={2} aria-hidden="true" />
                <h2 className="font-heading text-xl font-bold text-brand-primary">
                    Risk Zone Overview
                </h2>
            </div>
            <div className="space-y-3">
                {RISK_ZONES.map((zone) => (
                    <div key={zone.zone}>
                        <div className="mb-1 flex items-center justify-between">
                            <span className="text-sm text-color-text-primary">{zone.zone}</span>
                            <Badge variant={LEVEL_STYLES[zone.level].badge}>{zone.level}</Badge>
                        </div>
                        <div
                            className="h-1.5 w-full overflow-hidden rounded-full bg-color-surface-raised"
                            role="progressbar"
                            aria-valuenow={zone.percent}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`${zone.zone} risk level: ${zone.level}`}
                        >
                            <div
                                className={cn("h-full rounded-full", LEVEL_STYLES[zone.level].bar)}
                                style={{ width: `${zone.percent}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default RiskZoneOverviewCard;
