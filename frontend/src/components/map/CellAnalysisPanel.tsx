import { useEffect, useRef, useState } from "react";
import { Binoculars, TriangleAlert, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    RISK_LEVEL_FILL_CLASS,
    RISK_LEVEL_LABELS,
    type RiskLevel,
} from "@/lib/mapTokens";
import type { IncidentDetail, SightingDetail } from "@/services/riskApi";
import { useMapStore } from "@/store/mapStore";

export interface CellAnalysisPanelProps {
    level: RiskLevel;
    row: number;
    col: number;
    score: number;
    cellRef: string;
    isClosing: boolean;
    onClose: () => void;
    onClosed: () => void;
}

const MODEL_META_FALLBACK: [string, string][] = [
    ["Model", "Not available yet"],
    ["Last trained", "Not available yet"],
];

const FEATURE_LABELS: Record<string, string> = {
    incident_density_self: "Incident density (this cell)",
    incident_density_neighbors: "Incident density (nearby cells)",
    patrol_recency_days: "Days since last patrol",
    patrol_frequency: "Patrol frequency",
    sighting_density_self: "Animal sightings (this cell)",
    sighting_density_neighbors: "Animal sightings (nearby cells)",
    recent_incident: "Recent incident nearby",
};

function getFeatureLabel(featureName: string): string {
    if (FEATURE_LABELS[featureName]) return FEATURE_LABELS[featureName];
    return featureName
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function formatIncidentType(incidentType: string): string {
    return incidentType
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function formatSeverity(severity: string | null): string {
    if (!severity) return "Unknown severity";
    return `${severity.charAt(0).toUpperCase()}${severity.slice(1)} severity`;
}

const SEVERITY_STYLE: Record<
    string,
    { border: string; icon: string; badge: "critical" | "alert" | "caution" }
> = {
    high: {
        border: "border-l-status-critical",
        icon: "text-status-critical-text",
        badge: "critical",
    },
    medium: {
        border: "border-l-status-alert",
        icon: "text-status-alert",
        badge: "alert",
    },
    low: {
        border: "border-l-status-caution",
        icon: "text-status-caution-text",
        badge: "caution",
    },
};

const GROUP_LABEL_CLASS =
    "mb-1 text-[11px] font-semibold tracking-wide text-color-text-secondary uppercase";

function IncidentList({ incidents }: { incidents: IncidentDetail[] }) {
    return (
        <ul className="flex flex-col gap-1.5">
            {incidents.map((incident, i) => {
                const style = incident.severity
                    ? SEVERITY_STYLE[incident.severity.toLowerCase()]
                    : undefined;
                return (
                    <li
                        key={i}
                        className={`flex flex-col gap-1 rounded-sm border-l-2 bg-color-surface-bg px-2.5 py-2 ${style?.border ?? "border-l-color-border"}`}
                    >
                        <div className="flex items-baseline justify-between gap-2">
                            <span className="flex items-center gap-1.5 text-sm font-semibold text-color-text-primary">
                                <TriangleAlert
                                    className={`size-3.5 shrink-0 ${style?.icon ?? "text-color-text-secondary"}`}
                                    aria-hidden="true"
                                />
                                <span>
                                    {formatIncidentType(incident.incident_type)}
                                </span>
                            </span>
                            <span className="shrink-0 text-xs text-color-text-secondary tabular-nums">
                                {new Date(
                                    incident.occurred_at,
                                ).toLocaleDateString()}
                            </span>
                        </div>
                        <Badge
                            variant={style?.badge ?? "neutral"}
                            className="self-start"
                        >
                            {formatSeverity(incident.severity)}
                        </Badge>
                    </li>
                );
            })}
        </ul>
    );
}

function formatSpecies(species: string): string {
    return species
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function SightingList({ sightings }: { sightings: SightingDetail[] }) {
    return (
        <ul className="flex flex-col">
            {sightings.map((sighting, i) => (
                <li
                    key={i}
                    className="flex items-baseline justify-between gap-2 border-b border-color-border/60 py-1.5 last:border-b-0"
                >
                    <span className="flex items-center gap-1.5 text-sm text-color-text-primary">
                        <Binoculars
                            className="size-3.5 shrink-0 text-color-text-secondary"
                            aria-hidden="true"
                        />
                        <span>
                            {formatSpecies(sighting.species)}
                            {sighting.count ? ` (${sighting.count})` : ""}
                        </span>
                    </span>
                    <span className="shrink-0 text-xs text-color-text-secondary tabular-nums">
                        {new Date(sighting.occurred_at).toLocaleDateString()}
                    </span>
                </li>
            ))}
        </ul>
    );
}

export function CellAnalysisPanel({
    level,
    row,
    col,
    score,
    cellRef,
    isClosing,
    onClose,
    onClosed,
}: CellAnalysisPanelProps) {
    const closeRef = useRef<HTMLButtonElement>(null);

    const explanation = useMapStore((s) => s.explainByCellRef.get(cellRef));
    const activeModel = useMapStore((s) => s.activeModel);
    const selectedSnapshotId = useMapStore((s) => s.selectedSnapshotId);
    const loadCellExplain = useMapStore((s) => s.loadCellExplain);
    const loadActiveModel = useMapStore((s) => s.loadActiveModel);
    const [explainStatus, setExplainStatus] = useState<
        "loading" | "loaded" | "unavailable"
    >(explanation ? "loaded" : "loading");

    const isExplanationStale =
        explainStatus === "loaded" &&
        !!explanation &&
        explanation.heatmap_id !== selectedSnapshotId;

    useEffect(() => {
        loadActiveModel();
    }, [loadActiveModel]);

    useEffect(() => {
        if (explanation) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing status from a cached store value
            setExplainStatus("loaded");
            return;
        }
        let isCancelled = false;
        setExplainStatus("loading");
        loadCellExplain(cellRef).then((result) => {
            if (isCancelled) return;
            setExplainStatus(result ? "loaded" : "unavailable");
        });
        return () => {
            isCancelled = true;
        };
    }, [cellRef, explanation, loadCellExplain]);

    useEffect(() => {
        closeRef.current?.focus({ preventScroll: true });
    }, []);

    const onClosedRef = useRef(onClosed);
    useEffect(() => {
        onClosedRef.current = onClosed;
    }, [onClosed]);

    useEffect(() => {
        if (!isClosing) return undefined;
        const isReducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
        ).matches;
        const timer = setTimeout(
            () => onClosedRef.current(),
            isReducedMotion ? 0 : 250,
        );
        return () => clearTimeout(timer);
    }, [isClosing]);

    return (
        <div
            role="dialog"
            aria-label={`${RISK_LEVEL_LABELS[level]} risk analysis, cell ${row}, ${col}`}
            className={`analysis-panel-card absolute inset-y-0 right-0 z-[var(--z-toast)] flex w-full flex-col gap-3 overflow-y-auto border-l border-color-border bg-color-surface-raised p-4 shadow-md md:w-[320px] ${isClosing ? "is-closing" : ""}`}
        >
            <div className="relative flex items-start justify-between gap-2 pr-11">
                <div>
                    <div className="text-base font-semibold text-color-text-primary">
                        Cell Analysis
                    </div>
                    <p className="text-xs text-color-text-secondary">
                        Cell {row}, {col}
                    </p>
                </div>
                <button
                    ref={closeRef}
                    type="button"
                    onClick={onClose}
                    aria-label="Close analysis"
                    className="absolute top-0 right-0 flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-sm border border-color-border bg-color-surface-raised text-color-text-secondary hover:bg-color-surface-bg"
                >
                    <X className="size-5" aria-hidden="true" />
                </button>
            </div>

            <div className="flex flex-col items-start gap-1">
                <Badge variant={level}>{RISK_LEVEL_LABELS[level]} Risk</Badge>
                <span className="text-sm text-color-text-primary">
                    Risk score: {Math.round(score * 100)}%
                </span>
            </div>

            <div>
                <div className="mb-2 text-xs font-semibold tracking-wider text-color-text-primary uppercase">
                    Contributing Factors
                </div>
                {explainStatus === "loading" && (
                    <p className="text-sm text-color-text-secondary">
                        Loading analysis...
                    </p>
                )}
                {explainStatus === "unavailable" && (
                    <p className="text-sm text-color-text-secondary">
                        No explanation available for this cell.
                    </p>
                )}
                {explainStatus === "loaded" && isExplanationStale && (
                    <p className="text-sm text-color-text-secondary">
                        Explanation available for the latest snapshot only.
                    </p>
                )}
                {explainStatus === "loaded" &&
                    !isExplanationStale &&
                    explanation?.top_features.map((factor) => {
                        const pct = Math.round(factor.contribution * 100);
                        const label = getFeatureLabel(factor.feature_name);
                        return (
                            <div
                                key={factor.feature_name}
                                className="mb-2 flex items-center gap-2"
                            >
                                <span className="min-w-[130px] text-sm text-color-text-primary">
                                    {label}
                                </span>
                                <div
                                    className="h-1.5 flex-1 overflow-hidden rounded-xs bg-color-border"
                                    role="progressbar"
                                    aria-valuenow={pct}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-label={`${label} confidence`}
                                >
                                    <div
                                        className={`h-full rounded-xs ${RISK_LEVEL_FILL_CLASS[level]}`}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                                <span className="text-sm text-color-text-secondary">
                                    {pct}%
                                </span>
                            </div>
                        );
                    })}
            </div>

            {explainStatus === "loaded" &&
                !isExplanationStale &&
                explanation && (
                    <div>
                        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-color-text-primary uppercase">
                            <TriangleAlert
                                className="size-3.5 text-status-critical-text"
                                aria-hidden="true"
                            />
                            Nearby Incidents
                        </div>
                        {explanation.self_incidents.length === 0 &&
                        explanation.neighbor_incidents.length === 0 ? (
                            <p className="text-sm text-color-text-secondary">
                                No incidents recorded nearby.
                            </p>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {explanation.self_incidents.length > 0 && (
                                    <div>
                                        <div className={GROUP_LABEL_CLASS}>
                                            In this cell
                                        </div>
                                        <IncidentList
                                            incidents={
                                                explanation.self_incidents
                                            }
                                        />
                                    </div>
                                )}
                                {explanation.neighbor_incidents.length > 0 && (
                                    <div>
                                        <div className={GROUP_LABEL_CLASS}>
                                            In neighboring cells
                                        </div>
                                        <IncidentList
                                            incidents={
                                                explanation.neighbor_incidents
                                            }
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

            {explainStatus === "loaded" &&
                !isExplanationStale &&
                explanation && (
                    <div>
                        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-color-text-primary uppercase">
                            <Binoculars
                                className="size-3.5 text-color-text-secondary"
                                aria-hidden="true"
                            />
                            Nearby Sightings
                        </div>
                        {explanation.self_sightings.length === 0 &&
                        explanation.neighbor_sightings.length === 0 ? (
                            <p className="text-sm text-color-text-secondary">
                                No sightings recorded nearby.
                            </p>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {explanation.self_sightings.length > 0 && (
                                    <div>
                                        <div className={GROUP_LABEL_CLASS}>
                                            In this cell
                                        </div>
                                        <SightingList
                                            sightings={
                                                explanation.self_sightings
                                            }
                                        />
                                    </div>
                                )}
                                {explanation.neighbor_sightings.length > 0 && (
                                    <div>
                                        <div className={GROUP_LABEL_CLASS}>
                                            In neighboring cells
                                        </div>
                                        <SightingList
                                            sightings={
                                                explanation.neighbor_sightings
                                            }
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

            <hr className="border-color-border" />

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-color-text-secondary">
                {activeModel ? (
                    <>
                        <span className="contents">
                            <span>Model</span>
                            <span>#{activeModel.version}</span>
                        </span>
                        <span className="contents">
                            <span>Last trained</span>
                            <span>
                                {new Date(
                                    activeModel.trained_at,
                                ).toLocaleDateString()}
                            </span>
                        </span>
                        {activeModel.metrics.precision !== undefined && (
                            <span className="contents">
                                <span>Precision</span>
                                <span>
                                    {activeModel.metrics.precision.toFixed(2)}
                                </span>
                            </span>
                        )}
                        {activeModel.metrics.recall !== undefined && (
                            <span className="contents">
                                <span>Recall</span>
                                <span>
                                    {activeModel.metrics.recall.toFixed(2)}
                                </span>
                            </span>
                        )}
                        {activeModel.metrics.auc !== undefined && (
                            <span className="contents">
                                <span>AUC</span>
                                <span>
                                    {activeModel.metrics.auc.toFixed(2)}
                                </span>
                            </span>
                        )}
                    </>
                ) : (
                    MODEL_META_FALLBACK.map(([label, value]) => (
                        <span key={label} className="contents">
                            <span>{label}</span>
                            <span>{value}</span>
                        </span>
                    ))
                )}
            </div>

            <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-auto w-full"
                onClick={onClose}
            >
                Close Analysis
            </Button>
        </div>
    );
}
