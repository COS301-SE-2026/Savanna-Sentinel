import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ModelPerformanceCard } from "@/components/dashboard/ModelPerformanceCard";

describe("ModelPerformanceCard", () => {
    it("renders one labeled progress bar per metric", () => {
        render(
            <ModelPerformanceCard
                data={{
                    metrics: [{ label: "Precision", value: 82 }],
                    lastTrainedAt: "2026-08-10T09:00:00.000Z",
                }}
            />,
        );
        expect(screen.getByText("Precision")).toBeInTheDocument();
        expect(screen.getByText("82%")).toBeInTheDocument();
        expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "82");
    });

    it("shows the last-trained date", () => {
        render(
            <ModelPerformanceCard
                data={{ metrics: [], lastTrainedAt: "2026-08-10T09:00:00.000Z" }}
            />,
        );
        expect(screen.getByText(/last trained/i)).toBeInTheDocument();
    });
});
