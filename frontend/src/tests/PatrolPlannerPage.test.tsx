import { render, screen, waitFor, act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
    beforeAll,
    afterEach,
    afterAll,
    describe,
    it,
    expect,
    vi,
} from "vitest";

const mapRegistry = vi.hoisted(() => ({ instances: [] as unknown[] }));

vi.mock("maplibre-gl", async () => {
    const maplibre = await import("./mocks/maplibreMock");
    class CapturingMap extends maplibre.FakeMap {
        constructor(options: Record<string, unknown>) {
            super(options);
            mapRegistry.instances.push(this);
        }
    }
    const mod = { ...maplibre.createMapLibreMock(), Map: CapturingMap };
    return { ...mod, default: mod };
});

import maplibregl from "maplibre-gl";
import PatrolPlannerPage from "@/pages/PatrolPlannerPage";
import { Toaster } from "@/components/ui/sonner";
import { riskHandlers, TEST_GRID } from "./mocks/riskHandlers";
import { routeHandlers, ROUTE_REQUEST_ID } from "./mocks/routeHandlers";
import { savedRouteHandlers, SAVED_ROUTE } from "./mocks/savedRouteHandlers";
import type { FakeMap } from "./mocks/maplibreMock";
import { useMapStore, initialMapState } from "@/store/mapStore";
import { RISK_LEVEL_COLORS } from "@/lib/mapTokens";

const server = setupServer(
    ...riskHandlers,
    ...routeHandlers,
    ...savedRouteHandlers,
);
beforeAll(() => server.listen());
afterEach(() => {
    server.resetHandlers();
    mapRegistry.instances.length = 0;
    vi.restoreAllMocks();
    useMapStore.setState(initialMapState, true);
});
afterAll(() => server.close());

async function currentMap() {
    await waitFor(() =>
        expect(mapRegistry.instances.length).toBeGreaterThan(0),
    );
    return mapRegistry.instances[0] as FakeMap;
}

async function enterBothPoints() {
    await userEvent.type(
        screen.getByLabelText(/^start point$/i),
        "-24.3, 31.05",
    );
    await userEvent.type(
        screen.getByLabelText(/^end point$/i),
        "-24.32, 31.08",
    );
}

function renderPage() {
    return render(
        <>
            <Toaster />
            <PatrolPlannerPage />
        </>,
    );
}

