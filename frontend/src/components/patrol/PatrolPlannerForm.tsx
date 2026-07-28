import { MapPin } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LatLon, ArmedField } from "@/types/patrol";

export interface PatrolPlannerFormProps {
    startPoint: LatLon | null;
    endPoint: LatLon | null;
    armedField: ArmedField;
    onArmField: (field: "start" | "end") => void;
    onStartPointChange: (point: LatLon | null) => void;
    onEndPointChange: (point: LatLon | null) => void;
    maxTime: string;
    maxFuel: string;
    onMaxTimeChange: (value: string) => void;
    onMaxFuelChange: (value: string) => void;
    onGenerate: () => void;
    isGenerating: boolean;
    hasRoutes: boolean;
    onClearRoutes: () => void;
}

function formatPoint(point: LatLon | null): string {
    return point ? `${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}` : "";
}

function parsePoint(value: string): LatLon | null {
    const parts = value.split(",").map((p) => Number(p.trim()));
    if (parts.length !== 2 || parts.some((n) => Number.isNaN(n))) return null;
    const [lat, lon] = parts;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return { lat, lon };
}

function pointsEqual(a: LatLon | null, b: LatLon | null): boolean {
    if (a === null || b === null) return a === b;
    return a.lat === b.lat && a.lon === b.lon;
}

export function PatrolPlannerForm({
    startPoint,
    endPoint,
    armedField,
    onArmField,
    onStartPointChange,
    onEndPointChange,
    maxTime,
    maxFuel,
    onMaxTimeChange,
    onMaxFuelChange,
    onGenerate,
    isGenerating,
    hasRoutes,
    onClearRoutes,
}: PatrolPlannerFormProps) {
    const [isClearOpen, setIsClearOpen] = useState(false);

    const isBlankOrPositive = (value: string) =>
        value.trim() === "" || Number(value) > 0;

    const canGenerate =
        startPoint !== null &&
        endPoint !== null &&
        isBlankOrPositive(maxTime) &&
        isBlankOrPositive(maxFuel) &&
        !isGenerating;

    const [lastReportedStart, setLastReportedStart] = useState(startPoint);
    const [lastReportedEnd, setLastReportedEnd] = useState(endPoint);

    const [prevStartPoint, setPrevStartPoint] = useState(startPoint);
    const [startText, setStartText] = useState(() => formatPoint(startPoint));
    if (!pointsEqual(startPoint, prevStartPoint)) {
        setPrevStartPoint(startPoint);
        if (!pointsEqual(startPoint, lastReportedStart)) {
            setStartText(formatPoint(startPoint));
        }
    }

    const [prevEndPoint, setPrevEndPoint] = useState(endPoint);
    const [endText, setEndText] = useState(() => formatPoint(endPoint));
    if (!pointsEqual(endPoint, prevEndPoint)) {
        setPrevEndPoint(endPoint);
        if (!pointsEqual(endPoint, lastReportedEnd)) {
            setEndText(formatPoint(endPoint));
        }
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="text-xs font-semibold text-color-text-primary uppercase tracking-wider">
                Plan Route
            </div>

            <div className="flex flex-col gap-1">
                <Label htmlFor="pp-start">Start Point</Label>
                <div className="flex gap-1.5">
                    <Input
                        id="pp-start"
                        placeholder="Click map or enter coordinates"
                        value={startText}
                        onChange={(e) => {
                            setStartText(e.target.value);
                            const parsed = parsePoint(e.target.value);
                            setLastReportedStart(parsed);
                            onStartPointChange(parsed);
                        }}
                    />
                    <Button
                        type="button"
                        variant={armedField === "start" ? "default" : "outline"}
                        size="icon"
                        aria-label="Pick start point on map"
                        aria-pressed={armedField === "start"}
                        onClick={() => onArmField("start")}
                    >
                        <MapPin />
                    </Button>
                </div>
            </div>

            <div className="flex flex-col gap-1">
                <Label htmlFor="pp-end">End Point</Label>
                <div className="flex gap-1.5">
                    <Input
                        id="pp-end"
                        placeholder="Click map or enter coordinates"
                        value={endText}
                        onChange={(e) => {
                            setEndText(e.target.value);
                            const parsed = parsePoint(e.target.value);
                            setLastReportedEnd(parsed);
                            onEndPointChange(parsed);
                        }}
                    />
                    <Button
                        type="button"
                        variant={armedField === "end" ? "default" : "outline"}
                        size="icon"
                        aria-label="Pick end point on map"
                        aria-pressed={armedField === "end"}
                        onClick={() => onArmField("end")}
                    >
                        <MapPin />
                    </Button>
                </div>
            </div>

            <div className="flex flex-col gap-1">
                <Label htmlFor="pp-time">Max Time (optional)</Label>
                <div className="relative">
                    <Input
                        id="pp-time"
                        type="number"
                        min={0}
                        placeholder="No limit"
                        value={maxTime}
                        onChange={(e) => onMaxTimeChange(e.target.value)}
                        className="pr-10"
                    />
                    <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-color-text-primary">
                        min
                    </span>
                </div>
            </div>

            <div className="flex flex-col gap-1">
                <Label htmlFor="pp-fuel">Max Fuel (optional)</Label>
                <div className="relative">
                    <Input
                        id="pp-fuel"
                        type="number"
                        min={0}
                        placeholder="No limit"
                        value={maxFuel}
                        onChange={(e) => onMaxFuelChange(e.target.value)}
                        className="pr-8"
                    />
                    <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-color-text-primary">
                        L
                    </span>
                </div>
            </div>

            <Button
                type="button"
                className="w-full"
                disabled={!canGenerate}
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
