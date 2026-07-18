import { useState } from "react";
import { Popover } from "radix-ui";
import { BellIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetTrigger,
    SheetContent,
    SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNotificationStore } from "@/store/notificationStore";
import NotificationPanel from "./NotificationPanel";

export default function NotificationBell() {
    const [isOpen, setOpen] = useState(false);
    const isMobile = useIsMobile();
    const unreadCount = useNotificationStore(
        (s) => s.notifications.filter((n) => !n.read).length,
    );
    const hasUnread = unreadCount > 0;

    const trigger = (
        <Button
            variant="ghost"
            size="icon"
            aria-label={hasUnread ? "Notifications (unread)" : "Notifications"}
            className="relative"
        >
            <BellIcon className="size-5" />
            {hasUnread && (
                <span
                    aria-hidden="true"
                    className="absolute top-2 right-2 size-3 rounded-full border-2 border-color-surface-raised bg-brand-teal"
                />
            )}
        </Button>
    );

    if (isMobile) {
        return (
            <Sheet open={isOpen} onOpenChange={setOpen}>
                <SheetTrigger asChild>{trigger}</SheetTrigger>
                <SheetContent
                    side="bottom"
                    showCloseButton={false}
                    className="w-full max-w-none rounded-t-lg border border-b-0 border-color-border bg-color-surface-raised p-0 shadow-md duration-[var(--dur-deliberate)] ease-[var(--ease-enter)]"
                >
                    <SheetTitle className="sr-only">Notifications</SheetTitle>
                    <NotificationPanel />
                </SheetContent>
            </Sheet>
        );
    }

    return (
        <Popover.Root open={isOpen} onOpenChange={setOpen}>
            <Popover.Trigger asChild>{trigger}</Popover.Trigger>
            <Popover.Portal>
                <Popover.Content
                    side="bottom"
                    align="end"
                    sideOffset={8}
                    className="z-[var(--z-dropdown)] w-[360px] max-w-[360px] overflow-hidden rounded-lg border border-color-border bg-color-surface-raised shadow-md duration-[var(--dur-fast)] ease-[var(--ease-standard)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
                >
                    <NotificationPanel />
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}
