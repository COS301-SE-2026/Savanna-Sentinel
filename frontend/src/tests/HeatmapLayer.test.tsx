import { render, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
    describe,
    it,
    expect,
    vi,
    afterEach,
    beforeAll,
    afterAll,
} from "vitest";

vi.mock("maplibre-gl", async () => {
    const { createMapLibreMock } = await import("./mocks/maplibreMock");
    return createMapLibreMock();
});

import maplibregl from "maplibre-gl";
import { HeatmapLayer } from "@/components/map/HeatmapLayer";
import { TEST_GRID } from "./mocks/riskHandlers";
import type { FakeMap } from "./mocks/maplibreMock";
import { useAuthStore } from "@/store/authStore";
import { useMapStore, initialMapState } from "@/store/mapStore";
import {
    TEST_CELL_EXPLAIN,
    TEST_ACTIVE_MODEL,
    TEST_HEATMAP,
    TEST_HEATMAP_ID,
} from "./mocks/riskHandlers";

import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

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
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function makeRiskByCell(score: number) {
    return new Map(
        TEST_GRID.features.map((f) => [f.properties.cell_id, score]),
    );
}

describe("HeatmapLayer", () => {
    afterEach(() => {
        useMapStore.setState(initialMapState, true);
        useAuthStore.setState({
            user: null,
            accessToken: null,
            refreshToken: null,
        });

        vi.restoreAllMocks();
    });

    function seedRole(role: string) {
        useAuthStore.setState({
            user: { id: "u1", username: "tester", role },
            accessToken: "token",
            refreshToken: "refresh",
        });
    }

    it("adds a geojson source and fill layer once map and grid are available", async () => {
        const map = new maplibregl.Map({
            container: document.createElement("div"),
        }) as unknown as FakeMap;
        render(
            <HeatmapLayer
                map={map as never}
                grid={TEST_GRID}
                riskByCell={makeRiskByCell(0.1)}
                pickingActive={false}
                isMobile={false}
            />,
        );
        await waitFor(() =>
            expect(map.getSource("patrol-risk-grid")).toBeDefined(),
        );
        expect(map.getLayer("patrol-risk-grid-fill")).toBeDefined();
    });

    it("adds a cell border outline layer alongside the fill layer", async () => {
        const map = new maplibregl.Map({
            container: document.createElement("div"),
        }) as unknown as FakeMap;
        const { unmount } = render(
            <HeatmapLayer
                map={map as never}
                grid={TEST_GRID}
                riskByCell={makeRiskByCell(0.1)}
                pickingActive={false}
                isMobile={false}
            />,
        );
        await waitFor(() =>
            expect(map.getLayer("patrol-risk-grid-outline")).toBeDefined(),
        );

        unmount();
        expect(map.getLayer("patrol-risk-grid-outline")).toBeUndefined();
        expect(map.getLayer("patrol-risk-grid-fill")).toBeUndefined();
    });

    it("bakes opacityOverride into the initial source data instead of the page default", async () => {
        const map = new maplibregl.Map({
            container: document.createElement("div"),
        }) as unknown as FakeMap;
        render(
            <HeatmapLayer
                map={map as never}
                grid={TEST_GRID}
                riskByCell={makeRiskByCell(0.1)}
                pickingActive={false}
                isMobile={false}
                opacityOverride={0.05}
            />,
        );
        await waitFor(() =>
            expect(map.getSource("patrol-risk-grid")).toBeDefined(),
        );
        const data = map.getSource("patrol-risk-grid").data as {
            features: { properties: { fillOpacity: number } }[];
        };
        for (const feature of data.features) {
            expect(feature.properties.fillOpacity).toBe(0.05);
        }
    });

    it("refreshes source data via setData when opacityOverride changes", async () => {
        const map = new maplibregl.Map({
            container: document.createElement("div"),
        }) as unknown as FakeMap;
        const { rerender } = render(
            <HeatmapLayer
                map={map as never}
                grid={TEST_GRID}
                riskByCell={makeRiskByCell(0.1)}
                pickingActive={false}
                isMobile={false}
                opacityOverride={0.05}
            />,
        );
        await waitFor(() =>
            expect(map.getSource("patrol-risk-grid")).toBeDefined(),
        );

        rerender(
            <HeatmapLayer
                map={map as never}
                grid={TEST_GRID}
                riskByCell={makeRiskByCell(0.1)}
                pickingActive={false}
                isMobile={false}
                opacityOverride={1}
            />,
        );

        await waitFor(() => {
            const data = map.getSource("patrol-risk-grid").data as {
                features: { properties: { fillOpacity: number } }[];
            };
            expect(data.features[0].properties.fillOpacity).toBe(0.15);
        });
    });

    it("updates source data via setData when riskByCell changes", async () => {
        const map = new maplibregl.Map({
            container: document.createElement("div"),
        }) as unknown as FakeMap;
        const { rerender } = render(
            <HeatmapLayer
                map={map as never}
                grid={TEST_GRID}
                riskByCell={makeRiskByCell(0.1)}
                pickingActive={false}
                isMobile={false}
            />,
        );
        await waitFor(() =>
            expect(map.getSource("patrol-risk-grid")).toBeDefined(),
        );
        const setDataSpy = map.getSource("patrol-risk-grid").setData;

        rerender(
            <HeatmapLayer
                map={map as never}
                grid={TEST_GRID}
                riskByCell={makeRiskByCell(0.9)}
                pickingActive={false}
                isMobile={false}
            />,
        );
        await waitFor(() => expect(setDataSpy).toHaveBeenCalled());
    });

    it("does not open a popup on cell click while picking is active", async () => {
        const map = new maplibregl.Map({
            container: document.createElement("div"),
        }) as unknown as FakeMap;
        render(
            <HeatmapLayer
                map={map as never}
                grid={TEST_GRID}
                riskByCell={makeRiskByCell(0.1)}
                pickingActive
                isMobile={false}
            />,
        );
        await waitFor(() =>
            expect(map.getLayer("patrol-risk-grid-fill")).toBeDefined(),
        );

        map.queryRenderedFeaturesResult = [
            { properties: { cellId: "cell-1" } },
        ];
        const addToSpy = vi.spyOn(maplibregl.Popup.prototype, "addTo");
        map.fireClick({ lng: 31.005, lat: -24.305 });
        expect(addToSpy).not.toHaveBeenCalled();
    });

    it("opens a popup on cell click when picking is not active", async () => {
        const map = new maplibregl.Map({
            container: document.createElement("div"),
        }) as unknown as FakeMap;
        render(
            <HeatmapLayer
                map={map as never}
                grid={TEST_GRID}
                riskByCell={makeRiskByCell(0.1)}
                pickingActive={false}
                isMobile={false}
            />,
        );
        await waitFor(() =>
            expect(map.getLayer("patrol-risk-grid-fill")).toBeDefined(),
        );

        map.queryRenderedFeaturesResult = [
            { properties: { cellId: "cell-1" } },
        ];
        const addToSpy = vi.spyOn(maplibregl.Popup.prototype, "addTo");
        map.fireClick({ lng: 31.005, lat: -24.305 });
        await waitFor(() => expect(addToSpy).toHaveBeenCalled());
    });

    it("closes the popup when a click misses every cell", async () => {
        const map = new maplibregl.Map({
            container: document.createElement("div"),
        }) as unknown as FakeMap;
        render(
            <HeatmapLayer
                map={map as never}
                grid={TEST_GRID}
                riskByCell={makeRiskByCell(0.1)}
                pickingActive={false}
                isMobile={false}
            />,
        );
        await waitFor(() =>
            expect(map.getLayer("patrol-risk-grid-fill")).toBeDefined(),
        );

        map.queryRenderedFeaturesResult = [
            { properties: { cellId: "cell-1" } },
        ];
        const addToSpy = vi.spyOn(maplibregl.Popup.prototype, "addTo");
        map.fireClick({ lng: 31.005, lat: -24.305 });
        await waitFor(() => expect(addToSpy).toHaveBeenCalled());

        const removeSpy = vi.spyOn(maplibregl.Popup.prototype, "remove");
        map.queryRenderedFeaturesResult = [];
        map.fireClick({ lng: 40, lat: -40 });
        await waitFor(() => expect(removeSpy).toHaveBeenCalled());
    });

    it("does not show a View Analysis button for a ranger", async () => {
        seedRole("ranger");
        const map = new maplibregl.Map({
            container: document.createElement("div"),
        }) as unknown as FakeMap;
        render(
            <HeatmapLayer
                map={map as never}
                grid={TEST_GRID}
                riskByCell={makeRiskByCell(0.1)}
                pickingActive={false}
                isMobile
            />,
        );
        await waitFor(() =>
            expect(map.getLayer("patrol-risk-grid-fill")).toBeDefined(),
        );

        map.queryRenderedFeaturesResult = [
            { properties: { cellId: "cell-1" } },
        ];
        map.fireClick({ lng: 31.005, lat: -24.305 });

        const popupScope = within(map.getContainer());
        expect(await popupScope.findByText(/cell 0, 0/i)).toBeTruthy();
        expect(
            popupScope.queryByRole("button", { name: /view analysis/i }),
        ).not.toBeInTheDocument();
    });

    it("shows a View Analysis button for an analyst and opens the panel with real explain data", async () => {
        seedRole("analyst");
        useMapStore.setState({
            cellsByRef: new Map([["cell-1", TEST_HEATMAP.cells[0]]]),
            selectedSnapshotId: TEST_HEATMAP_ID,
        });
        const map = new maplibregl.Map({
            container: document.createElement("div"),
        }) as unknown as FakeMap;
        render(
            <HeatmapLayer
                map={map as never}
                grid={TEST_GRID}
                riskByCell={makeRiskByCell(0.1)}
                pickingActive={false}
                isMobile
            />,
        );
        await waitFor(() =>
            expect(map.getLayer("patrol-risk-grid-fill")).toBeDefined(),
        );

        map.queryRenderedFeaturesResult = [
            { properties: { cellId: "cell-1" } },
        ];
        map.fireClick({ lng: 31.005, lat: -24.305 });

        const popupScope = within(map.getContainer());
        await userEvent.click(
            await popupScope.findByRole("button", { name: /view analysis/i }),
        );

        expect(await popupScope.findByText("Nearby incidents")).toBeTruthy();
    });

    it("does not open a popup on a cell with no risk score", async () => {
        const map = new maplibregl.Map({
            container: document.createElement("div"),
        }) as unknown as FakeMap;
        render(
            <HeatmapLayer
                map={map as never}
                grid={TEST_GRID}
                riskByCell={new Map()}
                pickingActive={false}
                isMobile={false}
            />,
        );
        await waitFor(() =>
            expect(map.getLayer("patrol-risk-grid-fill")).toBeDefined(),
        );

        map.queryRenderedFeaturesResult = [
            { properties: { cellId: "cell-1" } },
        ];
        const addToSpy = vi.spyOn(maplibregl.Popup.prototype, "addTo");
        map.fireClick({ lng: 31.005, lat: -24.305 });
        expect(addToSpy).not.toHaveBeenCalled();
    });
});
