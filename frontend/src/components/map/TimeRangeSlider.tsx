import { Slider } from "@/components/ui/slider";
import { Select } from "@/components/ui/select";
import { SNAPSHOTS, TIME_OF_DAY_SLOTS } from "@/lib/mapSnapshots";

export interface TimeRangeSliderProps {
    dayIndex: number;
    onDayIndexChange: (index: number) => void;
    timeIndex: number;
    onTimeIndexChange: (index: number) => void;
}

export function TimeRangeSlider({
    dayIndex,
    onDayIndexChange,
    timeIndex,
    onTimeIndexChange,
}: TimeRangeSliderProps) {
    const day = SNAPSHOTS[dayIndex];
    const time = TIME_OF_DAY_SLOTS[timeIndex];

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <div className="flex justify-between text-sm text-color-text-primary">
                    <span>{SNAPSHOTS[0].label}</span>
                    <span>{SNAPSHOTS[SNAPSHOTS.length - 1].label}</span>
                </div>
                <Slider
                    min={0}
                    max={SNAPSHOTS.length - 1}
                    step={1}
                    value={dayIndex}
                    aria-label="Snapshot date"
                    aria-valuetext={day.label}
                    onChange={(e) => onDayIndexChange(Number(e.target.value))}
                />
                <Select
                    id="snapshot-date"
                    aria-label="Select snapshot date"
                    value={dayIndex}
                    onChange={(e) => onDayIndexChange(Number(e.target.value))}
                >
                    {SNAPSHOTS.map((snapshot, i) => (
                        <option key={snapshot.value} value={i}>
                            {snapshot.label}
                        </option>
                    ))}
                </Select>
            </div>

            <div className="flex flex-col gap-2">
                <div className="flex justify-between text-sm text-color-text-primary">
                    <span>Time of Day</span>
                    <span>{time}</span>
                </div>
                <Slider
                    min={0}
                    max={TIME_OF_DAY_SLOTS.length - 1}
                    step={1}
                    value={timeIndex}
                    aria-label="Snapshot time of day"
                    aria-valuetext={time}
                    onChange={(e) => onTimeIndexChange(Number(e.target.value))}
                />
            </div>

            <span className="text-sm text-color-text-primary">
                Snapshot: {day.label}, {time}
            </span>
        </div>
    );
}
