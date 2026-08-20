import { Shield, Users, Map, AlertTriangle } from "lucide-react";
import { DashCard } from "@/components/dashboard/DashCard";
import { RecentFieldReportsCard } from "@/components/dashboard/RecentFieldReportsCard";
import { RiskZoneOverviewCard } from "@/components/dashboard/RiskZoneOverviewCard";
import { ReportTrendsCard } from "@/components/dashboard/ReportTrendsCard";

const STATS = [
    {
        title: "Total Field Reports",
        value: 124,
        subtext: "+12 this week",
        icon: Shield,
    },
    {
        title: "Active Rangers",
        value: 8,
        subtext: "2 on patrol now",
        icon: Users,
    },
    {
        title: "Patrol Coverage",
        value: "73%",
        subtext: "+5% vs last week",
        icon: Map,
        valueClassName: "text-status-safe",
    },
    {
        title: "Open Incidents",
        value: 12,
        subtext: "3 high severity",
        icon: AlertTriangle,
        valueClassName: "text-status-alert",
    },
];

export function DashboardPage() {
    return (
        <div className="mx-auto max-w-[1120px] px-4 pt-8 pb-10 md:px-6">
            <h1 className="font-heading text-3xl leading-[1.1] font-bold text-brand-primary">
                Dashboard
            </h1>
            <p className="mt-1 text-sm text-color-text-secondary">
                Here&apos;s what&apos;s happening on the reserve.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {STATS.map((stat) => (
                    <DashCard key={stat.title} {...stat} />
                ))}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <RecentFieldReportsCard />
                <RiskZoneOverviewCard />
            </div>

            <div className="mt-4">
                <ReportTrendsCard />
            </div>
        </div>
    );
}

export default DashboardPage;
