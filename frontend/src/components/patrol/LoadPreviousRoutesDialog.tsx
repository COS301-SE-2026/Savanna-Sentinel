import { useEffect, useState } from "react";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Load Previous Route</DialogTitle>
                </DialogHeader>
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
                    {routes.map((route) => (
                        <li key={route.id}>
                            <Button
                                variant="outline"
                                className="w-full justify-start"
                                onClick={() => {
                                    onLoad(route);
                                    onOpenChange(false);
                                }}
                            >
                                {new Date(route.created_at).toLocaleString()}{" "}
                                — {Math.round(route.estimated_time_min)} min,{" "}
                                {Math.round(route.estimated_fuel_l)} L
                            </Button>
                        </li>
                    ))}
                </ul>
            </DialogContent>
        </Dialog>
    );
}
