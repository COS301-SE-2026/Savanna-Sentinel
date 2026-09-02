import { useState } from "react";

import {
    RISK_LEVEL_COLORS,
    NO_DATA_CELL_COLOR,
    NO_DATA_CELL_OPACITY,
    type RiskLevel,
} from "@/lib/mapTokens";

const LEGEND_ROWS: { level: RiskLevel; label: string; short: string }[] = [
    { level: "critical", label: "Critical", short: "C" },
    { level: "alert", label: "High", short: "H" },
    { level: "caution", label: "Medium", short: "M" },
    { level: "safe", label: "Low", short: "L" },
];

interface MapLegendProps {
    bottomClassName?: string;
    style?: React.CSSProperties;
    defaultExpanded?: boolean;
}

export function MapLegend({
    bottomClassName = "bottom-2",
    style,
    defaultExpanded = false,
}: MapLegendProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    return (
        <button
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            aria-expanded={isExpanded}
            aria-label={
                isExpanded ? "Collapse risk legend" : "Expand risk legend"
            }
            style={style}
            className={
                isExpanded
                    ? `absolute right-2 ${bottomClassName} z-[var(--z-sticky)] min-w-[140px] rounded-lg bg-color-surface-raised p-3 text-left shadow-md`
                    : `absolute right-2 ${bottomClassName} z-[var(--z-sticky)] inline-flex items-center gap-2 rounded-md bg-color-surface-raised px-2 py-1 shadow-sm`
            }
        >
            {isExpanded ? (
                <>
                    <div className="mb-2 text-xs font-semibold text-color-text-primary uppercase tracking-wider">
                        Risk Level
                    </div>
                    <div className="flex flex-col gap-2">
                        {LEGEND_ROWS.map(({ level, label }) => (
                            <div
                                key={level}
                                className="flex items-center gap-2 text-sm"
                            >
                                <span
                                    className="size-4 shrink-0 rounded-[2px] border border-color-border/50"
                                    style={{
                                        background: RISK_LEVEL_COLORS[level],
                                    }}
                                />
                                {label}
                            </div>
                        ))}
                        <div className="flex items-center gap-2 text-sm">
                            <span
                                className="size-4 shrink-0 rounded-[2px] border border-color-border/50"
                                style={{
                                    background: NO_DATA_CELL_COLOR,
                                    opacity: NO_DATA_CELL_OPACITY,
                                }}
                            />
                            No score yet
                        </div>
                    </div>
                </>
            ) : (
                <>
                    {LEGEND_ROWS.map(({ level, short }) => (
                        <span
                            key={level}
                            className="inline-flex items-center gap-1"
                        >
                            <span
                                className="size-2 shrink-0 rounded-full"
                                style={{ background: RISK_LEVEL_COLORS[level] }}
                            />
                            <span className="text-xs">{short}</span>
                        </span>
                    ))}
                    <span className="inline-flex items-center gap-1">
                        <span
                            className="size-2 shrink-0 rounded-full"
                            style={{
                                background: NO_DATA_CELL_COLOR,
                                opacity: NO_DATA_CELL_OPACITY,
                            }}
                        />
                        <span className="text-xs">N/A</span>
                    </span>
                </>
            )}
        </button>
    );
}
