import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import { PatrolPlannerForm } from "@/components/patrol/PatrolPlannerForm";
import { createStop } from "@/lib/patrolStops";

const A = { lat: -24.3, lon: 31.05 };
const C = { lat: -24.32, lon: 31.08 };

function baseProps() {
    return {
        stops: [createStop(), createStop()],
        armedStopId: null,
        onArmStop: vi.fn(),
        onStopsChange: vi.fn(),
        onGenerate: vi.fn(),
        isGenerating: false,
        heatmapHasNoData: false,
        hasRoutes: false,
        onClearRoutes: vi.fn(),
    };
}

describe("PatrolPlannerForm", () => {
    it("disables Generate Routes until both points are set", () => {
        render(<PatrolPlannerForm {...baseProps()} />);
        expect(
            screen.getByRole("button", { name: /generate routes/i }),
        ).toBeDisabled();
    });

    it("enables Generate Routes once every stop is set", () => {
        render(
            <PatrolPlannerForm
                {...baseProps()}
                stops={[createStop(A), createStop(C)]}
            />,
        );
        expect(
            screen.getByRole("button", { name: /generate routes/i }),
        ).toBeEnabled();
    });

    it("disables Generate Routes and names the empty stop", () => {
        render(
            <PatrolPlannerForm
                {...baseProps()}
                stops={[createStop(A), createStop(), createStop(C)]}
            />,
        );
        expect(
            screen.getByRole("button", { name: /generate routes/i }),
        ).toBeDisabled();
        expect(
            screen.getByText(/set stop 1 or remove it to generate routes/i),
        ).toBeInTheDocument();
    });

    it("does not show the empty stop hint for just a start and end", () => {
        render(<PatrolPlannerForm {...baseProps()} />);
        expect(screen.queryByText(/or remove it/i)).not.toBeInTheDocument();
    });

    it("disables Generate Routes while there is no heatmap data", () => {
        render(
            <PatrolPlannerForm
                {...baseProps()}
                stops={[createStop(A), createStop(C)]}
                heatmapHasNoData
            />,
        );
        expect(
            screen.getByRole("button", { name: /generate routes/i }),
        ).toBeDisabled();
    });

    it("calls onGenerate when Generate Routes is clicked while enabled", async () => {
        const props = baseProps();
        render(
            <PatrolPlannerForm
                {...props}
                stops={[createStop(A), createStop(C)]}
            />,
        );
        await userEvent.click(
            screen.getByRole("button", { name: /generate routes/i }),
        );
        expect(props.onGenerate).toHaveBeenCalledTimes(1);
    });

    it("hides Clear Routes when there are no generated routes", () => {
        render(<PatrolPlannerForm {...baseProps()} hasRoutes={false} />);
        expect(
            screen.queryByRole("button", { name: /clear routes/i }),
        ).not.toBeInTheDocument();
    });

    it("shows a destructive confirmation dialog and only clears on confirm", async () => {
        const props = { ...baseProps(), hasRoutes: true };
        render(<PatrolPlannerForm {...props} />);

        await userEvent.click(
            screen.getByRole("button", { name: "Clear Routes" }),
        );
        expect(screen.getByText("Clear Routes?")).toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(props.onClearRoutes).not.toHaveBeenCalled();

        await userEvent.click(
            screen.getByRole("button", { name: "Clear Routes" }),
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Clear Routes" }),
        );
        expect(props.onClearRoutes).toHaveBeenCalledTimes(1);
    });
});
