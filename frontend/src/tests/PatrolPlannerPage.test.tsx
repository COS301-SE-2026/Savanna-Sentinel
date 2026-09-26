import { render, screen, waitFor, act, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
    beforeEach,
    beforeAll,
    afterEach,
    afterAll,
    describe,
    it,
    expect,
    vi,
} from "vitest";

const mapRegistry = vi.hoisted(() => ({ instances: [] as unknown[] }));

vi.mock("../hooks/useUserLocation", () => ({
    useUserLocation: vi.fn((enabled: boolean) => ({
        location: enabled ? { lat: -24.3, lng: 31.05 } : null,
        status: enabled ? "ACTIVE" : "IDLE",
    })),
}));

vi.mock("../components/map/UserLocationLayer", () => ({
    UserLocationLayer: () => <div data-testid="user-location-layer" />,
}));
vi.mock("../components/map/UserLocationNotice", () => ({
    UserLocationNotice: ({ status }: { status: string }) => (
        <div data-testid="user-location-notice">Status: {status}</div>
    ),
}));

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

import * as maplibregl from "maplibre-gl";
import PatrolPlannerPage from "@/pages/PatrolPlannerPage";
import { Toaster } from "@/components/ui/sonner";
import { riskHandlers, TEST_GRID } from "./mocks/riskHandlers";
import { routeHandlers, ROUTE_REQUEST_ID } from "./mocks/routeHandlers";
import { savedRouteHandlers, SAVED_ROUTE } from "./mocks/savedRouteHandlers";
import type { FakeMap } from "./mocks/maplibreMock";
import { useMapStore, initialMapState } from "@/store/mapStore";
import { useAuthStore } from "@/store/authStore";
import { loadPinnedRoute } from "@/offline/pinnedRouteCache";
import { db } from "@/offline/db";
import { RISK_LEVEL_COLORS } from "@/lib/mapTokens";

const server = setupServer(
    ...riskHandlers,
    ...routeHandlers,
    ...savedRouteHandlers,
);
beforeAll(() => server.listen());
afterEach(async () => {
    server.resetHandlers();
    mapRegistry.instances.length = 0;
    vi.restoreAllMocks();
    useMapStore.setState(initialMapState, true);
    await db.cache.clear();
    useAuthStore.setState({
        user: null,
        accessToken: null,
        refreshToken: null,
    });
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
        <MemoryRouter initialEntries={["/patrol"]}>
            <Toaster />
            <Routes>
                <Route path="/patrol" element={<PatrolPlannerPage />} />
                <Route path="/map" element={<div>heatmap page</div>} />
            </Routes>
        </MemoryRouter>,
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
            name: /55\.0 km/i,
        });
        await userEvent.click(savedRouteButton);

        expect(await screen.findByText("Route A")).toBeInTheDocument();
        expect(screen.getByText("55.0 km")).toBeInTheDocument();

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

    it("sending a saved route to the heatmap stores it and navigates there", async () => {
        useAuthStore.setState({
            user: { id: "u1", username: "tester", role: "ranger" },
            accessToken: "token",
            refreshToken: "refresh",
        });

        renderPage();
        await userEvent.click(
            screen.getByRole("button", { name: /load previous/i }),
        );
        await userEvent.click(
            await screen.findByRole("button", {
                name: /show saved route on heatmap/i,
            }),
        );

        expect(await screen.findByText("heatmap page")).toBeInTheDocument();
        expect(await loadPinnedRoute("u1")).toEqual(SAVED_ROUTE);
    });

    it("warns instead of navigating when there is no account to store the route against", async () => {
        renderPage();
        await userEvent.click(
            screen.getByRole("button", { name: /load previous/i }),
        );
        await userEvent.click(
            await screen.findByRole("button", {
                name: /show saved route on heatmap/i,
            }),
        );

        expect(
            await screen.findByText(/could not send the route to the heatmap/i),
        ).toBeInTheDocument();
        expect(screen.queryByText("heatmap page")).not.toBeInTheDocument();
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
            name: /55\.0 km/i,
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
            name: /55\.0 km/i,
        });
        await userEvent.click(savedRouteButton);
        expect(await screen.findByText("55.0 km")).toBeInTheDocument();

        await userEvent.click(
            screen.getByRole("button", { name: /generate routes/i }),
        );

        expect(await screen.findByText("38.0 km")).toBeInTheDocument();
        expect(screen.queryByText("55.0 km")).not.toBeInTheDocument();
    });

    it("clearing routes removes a previously loaded route", async () => {
        renderPage();
        await userEvent.click(
            screen.getByRole("button", { name: /load previous/i }),
        );
        const savedRouteButton = await screen.findByRole("button", {
            name: /55\.0 km/i,
        });
        await userEvent.click(savedRouteButton);
        expect(await screen.findByText("55.0 km")).toBeInTheDocument();

        await userEvent.click(
            screen.getByRole("button", { name: /^clear routes$/i }),
        );
        const clearButtons = screen.getAllByRole("button", {
            name: /^clear routes$/i,
        });
        await userEvent.click(clearButtons[clearButtons.length - 1]);

        expect(screen.queryByText("55.0 km")).not.toBeInTheDocument();
        expect(
            screen.getByText(/generate routes to see alternatives/i),
        ).toBeInTheDocument();
    });
});

