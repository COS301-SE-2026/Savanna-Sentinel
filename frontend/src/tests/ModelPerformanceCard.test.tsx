import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ModelPerformanceCard } from "@/components/dashboard/ModelPerformanceCard";

describe("ModelPerformanceCard", () => {
    it("renders the heading and the indicative-only badge", () => {
        render(<ModelPerformanceCard />);
        expect(screen.getByText("Model Performance")).toBeInTheDocument();
        expect(screen.getByText("Indicative only")).toBeInTheDocument();
    });

    it("renders the Precision metric with its progress bar", () => {
        render(<ModelPerformanceCard />);
        expect(screen.getByText("Precision")).toBeInTheDocument();
        expect(screen.getByText("78%")).toBeInTheDocument();
        expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "78");
    });
});
