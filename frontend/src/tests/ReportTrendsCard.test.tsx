import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReportTrendsCard } from "@/components/dashboard/ReportTrendsCard";

describe("ReportTrendsCard", () => {
    it("renders the heading", () => {
        render(<ReportTrendsCard />);
        expect(screen.getByText("Report Trends (Last 7 Days)")).toBeInTheDocument();
    });

    it("renders one accessible bar per day with its count", () => {
        render(<ReportTrendsCard />);
        const bars = screen.getAllByRole("img");
        expect(bars).toHaveLength(7);
        expect(bars[0]).toHaveAttribute("aria-label", "Mon: 14 reports");
        expect(bars[1]).toHaveAttribute("aria-label", "Tue: 19 reports");
    });
});
