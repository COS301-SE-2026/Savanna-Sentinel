import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RiskZoneOverviewCard } from "@/components/dashboard/RiskZoneOverviewCard";

describe("RiskZoneOverviewCard", () => {
    it("renders an empty state when there is no risk zone data", () => {
        render(<RiskZoneOverviewCard />);
        expect(screen.getByText("No risk zone data available")).toBeInTheDocument();
        expect(screen.queryAllByRole("progressbar")).toHaveLength(0);
    });
});
