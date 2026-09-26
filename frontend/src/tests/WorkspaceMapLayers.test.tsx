import { act, render, waitFor } from "@testing-library/react";
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

function seedOneOfEach(): { layerId: string; polygonId: string } {
    const store = useWorkspaceStore.getState();
    const layerId = store.addLayer("Water", null);
    store.setActiveLayer(layerId);
    store.drawFeature("point", { type: "Point", coordinates: [1, 2] });
    store.drawFeature("line", {
        type: "LineString",
        coordinates: [
            [0, 0],
            [10, 0],
        ],
    });
    const polygon = store.drawFeature("polygon", {
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
    })!;
    return { layerId, polygonId: polygon.featureId };
}

function findGroupLayer(map: FakeMap, part: string): unknown {
    const id = map
        .getLayerOrder()
        .find((layerId) => layerId.endsWith(`-${part}`));
    return id ? map.getLayer(id) : undefined;
}

const SYMBOL_PARTS = ["points-symbol", "lines-symbol", "polygons-symbol"];

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

        const lineSymbolLayer = findGroupLayer(map, "lines-symbol") as {
            source: string;
        };
        const polygonSymbolLayer = findGroupLayer(map, "polygons-symbol") as {
            source: string;
        };
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
        expect(options?.layers?.length).toBeGreaterThan(0);
        for (const id of options?.layers ?? []) {
            expect(id).not.toMatch(/-symbol$/);
        }
    });

    it("anchors the icon above and the label below the feature with a gap, instead of centering on top of it", async () => {
        seedOneOfEach();
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

        for (const layerId of SYMBOL_PARTS) {
            const layer = findGroupLayer(map, layerId) as {
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
        seedOneOfEach();
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

        const dotLayer = findGroupLayer(map, "points-dot") as {
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

        for (const layerId of SYMBOL_PARTS) {
            const layer = findGroupLayer(map, layerId) as {
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
        seedOneOfEach();
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

        const dotLayer = findGroupLayer(map, "points-dot") as {
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

        const symbolLayer = findGroupLayer(map, "points-symbol") as {
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
        seedOneOfEach();
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

        const dotLayer = findGroupLayer(map, "points-dot") as {
            paint?: Record<string, unknown>;
        };
        const radiusAtDefaultZoom = evalZoomInterpolate(
            dotLayer.paint!["circle-radius"],
            10,
        );
        expect(radiusAtDefaultZoom).toBeLessThanOrEqual(3);
    });

    it("colours each symbol layer's icon from its own iconColour property, independent of the feature's shape colour, without a halo", async () => {
        seedOneOfEach();
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

        for (const layerId of SYMBOL_PARTS) {
            const layer = findGroupLayer(map, layerId) as {
                paint?: Record<string, unknown>;
            };
            expect(layer.paint!["icon-color"]).toEqual(["get", "iconColour"]);
            expect(layer.paint!["icon-halo-color"]).toBeUndefined();
            expect(layer.paint!["icon-halo-width"]).toBeUndefined();
        }
    });

    it("drives the polygon outline's opacity from its own outlineOpacity property, independent of the fill's opacity", async () => {
        seedOneOfEach();
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

        const outlineLayer = findGroupLayer(map, "polygons-outline") as {
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
        seedOneOfEach();
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

        for (const layerId of SYMBOL_PARTS) {
            const layer = findGroupLayer(map, layerId) as {
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
        it("places the outline and point halos below the selected layer's polygon fill and point dot so the throb buffers around the feature instead of overlapping onto it", async () => {
            const { layerId, polygonId } = seedOneOfEach();
            const map = makeMap();
            render(
                <WorkspaceMapLayers
                    map={map as never}
                    excludedFeatureId={null}
                    selectedFeatureId={polygonId}
                    onFeatureClick={() => {}}
                />,
            );
            await waitFor(() =>
                expect(map.sources["workspace-points"]).toBeDefined(),
            );

            const order = map.getLayerOrder();
            expect(
                order.indexOf("workspace-selection-halo-outline"),
            ).toBeLessThan(order.indexOf(`workspace-${layerId}-polygons-fill`));
            expect(
                order.indexOf("workspace-selection-halo-points"),
            ).toBeLessThan(order.indexOf(`workspace-${layerId}-points-dot`));
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

describe("WorkspaceMapLayers stacking", () => {
    function seedTwoLayers() {
        const store = useWorkspaceStore.getState();
        const topId = store.addLayer("Top", null);
        const bottomId = store.addLayer("Bottom", null);
        store.setActiveLayer(bottomId);
        const lo = store.drawFeature("point", {
            type: "Point",
            coordinates: [1, 2],
        })!;
        store.setActiveLayer(topId);
        const hi = store.drawFeature("polygon", {
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
        })!;
        return { topId, bottomId, lo, hi };
    }

    function renderMap(
        overrides: Partial<{
            selectedFeatureId: string | null;
            onFeatureClick: (id: string | null) => void;
        }> = {},
    ) {
        const map = makeMap();
        render(
            <WorkspaceMapLayers
                map={map as never}
                excludedFeatureId={null}
                selectedFeatureId={overrides.selectedFeatureId ?? null}
                onFeatureClick={overrides.onFeatureClick ?? (() => {})}
            />,
        );
        return map;
    }

    function groupIndices(map: FakeMap, layerId: string) {
        const prefix = `workspace-${layerId}-`;
        return map
            .getLayerOrder()
            .flatMap((id, index) => (id.startsWith(prefix) ? [index] : []));
    }

    it("draws every map layer of a lower workspace layer beneath every map layer of a higher one, even across geometry types", async () => {
        const { topId, bottomId } = seedTwoLayers();
        const map = renderMap();
        await waitFor(() =>
            expect(groupIndices(map, topId).length).toBeGreaterThan(0),
        );

        const top = groupIndices(map, topId);
        const bottom = groupIndices(map, bottomId);
        expect(bottom.length).toBeGreaterThan(0);
        expect(Math.max(...bottom)).toBeLessThan(Math.min(...top));
    });

    it("limits each layer's map layers to that workspace layer's own features", async () => {
        const { topId } = seedTwoLayers();
        const map = renderMap();
        await waitFor(() =>
            expect(groupIndices(map, topId).length).toBeGreaterThan(0),
        );

        const layer = map.getLayer(`workspace-${topId}-polygons-fill`) as {
            filter: unknown;
        };
        expect(layer.filter).toEqual(["==", ["get", "layerId"], topId]);
    });

    it("sorts features inside each map layer by their stacking position", async () => {
        const { topId } = seedTwoLayers();
        const map = renderMap();
        await waitFor(() =>
            expect(groupIndices(map, topId).length).toBeGreaterThan(0),
        );

        const layers = [
            ["polygons-fill", "fill-sort-key"],
            ["polygons-outline", "line-sort-key"],
            ["lines-stroke", "line-sort-key"],
            ["points-dot", "circle-sort-key"],
            ["points-symbol", "symbol-sort-key"],
        ] as const;
        for (const [suffix, key] of layers) {
            const layer = map.getLayer(`workspace-${topId}-${suffix}`) as {
                layout: Record<string, unknown>;
            };
            expect(layer.layout[key]).toEqual(["get", "z"]);
        }
    });

    it("keeps the same stacking after a layer is hidden and shown again", async () => {
        const { topId } = seedTwoLayers();
        const map = renderMap();
        await waitFor(() =>
            expect(groupIndices(map, topId).length).toBeGreaterThan(0),
        );
        const before = map.getLayerOrder();

        act(() =>
            useWorkspaceStore.getState().toggleLayerVisibility(topId, false),
        );
        await waitFor(() => expect(groupIndices(map, topId)).toHaveLength(0));
        act(() =>
            useWorkspaceStore.getState().toggleLayerVisibility(topId, true),
        );
        await waitFor(() =>
            expect(groupIndices(map, topId).length).toBeGreaterThan(0),
        );

        expect(map.getLayerOrder()).toEqual(before);
    });

    it("follows a reorder of the workspace layers", async () => {
        const { topId, bottomId } = seedTwoLayers();
        const map = renderMap();
        await waitFor(() =>
            expect(groupIndices(map, topId).length).toBeGreaterThan(0),
        );

        act(() =>
            useWorkspaceStore.getState().reorderLayer(null, [bottomId, topId]),
        );

        await waitFor(() => {
            const top = groupIndices(map, topId);
            const bottom = groupIndices(map, bottomId);
            expect(Math.max(...top)).toBeLessThan(Math.min(...bottom));
        });
    });

    it("keeps the stack between a bottom and a top anchor so other map layers can sit beneath or above it", async () => {
        const { topId, bottomId } = seedTwoLayers();
        const map = renderMap();
        await waitFor(() =>
            expect(groupIndices(map, topId).length).toBeGreaterThan(0),
        );

        const order = map.getLayerOrder();
        const bottomAnchor = order.indexOf("workspace-stack-bottom");
        const topAnchor = order.indexOf("workspace-stack-top");
        expect(bottomAnchor).toBeGreaterThanOrEqual(0);
        expect(bottomAnchor).toBeLessThan(
            Math.min(...groupIndices(map, bottomId)),
        );
        expect(topAnchor).toBeGreaterThan(
            Math.max(...groupIndices(map, topId)),
        );
    });

    it("resolves a click on overlapping features to the one highest in the tree, whatever order the map reports them", async () => {
        const { lo, hi } = seedTwoLayers();
        const onFeatureClick = vi.fn();
        const map = renderMap({ onFeatureClick });
        await waitFor(() =>
            expect(map.sources["workspace-points"]).toBeDefined(),
        );

        const hits = [
            { properties: { id: lo.featureId, z: 0 } },
            { properties: { id: hi.featureId, z: 1 } },
        ];
        for (const ordered of [hits, [...hits].reverse()]) {
            onFeatureClick.mockClear();
            map.queryRenderedFeaturesResult = ordered;
            map.fireClick({ lng: 1, lat: 2 });
            expect(onFeatureClick).toHaveBeenCalledWith(hi.featureId);
        }
    });

    it("only hit-tests the shape layers of the groups that exist", async () => {
        const { topId, bottomId } = seedTwoLayers();
        const map = renderMap();
        await waitFor(() =>
            expect(groupIndices(map, topId).length).toBeGreaterThan(0),
        );

        map.fireClick({ lng: 1, lat: 2 });

        const [, options] = map.queryRenderedFeatures.mock.calls.at(-1)!;
        expect([...(options?.layers ?? [])].sort()).toEqual(
            [topId, bottomId]
                .flatMap((id) => [
                    `workspace-${id}-points-dot`,
                    `workspace-${id}-lines-stroke`,
                    `workspace-${id}-polygons-fill`,
                ])
                .sort(),
        );
    });

    it("draws the selection halo directly beneath the selected feature's layer so higher layers still cover it", async () => {
        const { topId, bottomId, lo } = seedTwoLayers();
        const map = renderMap({ selectedFeatureId: lo.featureId });
        await waitFor(() =>
            expect(groupIndices(map, topId).length).toBeGreaterThan(0),
        );

        const order = map.getLayerOrder();
        const halo = order.indexOf("workspace-selection-halo-outline");
        expect(halo).toBeGreaterThan(order.indexOf("workspace-stack-bottom"));
        expect(halo).toBeLessThan(Math.min(...groupIndices(map, bottomId)));
        expect(halo).toBeLessThan(Math.min(...groupIndices(map, topId)));
        const haloPoints = order.indexOf("workspace-selection-halo-points");
        expect(haloPoints).toBeLessThan(
            order.indexOf(`workspace-${bottomId}-points-dot`),
        );
        expect(haloPoints).toBeGreaterThan(
            order.indexOf(`workspace-${bottomId}-polygons-fill`),
        );
    });

    it("draws a buffer polygon beneath the selected feature and follows geometry edits", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        const created = useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [30, -25] });
        useWorkspaceStore.getState().setFeatureBuffer(created!.featureId, {
            enabled: true,
            distanceM: 1000,
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

        await waitFor(() => {
            expect(map.sources["workspace-buffers"]).toBeDefined();
        });
        const order = map.getLayerOrder();
        const buffer = order.indexOf("workspace-buffers-fill");
        expect(buffer).toBeGreaterThan(order.indexOf("workspace-stack-bottom"));
        expect(buffer).toBeLessThan(
            order.indexOf(`workspace-${waterId}-points-dot`),
        );
        const before = map.sources["workspace-buffers"]
            .data as GeoJSON.FeatureCollection;
        expect(before.features).toHaveLength(1);
        const firstLon = (before.features[0].geometry as GeoJSON.Polygon)
            .coordinates[0][0][0];

        act(() => {
            useWorkspaceStore
                .getState()
                .editFeatureGeometry(created!.featureId, {
                    type: "Point",
                    coordinates: [31, -25],
                });
        });

        await waitFor(() => {
            const after = map.sources["workspace-buffers"]
                .data as GeoJSON.FeatureCollection;
            const movedLon = (after.features[0].geometry as GeoJSON.Polygon)
                .coordinates[0][0][0];
            expect(movedLon).toBeGreaterThan(firstLon + 0.5);
        });
    });

    it("draws no buffer while the buffered feature is not selected", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        const created = useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [30, -25] });
        useWorkspaceStore.getState().setFeatureBuffer(created!.featureId, {
            enabled: true,
            distanceM: 1000,
        });

        const map = makeMap();
        const props = {
            map: map as never,
            excludedFeatureId: null,
            onFeatureClick: () => {},
        };
        const { rerender } = render(
            <WorkspaceMapLayers {...props} selectedFeatureId={null} />,
        );
        await waitFor(() => {
            expect(map.sources["workspace-buffers"]).toBeDefined();
        });
        expect(
            (map.sources["workspace-buffers"].data as GeoJSON.FeatureCollection)
                .features,
        ).toHaveLength(0);

        rerender(
            <WorkspaceMapLayers
                {...props}
                selectedFeatureId={created!.featureId}
            />,
        );
        await waitFor(() => {
            expect(
                (
                    map.sources["workspace-buffers"]
                        .data as GeoJSON.FeatureCollection
                ).features,
            ).toHaveLength(1);
        });
    });
});
