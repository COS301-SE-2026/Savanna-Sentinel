import { api } from "./api";

export type NotificationType =
    | "tipoff_submitted"
    | "field_report_submitted"
    | "high_severity_incident"
    | "ingestion_complete";

export interface NotificationApiItem {
    id: string;
    type: NotificationType;
    title: string;
    body: string;
    read: boolean;
    related_type?: string | null;
    related_id?: string | null;
    created_at: string;
}

interface NotificationListApiResponse {
    total: number;
    unread_count: number;
    page: number;
    page_size: number;
    results: NotificationApiItem[];
}

export interface MappedNotification {
    id: string;
    title: string;
    body: string;
    timestamp: string;
    read: boolean;
}

export interface ListNotificationsResult {
    notifications: MappedNotification[];
    total: number;
    unreadCount: number;
}

export interface ListNotificationsQueryParams {
    page?: number;
    page_size?: number;
}

export const notificationsApi = {
    list: async (
        payload?: ListNotificationsQueryParams,
    ): Promise<ListNotificationsResult> =>
        api
            .get<NotificationListApiResponse>("/notifications", {
                params: payload,
            })
            .then((r) => r.data)
            .then((data) => ({
                notifications: data.results.map((item) => ({
                    id: item.id,
                    title: item.title,
                    body: item.body,
                    timestamp: item.created_at,
                    read: item.read,
                })),
                total: data.total,
                unreadCount: data.unread_count,
            })),

    markRead: async (id: string): Promise<void> =>
        api.post(`/notifications/${id}/read`).then(() => undefined),

    markAllRead: async (): Promise<void> =>
        api.post("/notifications/read-all").then(() => undefined),
};
