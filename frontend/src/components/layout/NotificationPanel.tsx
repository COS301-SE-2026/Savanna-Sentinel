import { BellOffIcon, CheckIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils";
import { useNotificationStore } from "@/store/notificationStore";

export default function NotificationPanel() {
    const notifications = useNotificationStore((s) => s.notifications);
    const markAsRead = useNotificationStore((s) => s.markAsRead);
    const markAllRead = useNotificationStore((s) => s.markAllRead);
    const hasUnread = notifications.some((n) => !n.read);

    return (
        <div className="flex w-full flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-color-border px-4 py-3">
                <span className="font-heading text-base font-bold text-brand-primary">
                    Notifications
                </span>
                <button
                    type="button"
                    onClick={markAllRead}
                    disabled={!hasUnread}
                    className="min-h-11 rounded-sm px-2 font-sans text-xs font-semibold text-brand-primary transition-colors hover:text-color-surface-deep hover:underline disabled:pointer-events-none disabled:opacity-40"
                >
                    Mark all read
                </button>
            </div>

            {notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                    <BellOffIcon
                        className="size-8 text-brand-muted"
                        strokeWidth={1.5}
                    />
                    <p className="font-sans text-sm text-color-text-secondary">
                        No new notifications
                    </p>
                </div>
            ) : (
                <ul
                    className="m-0 list-none overflow-y-auto p-0"
                    style={{ maxHeight: 400 }}
                >
                    {notifications.map((n) => (
                        <li
                            key={n.id}
                            className="border-b border-color-border px-4 py-3 last:border-b-0"
                        >
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                                <span className="font-sans text-sm font-semibold text-color-text-primary">
                                    {n.title}
                                </span>
                                {!n.read && (
                                    <Badge variant="neutral">New</Badge>
                                )}
                            </div>
                            <p className="mb-2 font-sans text-xs leading-relaxed text-color-text-primary">
                                {n.body}
                            </p>
                            <div className="flex items-center justify-between gap-2">
                                <span className="font-sans text-xs text-brand-mid">
                                    {formatRelativeTime(n.timestamp)}
                                </span>
                                {!n.read && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label="Mark as read"
                                        onClick={() => markAsRead(n.id)}
                                        className="text-brand-primary"
                                    >
                                        <CheckIcon className="size-4" />
                                    </Button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
