import { useMemo } from "react";
import { Slider } from "@/components/ui/slider";
import { TimeRangeSlider } from "@/components/map/TimeRangeSlider";
import { RiskModelControls } from "@/components/map/RiskModelControls";
import { LayerTreePanel } from "@/components/workspace/LayerTreePanel";
import type { WorkspaceSelection } from "@/components/workspace/StyleEditorPanel";
import { getRiskLevel } from "@/lib/mapTokens";
import { formatRelativeTime } from "@/lib/utils";
import { requestMotionPermission } from "@/lib/motionPermission";
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
    locationVisible: boolean;
    onLocationVisibleChange: (visible: boolean) => void;
    opacityLabel: string;
    opacityValue: number;
    onOpacityValueChange: (opacity: number) => void;
    opacityDisabled?: boolean;
    gridStale?: boolean;
    hasRoute?: boolean;
    routeVisible?: boolean;
    onRouteVisibleChange?: (visible: boolean) => void;
    onRemoveRoute?: () => void;
    patrolRouteSelected?: boolean;
    onSelectPatrolRoute?: () => void;
    selection: WorkspaceSelection;
    onSelectLayer: (layerId: string) => void;
    onSelectMembership: (membershipId: string) => void;
    heatmapSelected?: boolean;
    onSelectHeatmap?: () => void;
}

export function ExplainabilityPanel({
    heatmapVisible,
    onHeatmapVisibleChange,
    locationVisible,
    onLocationVisibleChange,
    opacityLabel,
    opacityValue,
    onOpacityValueChange,
    opacityDisabled = false,
    gridStale = false,
    hasRoute = false,
    routeVisible = false,
    onRouteVisibleChange,
    onRemoveRoute,
    patrolRouteSelected = false,
    onSelectPatrolRoute,
    selection,
    onSelectLayer,
    onSelectMembership,
    heatmapSelected = false,
    onSelectHeatmap,
}: ExplainabilityPanelProps) {
    const cellsByRef = useMapStore((s) => s.cellsByRef);
    const summary = useMapStore((s) => s.summary);
    const snapshots = useMapStore((s) => s.snapshots);
    const selectedSnapshotId = useMapStore((s) => s.selectedSnapshotId);

    const selectedSnapshot = snapshots.find(
        (s) => s.heatmap_id === selectedSnapshotId,
    );

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

    const handleLocationChange = async (checked: boolean) => {
        if (checked) {
            try {
                if (!(await requestMotionPermission())) {
                    return;
                }
            } catch (error) {
                console.warn("Motion sensor permission failed:", error);
                return;
            }
        }

        onLocationVisibleChange(checked);
    };

    return (
        <div className="flex flex-col gap-5 p-4">
            <div>
                <SectionHeader>Time Range</SectionHeader>
                <TimeRangeSlider />
            </div>

            <div className="overflow-hidden rounded-md border border-color-border">
                <LayerTreePanel
                    activeLayerId={null}
                    selection={selection}
                    readOnly
                    rootLayersCollapsed
                    heatmapVisible={heatmapVisible}
                    onToggleHeatmap={onHeatmapVisibleChange}
                    heatmapSelected={heatmapSelected}
                    onSelectHeatmap={onSelectHeatmap}
                    showHeatmapOpacitySlider={false}
                    locationVisible={locationVisible}
                    onToggleLocation={handleLocationChange}
                    hasRoute={hasRoute}
                    routeVisible={routeVisible}
                    onToggleRoute={onRouteVisibleChange}
                    onRemoveRoute={onRemoveRoute}
                    patrolRouteSelected={patrolRouteSelected}
                    onSelectPatrolRoute={onSelectPatrolRoute}
                    onSelectLayer={onSelectLayer}
                    onSelectMembership={onSelectMembership}
                />
            </div>

            <div>
                <div className="mb-2 flex items-center justify-between text-sm text-color-text-primary">
                    <span>{opacityLabel}</span>
                    <span>{opacityValue}%</span>
                </div>
                <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={opacityValue}
                    disabled={opacityDisabled}
                    aria-label={opacityLabel}
                    onChange={(e) =>
                        onOpacityValueChange(Number(e.target.value))
                    }
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
                            Incidents (60d)
                        </dt>
                        <dd className="font-semibold text-color-text-primary">
                            {summary === null
                                ? "Not available yet"
                                : summary.incidents_60d}
                        </dd>
                    </div>
                    <div className="flex justify-between text-sm">
                        <dt className="text-color-text-secondary">
                            Sightings (7d)
                        </dt>
                        <dd className="font-semibold text-color-text-primary">
                            {summary === null
                                ? "Not available yet"
                                : summary.sightings_7d}
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
                            {selectedSnapshot
                                ? formatRelativeTime(
                                      selectedSnapshot.computed_at,
                                  )
                                : "Not available yet"}
                        </dd>
                    </div>
                </dl>
            </div>

            <RiskModelControls />
        </div>
    );
}
