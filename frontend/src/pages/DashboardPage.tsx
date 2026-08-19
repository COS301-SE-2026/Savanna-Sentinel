import { DashboardCards } from "@/components/dashboard/DashboardCards";
import { PatrolCoverageCard } from "@/components/dashboard/PatrolCoverageCard";
import { ReportTrendsCard } from "@/components/dashboard/ReportTrendsCard";
import { ModelPerformanceCard } from "@/components/dashboard/ModelPerformanceCard";
import type { DashboardData } from "@/types/dashboard";

interface DashboardPageProps {
    data: DashboardData;
}

export function DashboardPage({ data }: DashboardPageProps) {
    return (
        <div className="mx-auto max-w-[1120px] px-4 pt-8 pb-10 md:px-6">
            <h1 className="mb-6 font-heading text-3xl leading-[1.1] font-bold text-brand-primary">
                Dashboard
            </h1>

            <div className="space-y-4">
                <DashboardCards stats={data.stats} />
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <PatrolCoverageCard data={data.patrolCoverage} />
                    <ReportTrendsCard data={data.reportTrends} />
                    <ModelPerformanceCard data={data.modelPerformance} />
                </div>
            </div>
        </div>
    );
}

export default DashboardPage;
