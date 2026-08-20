import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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
import MapPage from "@/pages/MapPage";
import { Toaster } from "@/components/ui/sonner";
import { riskHandlers } from "./mocks/riskHandlers";
import type { FakeMap } from "./mocks/maplibreMock";

const server = setupServer(...riskHandlers);
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
            <MapPage />
        </>,
    );
}

describe("MapPage", () => {
    it("loads the risk grid and renders the heatmap fill and outline layers", async () => {
        const addLayerSpy = vi.spyOn(maplibregl.Map.prototype, "addLayer");
        renderPage();

        await waitFor(() => {
            const ids = addLayerSpy.mock.calls.map(
                ([layer]) => (layer as { id: string }).id,
            );
            expect(ids).toContain("patrol-risk-grid-fill");
            expect(ids).toContain("patrol-risk-grid-outline");
        });
    });

    it("shows a loading pill while the grid is loading, then hides it", async () => {
        renderPage();
        expect(screen.getByText(/loading/i)).toBeInTheDocument();
        await waitFor(() =>
            expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
        );
    });

    it("shows a critical toast when the risk grid fails to load", async () => {
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

    it("shows the full risk legend expanded by default on desktop", async () => {
        renderPage();
        expect(
            screen.getByRole("button", { name: /collapse risk legend/i }),
        ).toBeInTheDocument();
        expect(screen.getByText("Critical")).toBeInTheDocument();
    });

    it("removes the heatmap layer from the map when Risk Heatmap is unchecked", async () => {
        const addLayerSpy = vi.spyOn(maplibregl.Map.prototype, "addLayer");
        const removeLayerSpy = vi.spyOn(
            maplibregl.Map.prototype,
            "removeLayer",
        );
        renderPage();
        await waitFor(() => {
            const ids = addLayerSpy.mock.calls.map(
                ([layer]) => (layer as { id: string }).id,
            );
            expect(ids).toContain("patrol-risk-grid-fill");
        });

        await userEvent.click(
            screen.getByRole("checkbox", { name: /risk heatmap/i }),
        );

        await waitFor(() => {
            expect(removeLayerSpy).toHaveBeenCalledWith(
                "patrol-risk-grid-fill",
            );
            expect(removeLayerSpy).toHaveBeenCalledWith(
                "patrol-risk-grid-outline",
            );
        });
    });

    it("flows the opacity slider through to the rendered heatmap source data", async () => {
        const addSourceSpy = vi.spyOn(maplibregl.Map.prototype, "addSource");
        renderPage();
        await waitFor(() => expect(addSourceSpy).toHaveBeenCalled());
        const map = addSourceSpy.mock.instances[0] as unknown as FakeMap;

        fireEvent.change(screen.getByLabelText(/heatmap opacity/i), {
            target: { value: "100" },
        });

        await waitFor(() => {
            const data = map.getSource("patrol-risk-grid").data as {
                features: { properties: { fillOpacity: number } }[];
            };
            expect(data.features.length).toBeGreaterThan(0);
            for (const feature of data.features) {
                expect([1, 0.15]).toContain(feature.properties.fillOpacity);
            }
        });
    });

    it("tears down cleanly on unmount", async () => {
        const addLayerSpy = vi.spyOn(maplibregl.Map.prototype, "addLayer");
        const { unmount } = renderPage();
        await waitFor(() => {
            const ids = addLayerSpy.mock.calls.map(
                ([layer]) => (layer as { id: string }).id,
            );
            expect(ids).toContain("patrol-risk-grid-fill");
        });
        expect(() => unmount()).not.toThrow();
    });
});
