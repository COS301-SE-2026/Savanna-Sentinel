import type { SavedRoute } from "@/services/routeApi";
import { cacheKeys, db, readCache, writeCache } from "@/offline/db";

const NEVER_STALE_MS = Number.POSITIVE_INFINITY;

export async function pinRouteToHeatmap(
    userId: string,
    route: SavedRoute,
): Promise<void> {
    await writeCache(cacheKeys.pinnedRoute(), userId, route);
}

export async function loadPinnedRoute(
    userId: string | null,
): Promise<SavedRoute | null> {
    if (!userId) return null;

    const cached = await readCache<SavedRoute>(
        cacheKeys.pinnedRoute(),
        userId,
        NEVER_STALE_MS,
    ).catch(() => null);

    return cached?.payload ?? null;
}

export async function clearPinnedRoute(): Promise<void> {
    await db.cache.delete(cacheKeys.pinnedRoute());
}

export async function unpinDeletedRoute(
    userId: string | null,
    routeId: string,
): Promise<void> {
    const pinned = await loadPinnedRoute(userId);
    if (pinned?.id === routeId) {
        await clearPinnedRoute();
    }
}
