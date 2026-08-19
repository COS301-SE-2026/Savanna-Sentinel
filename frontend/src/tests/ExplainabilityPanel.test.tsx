import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import { ExplainabilityPanel } from "@/components/map/ExplainabilityPanel";
import { SNAPSHOTS, TIME_OF_DAY_SLOTS } from "@/lib/mapSnapshots";

function makeRiskByCell(): Map<string, number> {
    // a, b: critical. c: high. d: medium. e: safe.
    return new Map([
        ["a", 0.9],
        ["b", 0.85],
        ["c", 0.6],
        ["d", 0.4],
        ["e", 0.1],
    ]);
}

function renderPanel(
    overrides: Partial<Parameters<typeof ExplainabilityPanel>[0]> = {},
) {
    const props = {
        riskByCell: makeRiskByCell(),
        dayIndex: SNAPSHOTS.length - 1,
        onDayIndexChange: vi.fn(),
        timeIndex: TIME_OF_DAY_SLOTS.length - 1,
        onTimeIndexChange: vi.fn(),
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
    it("shows the combined day/time snapshot hint from TimeRangeSlider", () => {
        renderPanel({ dayIndex: 0, timeIndex: 0 });
        expect(
            screen.getByText(`Snapshot: ${SNAPSHOTS[0].label}, 00:00`),
        ).toBeInTheDocument();
    });

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
