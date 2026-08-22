import { describe, it, expect, vi } from "vitest";
import { api } from "@/services/api";
import { dashboardApi } from "@/services/dashboardApi";

vi.mock("@/services/api", () => ({
    api: { get: vi.fn() },
}));

const dashboardResponse = {
    stats: [
        { label: "Total Field Reports", value: 124, badge: "FileText" },
        { label: "Active Rangers", value: 18, badge: "Users" },
    ],
    patrol_coverage: { area_covered_km2: 42, total_area_km2: 100 },
    report_trends: {
        counts_by_type: [{ report_type: "Wildlife", count: 12 }],
        trend: [{ date: "2026-08-22", count: 4 }],
    },
    model_performance: {
        metrics: [{ label: "Precision", value: 92 }],
        last_trained_at: "2026-08-20T10:00:00Z",
    },
    recent_field_reports: [
        {
            report_id: "RPT-001",
            ranger: "Amina Yusuf",
            report_type: "Elephant sighting",
            severity: "high",
            zone: "North corridor",
            occurred_at: "2026-08-22T08:30:00Z",
        },
    ],
    risk_zones: [{ zone: "North corridor", level: "Critical", risk_score: 90 }],
};

describe("dashboardApi.getDashboard", () => {
    it("requests and returns the dashboard response", async () => {
        vi.mocked(api.get).mockResolvedValueOnce({ data: dashboardResponse });

        const result = await dashboardApi.getDashboard();

        expect(api.get).toHaveBeenCalledWith("/dashboard");
        expect(result).toEqual(dashboardResponse);
    });

    it("propagates API errors", async () => {
        const error = new Error("Dashboard unavailable");
        vi.mocked(api.get).mockRejectedValueOnce(error);

        await expect(dashboardApi.getDashboard()).rejects.toBe(error);
    });
});
