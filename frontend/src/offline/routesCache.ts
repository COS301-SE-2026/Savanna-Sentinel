import { routeApi, type SavedRoute } from "@/services/routeApi";
import { cacheKeys, db, readCache, writeCache } from "@/offline/db";

export const MAX_CACHED_ROUTES = 3;

export interface SavedRoutesResult {
    routes: SavedRoute[];
    fetchedAt: number;
    isFromCache: boolean;
    isStale: boolean;
}

function createdAtMs(route: SavedRoute): number {
    return Date.parse(route.created_at) || 0;
}

async function cacheRoutes(
    userId: string,
    routes: SavedRoute[],
): Promise<void> {
    const savedAt = Date.now();
    const keep = [...routes]
        .sort((a, b) => createdAtMs(b) - createdAtMs(a))
        .slice(0, MAX_CACHED_ROUTES);

    await db.transaction("rw", db.routes, async () => {
        await db.routes.where("userId").equals(userId).delete();
        await db.routes.bulkPut(
            keep.map((route) => ({
                routeId: route.id,
                userId,
                savedAt,
                payload: route,
            })),
        );
    });
    await writeCache(cacheKeys.savedRoutes(), userId, { savedAt });
}

export async function loadSavedRoutes(
    userId: string | null,
): Promise<SavedRoutesResult> {
    try {
        const response = await routeApi.listSavedRoutes();
        if (userId) {
            await cacheRoutes(userId, response.results).catch(() => {});
        }
        return {
            routes: response.results,
            fetchedAt: Date.now(),
            isFromCache: false,
            isStale: false,
        };
    } catch (networkError) {
        if (!userId) throw networkError;

        const marker = await readCache<{ savedAt: number }>(
            cacheKeys.savedRoutes(),
            userId,
        ).catch(() => null);
        if (!marker) throw networkError;

        const rows = await db.routes
            .where("userId")
            .equals(userId)
            .toArray()
            .catch(() => []);

        const routes = rows
            .map((row) => row.payload as SavedRoute)
            .sort((a, b) => createdAtMs(b) - createdAtMs(a))
            .slice(0, MAX_CACHED_ROUTES);

        return {
            routes,
            fetchedAt: marker.fetchedAt,
            isFromCache: true,
            isStale: marker.isStale,
        };
    }
}

export async function cacheSavedRoute(
    userId: string | null,
    route: SavedRoute,
): Promise<void> {
    if (!userId) return;

    const savedAt = Date.now();
    await db.transaction("rw", db.routes, async () => {
        await db.routes.put({
            routeId: route.id,
            userId,
            savedAt,
            payload: route,
        });

        const rows = await db.routes.where("userId").equals(userId).toArray();
        const surplus = rows
            .sort(
                (a, b) =>
                    createdAtMs(b.payload as SavedRoute) -
                    createdAtMs(a.payload as SavedRoute),
            )
            .slice(MAX_CACHED_ROUTES)
            .map((row) => row.routeId);

        if (surplus.length > 0) await db.routes.bulkDelete(surplus);
    });
    await writeCache(cacheKeys.savedRoutes(), userId, { savedAt });
}

export async function forgetCachedRoute(routeId: string): Promise<void> {
    await db.routes.delete(routeId);
}
