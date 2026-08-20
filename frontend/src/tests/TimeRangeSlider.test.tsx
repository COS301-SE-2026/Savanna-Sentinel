import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import { TimeRangeSlider } from "@/components/map/TimeRangeSlider";
import { SNAPSHOTS, TIME_OF_DAY_SLOTS } from "@/lib/mapSnapshots";

describe("TimeRangeSlider", () => {
    it("shows the first and last snapshot dates as boundary labels", () => {
        render(
            <TimeRangeSlider
                dayIndex={0}
                onDayIndexChange={vi.fn()}
                timeIndex={0}
                onTimeIndexChange={vi.fn()}
            />,
        );
        const firstLabelSpans = screen
            .getAllByText(SNAPSHOTS[0].label)
            .filter((el) => el.tagName === "SPAN");
        const lastLabelSpans = screen
            .getAllByText(SNAPSHOTS[SNAPSHOTS.length - 1].label)
            .filter((el) => el.tagName === "SPAN");
        expect(firstLabelSpans.length).toBeGreaterThan(0);
        expect(lastLabelSpans.length).toBeGreaterThan(0);
    });

    it("reports a new day index when the date slider changes", () => {
        const onDayIndexChange = vi.fn();
        render(
            <TimeRangeSlider
                dayIndex={0}
                onDayIndexChange={onDayIndexChange}
                timeIndex={0}
                onTimeIndexChange={vi.fn()}
            />,
        );
        fireEvent.change(screen.getByLabelText(/^snapshot date$/i), {
            target: { value: "3" },
        });
        expect(onDayIndexChange).toHaveBeenCalledWith(3);
    });

    it("gives the date select an id so browsers can autofill/associate it", () => {
        render(
            <TimeRangeSlider
                dayIndex={0}
                onDayIndexChange={vi.fn()}
                timeIndex={0}
                onTimeIndexChange={vi.fn()}
            />,
        );
        expect(screen.getByLabelText(/select snapshot date/i)).toHaveAttribute(
            "id",
        );
    });

    it("reports a new day index when a date is picked from the select", async () => {
        const onDayIndexChange = vi.fn();
        render(
            <TimeRangeSlider
                dayIndex={0}
                onDayIndexChange={onDayIndexChange}
                timeIndex={0}
                onTimeIndexChange={vi.fn()}
            />,
        );
        await userEvent.selectOptions(
            screen.getByLabelText(/select snapshot date/i),
            String(2),
        );
        expect(onDayIndexChange).toHaveBeenCalledWith(2);
    });

    it("reports a new time-of-day index from the second slider", () => {
        const onTimeIndexChange = vi.fn();
        render(
            <TimeRangeSlider
                dayIndex={0}
                onDayIndexChange={vi.fn()}
                timeIndex={0}
                onTimeIndexChange={onTimeIndexChange}
            />,
        );
        fireEvent.change(screen.getByLabelText(/snapshot time of day/i), {
            target: { value: "2" },
        });
        expect(onTimeIndexChange).toHaveBeenCalledWith(2);
    });

    it("shows a combined hint with the selected day and time", () => {
        render(
            <TimeRangeSlider
                dayIndex={1}
                onDayIndexChange={vi.fn()}
                timeIndex={2}
                onTimeIndexChange={vi.fn()}
            />,
        );
        expect(
            screen.getByText(
                `Snapshot: ${SNAPSHOTS[1].label}, ${TIME_OF_DAY_SLOTS[2]}`,
            ),
        ).toBeInTheDocument();
    });
});
