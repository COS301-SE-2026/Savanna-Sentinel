import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardCards } from "@/components/dashboard/DashboardCards";

describe("DashboardCards", () => {
    it("renders one card per stat with label and value", () => {
        render(
            <DashboardCards
                stats={[
                    { label: "Active Patrols", value: 4 },
                    { label: "Open Tip-offs", value: 6 },
                ]}
            />,
        );
        expect(screen.getByText("Active Patrols")).toBeInTheDocument();
        expect(screen.getByText("4")).toBeInTheDocument();
    });

    it("renders the unit suffix when provided", () => {
        render(<DashboardCards stats={[{ label: "Avg Response", value: 3, unit: "min" }]} />);
        expect(screen.getByText("min")).toBeInTheDocument();
    });

    it("renders nothing when given an empty stats array", () => {
        const { container } = render(<DashboardCards stats={[]} />);
        expect(container.querySelectorAll("[data-slot='card']")).toHaveLength(0);
    });
});
