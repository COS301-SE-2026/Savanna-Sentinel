import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

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
        locationVisible: false,
        onLocationVisibleChange: vi.fn(),
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
        expect(
            screen.getByRole("checkbox", { name: /my location/i }),
        ).toBeInTheDocument();
        expect(screen.queryByText(/roads/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/water sources/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/fence lines/i)).not.toBeInTheDocument();
    });

    it("lists My Location directly after Risk Heatmap", () => {
        renderPanel();
        const layers = screen
            .getAllByRole("checkbox")
            .map((box) => box.closest("label")?.textContent);
        expect(layers).toEqual(["Risk Heatmap", "My Location"]);
    });

    it("leaves My Location off until the user turns it on", () => {
        renderPanel();
        expect(
            screen.getByRole("checkbox", { name: /my location/i }),
        ).not.toBeChecked();
    });

    it("calls onLocationVisibleChange when My Location is toggled", async () => {
        const props = renderPanel({ locationVisible: false });
        await userEvent.click(
            screen.getByRole("checkbox", { name: /my location/i }),
        );
        expect(props.onLocationVisibleChange).toHaveBeenCalledWith(true);
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

    it("shows placeholder text for summary metrics with nothing loaded", () => {
        renderPanel();
        const incidents = screen
            .getByText(/incidents \(60d\)/i)
            .closest("div")!;
        const sightings = screen.getByText(/sightings \(7d\)/i).closest("div")!;
        const lastUpdated = screen.getByText(/last updated/i).closest("div")!;
        expect(incidents).toHaveTextContent("Not available yet");
        expect(sightings).toHaveTextContent("Not available yet");
        expect(lastUpdated).toHaveTextContent("Not available yet");
    });

    it("shows incident and sighting counts from the store summary", () => {
        useMapStore.setState({
            summary: { incidents_60d: 7, sightings_7d: 42 },
        });
        renderPanel();
        expect(
            screen.getByText(/incidents \(60d\)/i).closest("div")!,
        ).toHaveTextContent("7");
        expect(
            screen.getByText(/sightings \(7d\)/i).closest("div")!,
        ).toHaveTextContent("42");
    });

    it("shows the selected snapshot's computed_at as the last updated time", () => {
        const twoHoursAgo = new Date(
            Date.now() - 2 * 60 * 60 * 1000,
        ).toISOString();
        useMapStore.setState({
            snapshots: [{ heatmap_id: "h1", computed_at: twoHoursAgo }],
            selectedSnapshotId: "h1",
        });
        renderPanel();
        expect(
            screen.getByText(/last updated/i).closest("div")!,
        ).toHaveTextContent("2 hr ago");
    });
});

describe("Permission and Location settings", () => {
    let originalDeviceMotionEvent: typeof window.DeviceMotionEvent;

    beforeEach(() => {
        originalDeviceMotionEvent = window.DeviceMotionEvent;
    })

    afterEach(() => {
        Object.defineProperty(window, "DeviceMotionEvent", {
            writable: true,
            configurable: true,
            value: originalDeviceMotionEvent
        });
        vi.restoreAllMocks();
    });

    it("requests DeviceMotionEvent permission on iOS when checking My Location", async () => {
        const mockRequestPermission = vi.fn().mockResolvedValue("granted");

        Object.defineProperty(window, "DeviceMotionEvent", {
            writable: true,
            configurable: true,
            value: Object.assign(
                function DeviceMotionEvent() {},
                { requestPermission: mockRequestPermission}
            )
        })

        const props = renderPanel({ locationVisible: false});

        await userEvent.click(
            screen.getByRole("checkbox", {name: /my location/i})
        )

        expect(mockRequestPermission).toHaveBeenCalledTimes(1);
        expect(props.onLocationVisibleChange).toHaveBeenCalledWith(true);
    })

    it("does not request permission when location is unchecked", async () => {
        const mockRequestPermission = vi.fn().mockResolvedValue("granted");

        Object.defineProperty(window, "DeviceMotionEvent", {
            writable: true,
            configurable: true,
            value: Object.assign(
                function DeviceMotionEvent() {},
                { requestPermission: mockRequestPermission}
            )
        })

        const props = renderPanel({ locationVisible: true});

         await userEvent.click(
            screen.getByRole("checkbox", {name: /my location/i})
        )

        expect(mockRequestPermission).not.toHaveBeenCalled();
        expect(props.onLocationVisibleChange).toHaveBeenCalledWith(false);
    })

    it("handles browsers where requestPermission is undefined", async () => {
        Object.defineProperty(window, "DeviceMotionEvent", {
            writable: true,
            configurable: true,
            value: function DeviceMotionEvent() {},
        });

         const props = renderPanel({ locationVisible: false});

        await userEvent.click(
            screen.getByRole("checkbox", {name: /my location/i})
        )

        expect(props.onLocationVisibleChange).toHaveBeenCalledWith(true);
    })

    it("catches permission failures", async () => {
        const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
        const mockError = new Error("User denied permission");
        const mockRequestPermission = vi.fn().mockRejectedValue(mockError);

        Object.defineProperty(window, "DeviceMotionEvent", {
            writable: true,
            configurable: true,
            value: Object.assign(
                function DeviceMotionEvent() {},
                { requestPermission: mockRequestPermission}
            )
        })

        renderPanel()

        await userEvent.click(
            screen.getByRole("checkbox", {name: /my location/i})
        )

        expect(mockRequestPermission).toHaveBeenCalledTimes(1);
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            "Motion sensor permission failed:",
            mockError,
        );
    })
})
