import {
    render,
    screen,
    waitFor,
    fireEvent,
    within,
    act,
} from "@testing-library/react";
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

import * as maplibregl from "maplibre-gl";
import MapPage from "@/pages/MapPage";
import { Toaster } from "@/components/ui/sonner";
import { riskHandlers } from "./mocks/riskHandlers";
import { useMapStore, initialMapState } from "@/store/mapStore";
import type { FakeMap } from "./mocks/maplibreMock";

const server = setupServer(...riskHandlers);
beforeAll(() => server.listen());
afterEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
    useMapStore.setState(initialMapState, true);
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

    it("keeps the map centered on the park, not a placeholder point, when the grid fails to load", async () => {
        server.use(
            http.get("http://localhost:8000/v1/risk/grid", () =>
                HttpResponse.json({ detail: "boom" }, { status: 500 }),
            ),
        );
        const onSpy = vi.spyOn(maplibregl.Map.prototype, "on");
        renderPage();
        await screen.findByText("Could not load risk grid");

        const map = onSpy.mock.instances[0] as unknown as FakeMap;
        expect(map.options.center).toEqual([31.18, -24.2]);
    });

    it("shows a no-data banner and still renders the grid when no heatmap has been computed", async () => {
        server.use(
            http.get("http://localhost:8000/v1/risk/heatmap/snapshots", () =>
                HttpResponse.json({ snapshots: [] }),
            ),
        );
        const addLayerSpy = vi.spyOn(maplibregl.Map.prototype, "addLayer");
        renderPage();

        expect(
            await screen.findByText(/no risk scores available yet/i),
        ).toBeInTheDocument();
        await waitFor(() => {
            const ids = addLayerSpy.mock.calls.map(
                ([layer]) => (layer as { id: string }).id,
            );
            expect(ids).toContain("patrol-risk-grid-fill");
        });
    });

    it("dismisses the no-data banner when its close button is clicked", async () => {
        server.use(
            http.get("http://localhost:8000/v1/risk/heatmap/snapshots", () =>
                HttpResponse.json({ snapshots: [] }),
            ),
        );
        renderPage();

        await screen.findByText(/no risk scores available yet/i);
        await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));

        expect(
            screen.queryByText(/no risk scores available yet/i),
        ).not.toBeInTheDocument();
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

    it("does not ask for location until the My Location layer is switched on", async () => {
        const watchPosition = vi.fn(() => 1);
        Object.defineProperty(window.navigator, "geolocation", {
            configurable: true,
            value: { watchPosition, clearWatch: vi.fn() },
        });

        renderPage();
        const toggle = await screen.findByRole("checkbox", {
            name: /my location/i,
        });
        expect(toggle).not.toBeChecked();
        expect(watchPosition).not.toHaveBeenCalled();

        await userEvent.click(toggle);

        await waitFor(() => expect(watchPosition).toHaveBeenCalledTimes(1));

        Object.defineProperty(window.navigator, "geolocation", {
            configurable: true,
            value: undefined,
        });
    });

    it("puts a location marker on the map once a fix arrives on an enabled layer", async () => {
        let emit: ((p: GeolocationPosition) => void) | null = null;
        Object.defineProperty(window.navigator, "geolocation", {
            configurable: true,
            value: {
                watchPosition: vi.fn((success) => {
                    emit = success;
                    return 1;
                }),
                clearWatch: vi.fn(),
            },
        });

        const addSourceSpy = vi.spyOn(maplibregl.Map.prototype, "addSource");
        renderPage();
        await waitFor(() => expect(addSourceSpy).toHaveBeenCalled());
        const map = addSourceSpy.mock.instances[0] as unknown as FakeMap;
        expect(map.markers.size).toBe(0);

        await userEvent.click(
            await screen.findByRole("checkbox", { name: /my location/i }),
        );
        act(() =>
            emit?.({
                coords: {
                    latitude: -24.3,
                    longitude: 31.05,
                    heading: 45,
                    accuracy: 10,
                    altitude: null,
                    altitudeAccuracy: null,
                    speed: null,
                },
                timestamp: Date.now(),
            } as GeolocationPosition),
        );

        await waitFor(() => expect(map.markers.size).toBe(1));
        const puck = [...map.markers][0].element;
        expect(
            within(puck).getByRole("img", { name: /your current location/i }),
        ).toBeTruthy();

        Object.defineProperty(window.navigator, "geolocation", {
            configurable: true,
            value: undefined,
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
