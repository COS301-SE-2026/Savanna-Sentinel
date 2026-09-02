import type { SyncItemStatus } from "@/services/reportsApi";

export interface ResolvedAction {
    shouldDiscardLocal: boolean;
    shouldCountAsSynced: boolean;
}

export function resolveSyncResult(status: SyncItemStatus): ResolvedAction {
    switch (status) {
        case "created":
        case "updated":
        case "deleted":
            return { shouldDiscardLocal: true, shouldCountAsSynced: true };
        case "conflict":
            return { shouldDiscardLocal: true, shouldCountAsSynced: false };
        case "error":
            return { shouldDiscardLocal: false, shouldCountAsSynced: false };
    }
}
