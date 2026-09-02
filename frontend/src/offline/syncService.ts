import { db, type OutboxItem } from "@/offline/db";
import { deleteDraft, getDraft } from "@/offline/draftsStore";
import { resolveSyncResult } from "@/offline/conflictResolver";
import { resolvePhotoUrls } from "@/lib/media";
import { reportsApi, type SyncReportItem } from "@/services/reportsApi";
import { formatToUTC } from "@/lib/utils";

const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 5 * 60_000;

export interface SyncOutcome {
    synced: number;
    failed: number;
}

let isFlushing = false;

async function buildSyncItem(item: OutboxItem): Promise<SyncReportItem | null> {
    const draft = await getDraft(item.draftLocalId);
    if (!draft) return null;

    if (item.kind === "delete") {
        return {
            local_id: item.draftLocalId,
            deleted_at: new Date().toISOString(),
            report_type: draft.reportType,
            location: { lat: draft.lat ?? 0, lon: draft.lon ?? 0 },
            occurred_at: formatToUTC(draft.occurredAt),
            description: draft.description,
        };
    }

    if (draft.lat === null || draft.lon === null) {
        throw new Error("Draft is missing coordinates");
    }

    const images = await resolvePhotoUrls(draft.photos);
    return {
        local_id: item.draftLocalId,
        report_type: draft.reportType,
        location: { lat: draft.lat, lon: draft.lon },
        occurred_at: formatToUTC(draft.occurredAt),
        description: draft.description,
        incident_type: draft.incidentType || undefined,
        severity: draft.severity || undefined,
        species: draft.species || undefined,
        count: draft.count ?? undefined,
        images,
    };
}

async function recordFailure(item: OutboxItem, message: string): Promise<void> {
    const attempts = item.attempts + 1;
    const delay = Math.min(
        BASE_BACKOFF_MS * 2 ** (attempts - 1),
        MAX_BACKOFF_MS,
    );

    await db.outbox.update(item.id, {
        attempts,
        lastError: message,
        nextAttemptAt: Date.now() + delay,
    });
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export async function flushOutbox(userId: string): Promise<SyncOutcome> {
    if (isFlushing) return { synced: 0, failed: 0 };
    isFlushing = true;

    try {
        const now = Date.now();
        const due = (await db.outbox.where("userId").equals(userId).toArray())
            .filter((item) => (item.nextAttemptAt ?? 0) <= now)
            .sort((a, b) => a.createdAt - b.createdAt);

        if (due.length === 0) return { synced: 0, failed: 0 };

        const byLocalId = new Map<string, OutboxItem>();
        const payload: SyncReportItem[] = [];
        let failed = 0;

        for (const item of due) {
            try {
                const built = await buildSyncItem(item);
                if (!built) {
                    await db.outbox.delete(item.id);
                    continue;
                }
                byLocalId.set(item.draftLocalId, item);
                payload.push(built);
            } catch (error) {
                await recordFailure(item, errorMessage(error));
                failed++;
            }
        }

        if (payload.length === 0) return { synced: 0, failed };

        let results;
        try {
            ({ results } = await reportsApi.syncReports(payload));
        } catch (error) {
            const message = errorMessage(error);
            for (const item of byLocalId.values()) {
                await recordFailure(item, message);
            }
            return { synced: 0, failed: failed + byLocalId.size };
        }

        let synced = 0;
        for (const result of results) {
            const item = byLocalId.get(result.local_id);
            if (!item) continue;

            const action = resolveSyncResult(result.status);
            if (action.shouldDiscardLocal) {
                await deleteDraft(item.draftLocalId);
                await db.outbox.delete(item.id);
                if (action.shouldCountAsSynced) synced++;
            } else {
                await recordFailure(item, result.message ?? "Sync failed");
                failed++;
            }
        }

        return { synced, failed };
    } finally {
        isFlushing = false;
    }
}
