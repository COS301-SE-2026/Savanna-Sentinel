import Dexie, { type Table } from "dexie";

export type OutboxKind = "create" | "update" | "delete";
export type DraftSyncStatus = "offline" | "pending" | "synced";

export const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

export interface CachedResponse<T = unknown> {
    key: string;
    userId: string;
    payload: T;
    fetchedAt: number;
}

export interface OfflineDraft {
    localId: string;
    userId: string;
    syncStatus: DraftSyncStatus;
    createdAt: number;
    remoteId?: string;
    payload: unknown;
}

export interface DraftPhoto {
    id: string;
    draftLocalId: string;
    blob: Blob;
    contentType: string;
}

export interface OutboxItem {
    id: string;
    kind: OutboxKind;
    userId: string;
    draftLocalId: string;
    createdAt: number;
    attempts: number;
    lastError?: string;
    nextAttemptAt?: number;
}

export interface CachedRoute {
    routeId: string;
    userId: string;
    savedAt: number;
    payload: unknown;
}

type SentinelDb = Dexie & {
    drafts: Table<OfflineDraft, string>;
    photos: Table<DraftPhoto, string>;
    outbox: Table<OutboxItem, string>;
    cache: Table<CachedResponse, string>;
    routes: Table<CachedRoute, string>;
};

export const db = new Dexie("savanna-sentinel") as SentinelDb;

db.version(1).stores({
    drafts: "localId, userId, syncStatus, createdAt",
    photos: "id, draftLocalId",
    outbox: "id, createdAt",
    cache: "key, fetchedAt",
    routes: "routeId, userId, savedAt",
});

export const cacheKeys = {
    riskGrid: (parkId: string) => `risk-grid:${parkId}`,
    reports: (query: string) => `reports:${query}`,
};

export interface CacheRead<T> {
    payload: T;
    fetchedAt: number;
    isStale: boolean;
}

export async function writeCache<T>(
    key: string,
    userId: string,
    payload: T,
): Promise<void> {
    await db.cache.put({ key, userId, payload, fetchedAt: Date.now() });
}

export async function readCache<T>(
    key: string,
    userId: string,
    staleAfterMs: number = STALE_AFTER_MS,
): Promise<CacheRead<T> | null> {
    const row = await db.cache.get(key);
    if (!row || row.userId !== userId) return null;

    return {
        payload: row.payload as T,
        fetchedAt: row.fetchedAt,
        isStale: Date.now() - row.fetchedAt > staleAfterMs,
    };
}

export async function clearOfflineData(): Promise<void> {
    await Promise.all([
        db.drafts.clear(),
        db.photos.clear(),
        db.outbox.clear(),
        db.cache.clear(),
        db.routes.clear(),
    ]);
}
