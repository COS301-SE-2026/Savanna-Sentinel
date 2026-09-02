import { create } from "zustand";
import type { AxiosError } from "axios";

import { riskApi } from "@/services/riskApi";
import type {
    ParkGridResponse,
    HeatmapSnapshot,
    HeatmapCell,
    ActiveModelResponse,
    CellExplainResponse,
} from "@/services/riskApi";
import { notifyCaution, notifyCritical } from "@/components/ui/toast";
import {
    loadHeatmap,
    loadHeatmapSnapshots,
    loadRiskGrid,
} from "@/offline/riskGridCache";
import { useAuthStore } from "@/store/authStore";

type GridStatus = "idle" | "loading" | "error";
type HeatmapStatus = "idle" | "loading" | "error" | "no-data";
type SnapshotsStatus = "idle" | "loading" | "error";

interface MapDataState {
    grid: ParkGridResponse | null;
    gridStatus: GridStatus;
    gridFetchedAt: number | null;
    gridStale: boolean;

    heatmapStatus: HeatmapStatus;
    cellsByRef: Map<string, HeatmapCell>;

    snapshots: HeatmapSnapshot[];
    snapshotsStatus: SnapshotsStatus;
    selectedSnapshotId: string | null;

    activeModel: ActiveModelResponse | null;
    explainByCellRef: Map<string, CellExplainResponse>;
}

interface MapState extends MapDataState {
    loadGrid: () => Promise<void>;
    loadSnapshots: () => Promise<void>;
    selectSnapshot: (heatmapId: string) => Promise<void>;
    loadCellExplain: (cellRef: string) => Promise<CellExplainResponse | null>;
    loadActiveModel: () => Promise<void>;
}

function currentUserId(): string | null {
    return useAuthStore.getState().user?.id ?? null;
}

function noDataReset() {
    return {
        heatmapStatus: "no-data" as const,
        cellsByRef: new Map<string, HeatmapCell>(),
    };
}

const initialData: MapDataState = {
    grid: null,
    gridStatus: "idle",
    gridFetchedAt: null,
    gridStale: false,

    heatmapStatus: "idle",
    cellsByRef: new Map(),

    snapshots: [],
    snapshotsStatus: "idle",
    selectedSnapshotId: null,

    activeModel: null,
    explainByCellRef: new Map(),
};

export let initialMapState: MapState;

export const useMapStore = create<MapState>()((set, get) => {
    const state: MapState = {
        ...initialData,

        loadGrid: async () => {
            set({ gridStatus: "loading" });
            try {
                const result = await loadRiskGrid(currentUserId());
                set({
                    grid: result.grid,
                    gridStatus: "idle",
                    gridFetchedAt: result.fetchedAt,
                    gridStale: result.isStale,
                });
                if (result.isFromCache) {
                    notifyCaution(
                        "Showing saved risk map",
                        "No connection, this is the last version downloaded.",
                    );
                }
            } catch {
                set({ gridStatus: "error" });
                notifyCritical("Could not load risk grid");
            }
        },

        loadSnapshots: async () => {
            set({ snapshotsStatus: "loading" });
            try {
                const { snapshots } =
                    await loadHeatmapSnapshots(currentUserId());
                set({ snapshots, snapshotsStatus: "idle" });
                if (snapshots.length === 0) {
                    set(noDataReset());
                    return;
                }
                if (get().selectedSnapshotId === null) {
                    const latest = snapshots[snapshots.length - 1];
                    await get().selectSnapshot(latest.heatmap_id);
                }
            } catch {
                set({ snapshotsStatus: "error" });
                notifyCritical("Could not load heatmap snapshots");
            }
        },

        selectSnapshot: async (heatmapId: string) => {
            set({ selectedSnapshotId: heatmapId, heatmapStatus: "loading" });
            try {
                const { heatmap } = await loadHeatmap(
                    heatmapId,
                    currentUserId(),
                );
                if (get().selectedSnapshotId !== heatmapId) return;
                const cellsByRef = new Map<string, HeatmapCell>();
                for (const cell of heatmap.cells) {
                    cellsByRef.set(cell.cell_ref, cell);
                }
                set({
                    cellsByRef,
                    heatmapStatus: "idle",
                    explainByCellRef: new Map(),
                });
            } catch (err) {
                if (get().selectedSnapshotId !== heatmapId) return;
                const status = (err as AxiosError).response?.status;
                if (status === 404) {
                    set(noDataReset());
                } else {
                    set({ heatmapStatus: "error" });
                    notifyCritical("Could not load risk heatmap");
                }
            }
        },

        loadCellExplain: async (cellRef: string) => {
            const cached = get().explainByCellRef.get(cellRef);
            if (cached) return cached;

            const cellId = get().cellsByRef.get(cellRef)?.cell_id;
            if (!cellId) return null;

            const requestedSnapshotId = get().selectedSnapshotId;
            try {
                const explanation = await riskApi.getCellExplain(cellId);
                if (get().selectedSnapshotId === requestedSnapshotId) {
                    set((current) => ({
                        explainByCellRef: new Map(current.explainByCellRef).set(
                            cellRef,
                            explanation,
                        ),
                    }));
                }
                return explanation;
            } catch {
                return null;
            }
        },

        loadActiveModel: async () => {
            if (get().activeModel) return;
            try {
                const activeModel = await riskApi.getActiveModel();
                set({ activeModel });
            } catch {
                // leave null, UI shows "Not available yet"
            }
        },
    };

    initialMapState = state;
    return state;
});
