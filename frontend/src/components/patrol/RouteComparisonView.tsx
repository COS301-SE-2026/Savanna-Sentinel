import { useState } from "react";
import { Save } from "lucide-react";

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
    ROUTE_COLORS,
    ROUTE_LABELS,
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
    savingIndex: number | null;
    savedIndices: Set<number>;
    canSave: boolean;
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
    savingIndex,
    savedIndices,
    canSave,
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
        return (
            <p className="text-sm text-color-text-primary">
                No feasible routes found for these constraints. Try increasing
                max time or fuel.
            </p>
        );
    }

    return (
        <>
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
                                "rounded-md border bg-color-surface-raised p-3",
                                isSelected
                                    ? "border-2 border-brand-primary"
                                    : "border-color-border",
                            )}
                        >
                            <div className="mb-3 flex items-center gap-2">
                                <span
                                    className="size-2 shrink-0 rounded-full"
                                    style={{ background: ROUTE_COLORS[index] }}
                                />
                                <span className="flex-1 text-sm font-semibold">
                                    {ROUTE_LABELS[index]}
                                </span>
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
                                    className={
                                        savedIndices.has(index)
                                            ? "text-status-safe"
                                            : undefined
                                    }
                                >
                                    <Save className="size-3.5" />
                                </Button>
                                <button
                                    type="button"
                                    aria-pressed={isSelected}
                                    onClick={() => onSelect(index)}
                                    className={cn(
                                        "rounded-full px-3 py-0.5 text-xs",
                                        isSelected
                                            ? "bg-brand-primary text-color-text-inverse"
                                            : "border border-color-border",
                                    )}
                                >
                                    {isSelected ? "Selected" : "Select"}
                                </button>
                            </div>
                            <dl className="flex flex-col gap-1 text-sm">
                                <div className="flex justify-between">
                                    <dt className="text-color-text-secondary">
                                        Est. Time
                                    </dt>
                                    <dd className="font-medium">
                                        {Math.round(route.estimated_time_min)}{" "}
                                        min
                                    </dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-color-text-secondary">
                                        Est. Fuel
                                    </dt>
                                    <dd className="font-medium">
                                        {Math.round(route.estimated_fuel_l)} L
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
