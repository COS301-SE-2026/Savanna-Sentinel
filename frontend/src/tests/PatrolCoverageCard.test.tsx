import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PatrolCoverageCard } from "@/components/dashboard/PatrolCoverageCard";

describe("PatrolCoverageCard", () => {
    it("displays covered/total area and computed percentage", () => {
        render(<PatrolCoverageCard data={{ areaCoveredKm2: 250, totalAreaKm2: 500 }} />);
        expect(screen.getByText("250 km² of 500 km²")).toBeInTheDocument();
        expect(screen.getByText("50%")).toBeInTheDocument();
    });

    it("sets the Progress bar's aria-valuenow to the computed percentage", () => {
        render(<PatrolCoverageCard data={{ areaCoveredKm2: 342, totalAreaKm2: 500 }} />);
        expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "68");
    });

    it("shows a coming-soon message when totalAreaKm2 is 0 (grid cells not yet persisted)", () => {
        render(<PatrolCoverageCard data={{ areaCoveredKm2: 0, totalAreaKm2: 0 }} />);
        expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });

    it("shows a real 0% reading when totalAreaKm2 is known but nothing has been covered", () => {
        render(<PatrolCoverageCard data={{ areaCoveredKm2: 0, totalAreaKm2: 500 }} />);
        expect(screen.getByText("0%")).toBeInTheDocument();
        expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    });
});
