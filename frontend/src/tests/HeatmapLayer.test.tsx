import { render, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("maplibre-gl", async () => {
    const { createMapLibreMock } = await import("./mocks/maplibreMock");
    return createMapLibreMock();
});

import maplibregl from "maplibre-gl";
import { HeatmapLayer } from "@/components/map/HeatmapLayer";
import { TEST_GRID } from "./mocks/riskHandlers";
import type { FakeMap } from "./mocks/maplibreMock";

function makeRiskByCell(score: number) {
    return new Map(
        TEST_GRID.features.map((f) => [f.properties.cell_id, score]),
    );
}

describe("HeatmapLayer", () => {
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
});
