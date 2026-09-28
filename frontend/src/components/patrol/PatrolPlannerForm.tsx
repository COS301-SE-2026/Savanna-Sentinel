import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { StopList } from "@/components/patrol/StopList";
import { firstUnsetStop } from "@/lib/patrolStops";
import type { PlannerStop } from "@/types/patrol";

export interface PatrolPlannerFormProps {
    stops: PlannerStop[];
    armedStopId: string | null;
    onArmStop: (id: string) => void;
    onStopsChange: (stops: PlannerStop[]) => void;
    onGenerate: () => void;
    isGenerating: boolean;
    heatmapHasNoData: boolean;
    hasRoutes: boolean;
    onClearRoutes: () => void;
}

export function PatrolPlannerForm({
    stops,
    armedStopId,
    onArmStop,
    onStopsChange,
    onGenerate,
    isGenerating,
    heatmapHasNoData,
    hasRoutes,
    onClearRoutes,
}: PatrolPlannerFormProps) {
    const [isClearOpen, setIsClearOpen] = useState(false);
    const unsetStop = firstUnsetStop(stops);

    const canGenerate =
        unsetStop === null && !isGenerating && !heatmapHasNoData;

    return (
        <div className="flex flex-col gap-4">
            <div className="text-xs font-semibold text-color-text-primary uppercase tracking-wider">
                Plan Route
            </div>

            <StopList
                stops={stops}
                armedStopId={armedStopId}
                onArmStop={onArmStop}
                onStopsChange={onStopsChange}
            />

            {unsetStop && stops.length > 2 && (
                <p className="text-xs text-color-text-primary">
                    Set {unsetStop.toLowerCase()} or remove it to generate
                    routes.
                </p>
            )}

            <Button
                type="button"
                className="w-full"
                disabled={!canGenerate}
                title={
                    heatmapHasNoData
                        ? "No risk scores available yet"
                        : undefined
                }
                onClick={onGenerate}
            >
                {isGenerating ? "Generating..." : "Generate Routes"}
            </Button>

            {hasRoutes && (
                <Button
                    type="button"
                    variant="destructive"
                    className="w-full"
                    onClick={() => setIsClearOpen(true)}
                >
                    Clear Routes
                </Button>
            )}

            <Dialog open={isClearOpen} onOpenChange={setIsClearOpen}>
                <DialogContent preventBackdropClose>
                    <DialogHeader>
                        <DialogTitle>Clear Routes?</DialogTitle>
                    </DialogHeader>
                    <DialogDescription>
                        The generated route alternatives will be removed from
                        the map. This cannot be undone.
                    </DialogDescription>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsClearOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={() => {
                                setIsClearOpen(false);
                                onClearRoutes();
                            }}
                        >
                            Clear Routes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
