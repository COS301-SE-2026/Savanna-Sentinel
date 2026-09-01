import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import { PatrolPlannerForm } from "@/components/patrol/PatrolPlannerForm";

function baseProps() {
    return {
        startPoint: null,
        endPoint: null,
        armedField: null as "start" | "end" | null,
        onArmField: vi.fn(),
        onStartPointChange: vi.fn(),
        onEndPointChange: vi.fn(),
        maxTime: "120",
        maxFuel: "15",
        onMaxTimeChange: vi.fn(),
        onMaxFuelChange: vi.fn(),
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

    it("enables Generate Routes once both points and positive time/fuel are set", () => {
        render(
            <PatrolPlannerForm
                {...baseProps()}
                startPoint={{ lat: -24.3, lon: 31.05 }}
                endPoint={{ lat: -24.32, lon: 31.08 }}
            />,
        );
        expect(
            screen.getByRole("button", { name: /generate routes/i }),
        ).toBeEnabled();
    });

    it("enables Generate Routes when max time and max fuel are left blank", () => {
        render(
            <PatrolPlannerForm
                {...baseProps()}
                startPoint={{ lat: -24.3, lon: 31.05 }}
                endPoint={{ lat: -24.32, lon: 31.08 }}
                maxTime=""
                maxFuel=""
            />,
        );
        expect(
            screen.getByRole("button", { name: /generate routes/i }),
        ).toBeEnabled();
    });

    it("disables Generate Routes when max time is explicitly zero", () => {
        render(
            <PatrolPlannerForm
                {...baseProps()}
                startPoint={{ lat: -24.3, lon: 31.05 }}
                endPoint={{ lat: -24.32, lon: 31.08 }}
                maxTime="0"
            />,
        );
        expect(
            screen.getByRole("button", { name: /generate routes/i }),
        ).toBeDisabled();
    });

    it("calls onArmField('start') when the start pin button is clicked", async () => {
        const props = baseProps();
        render(<PatrolPlannerForm {...props} />);
        await userEvent.click(
            screen.getByLabelText(/pick start point on map/i),
        );
        expect(props.onArmField).toHaveBeenCalledWith("start");
    });

    it("parses typed coordinates and calls onStartPointChange", async () => {
        const props = baseProps();
        render(<PatrolPlannerForm {...props} />);
        await userEvent.type(
            screen.getByLabelText(/start point/i, { selector: "input" }),
            "-24.3, 31.05",
        );
        expect(props.onStartPointChange).toHaveBeenLastCalledWith({
            lat: -24.3,
            lon: 31.05,
        });
    });

    it("calls onGenerate when Generate Routes is clicked while enabled", async () => {
        const props = baseProps();
        render(
            <PatrolPlannerForm
                {...props}
                startPoint={{ lat: -24.3, lon: 31.05 }}
                endPoint={{ lat: -24.32, lon: 31.08 }}
            />,
        );
        await userEvent.click(
            screen.getByRole("button", { name: /generate routes/i }),
        );
        expect(props.onGenerate).toHaveBeenCalledTimes(1);
    });

    it("does not reformat the start input when startPoint is a new object with equal lat/lon", async () => {
        const props = baseProps();
        const { rerender } = render(
            <PatrolPlannerForm
                {...props}
                startPoint={{ lat: -24.3, lon: 31.05 }}
            />,
        );
        const input = screen.getByLabelText(/start point/i, {
            selector: "input",
        }) as HTMLInputElement;
        expect(input.value).toBe("-24.30000, 31.05000");

        await userEvent.clear(input);
        await userEvent.type(input, "-24.3, 31.05");
        expect(input.value).toBe("-24.3, 31.05");

        rerender(
            <PatrolPlannerForm
                {...props}
                startPoint={{ lat: -24.3, lon: 31.05 }}
            />,
        );

        expect(input.value).toBe("-24.3, 31.05");
    });

    it("resyncs the start input when startPoint's lat/lon actually change externally", () => {
        const props = baseProps();
        const { rerender } = render(
            <PatrolPlannerForm
                {...props}
                startPoint={{ lat: -24.3, lon: 31.05 }}
            />,
        );
        const input = screen.getByLabelText(/start point/i, {
            selector: "input",
        }) as HTMLInputElement;
        expect(input.value).toBe("-24.30000, 31.05000");

        rerender(
            <PatrolPlannerForm
                {...props}
                startPoint={{ lat: -25.1, lon: 32.2 }}
            />,
        );

        expect(input.value).toBe("-25.10000, 32.20000");
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
