import { Card, CardContent } from "@/components/ui/card";
import type { StatCardData } from "@/types/dashboard";

interface DashboardCardsProps {
    stats: StatCardData[];
}

export function DashboardCards({ stats }: DashboardCardsProps) {
    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
                <Card key={stat.label}>
                    <CardContent>
                        <div className="text-xs font-bold tracking-[1.5px] text-color-text-secondary uppercase">
                            {stat.label}
                        </div>
                        <div className="mt-1 font-heading text-4xl leading-none font-bold text-brand-primary">
                            {stat.value}
                            {stat.unit && (
                                <span className="ml-1 text-lg font-normal text-color-text-secondary">
                                    {stat.unit}
                                </span>
                            )}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

export default DashboardCards;
