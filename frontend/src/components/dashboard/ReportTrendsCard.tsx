import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ReportTrendsData } from "@/types/dashboard";

interface ReportTrendsCardProps {
    data: ReportTrendsData;
}

export function ReportTrendsCard({ data }: ReportTrendsCardProps) {
    const maxCount = Math.max(1, ...data.trend.map((p) => p.count));

    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-heading text-xl font-bold text-brand-primary">
                    Field Report Trends
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-2">
                    {data.countsByType.map((c) => (
                        <Badge key={c.reportType} variant="neutral">
                            {c.reportType === "incident" ? "Incidents" : "Sightings"}: {c.count}
                        </Badge>
                    ))}
                </div>
                <div className="flex h-24 items-end gap-1">
                    {data.trend.map((point) => (
                        <div
                            key={point.date}
                            title={`${point.date}: ${point.count}`}
                            className="flex-1 rounded-t-sm bg-brand-primary"
                            style={{ height: `${(point.count / maxCount) * 100}%` }}
                        />
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

export default ReportTrendsCard;
