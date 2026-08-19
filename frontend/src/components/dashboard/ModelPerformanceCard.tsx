import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ModelPerformanceData } from "@/types/dashboard";

interface ModelPerformanceCardProps {
    data: ModelPerformanceData;
}

export function ModelPerformanceCard({ data }: ModelPerformanceCardProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-heading text-xl font-bold text-brand-primary">
                    Model Performance
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {data.metrics.map((metric) => (
                    <div key={metric.label} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-color-text-primary">{metric.label}</span>
                            <span className="font-semibold text-brand-primary">{metric.value}%</span>
                        </div>
                        <Progress value={metric.value} />
                    </div>
                ))}
                <p className="text-xs text-color-text-secondary">
                    Last trained {new Date(data.lastTrainedAt).toLocaleDateString()}
                </p>
            </CardContent>
        </Card>
    );
}

export default ModelPerformanceCard;
