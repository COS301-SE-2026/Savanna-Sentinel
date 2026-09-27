import { api } from "./api";

interface ApiTerrainEffects {
    computed_version: number | null;
    computed_at: string | null;
    stale: boolean;
    cells: Record<string, number>;
}

export interface TerrainEffects {
    computedVersion: number | null;
    computedAt: string | null;
    stale: boolean;
    cells: Record<string, number>;
}

function fromApi(data: ApiTerrainEffects): TerrainEffects {
    return {
        computedVersion: data.computed_version,
        computedAt: data.computed_at,
        stale: data.stale,
        cells: data.cells,
    };
}

export async function getRiskAdjustments(): Promise<TerrainEffects> {
    const { data } = await api.get<ApiTerrainEffects>(
        "/terrain/risk-adjustments",
    );
    return fromApi(data);
}

export async function getRouteCosts(): Promise<TerrainEffects> {
    const { data } = await api.get<ApiTerrainEffects>("/terrain/route-costs");
    return fromApi(data);
}
