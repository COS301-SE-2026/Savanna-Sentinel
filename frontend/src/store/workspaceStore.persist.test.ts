import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { useWorkspaceStore, initialWorkspaceState } from "./workspaceStore";

beforeEach(() => {
    localStorage.clear();
});

afterEach(() => {
    useWorkspaceStore.setState(initialWorkspaceState, true);
    localStorage.clear();
});

describe("workspaceStore persistence", () => {
    it("does not write to localStorage when a change is made", () => {
        useWorkspaceStore.getState().addLayer("Water", null);
        expect(localStorage.getItem("workspace-storage")).toBeNull();
    });

    it("marks hasUnsavedChanges true after a change", () => {
        useWorkspaceStore.getState().addLayer("Water", null);
        expect(useWorkspaceStore.getState().hasUnsavedChanges).toBe(true);
    });

    it("writes state to localStorage under the workspace-storage key when saveWorkspace is called", () => {
        useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().saveWorkspace();
        const raw = localStorage.getItem("workspace-storage");
        expect(raw).not.toBeNull();
        const parsed = JSON.parse(raw!);
        expect(parsed.state.layers).toHaveLength(1);
        expect(parsed.state.layers[0].name).toBe("Water");
    });

    it("clears hasUnsavedChanges after saveWorkspace is called", () => {
        useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().saveWorkspace();
        expect(useWorkspaceStore.getState().hasUnsavedChanges).toBe(false);
    });

    it("hydrates from a previously saved localStorage state on module load", async () => {
        localStorage.setItem(
            "workspace-storage",
            JSON.stringify({
                state: {
                    layers: [
                        {
                            id: "l1",
                            name: "Water",
                            parentId: null,
                            order: 0,
                            defaultStyle: {},
                        },
                    ],
                    features: [],
                    memberships: [],
                    activeLayerId: null,
                },
                version: 0,
            }),
        );

        vi.resetModules();
        const mod = await import("./workspaceStore");

        expect(mod.useWorkspaceStore.getState().layers).toHaveLength(1);
        expect(mod.useWorkspaceStore.getState().layers[0].name).toBe("Water");
        expect(mod.useWorkspaceStore.getState().hasUnsavedChanges).toBe(false);
    });

    it("saveWorkspace returns false and keeps unsaved changes when storage throws", () => {
        useWorkspaceStore.getState().addLayer("Water", null);
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new DOMException("full", "QuotaExceededError");
        });

        const hasSaved = useWorkspaceStore.getState().saveWorkspace();

        expect(hasSaved).toBe(false);
        expect(useWorkspaceStore.getState().hasUnsavedChanges).toBe(true);
        vi.restoreAllMocks();
    });

    it("resetWorkspace clears in-memory data and the persisted copy", () => {
        useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().saveWorkspace();
        expect(localStorage.getItem("workspace-storage")).not.toBeNull();

        useWorkspaceStore.getState().resetWorkspace();

        expect(localStorage.getItem("workspace-storage")).toBeNull();
        expect(useWorkspaceStore.getState().layers).toEqual([]);
        expect(useWorkspaceStore.getState().hasUnsavedChanges).toBe(false);
    });
});
