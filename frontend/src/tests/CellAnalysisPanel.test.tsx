import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
    describe,
    it,
    expect,
    vi,
    beforeAll,
    afterEach,
    afterAll,
} from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { CellAnalysisPanel } from "@/components/map/CellAnalysisPanel";
import { useMapStore, initialMapState } from "@/store/mapStore";
import type { HeatmapCell } from "@/services/riskApi";
import {
    TEST_CELL_EXPLAIN,
    TEST_ACTIVE_MODEL,
    TEST_HEATMAP_ID,
} from "./mocks/riskHandlers";

const CELL_1: HeatmapCell = {
    cell_id: "cell-1-uuid",
    cell_ref: "cell-1",
    risk_score: 0.82,
    geometry: { type: "Polygon", coordinates: [[[0, 0]]] },
};

const server = setupServer(
    http.get(
        "http://localhost:8000/v1/risk/heatmap/cells/:cellId/explain",
        () => HttpResponse.json(TEST_CELL_EXPLAIN),
    ),
    http.get("http://localhost:8000/v1/risk/models/active", () =>
        HttpResponse.json(TEST_ACTIVE_MODEL),
    ),
);
beforeAll(() => server.listen());
afterEach(() => {
    server.resetHandlers();
    useMapStore.setState(initialMapState, true);
});
afterAll(() => server.close());

function seedCellRef() {
    useMapStore.setState({
        cellsByRef: new Map([["cell-1", CELL_1]]),
        selectedSnapshotId: TEST_HEATMAP_ID,
    });
}

describe("CellAnalysisPanel", () => {
    it("renders the risk score, cell label, and real factor rows once explain data loads", async () => {
        seedCellRef();
        render(
            <CellAnalysisPanel
                level="critical"
                row={14}
                col={7}
                score={0.82}
                cellRef="cell-1"
                isClosing={false}
                onClose={vi.fn()}
                onClosed={vi.fn()}
            />,
        );

        expect(screen.getByText("Cell 14, 7")).toBeInTheDocument();
        expect(screen.getByText("Risk score: 82%")).toBeInTheDocument();
        expect(screen.getByText("Critical Risk")).toBeInTheDocument();

        expect(await screen.findByText("Nearby incidents")).toBeInTheDocument();
        expect(
            screen.getByRole("progressbar", {
                name: "Nearby incidents confidence",
            }),
        ).toHaveAttribute("aria-valuenow", "60");
    });

    it("identifies the active model by its version number", async () => {
        seedCellRef();
        render(
            <CellAnalysisPanel
                level="critical"
                row={14}
                col={7}
                score={0.82}
                cellRef="cell-1"
                isClosing={false}
                onClose={vi.fn()}
                onClosed={vi.fn()}
            />,
        );

        expect(await screen.findByText("#3")).toBeInTheDocument();
        expect(screen.queryByText("model-test-1")).not.toBeInTheDocument();
    });

    it("shows placeholder model metadata when no active model is available", async () => {
        server.use(
            http.get("http://localhost:8000/v1/risk/models/active", () =>
                HttpResponse.json({ detail: "not found" }, { status: 500 }),
            ),
        );
        seedCellRef();
        render(
            <CellAnalysisPanel
                level="safe"
                row={1}
                col={2}
                score={0.1}
                cellRef="cell-1"
                isClosing={false}
                onClose={vi.fn()}
                onClosed={vi.fn()}
            />,
        );

        await waitFor(() =>
            expect(screen.getAllByText("Not available yet")).toHaveLength(2),
        );
    });

    it("calls onClose from both the header close button and the footer button", async () => {
        seedCellRef();
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(
            <CellAnalysisPanel
                level="safe"
                row={1}
                col={2}
                score={0.1}
                cellRef="cell-1"
                isClosing={false}
                onClose={onClose}
                onClosed={vi.fn()}
            />,
        );

        await user.click(
            screen.getByRole("button", { name: "Close analysis" }),
        );
        await user.click(
            screen.getByRole("button", { name: "Close Analysis" }),
        );
        expect(onClose).toHaveBeenCalledTimes(2);
    });

    it("shows a stale-snapshot message instead of factor bars when the cached explanation belongs to a different heatmap", async () => {
        useMapStore.setState({
            cellsByRef: new Map([["cell-1", CELL_1]]),
            selectedSnapshotId: "heatmap-different-snapshot",
        });
        render(
            <CellAnalysisPanel
                level="critical"
                row={14}
                col={7}
                score={0.82}
                cellRef="cell-1"
                isClosing={false}
                onClose={vi.fn()}
                onClosed={vi.fn()}
            />,
        );

        expect(
            await screen.findByText(
                "Explanation available for the latest snapshot only.",
            ),
        ).toBeInTheDocument();
        expect(screen.queryByText("Nearby incidents")).not.toBeInTheDocument();
    });

    it("calls onClosed after the close animation once isClosing is true", () => {
        vi.useFakeTimers();
        seedCellRef();
        const onClosed = vi.fn();
        const { rerender } = render(
            <CellAnalysisPanel
                level="safe"
                row={1}
                col={2}
                score={0.1}
                cellRef="cell-1"
                isClosing={false}
                onClose={vi.fn()}
                onClosed={onClosed}
            />,
        );

        rerender(
            <CellAnalysisPanel
                level="safe"
                row={1}
                col={2}
                score={0.1}
                cellRef="cell-1"
                isClosing
                onClose={vi.fn()}
                onClosed={onClosed}
            />,
        );

        expect(onClosed).not.toHaveBeenCalled();
        vi.advanceTimersByTime(250);
        expect(onClosed).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
    });
});
