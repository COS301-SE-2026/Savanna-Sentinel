import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReportTrendsCard } from "@/components/dashboard/ReportTrendsCard";

describe("ReportTrendsCard", () => {
    it("renders the heading", () => {
        render(<ReportTrendsCard counts_by_type={[]} trend={[]} />);
        expect(
            screen.getByText("Report Trends (Last 7 Days)"),
        ).toBeInTheDocument();
    });

    it("renders an empty state when there is no trend data", () => {
        render(<ReportTrendsCard counts_by_type={[]} trend={[]} />);
        expect(screen.getByText("No trend data available")).toBeInTheDocument();
        expect(screen.queryAllByRole("img")).toHaveLength(0);
    });

    it("renders trend bars with counts and dates", () => {
        render(
            <ReportTrendsCard
                counts_by_type={[]}
                trend={[
                    { date: "Mon", count: 4 },
                    { date: "Tue", count: 8 },
                ]}
            />,
        );

        expect(
            screen.getByRole("img", { name: "Mon: 4 reports" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("img", { name: "Tue: 8 reports" }),
        ).toBeInTheDocument();
        expect(screen.getByText("4")).toBeInTheDocument();
        expect(screen.getByText("8")).toBeInTheDocument();
        expect(screen.getAllByText("Mon")).toHaveLength(1);
        expect(screen.getAllByText("Tue")).toHaveLength(1);
    });
});
