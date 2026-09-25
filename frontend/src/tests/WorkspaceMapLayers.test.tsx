import { render, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("maplibre-gl", async () => {
    const { createMapLibreMock } = await import("./mocks/maplibreMock");
    return createMapLibreMock();
});

import * as maplibregl from "maplibre-gl";
import type { FakeMap } from "./mocks/maplibreMock";
import { WorkspaceMapLayers } from "@/components/workspace/WorkspaceMapLayers";
import {
    useWorkspaceStore,
    initialWorkspaceState,
} from "@/store/workspaceStore";

afterEach(() => {
    useWorkspaceStore.setState(initialWorkspaceState, true);
});

function makeMap(): FakeMap {
    return new maplibregl.Map({
        container: document.createElement("div"),
    }) as unknown as FakeMap;
}

describe("WorkspaceMapLayers", () => {
    it("adds a geojson source per geometry type and populates it from visible features", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [1, 2] });

        const map = makeMap();
        render(
            <WorkspaceMapLayers
                map={map as never}
                excludedFeatureId={null}
                selectedFeatureId={null}
                onFeatureClick={() => {}}
            />,
        );

        await waitFor(() => {
            expect(map.sources["workspace-points"]).toBeDefined();
        });
        const data = map.sources["workspace-points"]
            .data as GeoJSON.FeatureCollection;
        expect(data.features).toHaveLength(1);
        expect(map.sources["workspace-lines"].data).toMatchObject({
            features: [],
        });
        expect(map.sources["workspace-polygons"].data).toMatchObject({
            features: [],
        });
    });

    it("excludes the feature currently being edited from the rendered collection", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        const created = useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [1, 2] });

        const map = makeMap();
        render(
            <WorkspaceMapLayers
                map={map as never}
                excludedFeatureId={created!.featureId}
                selectedFeatureId={null}
                onFeatureClick={() => {}}
            />,
        );

        await waitFor(() => {
            expect(map.sources["workspace-points"]).toBeDefined();
        });
        const data = map.sources["workspace-points"]
            .data as GeoJSON.FeatureCollection;
        expect(data.features).toHaveLength(0);
    });

    it("calls onFeatureClick with the clicked feature's id", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        const created = useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [1, 2] });

        const map = makeMap();
        const onFeatureClick = vi.fn();
        render(
            <WorkspaceMapLayers
                map={map as never}
                excludedFeatureId={null}
                selectedFeatureId={null}
                onFeatureClick={onFeatureClick}
            />,
        );
        await waitFor(() =>
            expect(map.sources["workspace-points"]).toBeDefined(),
        );

        map.queryRenderedFeaturesResult = [
            { properties: { id: created!.featureId } },
        ];
        map.fireClick({ lng: 1, lat: 2 });

        expect(onFeatureClick).toHaveBeenCalledWith(created!.featureId);
    });

    it("calls onFeatureClick with null when clicking outside any feature", async () => {
        const map = makeMap();
        const onFeatureClick = vi.fn();
        render(
            <WorkspaceMapLayers
                map={map as never}
                excludedFeatureId={null}
                selectedFeatureId={null}
                onFeatureClick={onFeatureClick}
            />,
        );
        await waitFor(() =>
            expect(map.sources["workspace-points"]).toBeDefined(),
        );

        map.queryRenderedFeaturesResult = [];
        map.fireClick({ lng: 5, lat: 5 });

        expect(onFeatureClick).toHaveBeenCalledWith(null);
    });

    it("drives the line and polygon symbol layers from a single-point anchor source instead of the raw line/polygon geometry, so a feature spanning multiple internal tiles doesn't render its icon and label more than once", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        useWorkspaceStore.getState().drawFeature("line", {
            type: "LineString",
            coordinates: [
                [0, 0],
                [10, 0],
            ],
        });
        useWorkspaceStore.getState().drawFeature("polygon", {
            type: "Polygon",
            coordinates: [
                [
                    [0, 0],
                    [10, 0],
                    [10, 10],
                    [0, 10],
                    [0, 0],
                ],
            ],
        });

        const map = makeMap();
        render(
            <WorkspaceMapLayers
                map={map as never}
                excludedFeatureId={null}
                selectedFeatureId={null}
                onFeatureClick={() => {}}
            />,
        );
        await waitFor(() =>
            expect(map.sources["workspace-points"]).toBeDefined(),
        );

        const lineSymbolLayer = map.getLayer("workspace-lines-symbol") as {
            source: string;
        };
        const polygonSymbolLayer = map.getLayer(
            "workspace-polygons-symbol",
        ) as { source: string };
        expect(lineSymbolLayer.source).not.toBe("workspace-lines");
        expect(polygonSymbolLayer.source).not.toBe("workspace-polygons");

        const lineIconsData = map.sources[lineSymbolLayer.source]
            .data as GeoJSON.FeatureCollection;
        const polygonIconsData = map.sources[polygonSymbolLayer.source]
            .data as GeoJSON.FeatureCollection;
        expect(lineIconsData.features).toHaveLength(1);
        expect(lineIconsData.features[0].geometry.type).toBe("Point");
        expect(polygonIconsData.features).toHaveLength(1);
        expect(polygonIconsData.features[0].geometry.type).toBe("Point");
    });

    it("queries a small buffer box around the click point instead of the exact pixel, so thin features are easier to hit", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [1, 2] });

        const map = makeMap();
        render(
            <WorkspaceMapLayers
                map={map as never}
                excludedFeatureId={null}
                selectedFeatureId={null}
                onFeatureClick={() => {}}
            />,
        );
        await waitFor(() =>
            expect(map.sources["workspace-points"]).toBeDefined(),
        );

        map.fireClick({ lng: 1, lat: 2 });

        const [bbox] = map.queryRenderedFeatures.mock.calls.at(-1)!;
        expect(bbox).toEqual([
            [-6, -6],
            [6, 6],
        ]);
    });

    it("excludes the icon/label symbol layers from the click hit-test so only the drawn geometry is clickable", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [1, 2] });

        const map = makeMap();
        render(
            <WorkspaceMapLayers
                map={map as never}
                excludedFeatureId={null}
                selectedFeatureId={null}
                onFeatureClick={() => {}}
            />,
        );
        await waitFor(() =>
            expect(map.sources["workspace-points"]).toBeDefined(),
        );

        map.fireClick({ lng: 1, lat: 2 });

        const [, options] = map.queryRenderedFeatures.mock.calls.at(-1)!;
        expect(options?.layers).not.toContain("workspace-points-symbol");
        expect(options?.layers).not.toContain("workspace-lines-symbol");
        expect(options?.layers).not.toContain("workspace-polygons-symbol");
    });

    it("anchors the icon above and the label below the feature with a gap, instead of centering on top of it", async () => {
        const map = makeMap();
        render(
            <WorkspaceMapLayers
                map={map as never}
                excludedFeatureId={null}
                selectedFeatureId={null}
                onFeatureClick={() => {}}
            />,
        );
        await waitFor(() =>
            expect(map.sources["workspace-points"]).toBeDefined(),
        );

        for (const layerId of [
            "workspace-points-symbol",
            "workspace-lines-symbol",
            "workspace-polygons-symbol",
        ]) {
            const layer = map.getLayer(layerId) as {
                layout?: Record<string, unknown>;
            };
            const layout = layer.layout!;

            expect(layout["icon-anchor"]).toBe("bottom");
            const [iconOffsetX, iconOffsetY] = layout["icon-offset"] as [
                number,
                number,
            ];
            expect(iconOffsetX).toBe(0);
            expect(iconOffsetY).toBeLessThan(0);

            expect(layout["text-anchor"]).toBe("top");
            const [textOffsetX, textOffsetY] = layout["text-offset"] as [
                number,
                number,
            ];
            expect(textOffsetX).toBe(0);
            expect(textOffsetY).toBeGreaterThan(0);
        }
    });

    function evalZoomInterpolate(expr: unknown, zoom: number): number {
        expect(Array.isArray(expr)).toBe(true);
        const arr = expr as unknown[];
        expect(arr[0]).toBe("interpolate");
        expect(arr[2]).toEqual(["zoom"]);
        const stops = arr.slice(3) as number[];
        for (let i = 0; i < stops.length - 2; i += 2) {
            const [z1, v1, z2, v2] = [
                stops[i],
                stops[i + 1],
                stops[i + 2],
                stops[i + 3],
            ];
            if (zoom <= z1) return v1;
            if (zoom >= z2) continue;
            return v1 + ((v2 - v1) * (zoom - z1)) / (z2 - z1);
        }
        return stops[stops.length - 1];
    }

    it("shrinks point dots, icons, and labels when zooming out instead of holding a fixed pixel size", async () => {
        const map = makeMap();
        render(
            <WorkspaceMapLayers
                map={map as never}
                excludedFeatureId={null}
                selectedFeatureId={null}
                onFeatureClick={() => {}}
            />,
        );
        await waitFor(() =>
            expect(map.sources["workspace-points"]).toBeDefined(),
        );

        const dotLayer = map.getLayer("workspace-points-dot") as {
            paint?: Record<string, unknown>;
        };
        const dotRadiusAtLowZoom = evalZoomInterpolate(
            dotLayer.paint!["circle-radius"],
            6,
        );
        const dotRadiusAtHighZoom = evalZoomInterpolate(
            dotLayer.paint!["circle-radius"],
            18,
        );
        expect(dotRadiusAtLowZoom).toBeLessThan(dotRadiusAtHighZoom);

        for (const layerId of [
            "workspace-points-symbol",
            "workspace-lines-symbol",
            "workspace-polygons-symbol",
        ]) {
            const layer = map.getLayer(layerId) as {
                layout?: Record<string, unknown>;
            };
            const layout = layer.layout!;

            const iconSizeAtLowZoom = evalZoomInterpolate(
                layout["icon-size"],
                6,
            );
            const iconSizeAtHighZoom = evalZoomInterpolate(
                layout["icon-size"],
                18,
            );
            expect(iconSizeAtLowZoom).toBeLessThan(iconSizeAtHighZoom);

            const textSizeAtLowZoom = evalZoomInterpolate(
                layout["text-size"],
                6,
            );
            const textSizeAtHighZoom = evalZoomInterpolate(
                layout["text-size"],
                18,
            );
            expect(textSizeAtLowZoom).toBeLessThan(textSizeAtHighZoom);
        }
    });

    it("shrinks sizing dramatically within a few zoom levels of the default, not just at extreme zoom", async () => {
        const map = makeMap();
        render(
            <WorkspaceMapLayers
                map={map as never}
                excludedFeatureId={null}
                selectedFeatureId={null}
                onFeatureClick={() => {}}
            />,
        );
        await waitFor(() =>
            expect(map.sources["workspace-points"]).toBeDefined(),
        );

        const zoomedOutBy3 = 7;

        const dotLayer = map.getLayer("workspace-points-dot") as {
            paint?: Record<string, unknown>;
        };
        const dotRadiusAtDefault = evalZoomInterpolate(
            dotLayer.paint!["circle-radius"],
            10,
        );
        const dotRadiusZoomedOut = evalZoomInterpolate(
            dotLayer.paint!["circle-radius"],
            zoomedOutBy3,
        );
        expect(dotRadiusZoomedOut).toBeLessThan(dotRadiusAtDefault * 0.25);

        const symbolLayer = map.getLayer("workspace-points-symbol") as {
            layout?: Record<string, unknown>;
        };
        const layout = symbolLayer.layout!;

        const iconSizeAtDefault = evalZoomInterpolate(layout["icon-size"], 10);
        const iconSizeZoomedOut = evalZoomInterpolate(
            layout["icon-size"],
            zoomedOutBy3,
        );
        expect(iconSizeZoomedOut).toBeLessThan(iconSizeAtDefault * 0.25);

        const textSizeAtDefault = evalZoomInterpolate(layout["text-size"], 10);
        const textSizeZoomedOut = evalZoomInterpolate(
            layout["text-size"],
            zoomedOutBy3,
        );
        expect(textSizeZoomedOut).toBeLessThan(textSizeAtDefault * 0.6);
    });

    it("keeps the point dot small at the default zoom so it reads as a precise location, not a blob", async () => {
        const map = makeMap();
        render(
            <WorkspaceMapLayers
                map={map as never}
                excludedFeatureId={null}
                selectedFeatureId={null}
                onFeatureClick={() => {}}
            />,
        );
        await waitFor(() =>
            expect(map.sources["workspace-points"]).toBeDefined(),
        );

        const dotLayer = map.getLayer("workspace-points-dot") as {
            paint?: Record<string, unknown>;
        };
        const radiusAtDefaultZoom = evalZoomInterpolate(
            dotLayer.paint!["circle-radius"],
            10,
        );
        expect(radiusAtDefaultZoom).toBeLessThanOrEqual(3);
    });

    it("colours each symbol layer's icon from its own iconColour property, independent of the feature's shape colour, without a halo", async () => {
        const map = makeMap();
        render(
            <WorkspaceMapLayers
                map={map as never}
                excludedFeatureId={null}
                selectedFeatureId={null}
                onFeatureClick={() => {}}
            />,
        );
        await waitFor(() =>
            expect(map.sources["workspace-points"]).toBeDefined(),
        );

        for (const layerId of [
            "workspace-points-symbol",
            "workspace-lines-symbol",
            "workspace-polygons-symbol",
        ]) {
            const layer = map.getLayer(layerId) as {
                paint?: Record<string, unknown>;
            };
            expect(layer.paint!["icon-color"]).toEqual(["get", "iconColour"]);
            expect(layer.paint!["icon-halo-color"]).toBeUndefined();
            expect(layer.paint!["icon-halo-width"]).toBeUndefined();
        }
    });

    it("drives the polygon outline's opacity from its own outlineOpacity property, independent of the fill's opacity", async () => {
        const map = makeMap();
        render(
            <WorkspaceMapLayers
                map={map as never}
                excludedFeatureId={null}
                selectedFeatureId={null}
                onFeatureClick={() => {}}
            />,
        );
        await waitFor(() =>
            expect(map.sources["workspace-points"]).toBeDefined(),
        );

        const outlineLayer = map.getLayer("workspace-polygons-outline") as {
            paint?: Record<string, unknown>;
        };
        expect(outlineLayer.paint!["line-opacity"]).toEqual([
            "get",
            "outlineOpacity",
        ]);
    });

    it("bakes a distinct outlineOpacity value into the polygon source data, separate from the fill opacity", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        const created = useWorkspaceStore.getState().drawFeature("polygon", {
            type: "Polygon",
            coordinates: [
                [
                    [0, 0],
                    [10, 0],
                    [10, 10],
                    [0, 10],
                    [0, 0],
                ],
            ],
        });
        useWorkspaceStore
            .getState()
            .setMembershipStyleOverride(created!.membershipId, {
                opacity: 0.2,
                outlineOpacity: 0.9,
            });

        const map = makeMap();
        render(
            <WorkspaceMapLayers
                map={map as never}
                excludedFeatureId={null}
                selectedFeatureId={null}
                onFeatureClick={() => {}}
            />,
        );
        await waitFor(() =>
            expect(map.sources["workspace-polygons"]).toBeDefined(),
        );

        const data = map.sources["workspace-polygons"]
            .data as GeoJSON.FeatureCollection;
        expect(data.features[0].properties).toMatchObject({
            opacity: 0.2,
            outlineOpacity: 0.9,
        });
    });

    it("keeps icons and labels small at the default zoom so a dense map of features doesn't get cluttered", async () => {
        const map = makeMap();
        render(
            <WorkspaceMapLayers
                map={map as never}
                excludedFeatureId={null}
                selectedFeatureId={null}
                onFeatureClick={() => {}}
            />,
        );
        await waitFor(() =>
            expect(map.sources["workspace-points"]).toBeDefined(),
        );

        for (const layerId of [
            "workspace-points-symbol",
            "workspace-lines-symbol",
            "workspace-polygons-symbol",
        ]) {
            const layer = map.getLayer(layerId) as {
                layout?: Record<string, unknown>;
            };
            const layout = layer.layout!;

            const iconSizeAtDefaultZoom = evalZoomInterpolate(
                layout["icon-size"],
                10,
            );
            expect(iconSizeAtDefaultZoom).toBeLessThanOrEqual(0.7);

            const textSizeAtDefaultZoom = evalZoomInterpolate(
                layout["text-size"],
                10,
            );
            expect(textSizeAtDefaultZoom).toBeLessThanOrEqual(10);
        }
    });

    describe("selection highlight", () => {
        it("inserts the outline and point halos below the polygon fill and point dot so the throb buffers around the feature instead of overlapping onto it", async () => {
            const map = makeMap();
            const addLayerSpy = vi.spyOn(map, "addLayer");
            render(
                <WorkspaceMapLayers
                    map={map as never}
                    excludedFeatureId={null}
                    selectedFeatureId={null}
                    onFeatureClick={() => {}}
                />,
            );
            await waitFor(() =>
                expect(map.sources["workspace-points"]).toBeDefined(),
            );

            const haloOutlineCall = addLayerSpy.mock.calls.find(
                ([layer]) =>
                    (layer as { id: string }).id ===
                    "workspace-selection-halo-outline",
            );
            const haloPointsCall = addLayerSpy.mock.calls.find(
                ([layer]) =>
                    (layer as { id: string }).id ===
                    "workspace-selection-halo-points",
            );
            expect(haloOutlineCall?.[1]).toBe("workspace-polygons-fill");
            expect(haloPointsCall?.[1]).toBe("workspace-points-dot");
        });

        function reducedMotion(matches: boolean) {
            vi.spyOn(window, "matchMedia").mockReturnValue({
                matches,
                media: "(prefers-reduced-motion: reduce)",
                onchange: null,
                addListener: vi.fn(),
                removeListener: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            } as unknown as MediaQueryList);
        }

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it("creates the outline and point halo layers, matching nothing when no feature is selected", async () => {
            const waterId = useWorkspaceStore
                .getState()
                .addLayer("Water", null);
            useWorkspaceStore.getState().setActiveLayer(waterId);
            useWorkspaceStore
                .getState()
                .drawFeature("point", { type: "Point", coordinates: [1, 2] });

            const map = makeMap();
            render(
                <WorkspaceMapLayers
                    map={map as never}
                    excludedFeatureId={null}
                    selectedFeatureId={null}
                    onFeatureClick={() => {}}
                />,
            );

            await waitFor(() =>
                expect(map.sources["workspace-points"]).toBeDefined(),
            );

            const haloPoints = map.getLayer(
                "workspace-selection-halo-points",
            ) as { filter?: unknown };
            const haloOutline = map.getLayer(
                "workspace-selection-halo-outline",
            ) as { layout?: unknown };
            expect(haloPoints).toBeDefined();
            expect(haloOutline).toBeDefined();
            expect(haloPoints.filter).toEqual(["==", ["get", "id"], ""]);
            expect(map.sources["workspace-halo-outline"].data).toEqual({
                type: "FeatureCollection",
                features: [],
            });
        });

        it("populates the halo outline source with a buffered polygon larger than the selected polygon", async () => {
            const waterId = useWorkspaceStore
                .getState()
                .addLayer("Water", null);
            useWorkspaceStore.getState().setActiveLayer(waterId);
            const created = useWorkspaceStore
                .getState()
                .drawFeature("polygon", {
                    type: "Polygon",
                    coordinates: [
                        [
                            [0, 0],
                            [10, 0],
                            [10, 10],
                            [0, 10],
                            [0, 0],
                        ],
                    ],
                });

            const map = makeMap();
            render(
                <WorkspaceMapLayers
                    map={map as never}
                    excludedFeatureId={null}
                    selectedFeatureId={created!.featureId}
                    onFeatureClick={() => {}}
                />,
            );
            await waitFor(() =>
                expect(map.sources["workspace-halo-outline"]).toBeDefined(),
            );

            const data = map.sources["workspace-halo-outline"]
                .data as GeoJSON.FeatureCollection;
            expect(data.features).toHaveLength(1);
            const geometry = data.features[0].geometry as GeoJSON.Polygon;
            expect(geometry.type).toBe("Polygon");
            const xs = geometry.coordinates[0].map((c) => c[0]);
            const ys = geometry.coordinates[0].map((c) => c[1]);

            expect(Math.min(...xs)).toBeLessThan(0);
            expect(Math.max(...xs)).toBeGreaterThan(10);
            expect(Math.min(...ys)).toBeLessThan(0);
            expect(Math.max(...ys)).toBeGreaterThan(10);
        });

        it("populates the halo outline source with a buffered shape surrounding a selected line", async () => {
            const waterId = useWorkspaceStore
                .getState()
                .addLayer("Water", null);
            useWorkspaceStore.getState().setActiveLayer(waterId);
            const created = useWorkspaceStore.getState().drawFeature("line", {
                type: "LineString",
                coordinates: [
                    [0, 0],
                    [10, 0],
                ],
            });

            const map = makeMap();
            render(
                <WorkspaceMapLayers
                    map={map as never}
                    excludedFeatureId={null}
                    selectedFeatureId={created!.featureId}
                    onFeatureClick={() => {}}
                />,
            );
            await waitFor(() =>
                expect(map.sources["workspace-halo-outline"]).toBeDefined(),
            );

            const data = map.sources["workspace-halo-outline"]
                .data as GeoJSON.FeatureCollection;
            expect(data.features).toHaveLength(1);
            expect(data.features[0].geometry.type).toBe("Polygon");
        });

        it("clears the halo outline source when a point is selected, since points use their own circle halo", async () => {
            const waterId = useWorkspaceStore
                .getState()
                .addLayer("Water", null);
            useWorkspaceStore.getState().setActiveLayer(waterId);
            const created = useWorkspaceStore
                .getState()
                .drawFeature("point", { type: "Point", coordinates: [1, 2] });

            const map = makeMap();
            render(
                <WorkspaceMapLayers
                    map={map as never}
                    excludedFeatureId={null}
                    selectedFeatureId={created!.featureId}
                    onFeatureClick={() => {}}
                />,
            );
            await waitFor(() =>
                expect(map.sources["workspace-halo-outline"]).toBeDefined(),
            );

            expect(map.sources["workspace-halo-outline"].data).toEqual({
                type: "FeatureCollection",
                features: [],
            });
        });

        it("recomputes the halo outline when the map finishes zooming, since the buffer distance is derived from screen pixels", async () => {
            const waterId = useWorkspaceStore
                .getState()
                .addLayer("Water", null);
            useWorkspaceStore.getState().setActiveLayer(waterId);
            const created = useWorkspaceStore
                .getState()
                .drawFeature("polygon", {
                    type: "Polygon",
                    coordinates: [
                        [
                            [0, 0],
                            [10, 0],
                            [10, 10],
                            [0, 10],
                            [0, 0],
                        ],
                    ],
                });

            const map = makeMap();
            render(
                <WorkspaceMapLayers
                    map={map as never}
                    excludedFeatureId={null}
                    selectedFeatureId={created!.featureId}
                    onFeatureClick={() => {}}
                />,
            );
            await waitFor(() =>
                expect(map.sources["workspace-halo-outline"]).toBeDefined(),
            );

            const setDataSpy = map.sources["workspace-halo-outline"]
                .setData as ReturnType<typeof vi.fn>;
            const callsBeforeZoom = setDataSpy.mock.calls.length;

            map.fire("zoomend");

            expect(setDataSpy.mock.calls.length).toBeGreaterThan(
                callsBeforeZoom,
            );
        });

        it("uses a round line-join on the halo outline so sharp corners don't spike or drop out", async () => {
            const map = makeMap();
            render(
                <WorkspaceMapLayers
                    map={map as never}
                    excludedFeatureId={null}
                    selectedFeatureId={null}
                    onFeatureClick={() => {}}
                />,
            );
            await waitFor(() =>
                expect(map.sources["workspace-points"]).toBeDefined(),
            );

            const haloOutline = map.getLayer(
                "workspace-selection-halo-outline",
            ) as {
                layout?: Record<string, unknown>;
            };
            expect(haloOutline.layout?.["line-join"]).toBe("round");
        });

        it("keeps the point halo's radius clear of the dot's largest rendered size at every zoom level", async () => {
            reducedMotion(true);
            const waterId = useWorkspaceStore
                .getState()
                .addLayer("Water", null);
            useWorkspaceStore.getState().setActiveLayer(waterId);
            const created = useWorkspaceStore
                .getState()
                .drawFeature("point", { type: "Point", coordinates: [1, 2] });

            const map = makeMap();
            render(
                <WorkspaceMapLayers
                    map={map as never}
                    excludedFeatureId={null}
                    selectedFeatureId={created!.featureId}
                    onFeatureClick={() => {}}
                />,
            );
            await waitFor(() =>
                expect(map.sources["workspace-points"]).toBeDefined(),
            );

            expect(map.setPaintProperty).toHaveBeenCalledWith(
                "workspace-selection-halo-points",
                "circle-radius",
                expect.any(Number),
            );
            const radiusCall = (
                map.setPaintProperty as ReturnType<typeof vi.fn>
            ).mock.calls.find(
                ([id, prop]) =>
                    id === "workspace-selection-halo-points" &&
                    prop === "circle-radius",
            );
            expect(radiusCall?.[2]).toBeGreaterThan(6.5 + 2);
        });

        it("filters the halo layers to the selected feature and starts a pulsing animation loop", async () => {
            reducedMotion(false);
            const waterId = useWorkspaceStore
                .getState()
                .addLayer("Water", null);
            useWorkspaceStore.getState().setActiveLayer(waterId);
            const created = useWorkspaceStore
                .getState()
                .drawFeature("point", { type: "Point", coordinates: [1, 2] });

            const map = makeMap();
            const rafSpy = vi
                .spyOn(window, "requestAnimationFrame")
                .mockReturnValue(1);

            render(
                <WorkspaceMapLayers
                    map={map as never}
                    excludedFeatureId={null}
                    selectedFeatureId={created!.featureId}
                    onFeatureClick={() => {}}
                />,
            );
            await waitFor(() =>
                expect(map.sources["workspace-points"]).toBeDefined(),
            );

            expect(map.setFilter).toHaveBeenCalledWith(
                "workspace-selection-halo-points",
                ["==", ["get", "id"], created!.featureId],
            );
            expect(rafSpy).toHaveBeenCalled();
        });

        it("stops the pulsing animation once the selection is cleared", async () => {
            reducedMotion(false);
            const waterId = useWorkspaceStore
                .getState()
                .addLayer("Water", null);
            useWorkspaceStore.getState().setActiveLayer(waterId);
            const created = useWorkspaceStore
                .getState()
                .drawFeature("point", { type: "Point", coordinates: [1, 2] });

            const map = makeMap();
            vi.spyOn(window, "requestAnimationFrame").mockReturnValue(42);
            const cancelSpy = vi
                .spyOn(window, "cancelAnimationFrame")
                .mockImplementation(() => {});

            const { rerender } = render(
                <WorkspaceMapLayers
                    map={map as never}
                    excludedFeatureId={null}
                    selectedFeatureId={created!.featureId}
                    onFeatureClick={() => {}}
                />,
            );
            await waitFor(() =>
                expect(map.sources["workspace-points"]).toBeDefined(),
            );

            rerender(
                <WorkspaceMapLayers
                    map={map as never}
                    excludedFeatureId={null}
                    selectedFeatureId={null}
                    onFeatureClick={() => {}}
                />,
            );

            expect(cancelSpy).toHaveBeenCalledWith(42);
        });

        it("applies a static faint halo instead of animating when the user prefers reduced motion", async () => {
            reducedMotion(true);
            const waterId = useWorkspaceStore
                .getState()
                .addLayer("Water", null);
            useWorkspaceStore.getState().setActiveLayer(waterId);
            const created = useWorkspaceStore
                .getState()
                .drawFeature("point", { type: "Point", coordinates: [1, 2] });

            const map = makeMap();
            const rafSpy = vi.spyOn(window, "requestAnimationFrame");

            render(
                <WorkspaceMapLayers
                    map={map as never}
                    excludedFeatureId={null}
                    selectedFeatureId={created!.featureId}
                    onFeatureClick={() => {}}
                />,
            );
            await waitFor(() =>
                expect(map.sources["workspace-points"]).toBeDefined(),
            );

            expect(rafSpy).not.toHaveBeenCalled();
            expect(map.setPaintProperty).toHaveBeenCalledWith(
                "workspace-selection-halo-points",
                "circle-opacity",
                expect.any(Number),
            );
        });
    });
});
