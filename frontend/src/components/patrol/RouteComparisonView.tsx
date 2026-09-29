import { useState } from "react";
import { MapPinned, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
    ROUTE_LABELS,
    SELECTED_ROUTE_COLOR,
    UNSELECTED_ROUTE_COLOR,
    getRiskCoverageColorClass,
} from "@/lib/mapTokens";
import type { PlannedRoute } from "@/services/routeApi";
import type { RouteJobStatus } from "@/types/patrol";

export interface RouteComparisonViewProps {
    status: RouteJobStatus;
    routes: PlannedRoute[];
    selectedIndex: number;
    onSelect: (index: number) => void;
    onSave: (index: number) => void;
    onSendToHeatmap: (index: number) => void;
    savingIndex: number | null;
    savedIndices: Set<number>;
    canSave: boolean;
    numAlternativesRequested?: number | null;
    shortfallReason?: string | null;
    isTerrainStale?: boolean;
}

const SHORTFALL_MESSAGES: Record<string, string> = {
    duplicate_route: "the remaining options retraced a route already shown",
    no_tour_found: "no further route could be completed",
    longer_than_best:
        "the remaining options were more than 15% longer than the shortest route",
};

const NO_ROUTE_MESSAGES: Record<string, string> = {
    stop_in_no_go:
        "A stop is inside an impassable area. Move it outside the area and generate again.",
    blocked_by_no_go:
        "A stop can't be reached without crossing an impassable feature. Move the stop, or give a crossing point such as a bridge a higher priority than the feature.",
};

function TerrainStaleNote() {
    return (
        <p className="mb-2 text-xs text-status-caution-text" role="status">
            Recent workspace changes are still being applied, so route
            preferences may not reflect them yet.
        </p>
    );
}

function shortfallNote(
    found: number,
    requested: number | null | undefined,
    reason: string | null | undefined,
): string | null {
    if (!requested || found >= requested) return null;
    const detail = reason ? SHORTFALL_MESSAGES[reason] : undefined;
    const tail = detail ? `: ${detail}` : ".";
    return `Showing ${found} of ${requested} alternatives${tail}`;
}

function SkeletonCard() {
    return (
        <div className="flex flex-col gap-3 rounded-md border border-color-border bg-color-surface-raised p-3">
            <Skeleton className="h-3.5 w-3/5" />
            <Skeleton className="h-3 w-[45%]" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-[55%]" />
        </div>
    );
}

