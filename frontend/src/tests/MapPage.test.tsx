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
import * as WorkspaceMapLayersModule from "@/components/workspace/WorkspaceMapLayers";
import * as LayerTreePanelModule from "@/components/workspace/LayerTreePanel";
import * as useWorkspacePoisModule from "@/hooks/useWorkspacePois";
import * as MapControlsModule from "@/components/map/MapControls";
import * as useUserLocationModule from "@/hooks/useUserLocation";
import * as SelectReferenceModalModule from "@/components/map/SelectReferenceModal";
import MapPage from "@/pages/MapPage";
import { Toaster } from "@/components/ui/sonner";
import { riskHandlers } from "./mocks/riskHandlers";
import { workspaceHandlers } from "./mocks/workspaceHandlers";
import { SAVED_ROUTE } from "./mocks/savedRouteHandlers";
import { useMapStore, initialMapState } from "@/store/mapStore";
import { useAuthStore } from "@/store/authStore";
import { loadPinnedRoute, pinRouteToHeatmap } from "@/offline/pinnedRouteCache";
import { db } from "@/offline/db";
import type { FakeMap } from "./mocks/maplibreMock";
import {
    initialWorkspaceState,
    useWorkspaceStore,
} from "@/store/workspaceStore";
import * as resolveModule from "@/lib/workspace/resolveVisibleFeatures";
import type React from "react";
import { type Poi } from "@/components/map/SelectReferenceModal";

