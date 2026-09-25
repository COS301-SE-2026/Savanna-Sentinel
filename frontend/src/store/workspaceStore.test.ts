import { describe, it, expect, afterEach } from "vitest";
import { useWorkspaceStore, initialWorkspaceState } from "./workspaceStore";

afterEach(() => {
    useWorkspaceStore.setState(initialWorkspaceState, true);
});

describe("layer CRUD", () => {
    it("adds a top-level layer and assigns it sibling order 0", () => {
        const id = useWorkspaceStore.getState().addLayer("Water", null);
        const layer = useWorkspaceStore
            .getState()
            .layers.find((l) => l.id === id);
        expect(layer).toMatchObject({
            name: "Water",
            parentId: null,
            order: 0,
        });
    });

    it("assigns the next sibling order when adding a second child under the same parent", () => {
        const { addLayer } = useWorkspaceStore.getState();
        const waterId = addLayer("Water", null);
        addLayer("Western water", waterId);
        const secondId = addLayer("Eastern water", waterId);
        const second = useWorkspaceStore
            .getState()
            .layers.find((l) => l.id === secondId);
        expect(second?.order).toBe(1);
    });

    it("rejects a reparent that would create a cycle and leaves the tree unchanged", () => {
        const { addLayer, reparentLayer } = useWorkspaceStore.getState();
        const waterId = addLayer("Water", null);
        const westernId = addLayer("Western water", waterId);
        const isReparented = reparentLayer(waterId, westernId);
        expect(isReparented).toBe(false);
        expect(
            useWorkspaceStore.getState().layers.find((l) => l.id === waterId)
                ?.parentId,
        ).toBeNull();
    });

    it("deleting a layer removes its memberships and clears activeLayerId if it pointed there", () => {
        const { addLayer, drawFeature, setActiveLayer, deleteLayer } =
            useWorkspaceStore.getState();
        const waterId = addLayer("Water", null);
        setActiveLayer(waterId);
        drawFeature("point", { type: "Point", coordinates: [0, 0] });
        deleteLayer(waterId);
        const state = useWorkspaceStore.getState();
        expect(state.memberships).toHaveLength(0);
        expect(state.activeLayerId).toBeNull();
    });

    it("deleting a layer deletes features that only appeared under it", () => {
        const { addLayer, drawFeature, setActiveLayer, deleteLayer } =
            useWorkspaceStore.getState();
        const waterId = addLayer("Water", null);
        setActiveLayer(waterId);
        drawFeature("point", { type: "Point", coordinates: [0, 0] });
        deleteLayer(waterId);
        expect(useWorkspaceStore.getState().features).toHaveLength(0);
    });

    it("deleting a layer only removes the membership of a feature that also appears elsewhere", () => {
        const {
            addLayer,
            drawFeature,
            setActiveLayer,
            duplicateFeatureToLayer,
            deleteLayer,
        } = useWorkspaceStore.getState();
        const waterId = addLayer("Water", null);
        const riverId = addLayer("River", null);
        setActiveLayer(waterId);
        const created = drawFeature("point", {
            type: "Point",
            coordinates: [0, 0],
        });
        duplicateFeatureToLayer(created!.membershipId, riverId);
        deleteLayer(waterId);
        const state = useWorkspaceStore.getState();
        expect(state.features.map((f) => f.id)).toEqual([created!.featureId]);
        expect(state.memberships.map((m) => m.layerId)).toEqual([riverId]);
    });

    it("deleting a parent layer deletes features that only appeared in its descendants", () => {
        const { addLayer, drawFeature, setActiveLayer, deleteLayer } =
            useWorkspaceStore.getState();
        const waterId = addLayer("Water", null);
        const westernId = addLayer("Western water", waterId);
        setActiveLayer(westernId);
        drawFeature("point", { type: "Point", coordinates: [0, 0] });
        deleteLayer(waterId);
        expect(useWorkspaceStore.getState().features).toHaveLength(0);
    });
});

