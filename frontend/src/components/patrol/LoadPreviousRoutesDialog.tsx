import { useEffect, useState } from "react";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
                            return (
                                <li key={route.id}>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-auto w-full flex-col items-stretch gap-2 p-3 text-left whitespace-normal"
                                        onClick={() => {
                                            onLoad(route);
                                            onOpenChange(false);
                                        }}
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
                                    </Button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </DialogContent>
        </Dialog>
    );
}
