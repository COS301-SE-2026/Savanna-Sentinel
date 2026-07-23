import { create } from "zustand";

export interface Notification {
    id: string;
    title: string;
    body: string;
    timestamp: string;
    read: boolean;
}

interface NotificationState {
    notifications: Notification[];
    setNotifications: (notifications: Notification[]) => void;
    markAsRead: (id: string) => void;
    markAllRead: () => void;
}
// once api exists,
// fetch initial notifications from api endpoint and subscribe
// for live updates, then call setNotifications with the result
export const useNotificationStore = create<NotificationState>()((set) => ({
    notifications: [],

    setNotifications: (notifications) => set({ notifications }),

    markAsRead: (id) =>
        set((state) => ({
            notifications: state.notifications.map((n) =>
                n.id === id ? { ...n, read: true } : n,
            ),
        })),

    markAllRead: () =>
        set((state) => ({
            notifications: state.notifications.map((n) => ({
                ...n,
                read: true,
            })),
        })),
}));
