import { TrendingUp } from "lucide-react";

interface TrendPoint {
    day: string;
    count: number;
}

const TREND_DATA: TrendPoint[] = [];

export function ReportTrendsCard() {
    const maxCount = Math.max(1, ...TREND_DATA.map((point) => point.count));

    return (
        <div className="rounded-md border border-color-border bg-color-surface-bg p-4">
            <div className="mb-4 flex items-center gap-2">
                <TrendingUp
                    className="h-4 w-4 text-brand-primary"
                    strokeWidth={2}
                    aria-hidden="true"
                />
                <h2 className="font-heading text-xl font-bold text-brand-primary">
                    Report Trends (Last 7 Days)
                </h2>
            </div>
            <div className="flex h-40 items-end gap-3">
                {TREND_DATA.length === 0 ? (
                    <p className="w-full self-center text-center text-sm text-color-text-secondary">
                        No trend data available
                    </p>
                ) : (
                    TREND_DATA.map((point) => (
                        <div
                            key={point.day}
                            className="flex h-full flex-1 flex-col items-center justify-end"
                            role="img"
                            aria-label={`${point.day}: ${point.count} reports`}
                        >
                            <span
                                aria-hidden="true"
                                className="mb-1 text-xs font-semibold text-brand-primary"
                            >
                                {point.count}
                            </span>
                            <div
                                aria-hidden="true"
                                className="w-full rounded-t-sm bg-brand-primary"
                                style={{
                                    height: `${(point.count / maxCount) * 100}%`,
                                }}
                            />
                        </div>
                    ))
                )}
            </div>
            <div className="mt-1 flex gap-3">
                {TREND_DATA.map((point) => (
                    <span
                        key={point.day}
                        aria-hidden="true"
                        className="flex-1 text-center text-xs text-color-text-secondary"
                    >
                        {point.day}
                    </span>
                ))}
            </div>
        </div>
    );
}

export default ReportTrendsCard;
