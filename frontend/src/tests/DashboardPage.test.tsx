import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardPage } from "@/pages/DashboardPage";
import type { DashboardData } from "@/types/dashboard";

const TEST_DATA: DashboardData = {
    stats: [{ label: "Active Patrols", value: 4 }],
    patrolCoverage: { areaCoveredKm2: 250, totalAreaKm2: 500 },
    reportTrends: {
        countsByType: [{ reportType: "incident", count: 3 }],
        trend: [{ date: "2026-08-19", count: 3 }],
    },
    modelPerformance: {
        metrics: [{ label: "Precision", value: 82 }],
        lastTrainedAt: "2026-08-10T09:00:00.000Z",
    },
};

describe("DashboardPage", () => {
    it("renders the page heading and all four dashboard cards from the given data", () => {
        render(<DashboardPage data={TEST_DATA} />);
        expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
        expect(screen.getByText("Patrol Coverage")).toBeInTheDocument();
        expect(screen.getByText("Field Report Trends")).toBeInTheDocument();
        expect(screen.getByText("Model Performance")).toBeInTheDocument();
        expect(screen.getByText("Active Patrols")).toBeInTheDocument();
    });
});
