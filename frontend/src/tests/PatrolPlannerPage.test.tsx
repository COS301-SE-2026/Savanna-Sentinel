import { render, screen, waitFor } from "@testing-library/react";
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

vi.mock("maplibre-gl", async () => {
    const { createMapLibreMock } = await import("./mocks/maplibreMock");
    return createMapLibreMock();
});

import maplibregl from "maplibre-gl";
import PatrolPlannerPage from "@/pages/PatrolPlannerPage";
import { Toaster } from "@/components/ui/sonner";
import { riskHandlers, TEST_GRID } from "./mocks/riskHandlers";
import { routeHandlers, ROUTE_REQUEST_ID } from "./mocks/routeHandlers";
import { savedRouteHandlers, SAVED_ROUTE } from "./mocks/savedRouteHandlers";

const server = setupServer(
    ...riskHandlers,
    ...routeHandlers,
    ...savedRouteHandlers,
);
beforeAll(() => server.listen());
afterEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
});
afterAll(() => server.close());

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

    it("saves the selected route and marks its card as saved", async () => {
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
        const data = (source as { data: { geometry: { coordinates: unknown } } })
            .data;
        expect(data.geometry.coordinates).toEqual(
            SAVED_ROUTE.path_geometry.coordinates,
        );
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

        await userEvent.type(
            screen.getByLabelText(/^end point$/i),
            "-24.32, 31.08",
        );
        await userEvent.click(
            screen.getByRole("button", { name: /generate routes/i }),
        );

        expect(await screen.findByText("38 min")).toBeInTheDocument();
        expect(screen.queryByText("55 min")).not.toBeInTheDocument();
    });
});