describe("PatrolPlannerPage", () => {
    it("disables Generate Routes until both points are set", async () => {
        renderPage();
        expect(
            screen.getByRole("button", { name: /generate routes/i }),
        ).toBeDisabled();

        await userEvent.type(
            screen.getByLabelText(/^start point$/i),
            "-24.3, 31.05",
        );
        await userEvent.type(
            screen.getByLabelText(/^end point$/i),
            "-24.32, 31.08",
        );

        await waitFor(() =>
            expect(
                screen.getByRole("button", { name: /generate routes/i }),
            ).toBeEnabled(),
        );
    });

    it("shows route alternative cards after generating", async () => {
        renderPage();
        await userEvent.type(
            screen.getByLabelText(/^start point$/i),
            "-24.3, 31.05",
        );
        await userEvent.type(
            screen.getByLabelText(/^end point$/i),
            "-24.32, 31.08",
        );
        await userEvent.click(
            screen.getByRole("button", { name: /generate routes/i }),
        );

        expect(await screen.findByText("Route A")).toBeInTheDocument();
        expect(screen.getByText("Route B")).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Selected" }),
        ).toBeInTheDocument();
    });

    it("sends the currently displayed risk heatmap with the route request", async () => {
        let requestBody: { risk_by_cell?: Record<string, number> } | null =
            null;
        server.use(
            http.post(
                "http://localhost:8000/v1/routes",
                async ({ request }) => {
                    requestBody = (await request.json()) as {
                        risk_by_cell?: Record<string, number>;
                    };
                    return HttpResponse.json(
                        {
                            job_id: ROUTE_REQUEST_ID,
                            request_id: ROUTE_REQUEST_ID,
                            park_id: "klaserie",
                            status: "queued",
                            queued_at: new Date().toISOString(),
                        },
                        { status: 202 },
                    );
                },
            ),
        );

        renderPage();
        await userEvent.type(
            screen.getByLabelText(/^start point$/i),
            "-24.3, 31.05",
        );
        await userEvent.type(
            screen.getByLabelText(/^end point$/i),
            "-24.32, 31.08",
        );
        await userEvent.click(
            screen.getByRole("button", { name: /generate routes/i }),
        );

        await waitFor(() => expect(requestBody).not.toBeNull());
        const riskByCell = requestBody!.risk_by_cell!;
        const expectedCellIds = TEST_GRID.features.map(
            (f) => f.properties.cell_id,
        );
        expect(Object.keys(riskByCell).sort()).toEqual(expectedCellIds.sort());
        for (const score of Object.values(riskByCell)) {
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(1);
        }
    });

    it("omits max_time and max_fuel from the request when left blank", async () => {
        let requestBody: { max_time?: number; max_fuel?: number } | null = null;
        server.use(
            http.post(
                "http://localhost:8000/v1/routes",
                async ({ request }) => {
                    requestBody = (await request.json()) as {
                        max_time?: number;
                        max_fuel?: number;
                    };
                    return HttpResponse.json(
                        {
                            job_id: ROUTE_REQUEST_ID,
                            request_id: ROUTE_REQUEST_ID,
                            park_id: "klaserie",
                            status: "queued",
                            queued_at: new Date().toISOString(),
                        },
                        { status: 202 },
                    );
                },
            ),
        );

        renderPage();
        await userEvent.type(
            screen.getByLabelText(/^start point$/i),
            "-24.3, 31.05",
        );
        await userEvent.type(
            screen.getByLabelText(/^end point$/i),
            "-24.32, 31.08",
        );
        await userEvent.clear(screen.getByLabelText(/max time/i));
        await userEvent.clear(screen.getByLabelText(/max fuel/i));
        await userEvent.click(
            screen.getByRole("button", { name: /generate routes/i }),
        );

        await waitFor(() => expect(requestBody).not.toBeNull());
        expect(requestBody!.max_time).toBeUndefined();
        expect(requestBody!.max_fuel).toBeUndefined();
    });

    it("tears down cleanly when navigated away from mid-session", async () => {
        const { unmount } = renderPage();
        await userEvent.type(
            screen.getByLabelText(/^start point$/i),
            "-24.3, 31.05",
        );
        await userEvent.type(
            screen.getByLabelText(/^end point$/i),
            "-24.32, 31.08",
        );
        await userEvent.click(
            screen.getByRole("button", { name: /generate routes/i }),
        );
        await screen.findByText("Route A");

        expect(() => unmount()).not.toThrow();
    });

    it("switches the Selected pill when a different card is chosen", async () => {
        renderPage();
        await userEvent.type(
            screen.getByLabelText(/^start point$/i),
            "-24.3, 31.05",
        );
        await userEvent.type(
            screen.getByLabelText(/^end point$/i),
            "-24.32, 31.08",
        );
        await userEvent.click(
            screen.getByRole("button", { name: /generate routes/i }),
        );

        await screen.findByText("Route B");
        await userEvent.click(screen.getByRole("button", { name: "Select" }));

        expect(
            await screen.findAllByRole("button", { name: "Selected" }),
        ).toHaveLength(1);
    });

    it("ignores map clicks until a field is armed", async () => {
        renderPage();
        const map = await currentMap();

        await act(async () => {
            map.fireClick({ lng: 31.05, lat: -24.3 });
        });

        expect(screen.getByLabelText(/^start point$/i)).toHaveValue("");
        expect(screen.getByLabelText(/^end point$/i)).toHaveValue("");
    });

    it("fills the armed field from a map click and disarms it", async () => {
        renderPage();
        const map = await currentMap();

        const pickStart = screen.getByRole("button", {
            name: "Pick start point on map",
        });
        await userEvent.click(pickStart);
        expect(pickStart).toHaveAttribute("aria-pressed", "true");

        await act(async () => {
            map.fireClick({ lng: 31.05, lat: -24.3 });
        });

        expect(screen.getByLabelText(/^start point$/i)).toHaveValue(
            "-24.30000, 31.05000",
        );
        expect(pickStart).toHaveAttribute("aria-pressed", "false");

        await userEvent.click(
            screen.getByRole("button", { name: "Pick end point on map" }),
        );
        await act(async () => {
            map.fireClick({ lng: 31.08, lat: -24.32 });
        });

        expect(screen.getByLabelText(/^end point$/i)).toHaveValue(
            "-24.32000, 31.08000",
        );
        await waitFor(() =>
            expect(
                screen.getByRole("button", { name: /generate routes/i }),
            ).toBeEnabled(),
        );
    });

    it("warns when the risk grid cannot be loaded", async () => {
        server.use(
            http.get("http://localhost:8000/v1/risk/grid", () =>
                HttpResponse.json({ detail: "boom" }, { status: 500 }),
            ),
        );

        renderPage();

        expect(
            await screen.findByText("Could not load risk grid"),
        ).toBeInTheDocument();
    });

    it("shows a dismissible no-data banner when no heatmap has been computed", async () => {
        server.use(
            http.get("http://localhost:8000/v1/risk/heatmap/snapshots", () =>
                HttpResponse.json({ snapshots: [] }),
            ),
        );

        renderPage();

        expect(
            await screen.findByText(/no risk scores available yet/i),
        ).toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));
        expect(
            screen.queryByText(/no risk scores available yet/i),
        ).not.toBeInTheDocument();
    });

    it("warns when route planning cannot be started", async () => {
        server.use(
            http.post("http://localhost:8000/v1/routes", () =>
                HttpResponse.json({ detail: "boom" }, { status: 500 }),
            ),
        );

        renderPage();
        await enterBothPoints();
        await userEvent.click(
            screen.getByRole("button", { name: /generate routes/i }),
        );

        expect(
            await screen.findByText("Could not start route planning"),
        ).toBeInTheDocument();
    });

    it("drops the generated routes once clearing is confirmed", async () => {
        renderPage();
        await enterBothPoints();
        await userEvent.click(
            screen.getByRole("button", { name: /generate routes/i }),
        );
        await screen.findByText("Route A");

        await userEvent.click(
            screen.getByRole("button", { name: /^clear routes$/i }),
        );
        const dialog = await screen.findByRole("dialog");
        await userEvent.click(
            within(dialog).getByRole("button", { name: /^clear routes$/i }),
        );

        await waitFor(() =>
            expect(screen.queryByText("Route A")).not.toBeInTheDocument(),
        );
    });

    it("saves the selected route and marks its card as saved", async () => {
        renderPage();
        await enterBothPoints();
        await userEvent.type(screen.getByLabelText(/max time/i), "120");
        await userEvent.type(screen.getByLabelText(/max fuel/i), "40");
        await userEvent.click(
            screen.getByRole("button", { name: /generate routes/i }),
        );
        await screen.findByText("Route A");

        await userEvent.click(
            screen.getByRole("button", { name: /^save route a/i }),
        );
        await userEvent.click(
            screen.getByRole("button", { name: /^save route$/i }),
        );

        expect(await screen.findByText("Route saved")).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /route a saved/i }),
        ).toBeDisabled();
    });

    it("saves a route successfully when Max Time and Max Fuel are left blank", async () => {
        let requestBody: {
            max_time?: number | null;
            max_fuel?: number | null;
        } | null = null;
        server.use(
            http.post(
                "http://localhost:8000/v1/routes/save",
                async ({ request }) => {
                    requestBody = (await request.json()) as {
                        max_time?: number | null;
                        max_fuel?: number | null;
                    };
                    return HttpResponse.json(SAVED_ROUTE, { status: 201 });
                },
            ),
        );

        renderPage();
        await userEvent.type(
            screen.getByLabelText(/^start point$/i),
            "-24.3, 31.05",
        );
        await userEvent.type(
            screen.getByLabelText(/^end point$/i),
            "-24.32, 31.08",
        );
        await userEvent.click(
            screen.getByRole("button", { name: /generate routes/i }),
        );
        await screen.findByText("Route A");

        expect(
            screen.getByRole("button", { name: /^save route a/i }),
        ).toBeEnabled();
        await userEvent.click(
            screen.getByRole("button", { name: /^save route a/i }),
        );
        await userEvent.click(
            screen.getByRole("button", { name: /^save route$/i }),
        );

        expect(await screen.findByText("Route saved")).toBeInTheDocument();
        await waitFor(() => expect(requestBody).not.toBeNull());
        expect(requestBody!.max_time).toBeNull();
        expect(requestBody!.max_fuel).toBeNull();
    });

    it("shows a critical toast when saving fails", async () => {
        server.use(
            http.post("http://localhost:8000/v1/routes/save", () =>
                HttpResponse.json({ detail: "boom" }, { status: 500 }),
            ),
        );

        renderPage();
        await userEvent.type(
            screen.getByLabelText(/^start point$/i),
            "-24.3, 31.05",
        );
        await userEvent.type(
            screen.getByLabelText(/^end point$/i),
            "-24.32, 31.08",
        );
        await userEvent.type(screen.getByLabelText(/max time/i), "120");
        await userEvent.type(screen.getByLabelText(/max fuel/i), "40");
        await userEvent.click(
            screen.getByRole("button", { name: /generate routes/i }),
        );
        await screen.findByText("Route A");

        await userEvent.click(
            screen.getByRole("button", { name: /^save route a/i }),
        );
        await userEvent.click(
            screen.getByRole("button", { name: /^save route$/i }),
        );

        expect(
            await screen.findByText("Could not save route"),
        ).toBeInTheDocument();
    });

    it("loading a previous route displays it via RouteComparisonView/PatrolRouteLayer", async () => {
        const addSourceSpy = vi.spyOn(maplibregl.Map.prototype, "addSource");

        renderPage();
        await userEvent.click(
            screen.getByRole("button", { name: /load previous/i }),
        );
        const savedRouteButton = await screen.findByRole("button", {
            name: /55 min/i,
        });
        await userEvent.click(savedRouteButton);

        expect(await screen.findByText("Route A")).toBeInTheDocument();
        expect(screen.getByText("55 min")).toBeInTheDocument();
        expect(screen.getByText("22 L")).toBeInTheDocument();

        await waitFor(() => {
            const call = addSourceSpy.mock.calls.find(
                ([id]) => id === "patrol-route-0",
            );
            expect(call).toBeDefined();
        });
        const [, source] = addSourceSpy.mock.calls.find(
            ([id]) => id === "patrol-route-0",
        )!;
        const data = (
            source as { data: { geometry: { coordinates: unknown } } }
        ).data;
        expect(data.geometry.coordinates).toEqual(
            SAVED_ROUTE.path_geometry.coordinates,
        );
    });

    it("loading a saved route shows its historical risk_by_cell on the heatmap, not the live data", async () => {
        renderPage();
        const map = await currentMap();

        await waitFor(() => {
            expect(map.sources["patrol-risk-grid"]).toBeDefined();
        });
        await waitFor(() => {
            const liveData = map.sources["patrol-risk-grid"]
                .data as GeoJSON.FeatureCollection;
            const cell1 = liveData.features.find(
                (f) => (f.properties as { cellId: string }).cellId === "cell-1",
            );

            expect(cell1?.properties?.fillColor).toBe(RISK_LEVEL_COLORS.safe);
        });

        await userEvent.click(
            screen.getByRole("button", { name: /load previous/i }),
        );
        const savedRouteButton = await screen.findByRole("button", {
            name: /55 min/i,
        });
        await userEvent.click(savedRouteButton);

        await waitFor(() => {
            const data = map.sources["patrol-risk-grid"]
                .data as GeoJSON.FeatureCollection;
            const cell1 = data.features.find(
                (f) => (f.properties as { cellId: string }).cellId === "cell-1",
            );
            expect(cell1?.properties?.fillColor).toBe(RISK_LEVEL_COLORS.alert);
        });
    });

    it("generating new routes clears a previously loaded route", async () => {
        renderPage();
        await userEvent.click(
            screen.getByRole("button", { name: /load previous/i }),
        );
        const savedRouteButton = await screen.findByRole("button", {
            name: /55 min/i,
        });
        await userEvent.click(savedRouteButton);
        expect(await screen.findByText("55 min")).toBeInTheDocument();

        await userEvent.click(
            screen.getByRole("button", { name: /generate routes/i }),
        );

        expect(await screen.findByText("38 min")).toBeInTheDocument();
        expect(screen.queryByText("55 min")).not.toBeInTheDocument();
    });

    it("clearing routes removes a previously loaded route", async () => {
        renderPage();
        await userEvent.click(
            screen.getByRole("button", { name: /load previous/i }),
        );
        const savedRouteButton = await screen.findByRole("button", {
            name: /55 min/i,
        });
        await userEvent.click(savedRouteButton);
        expect(await screen.findByText("55 min")).toBeInTheDocument();

        await userEvent.click(
            screen.getByRole("button", { name: /^clear routes$/i }),
        );
        const clearButtons = screen.getAllByRole("button", {
            name: /^clear routes$/i,
        });
        await userEvent.click(clearButtons[clearButtons.length - 1]);

        expect(screen.queryByText("55 min")).not.toBeInTheDocument();
        expect(
            screen.getByText(/generate routes to see alternatives/i),
        ).toBeInTheDocument();
    });
});
