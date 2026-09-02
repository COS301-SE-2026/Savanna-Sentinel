import { describe, it, expect, beforeEach, vi } from "vitest";

import { loadProfile } from "@/offline/profileCache";
import { usersApi, type UserResponse } from "@/services/usersApi";
import { cacheKeys, db } from "@/offline/db";

vi.mock("@/services/usersApi", () => ({
    usersApi: { getMe: vi.fn() },
}));

const USER = "user-1";

const PROFILE: UserResponse = {
    id: USER,
    username: "ranger1",
    email: "ranger1@sentinel.dev",
    first_name: "Thandi",
    last_name: "Mokoena",
    role: "ranger",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
    vi.mocked(usersApi.getMe).mockReset();
    vi.mocked(usersApi.getMe).mockResolvedValue(PROFILE);
});

describe("loadProfile online", () => {
    it("caches the name and nothing else", async () => {
        await loadProfile(USER);

        const row = await db.cache.get(cacheKeys.profile());
        expect(row?.payload).toEqual({
            firstName: "Thandi",
            lastName: "Mokoena",
        });
    });
});

describe("loadProfile offline", () => {
    it("serves the saved name and leaves profile null", async () => {
        await loadProfile(USER);
        vi.mocked(usersApi.getMe).mockRejectedValue(new Error("offline"));

        const result = await loadProfile(USER);

        expect(result.isFromCache).toBe(true);
        expect(result.firstName).toBe("Thandi");
        expect(result.lastName).toBe("Mokoena");
        expect(result.profile).toBeNull();
    });

    it("rethrows when no name has ever been cached", async () => {
        vi.mocked(usersApi.getMe).mockRejectedValue(new Error("offline"));

        await expect(loadProfile(USER)).rejects.toThrow("offline");
    });
});
