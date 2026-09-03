import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RiskZoneOverviewCard } from "@/components/dashboard/RiskZoneOverviewCard";

describe("RiskZoneOverviewCard", () => {
    it("renders an empty state when there is no risk cell data", () => {
        render(<RiskZoneOverviewCard riskData={[]} />);
        expect(
            screen.getByText("No risk cell data available"),
        ).toBeInTheDocument();
        expect(screen.queryAllByRole("progressbar")).toHaveLength(0);
    });

    it("renders risk levels and scores", () => {
        render(
            <RiskZoneOverviewCard
                riskData={[
                    {
                        zone: "North corridor",
                        level: "Critical",
                        risk_score: 0.9,
                    },
                    { zone: "River bend", level: "Low", risk_score: 0.4 },
                ]}
            />,
        );

        expect(screen.getByText("North corridor")).toBeInTheDocument();
        expect(screen.getByText("Critical")).toBeInTheDocument();
        expect(screen.getByText("River bend")).toBeInTheDocument();
        expect(screen.getByText("Low")).toBeInTheDocument();
        expect(
            screen.getByRole("progressbar", {
                name: "North corridor risk level: Critical",
            }),
        ).toHaveAttribute("aria-valuenow", "90");
        expect(
            screen.getByRole("progressbar", {
                name: "River bend risk level: Low",
            }),
        ).toHaveAttribute("aria-valuenow", "40");
    });
});
