import { useEffect, useMemo, useRef } from "react";
import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RISK_LEVEL_LABELS, type RiskLevel } from "@/lib/mapTokens";
import { useMapStore } from "@/store/mapStore";

export interface CellPopupContentProps {
    level: RiskLevel;
    row: number;
    col: number;
    cellRef: string;
    canViewAnalysis: boolean;
    onClose: () => void;
    onViewAnalysis: () => void;
}

function formatIncidentType(incidentType: string): string {
    return incidentType
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function formatSpecies(species: string): string {
    return species
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function topThree(counts: Map<string, number>): [string, number][] {
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
}

export function CellPopupContent({
    level,
    row,
    col,
    cellRef,
    canViewAnalysis,
    onClose,
    onViewAnalysis,
}: CellPopupContentProps) {
    const closeRef = useRef<HTMLButtonElement>(null);
    const explanation = useMapStore((s) => s.explainByCellRef.get(cellRef));
    const loadCellExplain = useMapStore((s) => s.loadCellExplain);

    useEffect(() => {
        closeRef.current?.focus();
    }, []);

    useEffect(() => {
        if (canViewAnalysis) loadCellExplain(cellRef);
    }, [canViewAnalysis, cellRef, loadCellExplain]);

    const incidentSummary = useMemo(() => {
        if (!explanation) return [];
        const counts = new Map<string, number>();
        for (const incident of [
            ...explanation.self_incidents,
            ...explanation.neighbor_incidents,
        ]) {
            counts.set(
                incident.incident_type,
                (counts.get(incident.incident_type) ?? 0) + 1,
            );
        }
        return topThree(counts).map(
            ([type, count]) => `${count} ${formatIncidentType(type)}`,
        );
    }, [explanation]);

    const sightingSummary = useMemo(() => {
        if (!explanation) return [];
        const counts = new Map<string, number>();
        for (const sighting of [
            ...explanation.self_sightings,
            ...explanation.neighbor_sightings,
        ]) {
            counts.set(
                sighting.species,
                (counts.get(sighting.species) ?? 0) + (sighting.count ?? 1),
            );
        }
        return topThree(counts).map(
            ([species, count]) => `${count} ${formatSpecies(species)}`,
        );
    }, [explanation]);

    return (
        <div
            role="dialog"
            aria-label={`${RISK_LEVEL_LABELS[level]} risk, cell ${row}, ${col}`}
            className="cell-popup-card w-[280px] rounded-lg border border-color-border bg-color-surface-raised p-4 shadow-md"
        >
            <div className="mb-2 flex items-center justify-between gap-2">
                <Badge variant={level}>{RISK_LEVEL_LABELS[level]} Risk</Badge>
                <button
                    ref={closeRef}
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-sm border border-color-border bg-color-surface-raised text-color-text-secondary hover:bg-color-surface-bg"
                >
                    <X className="size-5" aria-hidden="true" />
                </button>
            </div>

            <p className="mb-3 text-xs text-color-text-secondary">
                Cell {row}, {col}
            </p>

            {(incidentSummary.length > 0 || sightingSummary.length > 0) && (
                <div className="mb-3 flex flex-col gap-1 text-xs text-color-text-secondary">
                    {incidentSummary.length > 0 && (
                        <p>
                            <span className="font-semibold text-color-text-primary">
                                Incidents:{" "}
                            </span>
                            {incidentSummary.join(", ")}
                        </p>
                    )}
                    {sightingSummary.length > 0 && (
                        <p>
                            <span className="font-semibold text-color-text-primary">
                                Sightings:{" "}
                            </span>
                            {sightingSummary.join(", ")}
                        </p>
                    )}
                </div>
            )}

            {canViewAnalysis && (
                <>
                    <hr className="my-3 border-color-border" />
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={onViewAnalysis}
                    >
                        View Analysis
                    </Button>
                </>
            )}
        </div>
    );
}
