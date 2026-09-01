export type RiskLevel = "safe" | "caution" | "alert" | "critical";

export function getRiskLevel(score: number): RiskLevel {
    if (score < 0.25) return "safe";
    if (score < 0.5) return "caution";
    if (score < 0.75) return "alert";
    return "critical";
}

// Maplibre doesnt like CSS, must be updated by hand
export const RISK_LEVEL_COLORS: Record<RiskLevel, string> = {
    safe: "#06b050",
    caution: "#fae203",
    alert: "#ff9300",
    critical: "#b30000",
};

export const NO_DATA_CELL_COLOR = "#4f7392";
export const NO_DATA_CELL_OPACITY = 0.15;

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
    critical: "Critical",
    alert: "High",
    caution: "Medium",
    safe: "Low",
};

export const RISK_LEVEL_FILL_CLASS: Record<RiskLevel, string> = {
    safe: "bg-status-safe",
    caution: "bg-status-caution",
    alert: "bg-status-alert",
    critical: "bg-status-critical",
};

export function getRiskCoverageColorClass(coveragePercent: number): string {
    if (coveragePercent < 40) return "text-status-critical-text";
    if (coveragePercent <= 70) return "text-status-caution-text";
    return "text-status-safe-text";
}

// Route A/B/C card-dot colors (spot-sky / spot-aqua / spot-cobalt).
export const ROUTE_COLORS = ["#0580bb", "#009193", "#2042b2"];
export const ROUTE_LABELS = ["Route A", "Route B", "Route C"];

// spot-navy
export const SELECTED_ROUTE_COLOR = "#103364";
// spot-blue
export const UNSELECTED_ROUTE_COLOR = "#0070bf";
export const BRAND_PRIMARY_COLOR = "#003a6b";
