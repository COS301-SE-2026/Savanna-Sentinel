import { useCallback, useEffect, useRef, useState } from "react";

import { useAuthStore } from "@/store/authStore";
import { flushOutbox } from "@/offline/syncService";
import { pendingCount as countPending } from "@/offline/draftsStore";
import { notifySafe } from "@/components/ui/toast";

const RETRY_INTERVAL_MS = 30_000;

export interface OfflineSyncState {
    pending: number;
    isSyncing: boolean;
    syncNow: () => void;
}

export function useOfflineSync(onSynced?: () => void): OfflineSyncState {
    const user = useAuthStore((s) => s.user);
    const userId = user?.id;

    const [pending, setPending] = useState(0);
    const [isSyncing, setSyncing] = useState(false);
    const onSyncedRef = useRef(onSynced);
    useEffect(() => {
        onSyncedRef.current = onSynced;
    }, [onSynced]);

    const sync = useCallback(async () => {
        if (!userId) return;

        setSyncing(true);
        try {
            const outcome = await flushOutbox(userId);
            if (outcome.synced > 0) {
                notifySafe(
                    "Reports synced",
                    outcome.synced === 1
                        ? "1 saved report has been sent."
                        : `${outcome.synced} saved reports have been sent.`,
                );
                onSyncedRef.current?.();
            }
        } catch (error) {
            console.error("Offline sync failed", error);
        } finally {
            setSyncing(false);
            setPending(await countPending(userId).catch(() => 0));
        }
    }, [userId]);

    useEffect(() => {
        if (!userId) return;

        const initialFlush = setTimeout(() => void sync(), 0);

        const handleOnline = () => void sync();
        window.addEventListener("online", handleOnline);

        const timer = setInterval(() => {
            if (navigator.onLine) void sync();
        }, RETRY_INTERVAL_MS);

        return () => {
            clearTimeout(initialFlush);
            window.removeEventListener("online", handleOnline);
            clearInterval(timer);
        };
    }, [userId, sync]);

    return { pending, isSyncing, syncNow: () => void sync() };
}
