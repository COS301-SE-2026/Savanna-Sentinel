import { act, renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { useNotificationsPoll } from "@/hooks/useNotificationsPoll";
import { notificationsApi } from "@/services/notificationsApi";
import { useNotificationStore } from "@/store/notificationStore";
import type { ListNotificationsResult } from "@/services/notificationsApi";

vi.mock("@/services/notificationsApi", () => ({
    notificationsApi: { list: vi.fn(), markRead: vi.fn(), markAllRead: vi.fn() },
}));

const listResult = (
    overrides: Partial<ListNotificationsResult> = {},
): ListNotificationsResult => ({
    notifications: [
        {
            id: "n1",
            type: "tipoff_submitted",
            title: "New incident tip-off",
            body: "liaison1 reported poaching near the river",
            timestamp: "2026-01-01T00:00:00Z",
            read: false,
        },
    ],
    total: 1,
    unreadCount: 1,
    ...overrides,
});

beforeEach(() => {
    vi.useFakeTimers();
    useNotificationStore.setState({ notifications: [] });
});

afterEach(() => {
    vi.mocked(notificationsApi.list).mockReset();
    useNotificationStore.setState({ notifications: [] });
    vi.useRealTimers();
});

describe("useNotificationsPoll", () => {
    it("fetches on mount and populates the store", async () => {
        vi.mocked(notificationsApi.list).mockResolvedValue(listResult());

        renderHook(() => useNotificationsPoll());

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(notificationsApi.list).toHaveBeenCalledTimes(1);
        expect(useNotificationStore.getState().notifications).toHaveLength(1);
    });

    it("polls again after the interval elapses", async () => {
        vi.mocked(notificationsApi.list).mockResolvedValue(listResult());

        renderHook(() => useNotificationsPoll());

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(notificationsApi.list).toHaveBeenCalledTimes(1);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(30_000);
        });
        expect(notificationsApi.list).toHaveBeenCalledTimes(2);
    });

    it("stops polling after unmount", async () => {
        vi.mocked(notificationsApi.list).mockResolvedValue(listResult());

        const { unmount } = renderHook(() => useNotificationsPoll());

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        const callsBeforeUnmount = vi.mocked(notificationsApi.list).mock.calls
            .length;

        unmount();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(60_000);
        });
        expect(notificationsApi.list).toHaveBeenCalledTimes(callsBeforeUnmount);
    });

    it("leaves the store untouched when a poll fails", async () => {
        useNotificationStore.setState({
            notifications: listResult().notifications,
        });
        vi.mocked(notificationsApi.list).mockRejectedValue(
            new Error("network error"),
        );

        renderHook(() => useNotificationsPoll());

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(useNotificationStore.getState().notifications).toHaveLength(1);
    });
});
