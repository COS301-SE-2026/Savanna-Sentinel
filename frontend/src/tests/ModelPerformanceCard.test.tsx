import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ModelPerformanceCard } from "@/components/dashboard/ModelPerformanceCard";

describe("ModelPerformanceCard", () => {
    it("renders the heading and the indicative-only badge", () => {
        render(<ModelPerformanceCard metrics={[]} />);
        expect(screen.getByText("Model Performance")).toBeInTheDocument();
        expect(screen.getByText("Indicative only")).toBeInTheDocument();
    });

    it("renders an empty state when there is no performance data", () => {
        render(<ModelPerformanceCard metrics={[]} />);
        expect(
            screen.getByText("No performance data available"),
        ).toBeInTheDocument();
        expect(screen.queryAllByRole("progressbar")).toHaveLength(0);
    });

    it("renders metric values and progress bars", () => {
        render(
            <ModelPerformanceCard
                metrics={[
                    { label: "Precision", value: 0.92 },
                    { label: "Recall", value: 0.78 },
                ]}
            />,
        );

        expect(screen.getByText("Precision")).toBeInTheDocument();
        expect(screen.getByText("92%")).toBeInTheDocument();
        expect(screen.getByText("Recall")).toBeInTheDocument();
        expect(screen.getByText("78%")).toBeInTheDocument();
        expect(screen.getAllByRole("progressbar")).toHaveLength(2);
    });
});
