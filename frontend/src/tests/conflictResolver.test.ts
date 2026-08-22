import { describe, it, expect } from "vitest";

import { resolveSyncResult } from "@/offline/conflictResolver";

describe("resolveSyncResult", () => {
    it.each([
        ["created", true, true],
        ["updated", true, true],
        ["deleted", true, true],
        ["conflict", true, false],
        ["error", false, false],
    ] as const)("resolves %s", (status, shouldDiscard, shouldCount) => {
        expect(resolveSyncResult(status)).toEqual({
            shouldDiscardLocal: shouldDiscard,
            shouldCountAsSynced: shouldCount,
        });
    });
});
