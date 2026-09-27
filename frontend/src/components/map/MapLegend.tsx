import { useState } from "react";
import { Navigation2 } from "lucide-react";

import {
    RISK_LEVEL_COLORS,
    NO_DATA_CELL_COLOR,
    NO_DATA_CELL_OPACITY,
    USER_LOCATION_COLOR,
    SELECTED_ROUTE_COLOR,
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
    showLocation?: boolean;
    showRoute?: boolean;
}

export function MapLegend({
    bottomClassName = "bottom-2",
    style,
    defaultExpanded = false,
    showLocation = true,
    showRoute = false,
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
                    {(showLocation || showRoute) && (
                        <div className="mt-3 flex flex-col gap-2 border-t border-color-border pt-2">
                            {showLocation && (
                                <div className="flex items-center gap-2 text-sm">
                                    <span
                                        className="flex size-4 shrink-0 items-center justify-center rounded-full border border-white"
                                        style={{
                                            background: USER_LOCATION_COLOR,
                                        }}
                                    >
                                        <Navigation2
                                            aria-hidden="true"
                                            className="size-2 fill-white text-white"
                                        />
                                    </span>
                                    You are here
                                </div>
                            )}
                            {showRoute && (
                                <div className="flex items-center gap-2 text-sm">
                                    <span
                                        className="h-1 w-4 shrink-0 rounded-full"
                                        style={{
                                            background: SELECTED_ROUTE_COLOR,
                                        }}
                                    />
                                    Patrol route
                                </div>
                            )}
                        </div>
                    )}
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
                    {showLocation && (
                        <span className="inline-flex items-center gap-1">
                            <span
                                className="size-2 shrink-0 rounded-full"
                                style={{ background: USER_LOCATION_COLOR }}
                            />
                            <span className="text-xs">You</span>
                        </span>
                    )}
                    {showRoute && (
                        <span className="inline-flex items-center gap-1">
                            <span
                                className="h-0.5 w-3 shrink-0 rounded-full"
                                style={{ background: SELECTED_ROUTE_COLOR }}
                            />
                            <span className="text-xs">Route</span>
                        </span>
                    )}
                </>
            )}
        </button>
    );
}