describe("feature and membership CRUD", () => {
    it("drawFeature returns null when there is no active layer", () => {
        expect(
            useWorkspaceStore
                .getState()
                .drawFeature("point", { type: "Point", coordinates: [0, 0] }),
        ).toBeNull();
    });

    it("drawFeature creates a feature and a membership under the active layer", () => {
        const { addLayer, setActiveLayer, drawFeature } =
            useWorkspaceStore.getState();
        const waterId = addLayer("Water", null);
        setActiveLayer(waterId);
        const result = drawFeature("point", {
            type: "Point",
            coordinates: [1, 1],
        });
        const state = useWorkspaceStore.getState();
        expect(state.features).toHaveLength(1);
        expect(state.memberships).toEqual([
            expect.objectContaining({
                id: result?.membershipId,
                featureId: result?.featureId,
                layerId: waterId,
                visible: true,
            }),
        ]);
    });

    it("moveFeatureToLayer bakes the resolved style into the new membership so appearance is unaffected by the destination layer", () => {
        const {
            addLayer,
            setActiveLayer,
            drawFeature,
            setLayerDefaultStyle,
            moveFeatureToLayer,
        } = useWorkspaceStore.getState();
        const waterId = addLayer("Water", null);
        const roadsId = addLayer("Roads", null);
        setLayerDefaultStyle(waterId, { colour: "#2563eb" });
        setLayerDefaultStyle(roadsId, { colour: "#f59e0b" });
        setActiveLayer(waterId);
        const created = drawFeature("point", {
            type: "Point",
            coordinates: [0, 0],
        });
        const newMembershipId = moveFeatureToLayer(
            created!.membershipId,
            roadsId,
        );
        const state = useWorkspaceStore.getState();
        expect(state.memberships).toHaveLength(1);
        const newMembership = state.memberships.find(
            (m) => m.id === newMembershipId,
        );
        expect(newMembership?.layerId).toBe(roadsId);
        expect(newMembership?.styleOverride.colour).toBe("#2563eb");
    });

    it("moveFeatureToLayer refuses when the feature already appears under the target layer", () => {
        const {
            addLayer,
            setActiveLayer,
            drawFeature,
            duplicateFeatureToLayer,
            moveFeatureToLayer,
        } = useWorkspaceStore.getState();
        const waterId = addLayer("Water", null);
        const riverId = addLayer("River", null);
        setActiveLayer(waterId);
        const created = drawFeature("point", {
            type: "Point",
            coordinates: [0, 0],
        });
        duplicateFeatureToLayer(created!.membershipId, riverId);
        const before = useWorkspaceStore.getState().memberships;
        const result = moveFeatureToLayer(created!.membershipId, riverId);
        expect(result).toBeNull();
        expect(useWorkspaceStore.getState().memberships).toEqual(before);
    });

    it("moveFeatureToLayer refuses to move a feature onto the layer it is already in", () => {
        const { addLayer, setActiveLayer, drawFeature, moveFeatureToLayer } =
            useWorkspaceStore.getState();
        const waterId = addLayer("Water", null);
        setActiveLayer(waterId);
        const created = drawFeature("point", {
            type: "Point",
            coordinates: [0, 0],
        });
        expect(moveFeatureToLayer(created!.membershipId, waterId)).toBeNull();
        expect(useWorkspaceStore.getState().memberships).toHaveLength(1);
    });

    it("duplicateFeatureToLayer adds a second membership that bakes the resolved style, keeping the first", () => {
        const {
            addLayer,
            setActiveLayer,
            drawFeature,
            setLayerDefaultStyle,
            duplicateFeatureToLayer,
        } = useWorkspaceStore.getState();
        const waterId = addLayer("Water", null);
        const riverId = addLayer("River", null);
        setLayerDefaultStyle(waterId, { colour: "#2563eb" });
        setLayerDefaultStyle(riverId, { colour: "#f59e0b" });
        setActiveLayer(waterId);
        const created = drawFeature("point", {
            type: "Point",
            coordinates: [0, 0],
        });
        const newMembershipId = duplicateFeatureToLayer(
            created!.membershipId,
            riverId,
        );
        const state = useWorkspaceStore.getState();
        expect(state.memberships).toHaveLength(2);
        expect(state.memberships.map((m) => m.layerId).sort()).toEqual(
            [riverId, waterId].sort(),
        );
        const newMembership = state.memberships.find(
            (m) => m.id === newMembershipId,
        );
        expect(newMembership?.styleOverride.colour).toBe("#2563eb");
    });

    it("editFeatureGeometry mutates the single feature shared by every membership", () => {
        const {
            addLayer,
            setActiveLayer,
            drawFeature,
            duplicateFeatureToLayer,
            editFeatureGeometry,
        } = useWorkspaceStore.getState();
        const waterId = addLayer("Water", null);
        const riverId = addLayer("River", null);
        setActiveLayer(waterId);
        const created = drawFeature("point", {
            type: "Point",
            coordinates: [0, 0],
        });
        duplicateFeatureToLayer(created!.membershipId, riverId);
        editFeatureGeometry(created!.featureId, {
            type: "Point",
            coordinates: [5, 5],
        });
        const state = useWorkspaceStore.getState();
        expect(state.features).toHaveLength(1);
        expect(state.features[0].geometry).toEqual({
            type: "Point",
            coordinates: [5, 5],
        });
    });

    it("removing a feature's last membership deletes the feature", () => {
        const { addLayer, setActiveLayer, drawFeature, removeMembership } =
            useWorkspaceStore.getState();
        const waterId = addLayer("Water", null);
        setActiveLayer(waterId);
        const created = drawFeature("point", {
            type: "Point",
            coordinates: [0, 0],
        });
        removeMembership(created!.membershipId);
        const state = useWorkspaceStore.getState();
        expect(state.memberships).toHaveLength(0);
        expect(state.features).toHaveLength(0);
    });

    it("removing one of several memberships keeps the feature", () => {
        const {
            addLayer,
            setActiveLayer,
            drawFeature,
            duplicateFeatureToLayer,
            removeMembership,
        } = useWorkspaceStore.getState();
        const waterId = addLayer("Water", null);
        const riverId = addLayer("River", null);
        setActiveLayer(waterId);
        const created = drawFeature("point", {
            type: "Point",
            coordinates: [0, 0],
        });
        duplicateFeatureToLayer(created!.membershipId, riverId);
        removeMembership(created!.membershipId);
        const state = useWorkspaceStore.getState();
        expect(state.memberships.map((m) => m.layerId)).toEqual([riverId]);
        expect(state.features.map((f) => f.id)).toEqual([created!.featureId]);
    });

    it("deleteFeature removes the feature and every membership referencing it", () => {
        const {
            addLayer,
            setActiveLayer,
            drawFeature,
            duplicateFeatureToLayer,
            deleteFeature,
        } = useWorkspaceStore.getState();
        const waterId = addLayer("Water", null);
        const riverId = addLayer("River", null);
        setActiveLayer(waterId);
        const created = drawFeature("point", {
            type: "Point",
            coordinates: [0, 0],
        });
        duplicateFeatureToLayer(created!.membershipId, riverId);
        deleteFeature(created!.featureId);
        const state = useWorkspaceStore.getState();
        expect(state.features).toHaveLength(0);
        expect(state.memberships).toHaveLength(0);
    });

    it("toggleLayerVisibility bulk-sets visibility for every membership in the subtree", () => {
        const { addLayer, setActiveLayer, drawFeature, toggleLayerVisibility } =
            useWorkspaceStore.getState();
        const waterId = addLayer("Water", null);
        const westernId = addLayer("Western water", waterId);
        setActiveLayer(westernId);
        drawFeature("point", { type: "Point", coordinates: [0, 0] });
        toggleLayerVisibility(waterId, false);
        expect(
            useWorkspaceStore.getState().memberships.every((m) => !m.visible),
        ).toBe(true);
    });

    it("renameFeature sets the feature's name", () => {
        const { addLayer, setActiveLayer, drawFeature, renameFeature } =
            useWorkspaceStore.getState();
        const waterId = addLayer("Water", null);
        setActiveLayer(waterId);
        const created = drawFeature("point", {
            type: "Point",
            coordinates: [0, 0],
        });
        renameFeature(created!.featureId, "Watering hole");
        const feature = useWorkspaceStore
            .getState()
            .features.find((f) => f.id === created!.featureId);
        expect(feature?.name).toBe("Watering hole");
    });

    it("drawFeature assigns incrementing sibling order to memberships within the same layer", () => {
        const { addLayer, setActiveLayer, drawFeature } =
            useWorkspaceStore.getState();
        const waterId = addLayer("Water", null);
        setActiveLayer(waterId);
        drawFeature("point", { type: "Point", coordinates: [0, 0] });
        const second = drawFeature("point", {
            type: "Point",
            coordinates: [1, 1],
        });
        const state = useWorkspaceStore.getState();
        expect(
            state.memberships.find((m) => m.id === second?.membershipId)?.order,
        ).toBe(1);
    });

    it("reorderMembership reassigns sibling order when called with a new order", () => {
        const { addLayer, setActiveLayer, drawFeature, reorderMembership } =
            useWorkspaceStore.getState();
        const waterId = addLayer("Water", null);
        setActiveLayer(waterId);
        const first = drawFeature("point", {
            type: "Point",
            coordinates: [0, 0],
        });
        const second = drawFeature("point", {
            type: "Point",
            coordinates: [1, 1],
        });

        reorderMembership(waterId, [second!.membershipId, first!.membershipId]);

        const memberships = useWorkspaceStore.getState().memberships;
        expect(
            memberships.find((m) => m.id === second!.membershipId)?.order,
        ).toBe(0);
        expect(
            memberships.find((m) => m.id === first!.membershipId)?.order,
        ).toBe(1);
    });

    it("addLayer and drawFeature pick the next free order after a sibling was deleted", () => {
        const { addLayer, setActiveLayer, drawFeature, removeMembership } =
            useWorkspaceStore.getState();
        addLayer("First", null);
        addLayer("Second", null);
        const thirdId = addLayer("Third", null);
        const firstId = useWorkspaceStore.getState().layers[0].id;
        useWorkspaceStore.getState().deleteLayer(firstId);
        const fourthId = addLayer("Fourth", null);
        const orders = useWorkspaceStore.getState().layers.map((l) => l.order);
        expect(new Set(orders).size).toBe(orders.length);
        expect(
            useWorkspaceStore.getState().layers.find((l) => l.id === fourthId)
                ?.order,
        ).toBe(
            useWorkspaceStore.getState().layers.find((l) => l.id === thirdId)!
                .order + 1,
        );

        setActiveLayer(thirdId);
        const a = drawFeature("point", { type: "Point", coordinates: [0, 0] });
        drawFeature("point", { type: "Point", coordinates: [1, 1] });
        removeMembership(a!.membershipId);
        const c = drawFeature("point", { type: "Point", coordinates: [2, 2] });
        const memberships = useWorkspaceStore.getState().memberships;
        expect(new Set(memberships.map((m) => m.order)).size).toBe(
            memberships.length,
        );
        expect(memberships.find((m) => m.id === c!.membershipId)?.order).toBe(
            2,
        );
    });
});
