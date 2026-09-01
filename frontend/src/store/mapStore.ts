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
import { notifyCritical } from "@/components/ui/toast";

type GridStatus = "idle" | "loading" | "error";
type HeatmapStatus = "idle" | "loading" | "error" | "no-data";
type SnapshotsStatus = "idle" | "loading" | "error";

interface MapDataState {
    grid: ParkGridResponse | null;
    gridStatus: GridStatus;

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

function noDataReset() {
    return {
        heatmapStatus: "no-data" as const,
        cellsByRef: new Map<string, HeatmapCell>(),
    };
}

const initialData: MapDataState = {
    grid: null,
    gridStatus: "idle",

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
                const grid = await riskApi.getParkGrid();
                set({ grid, gridStatus: "idle" });
            } catch {
                set({ gridStatus: "error" });
                notifyCritical("Could not load risk grid");
            }
        },

        loadSnapshots: async () => {
            set({ snapshotsStatus: "loading" });
            try {
                const { snapshots } = await riskApi.getHeatmapSnapshots();
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
                const heatmap = await riskApi.getHeatmap({
                    snapshot: heatmapId,
                });
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
