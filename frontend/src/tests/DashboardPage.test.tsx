import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardPage } from "@/pages/DashboardPage";
import { dashboardApi } from "@/services/dashboardApi";

describe("DashboardPage", () => {
    it("renders the page heading and subtitle", () => {
        render(<DashboardPage />);
        expect(
            screen.getByRole("heading", { name: "Dashboard" }),
        ).toBeInTheDocument();
        expect(
            screen.getByText("Here's what's happening on the reserve."),
        ).toBeInTheDocument();
    });

    it("renders the Recent Field Reports table", () => {
        render(<DashboardPage />);
        expect(screen.getByText("Recent Field Reports")).toBeInTheDocument();
        expect(screen.getByText("No recent field reports")).toBeInTheDocument();
    });

    it("renders the Risk Cell Overview panel", () => {
        render(<DashboardPage />);
        expect(screen.getByText("Risk Cell Overview")).toBeInTheDocument();
        expect(
            screen.getByText("No risk cell data available"),
        ).toBeInTheDocument();
    });

    it("renders the Report Trends chart", () => {
        render(<DashboardPage />);
        expect(
            screen.getByText("Report Trends (Last 7 Days)"),
        ).toBeInTheDocument();
    });

    it("renders the Model Performance card", () => {
        render(<DashboardPage />);
        expect(screen.getByText("Model Performance")).toBeInTheDocument();
        expect(screen.getByText("Indicative only")).toBeInTheDocument();
    });

    it("renders dashboard data returned by the API", async () => {
        vi.spyOn(dashboardApi, "getDashboard").mockResolvedValue({
            stats: [
                { label: "Total Field Reports", value: 124, badge: "Shield" },
                { label: "Active Rangers", value: 18, badge: "Users" },
            ],
            patrol_coverage: { area_covered_km2: 42, total_area_km2: 100 },
            report_trends: {
                counts_by_type: [],
                trend: [{ date: "Mon", count: 4 }],
            },
            model_performance: {
                metrics: [{ label: "Precision", value: 0.92 }],
            },
            recent_field_reports: [
                {
                    report_id: "RPT-001",
                    ranger: "Amina Yusuf",
                    report_type: "Elephant sighting",
                    severity: "high",
                    zone: "North corridor",
                    occurred_at: "2026-08-22 08:30",
                },
            ],
            risk_zones: [
                { zone: "North corridor", level: "Critical", risk_score: 0.9 },
            ],
        });

        render(<DashboardPage />);

        expect(await screen.findByText("124")).toBeInTheDocument();
        expect(screen.getByText("18")).toBeInTheDocument();
        expect(screen.getByText("Amina Yusuf")).toBeInTheDocument();
        expect(screen.getByText("Critical")).toBeInTheDocument();
        expect(
            screen.getByRole("img", { name: "Mon: 4 reports" }),
        ).toBeInTheDocument();
        expect(screen.getByText("Precision")).toBeInTheDocument();

        vi.restoreAllMocks();
    });
});
