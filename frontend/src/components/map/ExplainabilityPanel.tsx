import { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { TimeRangeSlider } from "@/components/map/TimeRangeSlider";
import { RiskModelControls } from "@/components/map/RiskModelControls";
import { getRiskLevel } from "@/lib/mapTokens";
import { useMapStore } from "@/store/mapStore";

export function SectionHeader({ children }: { children: string }) {
    return (
        <div className="mb-2 text-xs font-semibold tracking-wider text-color-text-primary uppercase">
            {children}
        </div>
    );
}

export interface ExplainabilityPanelProps {
    heatmapVisible: boolean;
    onHeatmapVisibleChange: (visible: boolean) => void;
    opacity: number;
    onOpacityChange: (opacity: number) => void;
}

export function ExplainabilityPanel({
    heatmapVisible,
    onHeatmapVisibleChange,
    opacity,
    onOpacityChange,
}: ExplainabilityPanelProps) {
    const cellsByRef = useMapStore((s) => s.cellsByRef);

    const { criticalCount, highCount } = useMemo(() => {
        let criticalCount = 0;
        let highCount = 0;
        for (const cell of cellsByRef.values()) {
            const level = getRiskLevel(cell.risk_score);
            if (level === "critical") criticalCount++;
            else if (level === "alert") highCount++;
        }
        return { criticalCount, highCount };
    }, [cellsByRef]);

    return (
        <div className="flex flex-col gap-5 p-4">
            <div>
                <SectionHeader>Time Range</SectionHeader>
                <TimeRangeSlider />
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
                        <dd className="font-semibold text-color-text-primary">
                            Not available yet
                        </dd>
                    </div>
                </dl>
            </div>

            <RiskModelControls />
        </div>
    );
}
