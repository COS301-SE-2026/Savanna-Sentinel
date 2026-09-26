import {
    render,
    screen,
    cleanup,
    waitFor,
    fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupServer } from "msw/node";
import {
    describe,
    it,
    expect,
    afterEach,
    beforeAll,
    afterAll,
    beforeEach,
    vi,
} from "vitest";

vi.mock("maplibre-gl", async () => {
    const { createMapLibreMock } = await import("./mocks/maplibreMock");
    return createMapLibreMock();
});
vi.mock("terra-draw", async () => {
    const { createTerraDrawMock } = await import("./mocks/terraDrawMock");
    return createTerraDrawMock();
});
vi.mock("terra-draw-maplibre-gl-adapter", async () => {
    const { createTerraDrawAdapterMock } =
        await import("./mocks/terraDrawMock");
    return createTerraDrawAdapterMock();
});

vi.mock("@/components/ui/toast", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@/components/ui/toast")>();
    return { ...actual, notifySafe: vi.fn(), notifyCritical: vi.fn() };
});

import * as maplibregl from "maplibre-gl";
import WorkspacePage from "@/pages/WorkspacePage";
import {
    useWorkspaceStore,
    initialWorkspaceState,
} from "@/store/workspaceStore";
import { useMapStore, initialMapState } from "@/store/mapStore";
import * as useMobileModule from "@/hooks/use-mobile";
import { NAV_ITEMS } from "@/components/layout/navLinks";
import { notifyCritical, notifySafe } from "@/components/ui/toast";
import { riskHandlers } from "./mocks/riskHandlers";
import {
    workspaceHandlers,
    workspaceState,
    resetWorkspaceMock,
} from "./mocks/workspaceHandlers";
import type { FakeMap } from "./mocks/maplibreMock";

const server = setupServer(...riskHandlers, ...workspaceHandlers);
beforeAll(() => server.listen());
beforeEach(() => {
    resetWorkspaceMock();
    useWorkspaceStore.setState({ status: "ready" });
});
afterEach(() => {
    cleanup();
    server.resetHandlers();
    useWorkspaceStore.setState(initialWorkspaceState, true);
    useMapStore.setState(initialMapState, true);
    localStorage.clear();
    vi.restoreAllMocks();
});
afterAll(() => server.close());

describe("navLinks", () => {
    it("includes a Workspace entry restricted to analyst and admin", () => {
        const entry = NAV_ITEMS.find((item) => item.path === "/workspace");
        expect(entry).toBeDefined();
        expect(entry?.roles.sort()).toEqual(["admin", "analyst"]);
    });
});

