import { describe, it, expect, beforeEach, vi } from "vitest";

import { useWorkspaceStore, initialWorkspaceState } from "./workspaceStore";
import { fetchWorkspace } from "@/services/workspaceApi";
import { db } from "@/offline/db";

vi.mock("@/services/workspaceApi", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/services/workspaceApi")>()),
    fetchWorkspace: vi.fn(),
    saveWorkspace: vi.fn(),
    saveVisibility: vi.fn(),
}));

const USER = "user-1";

const SNAPSHOT = {
    version: 4,
    layers: [
        {
            id: "layer-1",
            name: "Waterholes",
            parentId: null,
            order: 0,
            defaultStyle: {},
            defaultRules: {},
        },
    ],
    features: [
        {
            id: "feature-1",
            type: "point" as const,
            name: "North waterhole",
            geometry: {
                type: "Point" as const,
                coordinates: [31.5, -24.2],
            },
            createdAt: "2026-09-01T00:00:00Z",
            updatedAt: "2026-09-01T00:00:00Z",
            inEffect: true,
            bufferEnabled: false,
            bufferDistanceM: 100,
            rules: {},
        },
    ],
    memberships: [
        {
            id: "membership-1",
            featureId: "feature-1",
            layerId: "layer-1",
            order: 0,
            styleOverride: {},
            visible: true,
        },
    ],
};

beforeEach(async () => {
    useWorkspaceStore.setState(initialWorkspaceState, true);
    await db.cache.clear();
    vi.mocked(fetchWorkspace).mockReset();
    vi.mocked(fetchWorkspace).mockResolvedValue(SNAPSHOT);
});

describe("loadWorkspace offline", () => {
    it("restores layers and POI features from the cache when offline", async () => {
        await useWorkspaceStore.getState().loadWorkspace(USER);
        useWorkspaceStore.setState(initialWorkspaceState, true);
        vi.mocked(fetchWorkspace).mockRejectedValue(new Error("offline"));

        await useWorkspaceStore.getState().loadWorkspace(USER);

        const state = useWorkspaceStore.getState();
        expect(state.status).toBe("ready");
        expect(state.layers).toEqual(SNAPSHOT.layers);
        expect(state.features).toEqual(SNAPSHOT.features);
        expect(state.memberships).toEqual(SNAPSHOT.memberships);
        expect(state.version).toBe(SNAPSHOT.version);
    });

    it("still reports an error when offline with nothing cached", async () => {
        vi.mocked(fetchWorkspace).mockRejectedValue(new Error("offline"));

        await useWorkspaceStore.getState().loadWorkspace(USER);

        expect(useWorkspaceStore.getState().status).toBe("error");
    });
});
