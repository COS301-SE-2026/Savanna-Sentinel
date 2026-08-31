import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

import NotificationBell from "@/components/layout/NotificationBell";
import { notificationsApi } from "@/services/notificationsApi";
import { useNotificationStore } from "@/store/notificationStore";
import type { Notification } from "@/store/notificationStore";

vi.mock("@/services/notificationsApi", () => ({
    notificationsApi: {
        list: vi.fn(),
        markRead: vi.fn().mockResolvedValue(undefined),
        markAllRead: vi.fn().mockResolvedValue(undefined),
    },
}));

function setNotifications(notifications: Notification[]) {
    useNotificationStore.setState({ notifications });
}

function setViewport(width: number) {
    window.innerWidth = width;
    window.dispatchEvent(new Event("resize"));
}

const sample: Notification[] = [
    {
        id: "1",
        type: "field_report_submitted",
        title: "Reports uploaded successfully",
        body: "3 field reports queued offline were sent to the server.",
        timestamp: new Date(Date.now() - 2 * 60_000).toISOString(),
        read: false,
    },
    {
        id: "2",
        type: "ingestion_complete",
        title: "CSV ingestion complete",
        body: "patrol_data_may.csv processed.",
        timestamp: new Date(Date.now() - 60 * 60_000).toISOString(),
        read: true,
    },
];

const openPanel = async () => {
    await userEvent.click(
        screen.getByRole("button", { name: /^notifications/i }),
    );
    await screen.findByRole("button", { name: /mark all read/i });
};

describe("NotificationBell", () => {
    beforeEach(() => {
        setViewport(1024);
    });

    afterEach(() => {
        useNotificationStore.setState({ notifications: [] });
        vi.clearAllMocks();
    });

    it("renders the trigger without a dot when there are no unread notifications", () => {
        setNotifications([]);
        render(<NotificationBell />);
        expect(
            screen.getByRole("button", { name: "Notifications" }),
        ).toBeInTheDocument();
    });

    it("shows an unread dot and updates the aria-label when unread notifications exist", () => {
        setNotifications(sample);
        render(<NotificationBell />);
        expect(
            screen.getByRole("button", { name: "Notifications (unread)" }),
        ).toBeInTheDocument();
    });

    it("shows the empty state when there are no notifications", async () => {
        setNotifications([]);
        render(<NotificationBell />);
        await openPanel();
        expect(screen.getByText("No new notifications")).toBeInTheDocument();
    });

    it("lists notifications with a New badge only on unread items", async () => {
        setNotifications(sample);
        render(<NotificationBell />);
        await openPanel();

        expect(
            screen.getByText("Reports uploaded successfully"),
        ).toBeInTheDocument();
        expect(screen.getByText("CSV ingestion complete")).toBeInTheDocument();
        expect(screen.getAllByText("New")).toHaveLength(1);
    });

    it("shows a tinted alert icon only for high-severity incident notifications", async () => {
        setNotifications([
            ...sample,
            {
                id: "3",
                type: "high_severity_incident",
                title: "High-severity incident reported",
                body: "poaching reported by liaison1 - needs attention.",
                timestamp: new Date(Date.now() - 5 * 60_000).toISOString(),
                read: false,
            },
        ]);
        render(<NotificationBell />);
        await openPanel();

        expect(
            document.body.querySelectorAll(".lucide-triangle-alert"),
        ).toHaveLength(1);
    });

    it("marks a single notification as read", async () => {
        setNotifications(sample);
        render(<NotificationBell />);
        await openPanel();

        await userEvent.click(
            screen.getByRole("button", { name: /mark as read/i }),
        );

        await waitFor(() => {
            expect(screen.queryByText("New")).not.toBeInTheDocument();
        });
        expect(
            useNotificationStore
                .getState()
                .notifications.find((n) => n.id === "1")?.read,
        ).toBe(true);
        expect(notificationsApi.markRead).toHaveBeenCalledWith("1");
    });

    it("reverts the read state if marking as read fails on the server", async () => {
        vi.mocked(notificationsApi.markRead).mockRejectedValueOnce(
            new Error("network error"),
        );
        setNotifications(sample);
        render(<NotificationBell />);
        await openPanel();

        await userEvent.click(
            screen.getByRole("button", { name: /mark as read/i }),
        );

        await waitFor(() => {
            expect(
                useNotificationStore
                    .getState()
                    .notifications.find((n) => n.id === "1")?.read,
            ).toBe(false);
        });
    });

    it("marks all notifications as read and disables the action", async () => {
        setNotifications(sample);
        render(<NotificationBell />);
        await openPanel();

        const markAllButton = screen.getByRole("button", {
            name: /mark all read/i,
        });
        expect(markAllButton).not.toBeDisabled();

        await userEvent.click(markAllButton);

        await waitFor(() => {
            expect(markAllButton).toBeDisabled();
        });
        expect(
            useNotificationStore.getState().notifications.every((n) => n.read),
        ).toBe(true);
        expect(notificationsApi.markAllRead).toHaveBeenCalledTimes(1);
    });

    it("disables the mark all read action when nothing is unread", async () => {
        setNotifications([{ ...sample[1] }]);
        render(<NotificationBell />);
        await openPanel();

        expect(
            screen.getByRole("button", { name: /mark all read/i }),
        ).toBeDisabled();
    });

    it("renders the panel as a bottom drawer on mobile viewports", async () => {
        setViewport(500);
        setNotifications(sample);
        render(<NotificationBell />);
        await openPanel();

        const sheetContent = document.querySelector(
            '[data-slot="sheet-content"]',
        );
        expect(sheetContent).not.toBeNull();
        expect(sheetContent).toHaveAttribute("data-side", "bottom");
    });
});
