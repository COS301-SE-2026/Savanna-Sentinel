import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import { RouteComparisonView } from "@/components/patrol/RouteComparisonView";
import type { PlannedRoute } from "@/services/routeApi";

const SAVE_PROPS = {
    onSave: vi.fn(),
    savingIndex: null,
    savedIndices: new Set<number>(),
    canSave: true,
};

const ROUTES: PlannedRoute[] = [
    {
        suggested_path: [],
        path_geometry: { type: "LineString", coordinates: [] },
        estimated_time_min: 38,
        estimated_fuel_l: 16,
        risk_coverage: 0.74,
    },
    {
        suggested_path: [],
        path_geometry: { type: "LineString", coordinates: [] },
        estimated_time_min: 45,
        estimated_fuel_l: 21,
        risk_coverage: 0.58,
    },
];

describe("RouteComparisonView", () => {
    it("shows an idle prompt before anything has run", () => {
        render(
            <RouteComparisonView
                status="idle"
                routes={[]}
                selectedIndex={0}
                onSelect={vi.fn()}
                {...SAVE_PROPS}
            />,
        );
        expect(
            screen.getByText(/generate routes to see alternatives/i),
        ).toBeInTheDocument();
    });

    it("shows 3 skeleton cards while queued or processing", () => {
        const { container } = render(
            <RouteComparisonView
                status="processing"
                routes={[]}
                selectedIndex={0}
                onSelect={vi.fn()}
                {...SAVE_PROPS}
            />,
        );
        expect(
            container.querySelectorAll('[data-slot="skeleton"]').length,
        ).toBeGreaterThan(0);
    });

    it("renders one card per route with correct labels and risk coverage colors", () => {
        render(
            <RouteComparisonView
                status="completed"
                routes={ROUTES}
                selectedIndex={0}
                onSelect={vi.fn()}
                {...SAVE_PROPS}
            />,
        );
        expect(screen.getByText("Route A")).toBeInTheDocument();
        expect(screen.getByText("Route B")).toBeInTheDocument();
        expect(screen.getByText("74%")).toHaveClass("text-status-safe-text");
        expect(screen.getByText("58%")).toHaveClass("text-status-caution-text");
    });

    it("shows Selected on the selected card and Select on the rest", () => {
        render(
            <RouteComparisonView
                status="completed"
                routes={ROUTES}
                selectedIndex={0}
                onSelect={vi.fn()}
                {...SAVE_PROPS}
            />,
        );
        expect(
            screen.getByRole("button", { name: "Selected" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Select" }),
        ).toBeInTheDocument();
    });

    it("calls onSelect with the clicked route's index", async () => {
        const onSelect = vi.fn();
        render(
            <RouteComparisonView
                status="completed"
                routes={ROUTES}
                selectedIndex={0}
                onSelect={onSelect}
                {...SAVE_PROPS}
            />,
        );
        await userEvent.click(screen.getByRole("button", { name: "Select" }));
        expect(onSelect).toHaveBeenCalledWith(1);
    });

    it("shows a failure message when status is failed", () => {
        render(
            <RouteComparisonView
                status="failed"
                routes={[]}
                selectedIndex={0}
                onSelect={vi.fn()}
                {...SAVE_PROPS}
            />,
        );
        expect(screen.getByRole("alert")).toHaveTextContent(
            /route generation failed/i,
        );
    });

    it("handles fewer than 3 results without crashing", () => {
        render(
            <RouteComparisonView
                status="completed"
                routes={[ROUTES[0]]}
                selectedIndex={0}
                onSelect={vi.fn()}
                {...SAVE_PROPS}
            />,
        );
        expect(screen.getByText("Route A")).toBeInTheDocument();
        expect(screen.queryByText("Route B")).not.toBeInTheDocument();
    });
});
