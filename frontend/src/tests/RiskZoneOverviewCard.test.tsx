import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RiskZoneOverviewCard } from "@/components/dashboard/RiskZoneOverviewCard";

describe("RiskZoneOverviewCard", () => {
    it("renders one row per zone with its risk level", () => {
        render(<RiskZoneOverviewCard />);
        expect(screen.getByText("Zone A-3")).toBeInTheDocument();
        expect(screen.getByText("Critical")).toBeInTheDocument();
        expect(screen.getByText("Zone C-2")).toBeInTheDocument();
        expect(screen.getByText("High")).toBeInTheDocument();
        expect(screen.getByText("Zone A-1")).toBeInTheDocument();
        expect(screen.getByText("Low")).toBeInTheDocument();
        expect(screen.getAllByText("Medium")).toHaveLength(2);
    });

    it("exposes each zone's risk level as an accessible progressbar", () => {
        render(<RiskZoneOverviewCard />);
        const bars = screen.getAllByRole("progressbar");
        expect(bars).toHaveLength(5);
        expect(bars[0]).toHaveAttribute("aria-valuenow", "95");
        expect(bars[0]).toHaveAttribute("aria-label", "Zone A-3 risk level: Critical");
    });
});
