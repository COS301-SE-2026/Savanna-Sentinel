import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/offline/db", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/offline/db")>();
    return {
        ...actual,
        clearOfflineData: vi.fn().mockResolvedValue(undefined),
    };
});
vi.mock("@/services/authApi", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/services/authApi")>();
    return {
        ...actual,
        authApi: {
            ...actual.authApi,
            logout: vi.fn().mockResolvedValue(undefined),
        },
    };
});

import { useAuthStore } from "@/store/authStore";
import {
    useWorkspaceStore,
    initialWorkspaceState,
} from "@/store/workspaceStore";

afterEach(() => {
    useWorkspaceStore.setState(initialWorkspaceState, true);
    localStorage.clear();
});

describe("authStore logout", () => {
    it("clears the saved workspace so the next user does not inherit it", () => {
        useWorkspaceStore.getState().addLayer("Patrol zones", null);
        useWorkspaceStore.getState().saveWorkspace();

        useAuthStore.getState().logout();

        expect(localStorage.getItem("workspace-storage")).toBeNull();
        expect(useWorkspaceStore.getState().layers).toEqual([]);
    });
});
