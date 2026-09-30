import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/offline/workspaceCache", () => ({
    prefetchWorkspace: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/offline/riskGridCache", () => ({
    prefetchMapData: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/offline/routesCache", () => ({
    prefetchSavedRoutes: vi.fn().mockResolvedValue(undefined),
}));

import { authApi } from "@/services/authApi";
import { prefetchWorkspace } from "@/offline/workspaceCache";
import { useAuthStore } from "@/store/authStore";

function loginAs(role: string) {
    vi.spyOn(authApi, "login").mockResolvedValue({
        access_token: "a",
        refresh_token: "r",
        token_type: "bearer",
        user: { id: "user-1", username: "u", role },
    } as never);
    return useAuthStore.getState().login("u", "pw");
}

beforeEach(() => {
    vi.mocked(prefetchWorkspace).mockClear();
});

describe("authStore workspace prefetch", () => {
    it.each(["ranger", "analyst", "admin"])(
        "warms the workspace cache when a %s logs in",
        async (role) => {
            await loginAs(role);

            expect(prefetchWorkspace).toHaveBeenCalledWith("user-1");
        },
    );

    it("does not request the workspace for a community liaison", async () => {
        await loginAs("community_liaison");

        expect(prefetchWorkspace).not.toHaveBeenCalled();
    });
});
