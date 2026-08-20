import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ModelPerformanceCard } from "@/components/dashboard/ModelPerformanceCard";

describe("ModelPerformanceCard", () => {
    it("renders the heading and the indicative-only badge", () => {
        render(<ModelPerformanceCard />);
        expect(screen.getByText("Model Performance")).toBeInTheDocument();
        expect(screen.getByText("Indicative only")).toBeInTheDocument();
    });

    it("renders an empty state when there is no performance data", () => {
        render(<ModelPerformanceCard />);
        expect(
            screen.getByText("No performance data available"),
        ).toBeInTheDocument();
        expect(screen.queryAllByRole("progressbar")).toHaveLength(0);
    });
});
