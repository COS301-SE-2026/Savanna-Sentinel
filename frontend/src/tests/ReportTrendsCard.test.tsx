import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReportTrendsCard } from "@/components/dashboard/ReportTrendsCard";

describe("ReportTrendsCard", () => {
    it("renders the heading", () => {
        render(<ReportTrendsCard />);
        expect(screen.getByText("Report Trends (Last 7 Days)")).toBeInTheDocument();
    });

    it("renders an empty state when there is no trend data", () => {
        render(<ReportTrendsCard />);
        expect(screen.getByText("No trend data available")).toBeInTheDocument();
        expect(screen.queryAllByRole("img")).toHaveLength(0);
    });
});
