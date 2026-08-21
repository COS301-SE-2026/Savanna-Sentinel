import { db, type OutboxItem } from "@/offline/db";
import { deleteDraft, getDraft } from "@/offline/draftsStore";
import { resolvePhotoUrls } from "@/lib/media";
import { reportsApi, type ReportCreate } from "@/services/reportsApi";
import { formatToUTC } from "@/lib/utils";

const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 5 * 60_000;

export interface SyncOutcome {
    synced: number;
    failed: number;
}

let isFlushing = false;

async function syncCreate(item: OutboxItem): Promise<void> {
    const stored = await getDraft(item.draftLocalId);
    if (!stored) return;

    const { draft } = stored;
    if (draft.lat === null || draft.lon === null) {
        throw new Error("Draft is missing coordinates");
    }

    const images = await resolvePhotoUrls(draft.photos);
    const payload: ReportCreate = {
        report_type: draft.reportType,
        location: { lat: draft.lat, lon: draft.lon },
        occurred_at: formatToUTC(draft.occurredAt),
        description: draft.description,
        incident_type: draft.incidentType || undefined,
        severity: draft.severity || undefined,
        species: draft.species || undefined,
        count: draft.count ?? undefined,
        images,
        sync_status: "pending",
    };

    await reportsApi.submitReport(payload);
    await deleteDraft(item.draftLocalId);
}

async function syncDelete(item: OutboxItem): Promise<void> {
    const stored = await getDraft(item.draftLocalId);
    if (stored?.remoteId) {
        await reportsApi.deleteReport(stored.remoteId);
    }
    await deleteDraft(item.draftLocalId);
}

async function recordFailure(item: OutboxItem, error: unknown): Promise<void> {
    const attempts = item.attempts + 1;
    const delay = Math.min(
        BASE_BACKOFF_MS * 2 ** (attempts - 1),
        MAX_BACKOFF_MS,
    );

    await db.outbox.update(item.id, {
        attempts,
        lastError: error instanceof Error ? error.message : String(error),
        nextAttemptAt: Date.now() + delay,
    });
}

export async function flushOutbox(userId: string): Promise<SyncOutcome> {
    if (isFlushing) return { synced: 0, failed: 0 };
    isFlushing = true;

    try {
        const now = Date.now();
        const items = (await db.outbox.where("userId").equals(userId).toArray())
            .filter((item) => (item.nextAttemptAt ?? 0) <= now)
            .sort((a, b) => a.createdAt - b.createdAt);

        let synced = 0;
        let failed = 0;

        for (const item of items) {
            try {
                if (item.kind === "delete") await syncDelete(item);
                else await syncCreate(item);
                await db.outbox.delete(item.id);
                synced++;
            } catch (error) {
                await recordFailure(item, error);
                failed++;
            }
        }

        return { synced, failed };
    } finally {
        isFlushing = false;
    }
}
