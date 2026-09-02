import { Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { RecentFieldReport } from "@/services/dashboardApi";

type ReportBadgeVariant = "critical" | "alert" | "safe" | "neutral";
const SEVERITY_BADGE_MAP: Record<string, ReportBadgeVariant> = {
    high: "critical",
    medium: "alert",
    low: "safe",
};

interface Data {
    reports: RecentFieldReport[];
}

export function RecentFieldReportsCard({ reports }: Data) {
    return (
        <div className="rounded-md border border-color-border bg-color-surface-bg p-4">
            <div className="mb-4 flex items-center gap-2">
                <Activity
                    className="h-4 w-4 text-brand-primary"
                    strokeWidth={2}
                    aria-hidden="true"
                />
                <h2 className="font-heading text-xl font-bold text-brand-primary">
                    Recent Field Reports
                </h2>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-color-border text-xs text-color-text-secondary uppercase">
                            <th className="pb-2 pr-4 font-medium">Ranger</th>
                            <th className="pb-2 pr-4 font-medium">Type</th>
                            <th className="pb-2 pr-4 font-medium">Location</th>
                            <th className="pb-2 font-medium">Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reports.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={4}
                                    className="py-6 text-center text-color-text-secondary"
                                >
                                    No recent field reports
                                </td>
                            </tr>
                        ) : (
                            reports.map((report) => (
                                <tr
                                    key={report.report_id}
                                    className="border-b border-color-border last:border-0"
                                >
                                    <td className="py-2 pr-4 text-color-text-primary">
                                        {report.ranger}
                                    </td>
                                    <td className="py-2 pr-4">
                                        <Badge
                                            variant={
                                                report.severity !== null &&
                                                report.severity !== undefined
                                                    ? SEVERITY_BADGE_MAP[
                                                          report.severity.toLowerCase()
                                                      ]
                                                    : "neutral"
                                            }
                                        >
                                            {report.report_type}
                                        </Badge>
                                    </td>
                                    <td className="py-2 pr-4 text-color-text-primary">
                                        {report.zone}
                                    </td>
                                    <td className="py-2 text-color-text-secondary">
                                        {new Date(
                                            report.occurred_at,
                                        ).toLocaleString(undefined, {
                                            dateStyle: "medium",
                                            timeStyle: "short",
                                        })}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default RecentFieldReportsCard;
