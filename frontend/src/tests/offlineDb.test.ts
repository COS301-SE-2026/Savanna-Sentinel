import { describe, it, expect } from "vitest";

import {
    clearOfflineData,
    db,
    readCache,
    writeCache,
    STALE_AFTER_MS,
} from "@/offline/db";

const USER = "user-1";
const OTHER_USER = "user-2";

describe("readCache and writeCache", () => {
    it("refuses a row belonging to another user", async () => {
        await writeCache("k", USER, { secret: true });

        expect(await readCache("k", OTHER_USER)).toBeNull();
    });

    it("round-trips a payload and flags one past the threshold as stale", async () => {
        await writeCache("k", USER, { hello: "world" });
        expect((await readCache("k", USER))?.payload).toEqual({
            hello: "world",
        });

        const row = await db.cache.get("k");
        await db.cache.put({
            ...row!,
            fetchedAt: Date.now() - STALE_AFTER_MS - 1_000,
        });

        expect((await readCache("k", USER))?.isStale).toBe(true);
    });
});

describe("clearOfflineData", () => {
    it("empties every store, since logout must leave nothing behind", async () => {
        await writeCache("k", USER, {});
        await db.drafts.put({
            localId: "d1",
            userId: USER,
            syncStatus: "offline",
            createdAt: Date.now(),
            payload: {},
        });
        await db.outbox.put({
            id: "o1",
            kind: "create",
            userId: USER,
            draftLocalId: "d1",
            createdAt: Date.now(),
            attempts: 0,
        });
        await db.routes.put({
            routeId: "r1",
            userId: USER,
            savedAt: Date.now(),
            payload: {},
        });

        await clearOfflineData();

        const counts = await Promise.all(
            db.tables.map((table) => table.count()),
        );
        expect(counts.every((count) => count === 0)).toBe(true);
    });
});
