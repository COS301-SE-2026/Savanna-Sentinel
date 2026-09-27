import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
    describe,
    it,
    expect,
    afterEach,
    afterAll,
    beforeAll,
    beforeEach,
} from "vitest";

import { useWorkspaceStore, initialWorkspaceState } from "./workspaceStore";
import {
    workspaceHandlers,
    workspaceState,
    resetWorkspaceMock,
} from "@/tests/mocks/workspaceHandlers";

const server = setupServer(...workspaceHandlers);

beforeAll(() => server.listen());
beforeEach(() => resetWorkspaceMock());
afterEach(() => {
    server.resetHandlers();
    useWorkspaceStore.setState(initialWorkspaceState, true);
});
afterAll(() => server.close());

const A_LAYER = {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Water",
    parent_id: null,
    order: 0,
    default_style: { colour: "#0070bf", stroke_width: 3 },
};

describe("workspaceStore server persistence", () => {
    it("does not touch the server when a change is made", async () => {
        useWorkspaceStore.getState().addLayer("Water", null);

        expect(workspaceState.saveCalls).toHaveLength(0);
        expect(useWorkspaceStore.getState().hasUnsavedChanges).toBe(true);
    });

    it("loads the stored workspace and its version", async () => {
        workspaceState.current = {
            version: 4,
            layers: [A_LAYER],
            features: [],
            memberships: [],
        };

        await useWorkspaceStore.getState().loadWorkspace();

        const state = useWorkspaceStore.getState();
        expect(state.version).toBe(4);
        expect(state.status).toBe("ready");
        expect(state.hasUnsavedChanges).toBe(false);
        expect(state.layers).toHaveLength(1);
        expect(state.layers[0].name).toBe("Water");
        expect(state.layers[0].defaultStyle).toEqual({
            colour: "#0070bf",
            strokeWidth: 3,
        });
    });

    it("sends the whole workspace and the loaded version on save", async () => {
        await useWorkspaceStore.getState().loadWorkspace();
        useWorkspaceStore.getState().addLayer("Water", null);

        const result = await useWorkspaceStore.getState().saveWorkspace();

        expect(result).toBe("saved");
        expect(workspaceState.saveCalls).toHaveLength(1);
        expect(workspaceState.saveCalls[0].base_version).toBe(0);
        expect(workspaceState.saveCalls[0].layers).toHaveLength(1);
        expect(useWorkspaceStore.getState().version).toBe(1);
        expect(useWorkspaceStore.getState().hasUnsavedChanges).toBe(false);
    });

    it("reports a conflict and keeps the edits when the version moved on", async () => {
        await useWorkspaceStore.getState().loadWorkspace();
        useWorkspaceStore.getState().addLayer("Water", null);
        workspaceState.current = { ...workspaceState.current, version: 3 };

        const result = await useWorkspaceStore.getState().saveWorkspace();

        expect(result).toBe("conflict");
        expect(useWorkspaceStore.getState().hasUnsavedChanges).toBe(true);
        expect(useWorkspaceStore.getState().layers).toHaveLength(1);
    });

    it("reports an error and keeps the edits when the save fails", async () => {
        await useWorkspaceStore.getState().loadWorkspace();
        useWorkspaceStore.getState().addLayer("Water", null);
        workspaceState.failSave = true;

        const result = await useWorkspaceStore.getState().saveWorkspace();

        expect(result).toBe("error");
        expect(useWorkspaceStore.getState().hasUnsavedChanges).toBe(true);
    });

    it("marks the store as errored when the workspace cannot be loaded", async () => {
        server.use(
            http.get(
                "http://localhost:8000/v1/workspace",
                () => new HttpResponse(null, { status: 500 }),
            ),
        );

        await useWorkspaceStore.getState().loadWorkspace();

        expect(useWorkspaceStore.getState().status).toBe("error");
    });

    it("loading again replaces unsaved edits", async () => {
        await useWorkspaceStore.getState().loadWorkspace();
        useWorkspaceStore.getState().addLayer("Scratch", null);
        workspaceState.current = {
            version: 9,
            layers: [A_LAYER],
            features: [],
            memberships: [],
        };

        await useWorkspaceStore.getState().loadWorkspace();

        const state = useWorkspaceStore.getState();
        expect(state.version).toBe(9);
        expect(state.layers.map((l) => l.name)).toEqual(["Water"]);
        expect(state.hasUnsavedChanges).toBe(false);
    });

    it("resetWorkspace clears the in-memory workspace", async () => {
        await useWorkspaceStore.getState().loadWorkspace();
        useWorkspaceStore.getState().addLayer("Water", null);

        useWorkspaceStore.getState().resetWorkspace();

        const state = useWorkspaceStore.getState();
        expect(state.layers).toEqual([]);
        expect(state.version).toBe(0);
        expect(state.status).toBe("idle");
        expect(state.hasUnsavedChanges).toBe(false);
    });

    it("selecting a layer is not an unsaved change", async () => {
        await useWorkspaceStore.getState().loadWorkspace();
        const layerId = useWorkspaceStore.getState().addLayer("Water", null);
        await useWorkspaceStore.getState().saveWorkspace();

        useWorkspaceStore.getState().setActiveLayer(layerId);

        expect(useWorkspaceStore.getState().hasUnsavedChanges).toBe(false);
    });
});

describe("workspace visibility", () => {
    async function savedWorkspaceWithOneFeature() {
        await useWorkspaceStore.getState().loadWorkspace();
        const layerId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(layerId);
        const created = useWorkspaceStore.getState().drawFeature("point", {
            type: "Point",
            coordinates: [31.1, -24.4],
        });
        await useWorkspaceStore.getState().saveWorkspace();
        return { layerId, membershipId: created!.membershipId };
    }

    it("pushes a toggle on its own once the workspace is saved", async () => {
        const { membershipId } = await savedWorkspaceWithOneFeature();

        useWorkspaceStore
            .getState()
            .toggleMembershipVisibility(membershipId, false);
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(workspaceState.visibilityCalls).toEqual([
            { entries: [{ membership_id: membershipId, visible: false }] },
        ]);
        expect(useWorkspaceStore.getState().hasUnsavedChanges).toBe(false);
    });

    it("pushes every membership under a layer in one request", async () => {
        const { layerId, membershipId } = await savedWorkspaceWithOneFeature();

        useWorkspaceStore.getState().toggleLayerVisibility(layerId, false);
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(workspaceState.visibilityCalls).toEqual([
            { entries: [{ membership_id: membershipId, visible: false }] },
        ]);
    });

    it("leaves a toggle to the pending save while there are unsaved edits", async () => {
        await useWorkspaceStore.getState().loadWorkspace();
        const layerId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(layerId);
        const created = useWorkspaceStore.getState().drawFeature("point", {
            type: "Point",
            coordinates: [31.1, -24.4],
        });

        useWorkspaceStore
            .getState()
            .toggleMembershipVisibility(created!.membershipId, false);
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(workspaceState.visibilityCalls).toEqual([]);

        await useWorkspaceStore.getState().saveWorkspace();
        expect(workspaceState.saveCalls[0].memberships).toEqual([
            expect.objectContaining({ visible: false }),
        ]);
    });
});
