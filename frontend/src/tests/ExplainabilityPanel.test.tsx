import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";

import { ExplainabilityPanel } from "@/components/map/ExplainabilityPanel";
import { useMapStore, initialMapState } from "@/store/mapStore";
import type { HeatmapCell } from "@/services/riskApi";

function makeCell(ref: string, riskScore: number): HeatmapCell {
    return {
        cell_id: `${ref}-uuid`,
        cell_ref: ref,
        risk_score: riskScore,
        geometry: { type: "Polygon", coordinates: [[[0, 0]]] },
    };
}

function makeCellsByRef(): Map<string, HeatmapCell> {
    // a, b: critical. c: high. d: medium. e: safe.
    return new Map([
        ["a", makeCell("a", 0.9)],
        ["b", makeCell("b", 0.85)],
        ["c", makeCell("c", 0.6)],
        ["d", makeCell("d", 0.4)],
        ["e", makeCell("e", 0.1)],
    ]);
}

afterEach(() => {
    useMapStore.setState(initialMapState, true);
});

function renderPanel(
    overrides: Partial<Parameters<typeof ExplainabilityPanel>[0]> = {},
) {
    useMapStore.setState({ cellsByRef: makeCellsByRef() });
    const props = {
        heatmapVisible: true,
        onHeatmapVisibleChange: vi.fn(),
        opacity: 55,
        onOpacityChange: vi.fn(),
        ...overrides,
    };
    render(<ExplainabilityPanel {...props} />);
    return props;
}

describe("ExplainabilityPanel", () => {
    it("only renders a Risk Heatmap layer checkbox, no other layers", () => {
        renderPanel();
        expect(
            screen.getByRole("checkbox", { name: /risk heatmap/i }),
        ).toBeInTheDocument();
        expect(screen.queryByText(/roads/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/water sources/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/fence lines/i)).not.toBeInTheDocument();
    });

    it("calls onHeatmapVisibleChange when the Risk Heatmap checkbox is toggled", async () => {
        const props = renderPanel({ heatmapVisible: true });
        await userEvent.click(
            screen.getByRole("checkbox", { name: /risk heatmap/i }),
        );
        expect(props.onHeatmapVisibleChange).toHaveBeenCalledWith(false);
    });

    it("disables the opacity slider when the heatmap layer is off", () => {
        renderPanel({ heatmapVisible: false });
        expect(screen.getByLabelText(/heatmap opacity/i)).toBeDisabled();
    });

    it("shows the current opacity percentage and reports changes", () => {
        const props = renderPanel({ opacity: 55 });
        expect(screen.getByText("55%")).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText(/heatmap opacity/i), {
            target: { value: "80" },
        });
        expect(props.onOpacityChange).toHaveBeenCalledWith(80);
    });

    it("computes Critical and High-risk cell counts from riskByCell", () => {
        renderPanel();
        const critical = screen.getByText(/critical cells/i).closest("div")!;
        const high = screen.getByText(/high-risk cells/i).closest("div")!;
        expect(critical).toHaveTextContent("2");
        expect(high).toHaveTextContent("1");
    });

    it("shows placeholder text for metrics with no backend source yet", () => {
        renderPanel();
        const incidents = screen
            .getByText(/incidents \(30d\)/i)
            .closest("div")!;
        const lastUpdated = screen.getByText(/last updated/i).closest("div")!;
        expect(incidents).toHaveTextContent("Not available yet");
        expect(lastUpdated).toHaveTextContent("Not available yet");
    });
});
