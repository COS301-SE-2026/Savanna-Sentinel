import { riskApi, type ParkGridResponse } from "@/services/riskApi";
import { assignRandomRisk, parseGridCells } from "@/lib/riskGrid";
import { cacheKeys, readCache, writeCache } from "@/offline/db";

interface RiskGridSnapshot {
    grid: ParkGridResponse;
    risk: [string, number][];
}

export interface RiskGridResult {
    grid: ParkGridResponse;
    riskByCell: Map<string, number>;
    fetchedAt: number;
    isFromCache: boolean;
    isStale: boolean;
}

export async function loadRiskGrid(
    parkId: string,
    userId: string | null,
): Promise<RiskGridResult> {
    const key = cacheKeys.riskGrid(parkId);

    try {
        const grid = await riskApi.getParkGrid(parkId);
        const riskByCell = assignRandomRisk(parseGridCells(grid));

        if (userId) {
            const snapshot: RiskGridSnapshot = {
                grid,
                risk: [...riskByCell.entries()],
            };
            await writeCache(key, userId, snapshot).catch(() => {});
        }

        return {
            grid,
            riskByCell,
            fetchedAt: Date.now(),
            isFromCache: false,
            isStale: false,
        };
    } catch (networkError) {
        if (!userId) throw networkError;

        const cached = await readCache<RiskGridSnapshot>(key, userId).catch(
            () => null,
        );
        if (!cached) throw networkError;

        return {
            grid: cached.payload.grid,
            riskByCell: new Map(cached.payload.risk),
            fetchedAt: cached.fetchedAt,
            isFromCache: true,
            isStale: cached.isStale,
        };
    }
}