const USER_ID = "u1";
const MOCK_LAYER = {
    id: "layer-test",
    name: "Test Layer",
    parentId: null,
    order: 0,
    defaultStyle: {},
    defaultRules: {},
};
const MOCK_FEATURE = {
    name: "Test feature",
    id: "feature-1",
    type: "point" as const,
    geometry: {
        type: "Point" as const,
        coordinates: [31.18, -24.2],
    },
    properties: { name: "Test feature" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    inEffect: true,
    bufferEnabled: false,
    bufferDistanceM: 100,
    rules: {},
};

const MOCK_MEMBERSHIP = {
    id: "mem-1",
    layerId: "layer-test",
    featureId: "feature-1",
    visible: true,
    order: 0,
    styleOverride: {},
};

const server = setupServer(...riskHandlers, ...workspaceHandlers);
beforeAll(() => server.listen());
afterEach(async () => {
    server.resetHandlers();
    vi.restoreAllMocks();
    useMapStore.setState(initialMapState, true);
    await db.cache.clear();
    useAuthStore.setState({
        user: null,
        accessToken: null,
        refreshToken: null,
    });
    useWorkspaceStore.setState(initialWorkspaceState, true);
});
afterAll(() => server.close());

async function signInWithPinnedRoute() {
    useAuthStore.setState({
        user: { id: USER_ID, username: "tester", role: "ranger" },
        accessToken: "token",
        refreshToken: "refresh",
    });
    await pinRouteToHeatmap(USER_ID, SAVED_ROUTE);
}

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

    it("has no Patrol Route layer control until a route has been sent over", async () => {
        renderPage();
        await screen.findByRole("checkbox", { name: /risk heatmap/i });

        expect(
            screen.queryByRole("checkbox", { name: /patrol route/i }),
        ).not.toBeInTheDocument();
    });

    it("draws a route sent from the patrol planner, with its start, stop and end markers", async () => {
        await signInWithPinnedRoute();
        const addSourceSpy = vi.spyOn(maplibregl.Map.prototype, "addSource");
        renderPage();

        await waitFor(() => {
            const ids = addSourceSpy.mock.calls.map(([id]) => id);
            expect(ids).toContain("patrol-route-0");
        });

        const map = addSourceSpy.mock.instances[0] as unknown as FakeMap;
        const source = map.getSource("patrol-route-0") as unknown as {
            data: { geometry: { coordinates: [number, number][] } };
        };
        expect(source.data.geometry.coordinates).toEqual(
            SAVED_ROUTE.path_geometry.coordinates,
        );
        await waitFor(() => expect(map.markers.size).toBe(3));
        const stopMarker = [...map.markers].find(
            (m) => m.element.textContent === "1",
        );
        expect(stopMarker?.getLngLat()).toEqual({ lng: 31.06, lat: -24.31 });
    });

    it("draws the route sent over even when the risk grid cannot be fetched", async () => {
        server.use(
            http.get("http://localhost:8000/v1/risk/grid", () =>
                HttpResponse.json({ detail: "offline" }, { status: 500 }),
            ),
        );
        await signInWithPinnedRoute();
        const addSourceSpy = vi.spyOn(maplibregl.Map.prototype, "addSource");
        renderPage();

        await waitFor(() => {
            const ids = addSourceSpy.mock.calls.map(([id]) => id);
            expect(ids).toContain("patrol-route-0");
        });
    });

    it("removes the route line when the Patrol Route layer is unchecked", async () => {
        await signInWithPinnedRoute();
        const removeLayerSpy = vi.spyOn(
            maplibregl.Map.prototype,
            "removeLayer",
        );
        renderPage();

        await userEvent.click(
            await screen.findByRole("checkbox", { name: /patrol route/i }),
        );

        await waitFor(() =>
            expect(removeLayerSpy).toHaveBeenCalledWith("patrol-route-0-line"),
        );
    });

    it("forgets the route on this device when Remove is clicked", async () => {
        await signInWithPinnedRoute();
        renderPage();
        await screen.findByRole("checkbox", { name: /patrol route/i });

        await userEvent.click(screen.getByRole("button", { name: /remove/i }));

        await waitFor(() =>
            expect(
                screen.queryByRole("checkbox", { name: /patrol route/i }),
            ).not.toBeInTheDocument(),
        );
        expect(await loadPinnedRoute(USER_ID)).toBeNull();
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

    it("loads workspace data on mount", async () => {
        const loadWorkspaceSpy = vi.fn();
        useWorkspaceStore.setState({
            status: "idle",
            loadWorkspace: loadWorkspaceSpy,
        });

        renderPage();

        await waitFor(() => {
            expect(loadWorkspaceSpy).toHaveBeenCalledTimes(1);
        });
    });

    it("selects a layer when clicked", async () => {
        useWorkspaceStore.setState({
            status: "ready",
            layers: [MOCK_LAYER],
            memberships: [],
            features: [],
        });

        renderPage();

        const layerButton = await screen.findByRole("button", {
            name: "Test Layer",
        });

        expect(layerButton).not.toHaveAttribute("aria-current");
        await userEvent.click(layerButton);

        expect(layerButton).toHaveAttribute("aria-current", "true");
    });

    it("selects a membership item and figures out the id", async () => {
        useWorkspaceStore.setState({
            status: "ready",
            layers: [MOCK_LAYER],
            memberships: [MOCK_MEMBERSHIP],
            features: [MOCK_FEATURE],
        });

        renderPage();

        const membershipButton = await screen.findByRole("button", {
            name: "Test feature",
        });

        expect(membershipButton).not.toHaveAttribute("aria-current");
        await userEvent.click(membershipButton);

        expect(membershipButton).toHaveAttribute("aria-current", "true");
    });

    it("selects a feature when clicked on the map", async () => {
        useWorkspaceStore.setState({
            status: "ready",
            layers: [MOCK_LAYER],
            memberships: [MOCK_MEMBERSHIP],
            features: [MOCK_FEATURE],
        });

        vi.spyOn(resolveModule, "resolveVisibleFeatures").mockReturnValue([
            {
                membershipId: MOCK_MEMBERSHIP.id,
                layerId: MOCK_MEMBERSHIP.layerId,
                z: 0,
                feature: MOCK_FEATURE,
                style: {
                    colour: "#000000",
                    opacity: 1,
                },
            },
        ]);

        renderPage();

        const membershipButton = await screen.findByRole("button", {
            name: "Test feature",
        });

        await userEvent.click(membershipButton);
        await waitFor(() => {
            expect(membershipButton).toHaveAttribute("aria-current", "true");
        });
    });

    it("clears selection when an empty area is clicked", async () => {
        const onSpy = vi.spyOn(maplibregl.Map.prototype, "on");
        vi.spyOn(resolveModule, "resolveVisibleFeatures").mockReturnValue([]);

        useWorkspaceStore.setState({
            status: "ready",
            layers: [MOCK_LAYER],
            memberships: [MOCK_MEMBERSHIP],
            features: [MOCK_FEATURE],
            loadWorkspace: vi.fn(),
        });

        renderPage();

        const layerButton = await screen.findByRole("button", {
            name: "Test Layer",
        });

        await userEvent.click(layerButton);
        expect(layerButton).toHaveAttribute("aria-current");

        const map = onSpy.mock.instances[0] as unknown as FakeMap;
        act(() => {
            map.fire("click", {
                point: { x: 100, y: 100 },
                lngLat: { lng: 31.18, lat: -24.2 },
            });
        });

        await waitFor(() => {
            expect(layerButton).not.toHaveAttribute("aria-current");
        });
    });

    it("ignores map feature clicks if a feature cannot be found", async () => {
        const onSpy = vi.spyOn(maplibregl.Map.prototype, "on");
        vi.spyOn(resolveModule, "resolveVisibleFeatures").mockReturnValue([]);

        useWorkspaceStore.setState({
            status: "ready",
            layers: [MOCK_LAYER],
            memberships: [MOCK_MEMBERSHIP],
            features: [MOCK_FEATURE],
            loadWorkspace: vi.fn(),
        });

        renderPage();
        const layerButton = await screen.findByRole("button", {
            name: "Test Layer",
        });

        await userEvent.click(layerButton);
        expect(layerButton).toHaveAttribute("aria-current");

        const map = onSpy.mock.instances[0] as unknown as FakeMap;
        act(() => {
            map.fire("click", {
                point: { x: 100, y: 100 },
                lngLat: { lng: 31.18, lat: -24.2 },
                features: [{ properties: { featureId: "error-feature" } }],
            });
        });

        await waitFor(() => {
            expect(layerButton).not.toHaveAttribute("aria-current");
        });
    });

    it("clears selection when handleFeatureClick receives null", async () => {
        const onSpy = vi.spyOn(maplibregl.Map.prototype, "on");

        useWorkspaceStore.setState({
            status: "ready",
            layers: [MOCK_LAYER],
            memberships: [MOCK_MEMBERSHIP],
            features: [MOCK_FEATURE],
            loadWorkspace: vi.fn(),
        });

        renderPage();

        const layerButton = await screen.findByRole("button", {
            name: "Test Layer",
        });
        await userEvent.click(layerButton);
        expect(layerButton).toHaveAttribute("aria-current", "true");

        const map = onSpy.mock.instances[0] as unknown as FakeMap;
        map.queryRenderedFeatures = vi.fn().mockReturnValue([]);
        act(() => {
            map.fire("click", {
                point: { x: 100, y: 100 },
                lngLat: { lng: 31.18, lat: -24.2 },
            });
        });

        await waitFor(() => {
            expect(layerButton).not.toHaveAttribute("aria-current");
        });
    });

    it("ignores map feature clicks if a feature cannot be found null version", async () => {
        let capturedOnFeatureClick: ((id: string | null) => void) | undefined;

        vi.spyOn(
            WorkspaceMapLayersModule,
            "WorkspaceMapLayers",
        ).mockImplementation((props) => {
            capturedOnFeatureClick = props.onFeatureClick;
            return null;
        });

        vi.spyOn(resolveModule, "resolveVisibleFeatures").mockReturnValue([]);

        useWorkspaceStore.setState({
            status: "ready",
            layers: [MOCK_LAYER],
            memberships: [MOCK_MEMBERSHIP],
            features: [MOCK_FEATURE],
            loadWorkspace: vi.fn(),
        });

        renderPage();

        const layerButton = await screen.findByRole("button", {
            name: "Test Layer",
        });
        await userEvent.click(layerButton);
        expect(layerButton).toHaveAttribute("aria-current", "true");

        act(() => {
            capturedOnFeatureClick?.("unresolvable-feature-id");
        });

        expect(layerButton).toHaveAttribute("aria-current", "true");
    });

    it("clears selection when handleSelectLayer receives undefined", async () => {
        let capturedProps!: React.ComponentProps<
            typeof LayerTreePanelModule.LayerTreePanel
        >;
        vi.spyOn(LayerTreePanelModule, "LayerTreePanel").mockImplementation(
            (props) => {
                capturedProps = props;
                return <></>;
            },
        );

        useWorkspaceStore.setState({
            status: "ready",
            layers: [MOCK_LAYER],
            memberships: [MOCK_MEMBERSHIP],
            features: [MOCK_FEATURE],
            loadWorkspace: vi.fn(),
        });

        renderPage();

        act(() => {
            capturedProps.onSelectLayer("layer-1");
        });
        expect(capturedProps?.selection).toEqual({
            kind: "layer",
            layerId: "layer-1",
        });

        act(() => {
            capturedProps.onSelectLayer(undefined as unknown as string);
        });
        expect(capturedProps?.selection).toBeNull();
    });

    it("clears selection when handleSelectMembership receives undefined", async () => {
        let capturedProps!: React.ComponentProps<
            typeof LayerTreePanelModule.LayerTreePanel
        >;
        vi.spyOn(LayerTreePanelModule, "LayerTreePanel").mockImplementation(
            (props) => {
                capturedProps = props;
                return <div data-testid="mock-layer-tree" />;
            },
        );

        useWorkspaceStore.setState({
            status: "ready",
            layers: [MOCK_LAYER],
            memberships: [MOCK_MEMBERSHIP],
            features: [MOCK_FEATURE],
            loadWorkspace: vi.fn(),
        });

        renderPage();

        act(() => {
            capturedProps.onSelectMembership("membership-1");
        });
        expect(capturedProps.selection).toEqual({
            kind: "membership",
            membershipId: "membership-1",
        });

        act(() => {
            capturedProps.onSelectMembership(undefined as unknown as string);
        });
        expect(capturedProps.selection).toBeNull();
    });

    it("passes showReferenceButton and hasReferencePoint to MapControls and fetches POIs from useWorkspace", async () => {
        const mockPois = [
            { id: "poi-1", name: "Test 1", lat: -24.3, lon: 31.05 },
        ];

        vi.spyOn(useWorkspacePoisModule, "useWorkspacePois").mockReturnValue(
            mockPois,
        );

        let capturedControlsProps: React.ComponentProps<
            typeof MapControlsModule.MapControls
        > | null = null;
        vi.spyOn(MapControlsModule, "MapControls").mockImplementation(
            (props) => {
                capturedControlsProps = props;
                return <div data-testid="mock-map-controls" />;
            },
        );

        const mockSetReferencePoint = vi.fn();
        vi.spyOn(useUserLocationModule, "useUserLocation").mockReturnValue({
            location: null,
            status: "needs-reference",
            hasNoReferencePoint: true,
            setReferencePoint: mockSetReferencePoint,
        });

        const { unmount } = renderPage();

        expect(capturedControlsProps!.showReferenceButton).toBe(false);
        expect(capturedControlsProps!.hasReferencePoint).toBe(false);

        const locationToggle = await screen.findByRole("checkbox", {
            name: /my location/i,
        });
        await userEvent.click(locationToggle);

        await waitFor(() => {
            expect(capturedControlsProps!.showReferenceButton).toBe(true);
        });
        expect(capturedControlsProps!.hasReferencePoint).toBe(false);

        unmount();
    });

    it("opens SelectReferenceModal, sets reference point on POI select, and handles previewing a POI", async () => {
        const mockPoi: Poi = {
            id: "poi-1",
            name: "Test 1",
            lat: -24.3,
            lon: 31.05,
        };
        vi.spyOn(useWorkspacePoisModule, "useWorkspacePois").mockReturnValue([
            mockPoi,
        ]);

        const mockSetReferencePoint = vi.fn();
        vi.spyOn(useUserLocationModule, "useUserLocation").mockReturnValue({
            location: null,
            status: "needs-reference",
            hasNoReferencePoint: true,
            setReferencePoint: mockSetReferencePoint,
        });

        let capturedModalProps: React.ComponentProps<
            typeof SelectReferenceModalModule.default
        > | null = null;

        vi.spyOn(SelectReferenceModalModule, "default").mockImplementation(
            (props) => {
                capturedModalProps = props;
                return <div data-testid="mock-select-reference-modal" />;
            },
        );

        let capturedControlsProps: React.ComponentProps<
            typeof MapControlsModule.MapControls
        > | null = null;
        vi.spyOn(MapControlsModule, "MapControls").mockImplementation(
            (props) => {
                capturedControlsProps = props;
                return <div data-testid="mock-map-controls" />;
            },
        );

        const addSourceSpy = vi.spyOn(maplibregl.Map.prototype, "addSource");

        useWorkspaceStore.setState({
            status: "ready",
            layers: [MOCK_LAYER],
            memberships: [MOCK_MEMBERSHIP],
            features: [MOCK_FEATURE],
        });

        vi.spyOn(resolveModule, "resolveVisibleFeatures").mockReturnValue([
            {
                membershipId: MOCK_MEMBERSHIP.id,
                layerId: MOCK_MEMBERSHIP.layerId,
                z: 0,
                feature: MOCK_FEATURE,
                style: { colour: "#000000", opacity: 1 },
            },
        ]);

        const { unmount } = renderPage();

        await waitFor(() => expect(addSourceSpy).toHaveBeenCalled());
        const map = addSourceSpy.mock.instances[0] as unknown as FakeMap;
        map.flyTo = vi.fn();

        expect(capturedModalProps!.open).toBe(false);
        expect(capturedModalProps!.pois).toEqual([mockPoi]);

        act(() => {
            capturedControlsProps!.onOpenPoiModal?.();
        });
        expect(capturedModalProps!.open).toBe(true);

        act(() => {
            capturedModalProps!.onSelectPoi?.(mockPoi);
        });

        expect(mockSetReferencePoint).toHaveBeenCalledWith({
            lat: -24.3,
            lon: 31.05,
            heading: 0,
            accuracy: 10,
        });

        act(() => {
            capturedModalProps!.onPreviewPoi?.(mockPoi);
        });

        expect(capturedModalProps!.open).toBe(false);

        expect(map.flyTo).toHaveBeenCalledWith({
            center: [31.05, -24.3],
            zoom: 12,
            duration: 800,
        });

        unmount();
    });
});
