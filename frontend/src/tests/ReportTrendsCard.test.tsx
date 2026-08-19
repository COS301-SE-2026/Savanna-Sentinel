import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReportTrendsCard } from "@/components/dashboard/ReportTrendsCard";

const DATA = {
    countsByType: [
        { reportType: "incident" as const, count: 18 },
        { reportType: "sighting" as const, count: 41 },
    ],
    trend: [
        { date: "2026-08-17", count: 6 },
        { date: "2026-08-18", count: 11 },
        { date: "2026-08-19", count: 7 },
    ],
};

describe("ReportTrendsCard", () => {
    it("shows a badge per report type with its count", () => {
        render(<ReportTrendsCard data={DATA} />);
        expect(screen.getByText("Incidents: 18")).toBeInTheDocument();
        expect(screen.getByText("Sightings: 41")).toBeInTheDocument();
    });

    it("renders one bar per trend point", () => {
        render(<ReportTrendsCard data={DATA} />);
        expect(screen.getByTitle("2026-08-18: 11")).toBeInTheDocument();
    });

    it("renders without crashing when trend is empty", () => {
        render(<ReportTrendsCard data={{ countsByType: [], trend: [] }} />);
        expect(screen.getByText("Field Report Trends")).toBeInTheDocument();
    });
});
