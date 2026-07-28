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

import PatrolPlannerPage from "@/pages/PatrolPlannerPage";
import { Toaster } from "@/components/ui/sonner";
import { riskHandlers, TEST_GRID } from "./mocks/riskHandlers";
import { routeHandlers, ROUTE_REQUEST_ID } from "./mocks/routeHandlers";

const server = setupServer(...riskHandlers, ...routeHandlers);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
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
});
