import { useEffect, useState } from "react";
import { DashCard } from "@/components/dashboard/DashCard";
import { RecentFieldReportsCard } from "@/components/dashboard/RecentFieldReportsCard";
import { RiskZoneOverviewCard } from "@/components/dashboard/RiskZoneOverviewCard";
import { ReportTrendsCard } from "@/components/dashboard/ReportTrendsCard";
import { ModelPerformanceCard } from "@/components/dashboard/ModelPerformanceCard";
import { notifyCritical } from "@/components/ui/toast";
import { dashboardApi } from "@/services/dashboardApi";
import type { DashboardResponse } from "@/services/dashboardApi";

const dashboardTemplate: DashboardResponse = {
    stats: [],
    patrol_coverage: { area_covered_km2: 0, total_area_km2: 0 },
    report_trends: { counts_by_type: [], trend: [] },
    model_performance: { metrics: [] },
    recent_field_reports: [],
    risk_zones: [],
};
export function DashboardPage() {
    const [dashboardData, setDashboardData] =
        useState<DashboardResponse>(dashboardTemplate);

    useEffect(() => {
        async function fetchDashboard() {
            try {
                const res: DashboardResponse =
                    await dashboardApi.getDashboard();
                setDashboardData(res);
            } catch (err) {
                notifyCritical("Error", "Failed to fetch dashboard data");
                console.error(err);
            }
            // maybe add a 10m timer?
        }

        fetchDashboard();
    }, []);

    const covPercent =
        dashboardData.patrol_coverage.total_area_km2 > 0
            ? Math.round(
                  (dashboardData.patrol_coverage.area_covered_km2 /
                      dashboardData.patrol_coverage.total_area_km2) *
                      100,
              )
            : "-";

    return (
        <div className="mx-auto max-w-[1120px] px-4 pt-8 pb-10 md:px-6">
            <h1 className="font-heading text-3xl leading-[1.1] font-bold text-brand-primary">
                Dashboard
            </h1>
            <p className="mt-1 text-sm text-color-text-secondary">
                Here&apos;s what&apos;s happening on the reserve.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {dashboardData.stats.map((stat) => (
                    <DashCard key={stat.label} {...stat} />
                ))}

                <DashCard
                    label="Patrol Coverage"
                    value={`${covPercent}%`}
                    badge="Map"
                />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <RecentFieldReportsCard
                    reports={dashboardData.recent_field_reports}
                />
                <RiskZoneOverviewCard riskData={dashboardData.risk_zones} />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ReportTrendsCard
                    counts_by_type={dashboardData.report_trends.counts_by_type}
                    trend={dashboardData.report_trends.trend}
                />
                <ModelPerformanceCard
                    metrics={dashboardData.model_performance.metrics}
                    last_trained_at={
                        dashboardData.model_performance.last_trained_at
                    }
                />
            </div>
        </div>
    );
}

export default DashboardPage;
