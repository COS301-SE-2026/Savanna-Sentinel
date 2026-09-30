import {
    fetchWorkspace,
    type WorkspaceSnapshot,
} from "@/services/workspaceApi";
import { cacheKeys, readCache, writeCache } from "@/offline/db";

export interface WorkspaceResult {
    snapshot: WorkspaceSnapshot;
    isFromCache: boolean;
    isStale: boolean;
}

export async function cacheWorkspaceSnapshot(
    userId: string | null,
    snapshot: WorkspaceSnapshot,
): Promise<void> {
    if (!userId) return;
    await writeCache(cacheKeys.workspace(), userId, snapshot).catch(() => {});
}

export async function prefetchWorkspace(userId: string): Promise<void> {
    try {
        await loadWorkspaceSnapshot(userId);
    } catch {
        console.warn("Background workspace cache warming failed");
    }
}

export async function loadWorkspaceSnapshot(
    userId: string | null,
): Promise<WorkspaceResult> {
    try {
        const snapshot = await fetchWorkspace();
        await cacheWorkspaceSnapshot(userId, snapshot);

        return { snapshot, isFromCache: false, isStale: false };
    } catch (networkError) {
        if (!userId) throw networkError;

        const cached = await readCache<WorkspaceSnapshot>(
            cacheKeys.workspace(),
            userId,
        ).catch(() => null);
        if (!cached) throw networkError;

        return {
            snapshot: cached.payload,
            isFromCache: true,
            isStale: cached.isStale,
        };
    }
}
