import { describe, it, expect, beforeEach, vi } from "vitest";

import { db } from "@/offline/db";
import { enqueue, saveDraft } from "@/offline/draftsStore";
import { flushOutbox } from "@/offline/syncService";
import { reportsApi } from "@/services/reportsApi";
import { blankDraftReportInput } from "@/types/reports";
import type { DraftReportInput } from "@/types/reports";
import type { SyncItemStatus } from "@/services/reportsApi";

vi.mock("@/services/reportsApi", () => ({
    reportsApi: { syncReports: vi.fn() },
}));

vi.mock("@/lib/media", async () => {
    const actual =
        await vi.importActual<typeof import("@/lib/media")>("@/lib/media");
    return { ...actual, resolvePhotoUrls: vi.fn(async () => []) };
});

const USER = "user-1";

function input(overrides: Partial<DraftReportInput> = {}): DraftReportInput {
    return {
        ...blankDraftReportInput("incident"),
        description: "Snare near the fence",
        incidentType: "Snare Found",
        severity: "high",
        lat: -24.2,
        lon: 31.18,
        ...overrides,
    };
}

async function queueDraft(localId: string, kind: "create" | "delete") {
    await saveDraft(USER, localId, input(), "offline");
    await enqueue(USER, localId, kind);
}

function respond(localId: string, status: SyncItemStatus, message?: string) {
    vi.mocked(reportsApi.syncReports).mockResolvedValue({
        results: [{ local_id: localId, status, message }],
    });
}

beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    vi.mocked(reportsApi.syncReports).mockReset();
});

describe("flushOutbox", () => {
    it("sends every due entry in a single batch", async () => {
        await queueDraft("d1", "create");
        await queueDraft("d2", "create");
        vi.mocked(reportsApi.syncReports).mockResolvedValue({
            results: [
                { local_id: "d1", status: "created" },
                { local_id: "d2", status: "created" },
            ],
        });

        const outcome = await flushOutbox(USER);

        expect(reportsApi.syncReports).toHaveBeenCalledTimes(1);
        expect(vi.mocked(reportsApi.syncReports).mock.calls[0][0]).toHaveLength(
            2,
        );
        expect(outcome.synced).toBe(2);
    });

    it("clears the draft and queue entry once the server has it", async () => {
        await queueDraft("d1", "create");
        respond("d1", "created");

        await flushOutbox(USER);

        expect(await db.drafts.count()).toBe(0);
        expect(await db.outbox.count()).toBe(0);
    });

    it("drops the local copy on a conflict without counting it as synced", async () => {
        await queueDraft("d1", "create");
        respond("d1", "conflict", "Server copy is newer");

        const outcome = await flushOutbox(USER);

        expect(outcome).toEqual({ synced: 0, failed: 0 });
        expect(await db.drafts.count()).toBe(0);
        expect(await db.outbox.count()).toBe(0);
    });

    it("keeps a failed entry queued and records why", async () => {
        await queueDraft("d1", "create");
        respond("d1", "error", "occurred_at cannot be in the future");

        const outcome = await flushOutbox(USER);

        expect(outcome.failed).toBe(1);
        expect(await db.drafts.count()).toBe(1);

        const entry = await db.outbox.toCollection().first();
        expect(entry?.attempts).toBe(1);
        expect(entry?.lastError).toBe("occurred_at cannot be in the future");
        expect(entry?.nextAttemptAt).toBeGreaterThan(Date.now());
    });

    it("requeues the whole batch when the request itself fails", async () => {
        await queueDraft("d1", "create");
        await queueDraft("d2", "create");
        vi.mocked(reportsApi.syncReports).mockRejectedValue(
            new Error("Network Error"),
        );

        const outcome = await flushOutbox(USER);

        expect(outcome).toEqual({ synced: 0, failed: 2 });
        expect(await db.drafts.count()).toBe(2);
        expect(await db.outbox.count()).toBe(2);
    });

    it("leaves an entry alone until its backoff has elapsed", async () => {
        await queueDraft("d1", "create");
        const entry = await db.outbox.toCollection().first();
        await db.outbox.update(entry!.id, {
            nextAttemptAt: Date.now() + 60_000,
        });

        const outcome = await flushOutbox(USER);

        expect(reportsApi.syncReports).not.toHaveBeenCalled();
        expect(outcome).toEqual({ synced: 0, failed: 0 });
    });

    it("marks a queued delete so the server soft-deletes it", async () => {
        await queueDraft("d1", "delete");
        respond("d1", "deleted");

        await flushOutbox(USER);

        const sent = vi.mocked(reportsApi.syncReports).mock.calls[0][0][0];
        expect(sent.deleted_at).toBeTruthy();
        expect(sent.local_id).toBe("d1");
    });

    it("will not run two flushes at once", async () => {
        await queueDraft("d1", "create");
        let release: (value: unknown) => void = () => {};
        vi.mocked(reportsApi.syncReports).mockReturnValue(
            new Promise((resolve) => {
                release = resolve;
            }) as ReturnType<typeof reportsApi.syncReports>,
        );

        const first = flushOutbox(USER);
        const second = await flushOutbox(USER);

        expect(second).toEqual({ synced: 0, failed: 0 });
        release({ results: [{ local_id: "d1", status: "created" }] });
        await first;
        expect(reportsApi.syncReports).toHaveBeenCalledTimes(1);
    });
});
