import { useEffect } from "react";

import { notificationsApi } from "@/services/notificationsApi";
import { useNotificationStore } from "@/store/notificationStore";

const POLL_INTERVAL_MS = 30_000;

export function useNotificationsPoll(): void {
    const setNotifications = useNotificationStore((s) => s.setNotifications);

    useEffect(() => {
        let isCancelled = false;

        async function fetchNotifications() {
            try {
                const { notifications } = await notificationsApi.list();
                if (!isCancelled) {
                    setNotifications(notifications);
                }
            } catch {
                // Network issue - the next poll will retry.
            }
        }

        fetchNotifications();
        const intervalId = setInterval(fetchNotifications, POLL_INTERVAL_MS);

        return () => {
            isCancelled = true;
            clearInterval(intervalId);
        };
    }, [setNotifications]);
}
