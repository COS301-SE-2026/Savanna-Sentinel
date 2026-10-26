import { render, screen } from "@testing-library/react";
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

import { CellPopupContent } from "@/components/map/CellPopupContent";
import { useMapStore, initialMapState } from "@/store/mapStore";
import type { CellExplainResponse, HeatmapCell } from "@/services/riskApi";
import { TEST_CELL_EXPLAIN } from "./mocks/riskHandlers";

const CELL_1: HeatmapCell = {
    cell_id: "cell-1-uuid",
    cell_ref: "cell-1",
    risk_score: 0.82,
    geometry: { type: "Polygon", coordinates: [[[0, 0]]] },
};

const EXPLAIN_URL =
    "http://localhost:8000/v1/risk/heatmap/cells/:cellId/explain";

const server = setupServer(
    http.get(EXPLAIN_URL, () => HttpResponse.json(TEST_CELL_EXPLAIN)),
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
    });
}

function renderPopup(canViewAnalysis = true) {
    return render(
        <CellPopupContent
            level="critical"
            row={14}
            col={7}
            cellRef="cell-1"
            canViewAnalysis={canViewAnalysis}
            onClose={vi.fn()}
            onViewAnalysis={vi.fn()}
        />,
    );
}

describe("CellPopupContent", () => {
    it("summarises incidents by type, most frequent first, without pluralising", async () => {
        seedCellRef();
        renderPopup();

        expect(
            await screen.findByText("2 Poaching Sign, 1 Snare"),
        ).toBeInTheDocument();
    });

    it("summarises sightings by species with total animal counts", async () => {
        seedCellRef();
        renderPopup();

        expect(
            await screen.findByText("3 Lion, 1 Elephant"),
        ).toBeInTheDocument();
    });

    it("shows at most the three highest contributors per summary", async () => {
        seedCellRef();
        const explain: CellExplainResponse = {
            ...TEST_CELL_EXPLAIN,
            self_incidents: [
                {
                    incident_type: "snare",
                    occurred_at: "2026-08-18T09:00:00Z",
                    severity: "high",
                },
                {
                    incident_type: "snare",
                    occurred_at: "2026-08-17T09:00:00Z",
                    severity: "high",
                },
                {
                    incident_type: "snare",
                    occurred_at: "2026-08-16T09:00:00Z",
                    severity: "high",
                },
                {
                    incident_type: "trap",
                    occurred_at: "2026-08-15T09:00:00Z",
                    severity: "low",
                },
                {
                    incident_type: "gunshot",
                    occurred_at: "2026-08-14T09:00:00Z",
                    severity: "high",
                },
            ],
            neighbor_incidents: [
                {
                    incident_type: "poaching_sign",
                    occurred_at: "2026-08-10T09:00:00Z",
                    severity: "medium",
                },
                {
                    incident_type: "poaching_sign",
                    occurred_at: "2026-08-09T09:00:00Z",
                    severity: "medium",
                },
                {
                    incident_type: "vehicle",
                    occurred_at: "2026-08-08T09:00:00Z",
                    severity: "low",
                },
            ],
            self_sightings: [],
            neighbor_sightings: [],
        };
        server.use(http.get(EXPLAIN_URL, () => HttpResponse.json(explain)));

        renderPopup();

        expect(
            await screen.findByText("3 Snare, 2 Poaching Sign, 1 Trap"),
        ).toBeInTheDocument();
        expect(screen.queryByText(/Gunshot/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Vehicle/)).not.toBeInTheDocument();
    });

    describe("terrain rules line", () => {
        function renderWithExplain(overrides: Partial<CellExplainResponse>) {
            server.use(
                http.get(EXPLAIN_URL, () =>
                    HttpResponse.json({ ...TEST_CELL_EXPLAIN, ...overrides }),
                ),
            );
            seedCellRef();
            renderPopup();
        }

        it("shows how many points terrain rules raised the score", async () => {
            renderWithExplain({ terrain_delta: 0.12 });

            expect(
                await screen.findByText("Raised score by 12 pts"),
            ).toBeInTheDocument();
            expect(screen.getByText(/Terrain rules:/)).toBeInTheDocument();
        });

        it("shows how many points terrain rules lowered the score", async () => {
            renderWithExplain({ terrain_delta: -0.08 });

            expect(
                await screen.findByText("Lowered score by 8 pts"),
            ).toBeInTheDocument();
        });

        it("shows terrain rules even when the cell has no incidents or sightings", async () => {
            renderWithExplain({
                terrain_delta: 0.2,
                self_incidents: [],
                neighbor_incidents: [],
                self_sightings: [],
                neighbor_sightings: [],
            });

            expect(
                await screen.findByText("Raised score by 20 pts"),
            ).toBeInTheDocument();
        });

        it("hides the line when terrain rules made no visible change", async () => {
            renderWithExplain({ terrain_delta: 0.004 });

            await screen.findByText("3 Lion, 1 Elephant");
            expect(
                screen.queryByText(/Terrain rules:/),
            ).not.toBeInTheDocument();
        });
    });

    it("does not show or fetch a summary without analysis permission", () => {
        renderPopup(false);

        expect(screen.queryByText(/Poaching Sign/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Lion/)).not.toBeInTheDocument();
        expect(useMapStore.getState().explainByCellRef.size).toBe(0);
    });
});
