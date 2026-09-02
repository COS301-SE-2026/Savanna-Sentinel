import { useMemo } from "react";

import { Slider } from "@/components/ui/slider";
import { Select } from "@/components/ui/select";
import { useMapStore } from "@/store/mapStore";
import {
    groupSnapshotsByDay,
    formatSnapshotTime,
} from "@/lib/heatmapSnapshots";

export function TimeRangeSlider() {
    const snapshots = useMapStore((s) => s.snapshots);
    const selectedSnapshotId = useMapStore((s) => s.selectedSnapshotId);
    const selectSnapshot = useMapStore((s) => s.selectSnapshot);

    const dayGroups = useMemo(
        () => groupSnapshotsByDay(snapshots),
        [snapshots],
    );

    const selectedDayIndex = useMemo(() => {
        const idx = dayGroups.findIndex((g) =>
            g.snapshots.some((s) => s.heatmap_id === selectedSnapshotId),
        );
        return idx === -1 ? Math.max(dayGroups.length - 1, 0) : idx;
    }, [dayGroups, selectedSnapshotId]);

    const dayGroup = dayGroups[selectedDayIndex];

    const selectedTimeIndex = useMemo(() => {
        if (!dayGroup) return 0;
        const idx = dayGroup.snapshots.findIndex(
            (s) => s.heatmap_id === selectedSnapshotId,
        );
        return idx === -1 ? dayGroup.snapshots.length - 1 : idx;
    }, [dayGroup, selectedSnapshotId]);

    if (!dayGroup) {
        return (
            <p className="text-sm text-color-text-secondary">
                No snapshots available yet.
            </p>
        );
    }

    function handleDayChange(index: number) {
        const group = dayGroups[index];
        const snap = group.snapshots[group.snapshots.length - 1];
        selectSnapshot(snap.heatmap_id);
    }

    function handleTimeChange(index: number) {
        const snap = dayGroup.snapshots[index];
        selectSnapshot(snap.heatmap_id);
    }

    const currentTimeLabel = formatSnapshotTime(
        dayGroup.snapshots[selectedTimeIndex].computed_at,
    );

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <div className="flex justify-between text-sm text-color-text-primary">
                    <span>{dayGroups[0].label}</span>
                    <span>{dayGroups[dayGroups.length - 1].label}</span>
                </div>
                <Slider
                    min={0}
                    max={dayGroups.length - 1}
                    step={1}
                    value={selectedDayIndex}
                    disabled={dayGroups.length <= 1}
                    aria-label="Snapshot date"
                    aria-valuetext={dayGroup.label}
                    onChange={(e) => handleDayChange(Number(e.target.value))}
                />
                <Select
                    id="snapshot-date"
                    aria-label="Select snapshot date"
                    value={selectedDayIndex}
                    onChange={(e) => handleDayChange(Number(e.target.value))}
                >
                    {dayGroups.map((group, i) => (
                        <option key={group.dateKey} value={i}>
                            {group.label}
                        </option>
                    ))}
                </Select>
            </div>

            <div className="flex flex-col gap-2">
                <div className="flex justify-between text-sm text-color-text-primary">
                    <span>Time of Day</span>
                    <span>{currentTimeLabel}</span>
                </div>
                <Slider
                    min={0}
                    max={dayGroup.snapshots.length - 1}
                    step={1}
                    value={selectedTimeIndex}
                    disabled={dayGroup.snapshots.length <= 1}
                    aria-label="Snapshot time of day"
                    aria-valuetext={currentTimeLabel}
                    onChange={(e) => handleTimeChange(Number(e.target.value))}
                />
                <Select
                    id="snapshot-time"
                    aria-label="Select snapshot time"
                    value={selectedTimeIndex}
                    onChange={(e) => handleTimeChange(Number(e.target.value))}
                >
                    {dayGroup.snapshots.map((snap, i) => (
                        <option key={snap.heatmap_id} value={i}>
                            {formatSnapshotTime(snap.computed_at)}
                        </option>
                    ))}
                </Select>
            </div>

            <span className="text-sm text-color-text-primary">
                Snapshot: {dayGroup.label}, {currentTimeLabel}
            </span>
        </div>
    );
}
