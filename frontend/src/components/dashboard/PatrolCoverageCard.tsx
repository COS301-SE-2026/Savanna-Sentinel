import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { PatrolCoverageData } from "@/types/dashboard";

interface PatrolCoverageCardProps {
    data: PatrolCoverageData;
}

export function PatrolCoverageCard({ data }: PatrolCoverageCardProps) {
    const percent = data.totalAreaKm2 > 0
        ? Math.round((data.areaCoveredKm2 / data.totalAreaKm2) * 100)
        : 0;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-heading text-xl font-bold text-brand-primary">
                    Patrol Coverage
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex items-baseline justify-between">
                    <span className="text-sm text-color-text-secondary">
                        {data.areaCoveredKm2.toLocaleString()} km² of {data.totalAreaKm2.toLocaleString()} km²
                    </span>
                    <span className="font-heading text-2xl font-bold text-brand-primary">
                        {percent}%
                    </span>
                </div>
                <Progress value={percent} />
            </CardContent>
        </Card>
    );
}

export default PatrolCoverageCard;
