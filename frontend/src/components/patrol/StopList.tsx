import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowUpDown, MapPin, Plus, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    addStop,
    canAddStop,
    canRemoveStop,
    formatPoint,
    moveStop,
    parsePoint,
    pointsEqual,
    removeStop,
    reverseStops,
    stopLabel,
    updateStop,
} from "@/lib/patrolStops";
import { cn } from "@/lib/utils";
import { MAX_WAYPOINTS, type LatLon, type PlannerStop } from "@/types/patrol";

export interface StopListProps {
    stops: PlannerStop[];
    armedStopId: string | null;
    onArmStop: (id: string) => void;
    onStopsChange: (stops: PlannerStop[]) => void;
}

// same shapes as the map markers: circle, numbered circle, diamond
function StopGlyph({ index, total }: { index: number; total: number }) {
    if (index === 0) {
        return (
            <span className="size-4 rounded-full bg-brand-primary ring-2 ring-color-surface-raised" />
        );
    }
    if (index === total - 1) {
        return (
            <span className="size-3 rotate-45 bg-brand-primary ring-2 ring-color-surface-raised" />
        );
    }
    return (
        <span className="flex size-5 items-center justify-center rounded-full bg-brand-primary text-xs font-semibold text-color-text-inverse ring-2 ring-color-surface-raised">
            {index}
        </span>
    );
}

function placeholderFor(index: number, total: number): string {
    if (index === 0) return "Choose start point";
    if (index === total - 1) return "Choose end point";
    return "Add a stop";
}

interface StopRowProps {
    stop: PlannerStop;
    index: number;
    total: number;
    isArmed: boolean;
    canRemove: boolean;
    onArm: () => void;
    onChange: (point: LatLon | null) => void;
    onRemove: () => void;
}

function StopRow({
    stop,
    index,
    total,
    isArmed,
    canRemove,
    onArm,
    onChange,
    onRemove,
}: StopRowProps) {
    const label = stopLabel(index, total);
    const lowerLabel = label.toLowerCase();
    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: stop.id });

    const [lastReported, setLastReported] = useState(stop.point);
    const [prevPoint, setPrevPoint] = useState(stop.point);
    const [text, setText] = useState(() => formatPoint(stop.point));
    if (!pointsEqual(stop.point, prevPoint)) {
        setPrevPoint(stop.point);
        if (!pointsEqual(stop.point, lastReported)) {
            setText(formatPoint(stop.point));
        }
    }

    return (
        <li
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={cn(
                "flex items-center gap-1 rounded-md bg-color-surface-raised",
                isDragging && "relative z-20 shadow-md",
            )}
        >
            <button
                ref={setActivatorNodeRef}
                type="button"
                aria-label={`Reorder ${lowerLabel}`}
                {...attributes}
                {...listeners}
                className="z-10 flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary active:cursor-grabbing"
            >
                <StopGlyph index={index} total={total} />
            </button>
            <div className="relative min-w-0 flex-1">
                <Input
                    aria-label={label}
                    placeholder={placeholderFor(index, total)}
                    value={text}
                    title={text || undefined}
                    onChange={(e) => {
                        setText(e.target.value);
                        const parsed = parsePoint(e.target.value);
                        setLastReported(parsed);
                        onChange(parsed);
                    }}
                    className={cn("pr-10", isArmed && "border-brand-primary")}
                />
                <button
                    type="button"
                    aria-label={`Pick ${lowerLabel} on map`}
                    aria-pressed={isArmed}
                    onClick={onArm}
                    className={cn(
                        "absolute top-1/2 right-1 flex size-8 -translate-y-1/2 items-center justify-center rounded-sm text-brand-primary duration-[--dur-fast] before:absolute before:-inset-1.5 hover:bg-color-surface-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary",
                        isArmed &&
                            "bg-brand-primary text-color-text-inverse hover:bg-brand-primary/87",
                    )}
                >
                    <MapPin className="size-4" />
                </button>
            </div>
            {canRemove ? (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${lowerLabel}`}
                    onClick={onRemove}
                >
                    <X />
                </Button>
            ) : (
                <span aria-hidden className="size-11 shrink-0" />
            )}
        </li>
    );
}

export function StopList({
    stops,
    armedStopId,
    onArmStop,
    onStopsChange,
}: StopListProps) {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );
    const canRemove = canRemoveStop(stops);
    const waypointCount = stops.length - 2;

    function handleDragEnd({ active, over }: DragEndEvent) {
        if (!over || active.id === over.id) return;
        onStopsChange(moveStop(stops, String(active.id), String(over.id)));
    }

    return (
        <div className="flex flex-col gap-2">
            {/* data-vaul-no-drag stops the mobile drawer eating reorder drags */}
            <div className="relative" data-vaul-no-drag>
                <span
                    aria-hidden
                    className="pointer-events-none absolute top-5.5 bottom-5.5 left-5.25 border-l-2 border-dotted border-color-input-border"
                />
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={stops.map((stop) => stop.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <ol
                            aria-label="Route stops"
                            className="m-0 flex list-none flex-col gap-2 p-0"
                        >
                            {stops.map((stop, index) => (
                                <StopRow
                                    key={stop.id}
                                    stop={stop}
                                    index={index}
                                    total={stops.length}
                                    isArmed={armedStopId === stop.id}
                                    canRemove={canRemove}
                                    onArm={() => onArmStop(stop.id)}
                                    onChange={(point) =>
                                        onStopsChange(
                                            updateStop(stops, stop.id, point),
                                        )
                                    }
                                    onRemove={() =>
                                        onStopsChange(
                                            removeStop(stops, stop.id),
                                        )
                                    }
                                />
                            ))}
                        </ol>
                    </SortableContext>
                </DndContext>
                {!canRemove && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Swap start and end points"
                        onClick={() => onStopsChange(reverseStops(stops))}
                        className="absolute top-1/2 right-0 -translate-y-1/2"
                    >
                        <ArrowUpDown />
                    </Button>
                )}
            </div>
            <div className="flex items-center justify-between gap-2 pl-11">
                <Button
                    type="button"
                    variant="ghost"
                    className="px-2"
                    disabled={!canAddStop(stops)}
                    onClick={() => onStopsChange(addStop(stops))}
                >
                    <Plus />
                    Add stop
                </Button>
                <span className="text-xs text-color-text-primary tabular-nums">
                    {waypointCount} of {MAX_WAYPOINTS} stops
                </span>
            </div>
        </div>
    );
}
