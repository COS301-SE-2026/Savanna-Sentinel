import { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { TimeRangeSlider } from "@/components/map/TimeRangeSlider";
import { getRiskLevel } from "@/lib/mapTokens";
import { formatRelativeTime } from "@/lib/utils";

function SectionHeader({ children }: { children: string }) {
    return (
        <div className="mb-2 text-xs font-semibold tracking-wider text-color-text-primary uppercase">
            {children}
        </div>
    );
}

export interface ExplainabilityPanelProps {
    riskByCell: Map<string, number>;
    dayIndex: number;
    onDayIndexChange: (index: number) => void;
    timeIndex: number;
    onTimeIndexChange: (index: number) => void;
    heatmapVisible: boolean;
    onHeatmapVisibleChange: (visible: boolean) => void;
    opacity: number;
    onOpacityChange: (opacity: number) => void;
    gridFetchedAt?: number | null;
    gridStale?: boolean;
}

export function ExplainabilityPanel({
    riskByCell,
    dayIndex,
    onDayIndexChange,
    timeIndex,
    onTimeIndexChange,
    heatmapVisible,
    onHeatmapVisibleChange,
    opacity,
    onOpacityChange,
    gridFetchedAt = null,
    gridStale = false,
}: ExplainabilityPanelProps) {
    const { criticalCount, highCount } = useMemo(() => {
        let criticalCount = 0;
        let highCount = 0;
        for (const score of riskByCell.values()) {
            const level = getRiskLevel(score);
            if (level === "critical") criticalCount++;
            else if (level === "alert") highCount++;
        }
        return { criticalCount, highCount };
    }, [riskByCell]);

    return (
        <div className="flex flex-col gap-5 p-4">
            <div>
                <SectionHeader>Time Range</SectionHeader>
                <TimeRangeSlider
                    dayIndex={dayIndex}
                    onDayIndexChange={onDayIndexChange}
                    timeIndex={timeIndex}
                    onTimeIndexChange={onTimeIndexChange}
                />
            </div>

            <div>
                <SectionHeader>Layers</SectionHeader>
                <div className="flex flex-col gap-2">
                    <label className="flex min-h-11 w-full cursor-pointer items-center gap-2">
                        <Checkbox
                            checked={heatmapVisible}
                            onChange={(e) =>
                                onHeatmapVisibleChange(e.target.checked)
                            }
                        />
                        <span className="text-sm text-color-text-primary">
                            Risk Heatmap
                        </span>
                    </label>
                </div>
            </div>

            <div>
                <div className="mb-2 flex items-center justify-between text-sm text-color-text-primary">
                    <span>Heatmap Opacity</span>
                    <span>{opacity}%</span>
                </div>
                <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={opacity}
                    disabled={!heatmapVisible}
                    aria-label="Heatmap opacity"
                    onChange={(e) => onOpacityChange(Number(e.target.value))}
                />
            </div>

            <div>
                <SectionHeader>Summary</SectionHeader>
                <dl className="flex flex-col gap-2">
                    <div className="flex justify-between text-sm">
                        <dt className="text-color-text-secondary">
                            Critical cells
                        </dt>
                        <dd className="font-semibold text-status-critical-text">
                            {criticalCount}
                        </dd>
                    </div>
                    <div className="flex justify-between text-sm">
                        <dt className="text-color-text-secondary">
                            High-risk cells
                        </dt>
                        <dd className="font-semibold text-status-caution-text">
                            {highCount}
                        </dd>
                    </div>
                    <div className="flex justify-between text-sm">
                        <dt className="text-color-text-secondary">
                            Incidents (30d)
                        </dt>
                        <dd className="font-semibold text-color-text-primary">
                            Not available yet
                        </dd>
                    </div>
                    <div className="flex justify-between text-sm">
                        <dt className="text-color-text-secondary">
                            Last updated
                        </dt>
                        <dd
                            className={
                                gridStale
                                    ? "font-semibold text-status-caution-text"
                                    : "font-semibold text-color-text-primary"
                            }
                        >
                            {gridFetchedAt === null
                                ? "Not available yet"
                                : formatRelativeTime(
                                      new Date(gridFetchedAt).toISOString(),
                                  )}
                        </dd>
                    </div>
                </dl>
            </div>
        </div>
    );
}
