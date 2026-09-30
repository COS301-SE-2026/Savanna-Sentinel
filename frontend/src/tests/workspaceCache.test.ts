import { describe, it, expect, beforeEach, vi } from "vitest";

import {
    loadWorkspaceSnapshot,
    prefetchWorkspace,
} from "@/offline/workspaceCache";
import {
    fetchWorkspace,
    type WorkspaceSnapshot,
} from "@/services/workspaceApi";
import { cacheKeys, db, STALE_AFTER_MS } from "@/offline/db";

vi.mock("@/services/workspaceApi", () => ({
    fetchWorkspace: vi.fn(),
}));

const USER = "user-1";

const SNAPSHOT: WorkspaceSnapshot = {
    version: 3,
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
            type: "point",
            name: "North waterhole",
            geometry: { type: "Point", coordinates: [31.5, -24.2] },
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
    await db.cache.clear();
    vi.mocked(fetchWorkspace).mockReset();
    vi.mocked(fetchWorkspace).mockResolvedValue(SNAPSHOT);
});

describe("prefetchWorkspace", () => {
    it("caches the workspace so it is available offline later", async () => {
        await prefetchWorkspace(USER);
        vi.mocked(fetchWorkspace).mockRejectedValue(new Error("offline"));

        const result = await loadWorkspaceSnapshot(USER);

        expect(result.isFromCache).toBe(true);
        expect(result.snapshot).toEqual(SNAPSHOT);
    });

    it("swallows network failures", async () => {
        vi.mocked(fetchWorkspace).mockRejectedValue(new Error("offline"));

        await expect(prefetchWorkspace(USER)).resolves.toBeUndefined();
    });
});

describe("loadWorkspaceSnapshot", () => {
    it("returns the live workspace and does not flag it as cached", async () => {
        const result = await loadWorkspaceSnapshot(USER);

        expect(result.isFromCache).toBe(false);
        expect(result.snapshot).toEqual(SNAPSHOT);
    });

    it("serves the last workspace when the network is down", async () => {
        await loadWorkspaceSnapshot(USER);
        vi.mocked(fetchWorkspace).mockRejectedValue(new Error("offline"));

        const result = await loadWorkspaceSnapshot(USER);

        expect(result.isFromCache).toBe(true);
        expect(result.snapshot).toEqual(SNAPSHOT);
    });

    it("rethrows the network error when nothing is cached", async () => {
        vi.mocked(fetchWorkspace).mockRejectedValue(new Error("offline"));

        await expect(loadWorkspaceSnapshot(USER)).rejects.toThrow("offline");
    });

    it("does not serve another user's cached workspace", async () => {
        await loadWorkspaceSnapshot("other-user");
        vi.mocked(fetchWorkspace).mockRejectedValue(new Error("offline"));

        await expect(loadWorkspaceSnapshot(USER)).rejects.toThrow("offline");
    });

    it("reports a workspace older than the refresh cycle as stale", async () => {
        await loadWorkspaceSnapshot(USER);
        const row = await db.cache.get(cacheKeys.workspace());
        await db.cache.put({
            ...row!,
            fetchedAt: Date.now() - STALE_AFTER_MS - 1_000,
        });
        vi.mocked(fetchWorkspace).mockRejectedValue(new Error("offline"));

        expect((await loadWorkspaceSnapshot(USER)).isStale).toBe(true);
    });

    it("skips the cache and still fetches when there is no user", async () => {
        const result = await loadWorkspaceSnapshot(null);

        expect(result.snapshot).toEqual(SNAPSHOT);
        expect(await db.cache.count()).toBe(0);
    });
});
