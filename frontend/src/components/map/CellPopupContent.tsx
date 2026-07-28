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

export interface CellPopupContentProps {
    level: RiskLevel;
    row: number;
    col: number;
    factors: CellFactor[];
    onClose: () => void;
    onViewAnalysis: () => void;
}

export function CellPopupContent({
    level,
    row,
    col,
    factors,
    onClose,
    onViewAnalysis,
}: CellPopupContentProps) {
    const closeRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        closeRef.current?.focus();
    }, []);

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

            {factors.map((factor) => (
                <div
                    key={factor.label}
                    className="mb-2 flex items-center gap-2"
                >
                    <span className="min-w-[130px] text-sm text-color-text-primary">
                        {factor.label}
                    </span>
                    <div
                        className="h-1 flex-1 overflow-hidden rounded-xs bg-color-border"
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
        </div>
    );
}
