import { useEffect, useRef } from "react";
import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CellFactor } from "@/lib/cellFactors";
import {
    RISK_LEVEL_FILL_CLASS,
    RISK_LEVEL_LABELS,
    type RiskLevel,
} from "@/lib/mapTokens";

export interface CellAnalysisPanelProps {
    level: RiskLevel;
    row: number;
    col: number;
    score: number;
    factors: CellFactor[];
    isClosing: boolean;
    onClose: () => void;
    onClosed: () => void;
}

// stub for now
const MODEL_META: [string, string][] = [
    ["Model", "Not available yet"],
    ["F1 Score", "Not available yet"],
    ["Last trained", "Not available yet"],
];

export function CellAnalysisPanel({
    level,
    row,
    col,
    score,
    factors,
    isClosing,
    onClose,
    onClosed,
}: CellAnalysisPanelProps) {
    const closeRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        closeRef.current?.focus();
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
                        Zone Analysis
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
                {factors.map((factor) => (
                    <div
                        key={factor.label}
                        className="mb-2 flex items-center gap-2"
                    >
                        <span className="min-w-[130px] text-sm text-color-text-primary">
                            {factor.label}
                        </span>
                        <div
                            className="h-1.5 flex-1 overflow-hidden rounded-xs bg-color-border"
                            role="progressbar"
                            aria-valuenow={factor.pct}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`${factor.label} confidence`}
                        >
                            <div
                                className={`h-full rounded-xs ${RISK_LEVEL_FILL_CLASS[level]}`}
                                style={{ width: `${factor.pct}%` }}
                            />
                        </div>
                        <span className="text-sm text-color-text-secondary">
                            {factor.pct}%
                        </span>
                    </div>
                ))}
            </div>

            <hr className="border-color-border" />

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-color-text-secondary">
                {MODEL_META.map(([label, value]) => (
                    <span key={label} className="contents">
                        <span>{label}</span>
                        <span>{value}</span>
                    </span>
                ))}
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
