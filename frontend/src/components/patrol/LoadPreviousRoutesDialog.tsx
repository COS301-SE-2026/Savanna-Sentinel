import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { getRiskCoverageColorClass } from "@/lib/mapTokens";
import { cn } from "@/lib/utils";
import { routeApi, type SavedRoute } from "@/services/routeApi";

interface LoadPreviousRoutesDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onLoad: (route: SavedRoute) => void;
}

export function LoadPreviousRoutesDialog({
    open,
    onOpenChange,
    onLoad,
}: LoadPreviousRoutesDialogProps) {
    const [routes, setRoutes] = useState<SavedRoute[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [isPreviouslyOpen, setPrevOpen] = useState(open);

    if (open !== isPreviouslyOpen) {
        setPrevOpen(open);
        setPendingDeleteId(null);
    }

    useEffect(() => {
        if (!open) return;

        async function fetchSavedRoutes() {
            setIsLoading(true);
            setError(null);
            try {
                const res = await routeApi.listSavedRoutes();
                setRoutes(res.results);
            } catch {
                setError("Failed to load saved routes.");
            } finally {
                setIsLoading(false);
            }
        }
        fetchSavedRoutes();
    }, [open]);

    async function handleDelete(routeId: string) {
        setDeletingId(routeId);
        setError(null);
        try {
            await routeApi.deleteSavedRoute(routeId);
            setRoutes((prev) => prev.filter((r) => r.id !== routeId));
        } catch {
            setError("Failed to delete saved route.");
        } finally {
            setDeletingId(null);
        }
    }

    if (pendingDeleteId !== null) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent preventBackdropClose>
                    <DialogHeader>
                        <DialogTitle>Delete Saved Route?</DialogTitle>
                    </DialogHeader>
                    <DialogDescription>
                        This saved route will be permanently removed. This
                        cannot be undone.
                    </DialogDescription>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setPendingDeleteId(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={() => {
                                handleDelete(pendingDeleteId);
                                setPendingDeleteId(null);
                            }}
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Load Previous Route</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-3 px-6 py-5">
                    {isLoading && (
                        <p className="text-sm text-color-text-secondary">
                            Loading...
                        </p>
                    )}
                    {error && (
                        <p className="text-sm text-status-critical-text">
                            {error}
                        </p>
                    )}
                    {!isLoading && !error && routes.length === 0 && (
                        <p className="text-sm text-color-text-secondary">
                            No saved routes yet.
                        </p>
                    )}
                    <ul className="flex flex-col gap-2">
                        {routes.map((route) => {
                            const coveragePercent = Math.round(
                                route.risk_coverage * 100,
                            );
                            const [lon, lat] = route.start_point.coordinates;
                            const [endLon, endLat] =
                                route.end_point.coordinates;
                            return (
                                <li key={route.id}>
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => {
                                            onLoad(route);
                                            onOpenChange(false);
                                        }}
                                        onKeyDown={(e) => {
                                            if (
                                                e.key === "Enter" ||
                                                e.key === " "
                                            ) {
                                                onLoad(route);
                                                onOpenChange(false);
                                            }
                                        }}
                                        className={cn(
                                            buttonVariants({
                                                variant: "outline",
                                            }),
                                            "h-auto w-full cursor-pointer flex-col items-stretch gap-2 p-3 text-left whitespace-normal",
                                        )}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-semibold text-color-text-primary">
                                                {new Date(
                                                    route.created_at,
                                                ).toLocaleString()}
                                            </span>
                                            <span
                                                className={cn(
                                                    "shrink-0 text-xs font-medium",
                                                    getRiskCoverageColorClass(
                                                        coveragePercent,
                                                    ),
                                                )}
                                            >
                                                {coveragePercent}% risk
                                            </span>
                                        </div>
                                        <div className="text-xs text-color-text-secondary">
                                            Start: {lat.toFixed(5)},{" "}
                                            {lon.toFixed(5)}
                                        </div>
                                        <div className="text-xs text-color-text-secondary">
                                            End: {endLat.toFixed(5)},{" "}
                                            {endLon.toFixed(5)}
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex gap-3 text-xs text-color-text-secondary">
                                                <span>
                                                    {Math.round(
                                                        route.estimated_time_min,
                                                    )}{" "}
                                                    min
                                                </span>
                                                <span>
                                                    {Math.round(
                                                        route.estimated_fuel_l,
                                                    )}{" "}
                                                    L
                                                </span>
                                            </div>
                                            <Button
                                                type="button"
                                                size="icon-xs"
                                                variant="outline"
                                                className="border-status-critical hover:bg-status-critical/5"
                                                aria-label="Delete saved route"
                                                disabled={
                                                    deletingId === route.id
                                                }
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setPendingDeleteId(
                                                        route.id,
                                                    );
                                                }}
                                            >
                                                <Trash2 className="text-status-critical" />
                                            </Button>
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </DialogContent>
        </Dialog>
    );
}