export function RouteComparisonView({
    status,
    routes,
    selectedIndex,
    onSelect,
    onSave,
    onSendToHeatmap,
    savingIndex,
    savedIndices,
    canSave,
    numAlternativesRequested,
    shortfallReason,
    isTerrainStale = false,
}: RouteComparisonViewProps) {
    const [pendingSaveIndex, setPendingSaveIndex] = useState<number | null>(
        null,
    );

    if (status === "idle") {
        return (
            <p className="text-sm text-color-text-primary">
                Set a start and end point, then generate routes to see
                alternatives here.
            </p>
        );
    }

    if (status === "queued" || status === "processing") {
        return (
            <div
                className="flex flex-col gap-3"
                aria-label="Generating route alternatives"
            >
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
            </div>
        );
    }

    if (status === "failed") {
        return (
            <p className="text-sm text-status-critical-text" role="alert">
                Route generation failed. Try adjusting your constraints and
                generate again.
            </p>
        );
    }

    if (routes.length === 0) {
        const blocked = shortfallReason
            ? NO_ROUTE_MESSAGES[shortfallReason]
            : undefined;
        return (
            <>
                {isTerrainStale && <TerrainStaleNote />}
                <p
                    className="text-sm text-color-text-primary"
                    role={blocked ? "alert" : undefined}
                >
                    {blocked ??
                        "No feasible routes found. Try a different start or end point."}
                </p>
            </>
        );
    }

    const note = shortfallNote(
        routes.length,
        numAlternativesRequested,
        shortfallReason,
    );

    return (
        <>
            {isTerrainStale && <TerrainStaleNote />}
            {note && (
                <p
                    className="mb-2 text-xs text-color-text-primary"
                    role="status"
                >
                    {note}
                </p>
            )}
            <div
                className="flex flex-col gap-3"
                aria-label="Route alternatives"
            >
                {routes.map((route, index) => {
                    const isSelected = index === selectedIndex;
                    const coveragePercent = Math.round(
                        route.risk_coverage * 100,
                    );
                    return (
                        <div
                            key={index}
                            className={cn(
                                "relative rounded-md border bg-color-surface-raised p-3",
                                isSelected
                                    ? "border-2 border-brand-primary"
                                    : "border-color-border hover:bg-color-surface-bg",
                            )}
                        >
                            <div className="mb-3 flex items-center gap-2">
                                <span
                                    className="size-2 shrink-0 rounded-full"
                                    style={{
                                        background: isSelected
                                            ? SELECTED_ROUTE_COLOR
                                            : UNSELECTED_ROUTE_COLOR,
                                    }}
                                />
                                <button
                                    type="button"
                                    aria-pressed={isSelected}
                                    onClick={() => onSelect(index)}
                                    className="flex-1 cursor-pointer text-left text-sm font-semibold outline-none after:absolute after:inset-0 after:rounded-md focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-brand-primary focus-visible:after:[--tw-outline-style:solid]"
                                >
                                    {ROUTE_LABELS[index]}
                                </button>
                                <Button
                                    type="button"
                                    size="icon-xs"
                                    variant="outline"
                                    className="relative z-10"
                                    disabled={savingIndex === index}
                                    aria-label={
                                        !canSave || savedIndices.has(index)
                                            ? `Show ${ROUTE_LABELS[index]} on heatmap`
                                            : `Save and show ${ROUTE_LABELS[index]} on heatmap`
                                    }
                                    title={
                                        !canSave || savedIndices.has(index)
                                            ? "Show on heatmap"
                                            : "Save and show on heatmap"
                                    }
                                    onClick={() => onSendToHeatmap(index)}
                                >
                                    <MapPinned className="size-3.5" />
                                </Button>
                                <Button
                                    type="button"
                                    size="icon-xs"
                                    variant="outline"
                                    disabled={
                                        !canSave ||
                                        savingIndex === index ||
                                        savedIndices.has(index)
                                    }
                                    aria-label={
                                        savedIndices.has(index)
                                            ? `${ROUTE_LABELS[index]} saved`
                                            : `Save ${ROUTE_LABELS[index]}`
                                    }
                                    aria-pressed={savedIndices.has(index)}
                                    onClick={() => setPendingSaveIndex(index)}
                                    title={
                                        !canSave
                                            ? "Loaded routes can't be re-saved - generate a new route to save it"
                                            : undefined
                                    }
                                    className={cn(
                                        "relative z-10",
                                        savedIndices.has(index) &&
                                            "text-status-safe",
                                    )}
                                >
                                    <Save className="size-3.5" />
                                </Button>
                            </div>
                            <dl className="flex flex-col gap-1 text-sm">
                                <div className="flex justify-between">
                                    <dt className="text-color-text-secondary">
                                        Distance
                                    </dt>
                                    <dd className="font-medium">
                                        {route.distance_km.toFixed(1)} km
                                    </dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-color-text-secondary">
                                        Risk Coverage
                                    </dt>
                                    <dd
                                        className={cn(
                                            "font-medium",
                                            getRiskCoverageColorClass(
                                                coveragePercent,
                                            ),
                                        )}
                                    >
                                        {coveragePercent}%
                                    </dd>
                                </div>
                            </dl>
                        </div>
                    );
                })}
            </div>

            <Dialog
                open={pendingSaveIndex !== null}
                onOpenChange={(open) => !open && setPendingSaveIndex(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Save this route?</DialogTitle>
                    </DialogHeader>
                    <DialogDescription>
                        {pendingSaveIndex !== null &&
                            `${ROUTE_LABELS[pendingSaveIndex]} will be added to your saved routes for later use.`}
                    </DialogDescription>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setPendingSaveIndex(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={() => {
                                if (pendingSaveIndex !== null) {
                                    onSave(pendingSaveIndex);
                                }
                                setPendingSaveIndex(null);
                            }}
                        >
                            Save Route
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
