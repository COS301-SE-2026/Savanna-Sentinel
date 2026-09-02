import { describe, it, expect, beforeEach, vi } from "vitest";

import { db } from "@/offline/db";
import {
    deleteDraft,
    enqueue,
    getDraft,
    listDrafts,
    saveDraft,
} from "@/offline/draftsStore";
import { PLACEHOLDER_PHOTO_TYPE } from "@/lib/media";
import { blankDraftReportInput } from "@/types/reports";
import type { DraftReportInput } from "@/types/reports";

const USER = "user-1";
const OTHER_USER = "user-2";

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

function localPhoto(name = "snare.jpg") {
    return {
        file: new File(["bytes"], name, { type: "image/jpeg" }),
        previewUrl: "blob:local",
    };
}

function uploadedPhoto(url: string) {
    return {
        file: new File([], "", { type: PLACEHOLDER_PHOTO_TYPE }),
        previewUrl: url,
    };
}

beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:rehydrated");
    URL.revokeObjectURL = vi.fn();
});

describe("saveDraft and getDraft", () => {
    it("round-trips the report fields", async () => {
        await saveDraft(USER, "d1", input(), "offline");

        const draft = await getDraft("d1");
        expect(draft?.description).toBe("Snare near the fence");
        expect(draft?.severity).toBe("high");
        expect(draft?.lat).toBe(-24.2);
        expect(draft?.syncStatus).toBe("offline");
    });

    it("stores a local photo as a blob and rebuilds it on read", async () => {
        await saveDraft(
            USER,
            "d1",
            input({ photos: [localPhoto("snare.jpg")] }),
            "offline",
        );

        const rows = await db.photos.toArray();
        expect(rows[0].remoteUrl).toBeUndefined();

        const draft = await getDraft("d1");
        expect(draft?.photos[0].file.name).toBe("snare.jpg");
        expect(draft?.photos[0].previewUrl).toBe("blob:rehydrated");
    });

    it("keeps an already-uploaded photo as a url, not a blob", async () => {
        const url = "https://media.test/uploaded.jpg";
        await saveDraft(
            USER,
            "d1",
            input({ photos: [uploadedPhoto(url)] }),
            "offline",
        );

        const draft = await getDraft("d1");
        expect(draft?.photos[0].previewUrl).toBe(url);
        expect(draft?.photos[0].file.type).toBe(PLACEHOLDER_PHOTO_TYPE);
        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    it("replaces photos on re-save instead of accumulating them", async () => {
        await saveDraft(
            USER,
            "d1",
            input({ photos: [localPhoto("a.jpg"), localPhoto("b.jpg")] }),
            "offline",
        );
        await saveDraft(
            USER,
            "d1",
            input({ photos: [localPhoto("c.jpg")] }),
            "offline",
        );

        expect(await db.photos.count()).toBe(1);
    });
});

describe("listDrafts", () => {
    it("returns only the given user's drafts", async () => {
        await saveDraft(USER, "mine", input(), "offline");
        await saveDraft(OTHER_USER, "theirs", input(), "offline");

        const drafts = await listDrafts(USER);
        expect(drafts.map((d) => d.localId)).toEqual(["mine"]);
    });
});

describe("deleteDraft", () => {
    it("removes the draft, its photos and its queue entry together", async () => {
        await saveDraft(
            USER,
            "d1",
            input({ photos: [localPhoto()] }),
            "offline",
        );
        await enqueue(USER, "d1", "create");

        await deleteDraft("d1");

        expect(await getDraft("d1")).toBeNull();
        expect(await db.photos.count()).toBe(0);
        expect(await db.outbox.count()).toBe(0);
    });
});

describe("enqueue", () => {
    it("keeps one entry per draft and resets its retry state", async () => {
        await enqueue(USER, "d1", "create");
        const queued = await db.outbox.toCollection().first();
        await db.outbox.update(queued!.id, {
            attempts: 3,
            lastError: "boom",
        });

        await enqueue(USER, "d1", "create");

        expect(await db.outbox.count()).toBe(1);
        const after = await db.outbox.toCollection().first();
        expect(after?.attempts).toBe(0);
        expect(after?.lastError).toBeUndefined();
    });

    it("keeps a pending create as a create when an update arrives", async () => {
        await enqueue(USER, "d1", "create");
        await enqueue(USER, "d1", "update");

        const entry = await db.outbox.toCollection().first();
        expect(entry?.kind).toBe("create");
    });
});