describe("WorkspacePage", () => {
    it("renders the layer tree and draw toolbar on desktop", async () => {
        vi.spyOn(useMobileModule, "useIsMobile").mockReturnValue(false);
        render(<WorkspacePage />);

        expect(await screen.findByText("Layers")).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /new layer/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Point" }),
        ).toBeInTheDocument();
    });

    it("hides editing affordances and the draw toolbar on mobile", async () => {
        vi.spyOn(useMobileModule, "useIsMobile").mockReturnValue(true);
        render(<WorkspacePage />);

        expect(await screen.findByText("Layers")).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: /new layer/i }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "Point" }),
        ).not.toBeInTheDocument();
    });

    it("selecting a membership from the tree opens the style editor panel on desktop", async () => {
        vi.spyOn(useMobileModule, "useIsMobile").mockReturnValue(false);
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] });

        render(<WorkspacePage />);

        const featureRow = await screen.findByText("Point");
        await userEvent.click(featureRow);

        expect(await screen.findByText("Point feature")).toBeInTheDocument();
    });

    it("blocks selecting a different feature from the tree while an edit session is active", async () => {
        vi.spyOn(useMobileModule, "useIsMobile").mockReturnValue(false);
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] });
        const second = useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [1, 1] });
        useWorkspaceStore
            .getState()
            .renameFeature(second!.featureId, "Second point");

        render(<WorkspacePage />);

        await userEvent.click(await screen.findByText("Point"));
        await userEvent.click(
            await screen.findByRole("button", { name: /edit geometry/i }),
        );
        expect(
            await screen.findByRole("button", { name: /finish editing/i }),
        ).toBeInTheDocument();

        await userEvent.click(await screen.findByText("Second point"));

        expect(
            screen.getByRole("button", { name: /finish editing/i }),
        ).toBeInTheDocument();
        expect(screen.queryByLabelText("Feature name")).toHaveValue("");
    });

    it("still allows selecting a feature from the tree while a drawing tool is active", async () => {
        vi.spyOn(useMobileModule, "useIsMobile").mockReturnValue(false);
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        const created = useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] });
        useWorkspaceStore
            .getState()
            .renameFeature(created!.featureId, "My point");

        render(<WorkspacePage />);

        await userEvent.click(
            await screen.findByRole("button", { name: "Point" }),
        );
        await userEvent.click(await screen.findByText("My point"));

        expect(await screen.findByText("Point feature")).toBeInTheDocument();
    });

    it("blocks selecting a feature by clicking it on the map while a drawing tool is active", async () => {
        vi.spyOn(useMobileModule, "useIsMobile").mockReturnValue(false);
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        const created = useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] });
        useWorkspaceStore
            .getState()
            .renameFeature(created!.featureId, "My point");
        const addLayerSpy = vi.spyOn(maplibregl.Map.prototype, "addLayer");

        render(<WorkspacePage />);

        await waitFor(() => expect(addLayerSpy).toHaveBeenCalled());
        const map = addLayerSpy.mock.instances[0] as unknown as FakeMap;

        await userEvent.click(
            await screen.findByRole("button", { name: "Point" }),
        );

        map.queryRenderedFeaturesResult = [
            { properties: { id: created!.featureId } },
        ];
        map.fireClick({ lng: 0, lat: 0 });

        expect(screen.queryByText("Point feature")).not.toBeInTheDocument();
        expect(
            screen.getByText(
                "Select a layer or a feature to edit its appearance.",
            ),
        ).toBeInTheDocument();
    });

    it("deselects the current feature when clicking outside any feature on the map", async () => {
        vi.spyOn(useMobileModule, "useIsMobile").mockReturnValue(false);
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        const created = useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] });
        useWorkspaceStore
            .getState()
            .renameFeature(created!.featureId, "My point");
        const addLayerSpy = vi.spyOn(maplibregl.Map.prototype, "addLayer");

        render(<WorkspacePage />);

        await waitFor(() => expect(addLayerSpy).toHaveBeenCalled());
        const map = addLayerSpy.mock.instances[0] as unknown as FakeMap;

        map.queryRenderedFeaturesResult = [
            { properties: { id: created!.featureId } },
        ];
        map.fireClick({ lng: 0, lat: 0 });
        expect(await screen.findByText("Point feature")).toBeInTheDocument();

        map.queryRenderedFeaturesResult = [];
        map.fireClick({ lng: 5, lat: 5 });

        expect(
            await screen.findByText(
                "Select a layer or a feature to edit its appearance.",
            ),
        ).toBeInTheDocument();
        expect(screen.queryByText("Point feature")).not.toBeInTheDocument();
    });

    it("loads and renders the risk heatmap grid beneath the workspace feature layers", async () => {
        vi.spyOn(useMobileModule, "useIsMobile").mockReturnValue(false);
        const addLayerSpy = vi.spyOn(maplibregl.Map.prototype, "addLayer");

        render(<WorkspacePage />);

        await waitFor(() => {
            const ids = addLayerSpy.mock.calls.map(
                ([layer]) => (layer as { id: string }).id,
            );
            expect(ids).toContain("patrol-risk-grid-fill");
            expect(ids).toContain("patrol-risk-grid-outline");
        });

        const fillCall = addLayerSpy.mock.calls.find(
            ([layer]) =>
                (layer as { id: string }).id === "patrol-risk-grid-fill",
        );
        expect(fillCall?.[1]).toBe("workspace-stack-bottom");
    });

    it("shows a loading pill while the grid is loading, then hides it", async () => {
        vi.spyOn(useMobileModule, "useIsMobile").mockReturnValue(false);
        render(<WorkspacePage />);

        expect(screen.getByText(/loading/i)).toBeInTheDocument();
        await waitFor(() =>
            expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
        );
    });

    it("does not show the risk legend", async () => {
        vi.spyOn(useMobileModule, "useIsMobile").mockReturnValue(false);
        render(<WorkspacePage />);

        await screen.findByText("Layers");
        expect(
            screen.queryByRole("button", { name: /expand risk legend/i }),
        ).not.toBeInTheDocument();
    });

    it("hides the heatmap layer when the heatmap toggle is switched off", async () => {
        vi.spyOn(useMobileModule, "useIsMobile").mockReturnValue(false);
        const addLayerSpy = vi.spyOn(maplibregl.Map.prototype, "addLayer");

        render(<WorkspacePage />);

        await waitFor(() => {
            const ids = addLayerSpy.mock.calls.map(
                ([layer]) => (layer as { id: string }).id,
            );
            expect(ids).toContain("patrol-risk-grid-fill");
        });
        const map = addLayerSpy.mock.instances[0] as unknown as FakeMap;

        const toggle = await screen.findByRole("checkbox", {
            name: /toggle visibility for heatmap/i,
        });
        await userEvent.click(toggle);

        await waitFor(() => {
            expect(map.setLayoutProperty).toHaveBeenCalledWith(
                "patrol-risk-grid-fill",
                "visibility",
                "none",
            );
        });
    });

    it("disables the Save button until there are unsaved changes", async () => {
        vi.spyOn(useMobileModule, "useIsMobile").mockReturnValue(false);
        render(<WorkspacePage />);

        expect(
            await screen.findByRole("button", { name: /save/i }),
        ).toBeDisabled();

        useWorkspaceStore.getState().addLayer("Water", null);

        expect(
            await screen.findByRole("button", { name: /save/i }),
        ).toBeEnabled();
    });

    it("sends the workspace to the server and confirms when Save is clicked", async () => {
        vi.spyOn(useMobileModule, "useIsMobile").mockReturnValue(false);
        render(<WorkspacePage />);
        useWorkspaceStore.getState().addLayer("Water", null);

        await userEvent.click(
            await screen.findByRole("button", { name: /save/i }),
        );

        await waitFor(() => expect(notifySafe).toHaveBeenCalled());
        expect(workspaceState.saveCalls).toHaveLength(1);
        expect(workspaceState.current.layers).toHaveLength(1);
        expect(useWorkspaceStore.getState().hasUnsavedChanges).toBe(false);
    });

    it("loads the stored workspace on mount", async () => {
        vi.spyOn(useMobileModule, "useIsMobile").mockReturnValue(false);
        useWorkspaceStore.setState({ status: "idle" });
        workspaceState.current = {
            version: 2,
            layers: [
                {
                    id: "11111111-1111-4111-8111-111111111111",
                    name: "Waterholes",
                    parent_id: null,
                    order: 0,
                    default_style: {},
                },
            ],
            features: [],
            memberships: [],
        };

        render(<WorkspacePage />);

        expect(await screen.findByText("Waterholes")).toBeInTheDocument();
        expect(useWorkspaceStore.getState().version).toBe(2);
    });

    it("offers to load the latest version when somebody else saved first", async () => {
        vi.spyOn(useMobileModule, "useIsMobile").mockReturnValue(false);
        vi.mocked(notifySafe).mockClear();
        render(<WorkspacePage />);
        useWorkspaceStore.getState().addLayer("Mine", null);
        workspaceState.current = {
            version: 5,
            layers: [
                {
                    id: "22222222-2222-4222-8222-222222222222",
                    name: "Theirs",
                    parent_id: null,
                    order: 0,
                    default_style: {},
                },
            ],
            features: [],
            memberships: [],
        };

        await userEvent.click(
            await screen.findByRole("button", { name: /save/i }),
        );

        await screen.findByText("Workspace changed elsewhere");
        expect(notifySafe).not.toHaveBeenCalled();

        await userEvent.click(
            screen.getByRole("button", { name: /load latest version/i }),
        );

        await waitFor(() =>
            expect(useWorkspaceStore.getState().version).toBe(5),
        );
        expect(useWorkspaceStore.getState().layers.map((l) => l.name)).toEqual([
            "Theirs",
        ]);
    });

    it("hides the Save button on mobile", async () => {
        vi.spyOn(useMobileModule, "useIsMobile").mockReturnValue(true);
        render(<WorkspacePage />);

        expect(await screen.findByText("Layers")).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: /save/i }),
        ).not.toBeInTheDocument();
    });

    it("selects the membership the map renders when a feature appears under several layers", async () => {
        vi.spyOn(useMobileModule, "useIsMobile").mockReturnValue(false);
        const store = useWorkspaceStore.getState();
        const lowerId = store.addLayer("Lower", null);
        const upperId = store.addLayer("Upper", null);
        store.setActiveLayer(lowerId);
        const created = store.drawFeature("point", {
            type: "Point",
            coordinates: [0, 0],
        });
        const duplicateId = useWorkspaceStore
            .getState()
            .duplicateFeatureToLayer(created!.membershipId, upperId);
        // Hide the first membership so only the duplicate is rendered.
        useWorkspaceStore
            .getState()
            .toggleMembershipVisibility(created!.membershipId, false);
        const addLayerSpy = vi.spyOn(maplibregl.Map.prototype, "addLayer");

        render(<WorkspacePage />);

        await waitFor(() => expect(addLayerSpy).toHaveBeenCalled());
        const map = addLayerSpy.mock.instances[0] as unknown as FakeMap;
        map.queryRenderedFeaturesResult = [
            { properties: { id: created!.featureId } },
        ];
        map.fireClick({ lng: 0, lat: 0 });

        await screen.findByText("Point feature");
        fireEvent.change(screen.getByLabelText("Opacity"), {
            target: { value: "50" },
        });

        const byId = (id: string | null) =>
            useWorkspaceStore.getState().memberships.find((m) => m.id === id);
        expect(byId(duplicateId)?.styleOverride.opacity).toBeCloseTo(0.5);
        expect(byId(created!.membershipId)?.styleOverride.opacity).not.toBe(
            0.5,
        );
    });

    it("shows an error toast and keeps the Save button enabled when the server rejects the save", async () => {
        vi.spyOn(useMobileModule, "useIsMobile").mockReturnValue(false);
        vi.mocked(notifySafe).mockClear();
        render(<WorkspacePage />);
        useWorkspaceStore.getState().addLayer("Water", null);
        workspaceState.failSave = true;

        await userEvent.click(
            await screen.findByRole("button", { name: /save/i }),
        );

        await waitFor(() => expect(notifyCritical).toHaveBeenCalled());
        expect(notifySafe).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: /save/i })).toBeEnabled();
    });
});
