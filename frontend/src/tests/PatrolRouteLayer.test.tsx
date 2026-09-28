import { StrictMode } from "react";
import { render, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("maplibre-gl", async () => {
    const { createMapLibreMock } = await import("./mocks/maplibreMock");
    return createMapLibreMock();
});

import * as maplibregl from "maplibre-gl";
import { PatrolRouteLayer } from "@/components/map/PatrolRouteLayer";
import type { FakeMap } from "./mocks/maplibreMock";
import type { PlannedRoute } from "@/services/routeApi";

const ROUTES: PlannedRoute[] = [
    {
        suggested_path: ["cell-1", "cell-2"],
        path_geometry: {
            type: "LineString",
            coordinates: [
                [31.0, -24.3],
                [31.01, -24.31],
            ],
        },
        distance_km: 10,
        risk_coverage: 0.5,
    },
    {
        suggested_path: ["cell-1", "cell-3"],
        path_geometry: {
            type: "LineString",
            coordinates: [
                [31.0, -24.3],
                [31.02, -24.32],
            ],
        },
        distance_km: 20,
        risk_coverage: 0.3,
    },
];

describe("PatrolRouteLayer", () => {
    it("adds a marker once a start point is set", async () => {
        const map = new maplibregl.Map({
            container: document.createElement("div"),
        }) as unknown as FakeMap;
        render(
            <PatrolRouteLayer
                map={map as never}
                startPoint={{ lat: -24.3, lon: 31.05 }}
                endPoint={null}
                routes={[]}
                selectedIndex={0}
            />,
        );
        await waitFor(() => {
            expect(map.layers).toEqual({});
        });
    });

    it("adds one line layer per route, styling the selected one differently", async () => {
        const map = new maplibregl.Map({
            container: document.createElement("div"),
        }) as unknown as FakeMap;
        render(
            <PatrolRouteLayer
                map={map as never}
                startPoint={null}
                endPoint={null}
                routes={ROUTES}
                selectedIndex={0}
            />,
        );
        await waitFor(() => {
            expect(map.getLayer("patrol-route-0-line")).toBeDefined();
            expect(map.getLayer("patrol-route-1-line")).toBeDefined();
        });
    });

    it("still attaches a start marker under React.StrictMode's double-invoked effects", async () => {
        const map = new maplibregl.Map({
            container: document.createElement("div"),
        }) as unknown as FakeMap;
        render(
            <StrictMode>
                <PatrolRouteLayer
                    map={map as never}
                    startPoint={{ lat: -24.3, lon: 31.05 }}
                    endPoint={{ lat: -24.31, lon: 31.06 }}
                    routes={[]}
                    selectedIndex={0}
                />
            </StrictMode>,
        );

        await waitFor(() => {
            expect(map.markers.size).toBe(2);
        });
    });

    it("removes both markers on unmount, leaving none attached to the map", async () => {
        const map = new maplibregl.Map({
            container: document.createElement("div"),
        }) as unknown as FakeMap;
        const { unmount } = render(
            <PatrolRouteLayer
                map={map as never}
                startPoint={{ lat: -24.3, lon: 31.05 }}
                endPoint={{ lat: -24.31, lon: 31.06 }}
                routes={[]}
                selectedIndex={0}
            />,
        );

        await waitFor(() => {
            expect(map.markers.size).toBe(2);
        });

        unmount();

        expect(map.markers.size).toBe(0);
    });

    it("defaults to full opacity for the selected route and faded for the rest when no override is given", async () => {
        const map = new maplibregl.Map({
            container: document.createElement("div"),
        }) as unknown as FakeMap;
        render(
            <PatrolRouteLayer
                map={map as never}
                startPoint={null}
                endPoint={null}
                routes={ROUTES}
                selectedIndex={0}
            />,
        );
        await waitFor(() => {
            const selected = map.getLayer("patrol-route-0-line") as {
                paint?: Record<string, unknown>;
            };
            const other = map.getLayer("patrol-route-1-line") as {
                paint?: Record<string, unknown>;
            };
            expect(selected.paint!["line-opacity"]).toBe(1);
            expect(other.paint!["line-opacity"]).toBe(0.4);
        });
    });

    it("applies opacityOverride to every route's line-opacity, overriding the selected/unselected default", async () => {
        const map = new maplibregl.Map({
            container: document.createElement("div"),
        }) as unknown as FakeMap;
        render(
            <PatrolRouteLayer
                map={map as never}
                startPoint={null}
                endPoint={null}
                routes={ROUTES}
                selectedIndex={0}
                opacityOverride={0.3}
            />,
        );
        await waitFor(() => {
            const selected = map.getLayer("patrol-route-0-line") as {
                paint?: Record<string, unknown>;
            };
            const other = map.getLayer("patrol-route-1-line") as {
                paint?: Record<string, unknown>;
            };
            expect(selected.paint!["line-opacity"]).toBe(0.3);
            expect(other.paint!["line-opacity"]).toBe(0.3);
        });
    });

    it("updates an existing route's opacity when opacityOverride changes", async () => {
        const map = new maplibregl.Map({
            container: document.createElement("div"),
        }) as unknown as FakeMap;
        const { rerender } = render(
            <PatrolRouteLayer
                map={map as never}
                startPoint={null}
                endPoint={null}
                routes={ROUTES}
                selectedIndex={0}
                opacityOverride={0.3}
            />,
        );
        await waitFor(() =>
            expect(map.getLayer("patrol-route-0-line")).toBeDefined(),
        );

        rerender(
            <PatrolRouteLayer
                map={map as never}
                startPoint={null}
                endPoint={null}
                routes={ROUTES}
                selectedIndex={0}
                opacityOverride={0.7}
            />,
        );

        await waitFor(() =>
            expect(map.setPaintProperty).toHaveBeenCalledWith(
                "patrol-route-0-line",
                "line-opacity",
                0.7,
            ),
        );
    });

    it("re-styles lines when the selected index changes", async () => {
        const map = new maplibregl.Map({
            container: document.createElement("div"),
        }) as unknown as FakeMap;
        const { rerender } = render(
            <PatrolRouteLayer
                map={map as never}
                startPoint={null}
                endPoint={null}
                routes={ROUTES}
                selectedIndex={0}
            />,
        );
        await waitFor(() =>
            expect(map.getLayer("patrol-route-0-line")).toBeDefined(),
        );

        rerender(
            <PatrolRouteLayer
                map={map as never}
                startPoint={null}
                endPoint={null}
                routes={ROUTES}
                selectedIndex={1}
            />,
        );
        await waitFor(() =>
            expect(map.setPaintProperty).toHaveBeenCalledWith(
                "patrol-route-1-line",
                "line-color",
                "#103364",
            ),
        );
    });
});