describe("Location Handling", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("renders my location unchecked by default without rendering the location layer", async () => {
        renderPage();

        const checkbox = screen.getByRole("checkbox", { name: /my location/i });
        expect(checkbox).not.toBeChecked();

        expect(
            screen.queryByTestId("user-location-layer"),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByTestId("user-location-notice"),
        ).not.toBeInTheDocument();
    });

    it("renders location layer when my location is checked", async () => {
        renderPage();

        const checkbox = screen.getByRole("checkbox", { name: /my location/i });
        await userEvent.click(checkbox);

        expect(checkbox).toBeChecked();
        expect(screen.getByTestId("user-location-layer")).toBeInTheDocument();
        expect(screen.getByTestId("user-location-notice")).toBeInTheDocument();
        expect(screen.getByText("Status: ACTIVE")).toBeInTheDocument();
    });

    it("removes location layer and notice when toggled off", async () => {
        renderPage();

        const checkbox = screen.getByRole("checkbox", { name: /my location/i });
        await userEvent.click(checkbox);
        expect(screen.getByTestId("user-location-layer")).toBeInTheDocument();

        await userEvent.click(checkbox);
        expect(checkbox).not.toBeChecked();

        expect(
            screen.queryByTestId("user-location-layer"),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByTestId("user-location-notice"),
        ).not.toBeInTheDocument();
    });

    it("requests DeviceMotionEvent permission iOS devices", async () => {
        const mockRequestPermission = vi.fn().mockResolvedValue("granted");

        vi.stubGlobal("DeviceMotionEvent", {
            requestPermission: mockRequestPermission,
        });

        renderPage();

        const checkbox = screen.getByRole("checkbox", { name: /my location/i });
        await userEvent.click(checkbox);

        expect(mockRequestPermission).toHaveBeenCalledTimes(1);
        expect(checkbox).toBeChecked();
        expect(screen.getByTestId("user-location-layer")).toBeInTheDocument();
    });

    it("does not trigger motion permission request when unchecking location", async () => {
        const mockRequestPermission = vi.fn().mockResolvedValue("granted");

        vi.stubGlobal("DeviceMotionEvent", {
            requestPermission: mockRequestPermission,
        });

        renderPage();

        const checkbox = screen.getByRole("checkbox", { name: /my location/i });
        await userEvent.click(checkbox);
        expect(mockRequestPermission).toHaveBeenCalledTimes(1);

        await userEvent.click(checkbox);
        expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    });

    it("sends added stops as ordered waypoints", async () => {
        let requestBody: { waypoints?: { coordinates: number[] }[] } | null =
            null;
        server.use(
            http.post(
                "http://localhost:8000/v1/routes",
                async ({ request }) => {
                    requestBody = (await request.json()) as {
                        waypoints?: { coordinates: number[] }[];
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
        await enterBothPoints();
        await userEvent.click(
            screen.getByRole("button", { name: /add stop/i }),
        );
        await userEvent.type(
            screen.getByLabelText(/^stop 1$/i),
            "-24.31, 31.06",
        );
        await userEvent.click(
            screen.getByRole("button", { name: /generate routes/i }),
        );

        await waitFor(() => expect(requestBody).not.toBeNull());
        expect(requestBody!.waypoints!.map((p) => p.coordinates)).toEqual([
            [31.06, -24.31],
        ]);
    });

    it("keeps Generate Routes disabled while a stop is empty", async () => {
        renderPage();
        await enterBothPoints();
        await userEvent.click(
            screen.getByRole("button", { name: /add stop/i }),
        );
        expect(
            screen.getByRole("button", { name: /generate routes/i }),
        ).toBeDisabled();
        expect(
            screen.getByText(/set stop 1 or remove it/i),
        ).toBeInTheDocument();
    });

    it("fills an armed stop from a map click", async () => {
        renderPage();
        const map = await currentMap();
        await userEvent.click(
            screen.getByRole("button", { name: /add stop/i }),
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Pick stop 1 on map" }),
        );
        await act(async () => {
            map.fireClick({ lng: 31.06, lat: -24.31 });
        });
        expect(screen.getByLabelText(/^stop 1$/i)).toHaveValue(
            "-24.31000, 31.06000",
        );
    });

    it("restores a saved route's stops when it is loaded", async () => {
        renderPage();
        await userEvent.click(
            screen.getByRole("button", { name: /load previous/i }),
        );
        await userEvent.click(
            await screen.findByRole("button", { name: /55\.0 km/i }),
        );

        expect(await screen.findByLabelText(/^stop 1$/i)).toHaveValue(
            "-24.31000, 31.06000",
        );
        expect(screen.getByLabelText(/^start point$/i)).toHaveValue(
            "-24.30000, 31.05000",
        );
        expect(screen.getByLabelText(/^end point$/i)).toHaveValue(
            "-24.32000, 31.08000",
        );
    });

    it("saves the stops that were planned, not later edits", async () => {
        let saveBody: { waypoints?: { coordinates: number[] }[] } | null = null;
        server.use(
            http.post(
                "http://localhost:8000/v1/routes/save",
                async ({ request }) => {
                    saveBody = (await request.json()) as {
                        waypoints?: { coordinates: number[] }[];
                    };
                    return HttpResponse.json(SAVED_ROUTE, { status: 201 });
                },
            ),
        );

        renderPage();
        await enterBothPoints();
        await userEvent.click(
            screen.getByRole("button", { name: /add stop/i }),
        );
        await userEvent.type(
            screen.getByLabelText(/^stop 1$/i),
            "-24.31, 31.06",
        );
        await userEvent.click(
            screen.getByRole("button", { name: /generate routes/i }),
        );
        await screen.findByText("Route A");

        const stop = screen.getByLabelText(/^stop 1$/i);
        await userEvent.clear(stop);
        await userEvent.type(stop, "-24.4, 31.2");

        await userEvent.click(
            screen.getByRole("button", { name: /^save route a/i }),
        );
        await userEvent.click(
            screen.getByRole("button", { name: /^save route$/i }),
        );

        await waitFor(() => expect(saveBody).not.toBeNull());
        expect(saveBody!.waypoints!.map((p) => p.coordinates)).toEqual([
            [31.06, -24.31],
        ]);
    });
});
