import {
    riskApi,
    type HeatmapResponse,
    type HeatmapSnapshot,
    type ParkGridResponse,
} from "@/services/riskApi";
import { cacheKeys, readCache, writeCache } from "@/offline/db";

export interface RiskGridResult {
    grid: ParkGridResponse;
    fetchedAt: number;
    isFromCache: boolean;
    isStale: boolean;
}

export interface SnapshotListResult {
    snapshots: HeatmapSnapshot[];
    isFromCache: boolean;
}

export interface HeatmapResult {
    heatmap: HeatmapResponse;
    isFromCache: boolean;
}

export async function loadRiskGrid(
    userId: string | null,
): Promise<RiskGridResult> {
    const key = cacheKeys.riskGrid();

    try {
        const grid = await riskApi.getParkGrid();

        if (userId) {
            await writeCache(key, userId, grid).catch(() => {});
        }

        return {
            grid,
            fetchedAt: Date.now(),
            isFromCache: false,
            isStale: false,
        };
    } catch (networkError) {
        if (!userId) throw networkError;

        const cached = await readCache<ParkGridResponse>(key, userId).catch(
            () => null,
        );
        if (!cached) throw networkError;

        return {
            grid: cached.payload,
            fetchedAt: cached.fetchedAt,
            isFromCache: true,
            isStale: cached.isStale,
        };
    }
}

export async function loadHeatmapSnapshots(
    userId: string | null,
): Promise<SnapshotListResult> {
    const key = cacheKeys.heatmapSnapshots();

    try {
        const { snapshots } = await riskApi.getHeatmapSnapshots();

        if (userId) {
            await writeCache(key, userId, snapshots).catch(() => {});
        }

        return { snapshots, isFromCache: false };
    } catch (networkError) {
        if (!userId) throw networkError;

        const cached = await readCache<HeatmapSnapshot[]>(key, userId).catch(
            () => null,
        );
        if (!cached) throw networkError;

        return { snapshots: cached.payload, isFromCache: true };
    }
}

export async function loadHeatmap(
    heatmapId: string,
    userId: string | null,
): Promise<HeatmapResult> {
    const key = cacheKeys.heatmap(heatmapId);

    try {
        const heatmap = await riskApi.getHeatmap({ snapshot: heatmapId });

        if (userId) {
            await writeCache(key, userId, heatmap).catch(() => {});
        }

        return { heatmap, isFromCache: false };
    } catch (networkError) {
        if (!userId) throw networkError;

        const cached = await readCache<HeatmapResponse>(key, userId).catch(
            () => null,
        );
        if (!cached) throw networkError;

        return { heatmap: cached.payload, isFromCache: true };
    }
}
