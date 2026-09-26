import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import { StopList } from "@/components/patrol/StopList";
import { createStop } from "@/lib/patrolStops";
import type { LatLon, PlannerStop } from "@/types/patrol";

const A = { lat: -24.3, lon: 31.05 };
const C = { lat: -24.32, lon: 31.08 };

function stopsWith(...points: (LatLon | null)[]): PlannerStop[] {
    return points.map((p) => createStop(p));
}

function renderList(stops: PlannerStop[], armedStopId: string | null = null) {
    const onStopsChange = vi.fn();
    const onArmStop = vi.fn();
    render(
        <StopList
            stops={stops}
            armedStopId={armedStopId}
            onArmStop={onArmStop}
            onStopsChange={onStopsChange}
        />,
    );
    return { onStopsChange, onArmStop };
}

describe("StopList", () => {
    it("shows start and end with a swap button and no remove buttons", () => {
        renderList(stopsWith(A, C));
        expect(screen.getByLabelText(/^start point$/i)).toHaveValue(
            "-24.30000, 31.05000",
        );
        expect(screen.getByLabelText(/^end point$/i)).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Swap start and end points" }),
        ).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /^remove/i })).toBeNull();
    });

    it("adds a stop before the end point", async () => {
        const stops = stopsWith(A, C);
        const { onStopsChange } = renderList(stops);
        await userEvent.click(
            screen.getByRole("button", { name: /add stop/i }),
        );
        const next: PlannerStop[] = onStopsChange.mock.calls[0][0];
        expect(next).toHaveLength(3);
        expect(next[2].id).toBe(stops[1].id);
    });

    it("disables Add stop at five stops", () => {
        renderList(stopsWith(A, null, null, null, null, null, C));
        expect(
            screen.getByRole("button", { name: /add stop/i }),
        ).toBeDisabled();
        expect(screen.getByText("5 of 5 stops")).toBeInTheDocument();
    });

    it("removes a stop", async () => {
        const stops = stopsWith(A, null, C);
        const { onStopsChange } = renderList(stops);
        await userEvent.click(
            screen.getByRole("button", { name: "Remove stop 1" }),
        );
        expect(onStopsChange.mock.calls[0][0]).toHaveLength(2);
    });

    it("arms a stop for map picking", async () => {
        const stops = stopsWith(A, null, C);
        const { onArmStop } = renderList(stops);
        await userEvent.click(
            screen.getByRole("button", { name: "Pick stop 1 on map" }),
        );
        expect(onArmStop).toHaveBeenCalledWith(stops[1].id);
    });

    it("reports typed coordinates for the edited stop", async () => {
        const stops = stopsWith(A, null, C);
        const { onStopsChange } = renderList(stops);
        await userEvent.type(
            screen.getByLabelText(/^stop 1$/i),
            "-24.31, 31.06",
        );
        const last: PlannerStop[] = onStopsChange.mock.lastCall![0];
        expect(last[1].point).toEqual({ lat: -24.31, lon: 31.06 });
    });

    it("does not reformat a stop's input when its point is a new object with equal lat/lon", async () => {
        const start = createStop({ lat: -24.3, lon: 31.05 });
        const end = createStop(C);
        const props = {
            armedStopId: null,
            onArmStop: vi.fn(),
            onStopsChange: vi.fn(),
        };
        const { rerender } = render(
            <StopList {...props} stops={[start, end]} />,
        );
        const input = screen.getByLabelText(
            /^start point$/i,
        ) as HTMLInputElement;
        expect(input.value).toBe("-24.30000, 31.05000");

        await userEvent.clear(input);
        await userEvent.type(input, "-24.3, 31.05");
        expect(input.value).toBe("-24.3, 31.05");

        rerender(
            <StopList
                {...props}
                stops={[{ ...start, point: { lat: -24.3, lon: 31.05 } }, end]}
            />,
        );
        expect(input.value).toBe("-24.3, 31.05");
    });

    it("resyncs a stop's input when its point changes externally", () => {
        const start = createStop({ lat: -24.3, lon: 31.05 });
        const end = createStop(C);
        const props = {
            armedStopId: null,
            onArmStop: vi.fn(),
            onStopsChange: vi.fn(),
        };
        const { rerender } = render(
            <StopList {...props} stops={[start, end]} />,
        );
        const input = screen.getByLabelText(
            /^start point$/i,
        ) as HTMLInputElement;

        rerender(
            <StopList
                {...props}
                stops={[{ ...start, point: { lat: -25.1, lon: 32.2 } }, end]}
            />,
        );
        expect(input.value).toBe("-25.10000, 32.20000");
    });
});
