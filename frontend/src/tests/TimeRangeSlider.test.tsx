import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, afterEach } from "vitest";

import { TimeRangeSlider } from "@/components/map/TimeRangeSlider";
import { useMapStore, initialMapState } from "@/store/mapStore";
import { groupSnapshotsByDay } from "@/lib/heatmapSnapshots";

const SNAPSHOTS = [
    { heatmap_id: "a", computed_at: "2026-08-20T06:00:00Z" },
    { heatmap_id: "b", computed_at: "2026-08-20T18:00:00Z" },
    { heatmap_id: "c", computed_at: "2026-08-21T06:00:00Z" },
];

const DAY_GROUPS = groupSnapshotsByDay(SNAPSHOTS);

function seedStore(selectedSnapshotId: string | null = "c") {
    useMapStore.setState({
        ...initialMapState,
        snapshots: SNAPSHOTS,
        selectedSnapshotId,
        selectSnapshot: async (heatmapId: string) => {
            useMapStore.setState({ selectedSnapshotId: heatmapId });
        },
    });
}

afterEach(() => {
    useMapStore.setState(initialMapState, true);
});

describe("TimeRangeSlider", () => {
    it("shows a message when there are no snapshots yet", () => {
        seedStore(null);
        useMapStore.setState({ snapshots: [], selectedSnapshotId: null });
        render(<TimeRangeSlider />);
        expect(screen.getByText(/no snapshots available/i)).toBeInTheDocument();
    });

    it("shows the first and last day labels as boundary labels", () => {
        seedStore();
        render(<TimeRangeSlider />);
        expect(screen.getAllByText(DAY_GROUPS[0].label).length).toBeGreaterThan(
            0,
        );
        expect(screen.getAllByText(DAY_GROUPS[1].label).length).toBeGreaterThan(
            0,
        );
    });

    it("selects the latest snapshot of a newly picked day when the day slider changes", () => {
        seedStore();
        render(<TimeRangeSlider />);
        fireEvent.change(screen.getByLabelText(/^snapshot date$/i), {
            target: { value: "0" },
        });
        expect(useMapStore.getState().selectedSnapshotId).toBe("b");
    });

    it("selects a specific snapshot when the time-of-day slider changes", () => {
        seedStore("b");
        render(<TimeRangeSlider />);
        fireEvent.change(screen.getByLabelText(/snapshot time of day/i), {
            target: { value: "0" },
        });
        expect(useMapStore.getState().selectedSnapshotId).toBe("a");
    });

    it("gives the date select an id so browsers can autofill/associate it", () => {
        seedStore();
        render(<TimeRangeSlider />);
        expect(screen.getByLabelText(/select snapshot date/i)).toHaveAttribute(
            "id",
        );
    });

    it("reports a new day when a date is picked from the select", async () => {
        seedStore();
        render(<TimeRangeSlider />);
        await userEvent.selectOptions(
            screen.getByLabelText(/select snapshot date/i),
            String(0),
        );
        expect(useMapStore.getState().selectedSnapshotId).toBe("b");
    });

    it("shows a combined hint with the selected day and time", () => {
        seedStore("a");
        render(<TimeRangeSlider />);
        expect(
            screen.getByText(new RegExp(`^Snapshot: ${DAY_GROUPS[0].label},`)),
        ).toBeInTheDocument();
    });

    it("disables the time-of-day slider when the selected day has only one snapshot", () => {
        seedStore("c");
        render(<TimeRangeSlider />);
        expect(screen.getByLabelText(/snapshot time of day/i)).toBeDisabled();
    });

    it("does not disable the time-of-day slider when the day has multiple snapshots", () => {
        seedStore("b");
        render(<TimeRangeSlider />);
        expect(
            screen.getByLabelText(/snapshot time of day/i),
        ).not.toBeDisabled();
    });

    it("disables the date slider when there is only one day of snapshots", () => {
        useMapStore.setState({
            ...initialMapState,
            snapshots: [SNAPSHOTS[0]],
            selectedSnapshotId: "a",
            selectSnapshot: async (heatmapId: string) => {
                useMapStore.setState({ selectedSnapshotId: heatmapId });
            },
        });
        render(<TimeRangeSlider />);
        expect(screen.getByLabelText(/^snapshot date$/i)).toBeDisabled();
    });

    it("gives the time select an id so browsers can autofill/associate it", () => {
        seedStore("b");
        render(<TimeRangeSlider />);
        expect(screen.getByLabelText(/select snapshot time/i)).toHaveAttribute(
            "id",
        );
    });

    it("selects a specific snapshot when a time is picked from the time select", async () => {
        seedStore("b");
        render(<TimeRangeSlider />);
        await userEvent.selectOptions(
            screen.getByLabelText(/select snapshot time/i),
            String(0),
        );
        expect(useMapStore.getState().selectedSnapshotId).toBe("a");
    });
});
