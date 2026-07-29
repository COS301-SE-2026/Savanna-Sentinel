import { Link } from "react-router-dom";
import { Popover } from "radix-ui";
import { GlobeOffIcon, HelpCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import BurgerMenu from "./BurgerMenu";
import NotificationBell from "./NotificationBell";

export default function TopBar() {
    const user = useAuthStore((s) => s.user);
    const isOnline = useOnlineStatus();
    const initials = user ? user.username[0].toUpperCase() : "";

    return (
        <header className="fixed top-0 inset-x-0 z-40 h-14 flex items-center justify-between px-5 border-b border-color-border bg-color-surface-raised shadow-sm">
            <div className="flex items-center gap-3">
                <BurgerMenu />
                <span className="hidden min-[480px]:block font-heading font-bold text-lg text-brand-primary tracking-[0.2px] select-none">
                    Savanna Sentinel
                </span>
            </div>

            <div className="flex items-center gap-1">
                {!isOnline && (
                    <Popover.Root>
                        <Popover.Trigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="No Internet connection"
                                className="text-brand-primary"
                            >
                                <GlobeOffIcon className="size-5" />
                            </Button>
                        </Popover.Trigger>
                        <Popover.Portal>
                            <Popover.Content
                                side="bottom"
                                align="center"
                                sideOffset={8}
                                className="z-[var(--z-dropdown)] rounded-md border border-color-border bg-color-surface-raised px-3 py-1 font-sans text-xs font-medium text-color-text-primary shadow-md duration-[var(--dur-fast)] ease-[var(--ease-standard)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
                            >
                                No Internet connection
                            </Popover.Content>
                        </Popover.Portal>
                    </Popover.Root>
                )}
                <NotificationBell />

                <Button variant="ghost" size="icon" aria-label="Help" asChild>
                    <Link to="/help">
                        <HelpCircleIcon className="size-5" />
                    </Link>
                </Button>
                <Link
                    to="/profile"
                    aria-label="Account"
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-mid font-heading text-sm font-bold tracking-[0.3px] text-color-text-inverse outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary focus-visible:[--tw-outline-style:solid]"
                >
                    {initials}
                </Link>
            </div>
        </header>
    );
}
