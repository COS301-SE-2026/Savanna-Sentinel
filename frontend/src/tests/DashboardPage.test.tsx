import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardPage } from "@/pages/DashboardPage";

describe("DashboardPage", () => {
    it("renders the page heading and subtitle", () => {
        render(<DashboardPage />);
        expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
        expect(
            screen.getByText("Here's what's happening on the reserve."),
        ).toBeInTheDocument();
    });

    it("renders all four stat cards with their values", () => {
        render(<DashboardPage />);
        expect(screen.getByText("Total Field Reports")).toBeInTheDocument();
        expect(screen.getByText("124")).toBeInTheDocument();
        expect(screen.getByText("Active Rangers")).toBeInTheDocument();
        expect(screen.getByText("8")).toBeInTheDocument();
        expect(screen.getByText("Patrol Coverage")).toBeInTheDocument();
        expect(screen.getByText("73%")).toBeInTheDocument();
        expect(screen.getByText("Open Incidents")).toBeInTheDocument();
        expect(screen.getAllByText("12").length).toBeGreaterThan(0);
    });

    it("renders the Recent Field Reports table", () => {
        render(<DashboardPage />);
        expect(screen.getByText("Recent Field Reports")).toBeInTheDocument();
        expect(screen.getByText("RPT-041")).toBeInTheDocument();
    });

    it("renders the Risk Zone Overview panel", () => {
        render(<DashboardPage />);
        expect(screen.getByText("Risk Zone Overview")).toBeInTheDocument();
        expect(screen.getByText("Critical")).toBeInTheDocument();
    });

    it("renders the Report Trends chart", () => {
        render(<DashboardPage />);
        expect(screen.getByText("Report Trends (Last 7 Days)")).toBeInTheDocument();
    });
});
