import { create } from "zustand";

import { notificationsApi } from "@/services/notificationsApi";
import type { NotificationType } from "@/services/notificationsApi";

export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    body: string;
    timestamp: string;
    read: boolean;
}

interface NotificationState {
    notifications: Notification[];
    setNotifications: (notifications: Notification[]) => void;
    markAsRead: (id: string) => Promise<void>;
    markAllRead: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
    notifications: [],

    setNotifications: (notifications) => set({ notifications }),

    markAsRead: async (id) => {
        const previous = get().notifications;
        set({
            notifications: previous.map((n) =>
                n.id === id ? { ...n, read: true } : n,
            ),
        });

        try {
            await notificationsApi.markRead(id);
        } catch {
            set({ notifications: previous });
        }
    },

    markAllRead: async () => {
        const previous = get().notifications;
        set({
            notifications: previous.map((n) => ({ ...n, read: true })),
        });

        try {
            await notificationsApi.markAllRead();
        } catch {
            set({ notifications: previous });
        }
    },
}));
