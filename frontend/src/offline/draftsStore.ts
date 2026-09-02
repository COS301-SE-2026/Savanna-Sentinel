import { db, type DraftSyncStatus, type OutboxKind } from "@/offline/db";
import { PLACEHOLDER_PHOTO_TYPE } from "@/lib/media";
import type {
    DraftReport,
    DraftReportInput,
    PhotoAttachment,
} from "@/types/reports";

export type DraftPayload = Omit<DraftReportInput, "photos">;

function newId(): string {
    return crypto.randomUUID();
}

function isAlreadyUploaded(photo: PhotoAttachment): boolean {
    return photo.file.type === PLACEHOLDER_PHOTO_TYPE;
}

async function persistPhotos(
    draftLocalId: string,
    photos: PhotoAttachment[],
): Promise<void> {
    await db.photos.where("draftLocalId").equals(draftLocalId).delete();
    await db.photos.bulkPut(
        photos.map((photo) => ({
            id: newId(),
            draftLocalId,
            blob: isAlreadyUploaded(photo) ? new Blob([]) : photo.file,
            contentType: photo.file.type,
            fileName: photo.file.name,
            remoteUrl: isAlreadyUploaded(photo) ? photo.previewUrl : undefined,
        })),
    );
}

async function readPhotos(draftLocalId: string): Promise<PhotoAttachment[]> {
    const rows = await db.photos
        .where("draftLocalId")
        .equals(draftLocalId)
        .toArray();

    return rows.map((row) => {
        if (row.remoteUrl) {
            return {
                file: new File([], "", { type: PLACEHOLDER_PHOTO_TYPE }),
                previewUrl: row.remoteUrl,
            };
        }
        const file = new File([row.blob], row.fileName, {
            type: row.contentType,
        });
        return { file, previewUrl: URL.createObjectURL(row.blob) };
    });
}

export async function saveDraft(
    userId: string,
    localId: string,
    input: DraftReportInput,
    syncStatus: DraftSyncStatus,
): Promise<void> {
    const { photos, ...rest } = input;
    const payload: DraftPayload = rest;

    await db.drafts.put({
        localId,
        userId,
        syncStatus,
        createdAt: Date.now(),
        payload,
    });
    await persistPhotos(localId, photos);
}

export async function listDrafts(userId: string): Promise<DraftReport[]> {
    const rows = await db.drafts.where("userId").equals(userId).toArray();

    return Promise.all(
        rows
            .sort((a, b) => a.createdAt - b.createdAt)
            .map(async (row) => ({
                ...(row.payload as DraftPayload),
                photos: await readPhotos(row.localId),
                localId: row.localId,
                submittedBy: row.userId,
                createdAt: new Date(row.createdAt).toISOString(),
                syncStatus: row.syncStatus,
            })),
    );
}

export async function getDraft(localId: string): Promise<DraftReport | null> {
    const row = await db.drafts.get(localId);
    if (!row) return null;

    return {
        ...(row.payload as DraftPayload),
        photos: await readPhotos(localId),
        localId: row.localId,
        submittedBy: row.userId,
        createdAt: new Date(row.createdAt).toISOString(),
        syncStatus: row.syncStatus,
    };
}

export async function deleteDraft(localId: string): Promise<void> {
    await db.transaction("rw", db.drafts, db.photos, db.outbox, async () => {
        await db.drafts.delete(localId);
        await db.photos.where("draftLocalId").equals(localId).delete();
        await db.outbox.where("draftLocalId").equals(localId).delete();
    });
}
export async function enqueue(
    userId: string,
    draftLocalId: string,
    kind: OutboxKind,
): Promise<void> {
    const existing = await db.outbox
        .where("draftLocalId")
        .equals(draftLocalId)
        .first();
    if (existing) {
        const kindToKeep = existing.kind === "create" ? "create" : kind;
        await db.outbox.update(existing.id, {
            kind: kindToKeep,
            attempts: 0,
            lastError: undefined,
        });
        return;
    }

    await db.outbox.put({
        id: newId(),
        kind,
        userId,
        draftLocalId,
        createdAt: Date.now(),
        attempts: 0,
    });
}

export async function pendingCount(userId: string): Promise<number> {
    return db.outbox.where("userId").equals(userId).count();
}
