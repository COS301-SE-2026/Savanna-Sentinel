import { Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type ReportBadgeVariant = "critical" | "alert" | "safe" | "neutral";

interface RecentFieldReport {
    id: string;
    ranger: string;
    type: string;
    badgeVariant: ReportBadgeVariant;
    location: string;
    time: string;
}

const RECENT_REPORTS: RecentFieldReport[] = [
    { id: "RPT-041", ranger: "ranger1", type: "High", badgeVariant: "critical", location: "Zone A-3", time: "2h ago" },
    { id: "RPT-040", ranger: "ranger2", type: "Sighting", badgeVariant: "neutral", location: "Zone B-1", time: "4h ago" },
    { id: "RPT-039", ranger: "ranger1", type: "Medium", badgeVariant: "alert", location: "Zone C-2", time: "6h ago" },
    { id: "RPT-038", ranger: "ranger3", type: "Sighting", badgeVariant: "neutral", location: "Zone A-1", time: "8h ago" },
    { id: "RPT-037", ranger: "ranger2", type: "Low", badgeVariant: "safe", location: "Zone D-4", time: "1d ago" },
];

export function RecentFieldReportsCard() {
    return (
        <div className="rounded-md border border-color-border bg-color-surface-bg p-4">
            <div className="mb-4 flex items-center gap-2">
                <Activity className="h-4 w-4 text-brand-primary" strokeWidth={2} aria-hidden="true" />
                <h2 className="font-heading text-xl font-bold text-brand-primary">
                    Recent Field Reports
                </h2>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-color-border text-xs text-color-text-secondary uppercase">
                            <th className="pb-2 pr-4 font-medium">ID</th>
                            <th className="pb-2 pr-4 font-medium">Ranger</th>
                            <th className="pb-2 pr-4 font-medium">Type</th>
                            <th className="pb-2 pr-4 font-medium">Location</th>
                            <th className="pb-2 font-medium">Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        {RECENT_REPORTS.map((report) => (
                            <tr key={report.id} className="border-b border-color-border last:border-0">
                                <td className="py-2 pr-4 text-color-text-secondary">{report.id}</td>
                                <td className="py-2 pr-4 text-color-text-primary">{report.ranger}</td>
                                <td className="py-2 pr-4">
                                    <Badge variant={report.badgeVariant}>{report.type}</Badge>
                                </td>
                                <td className="py-2 pr-4 text-color-text-primary">{report.location}</td>
                                <td className="py-2 text-color-text-secondary">{report.time}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default RecentFieldReportsCard;
