import { useState } from "react";
import { Link } from "react-router-dom";
import { Popover } from "radix-ui";
import { UserIcon, LogOutIcon } from "lucide-react";

import { useAuthStore } from "@/store/authStore";

export default function AccountMenu() {
    const [isOpen, setOpen] = useState(false);
    const user = useAuthStore((s) => s.user);
    const logout = useAuthStore((s) => s.logout);
    const initials = user ? user.username[0].toUpperCase() : "";

    const handleLogout = () => {
        setOpen(false);
        logout();
    };

    return (
        <Popover.Root open={isOpen} onOpenChange={setOpen}>
            <Popover.Trigger asChild>
                <button
                    type="button"
                    aria-label="Account"
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-mid font-heading text-sm font-bold tracking-[0.3px] text-color-text-inverse outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary focus-visible:[--tw-outline-style:solid]"
                >
                    {initials}
                </button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content
                    side="bottom"
                    align="end"
                    sideOffset={14}
                    className="z-[var(--z-dropdown)] w-56 overflow-hidden rounded-lg border border-color-border bg-color-surface-raised shadow-md duration-[var(--dur-fast)] ease-[var(--ease-standard)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
                >
                    {user && (
                        <div className="border-b border-color-border px-4 py-3">
                            <span className="truncate font-heading text-base font-bold text-brand-primary">
                                {user.username}
                            </span>
                            <p className="mt-0.5 font-sans text-xs text-brand-mid capitalize">
                                {user.role.replace("_", " ")}
                            </p>
                        </div>
                    )}

                    <ul className="m-0 list-none p-0">
                        <li className="border-b border-color-border last:border-b-0">
                            <Link
                                to="/profile"
                                onClick={() => setOpen(false)}
                                className="flex min-h-11 items-center gap-3 px-4 py-3 font-sans text-sm font-semibold text-color-text-primary outline-none transition-colors hover:bg-color-surface-bg focus-visible:bg-color-surface-bg"
                            >
                                <UserIcon className="size-4 shrink-0 text-brand-primary" />
                                Profile &amp; settings
                            </Link>
                        </li>
                        <li className="border-b border-color-border last:border-b-0">
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="flex min-h-11 w-full items-center gap-3 px-4 py-3 font-sans text-sm font-semibold text-color-text-primary outline-none transition-colors hover:bg-color-surface-bg focus-visible:bg-color-surface-bg"
                            >
                                <LogOutIcon className="size-4 shrink-0 text-brand-primary" />
                                Log out
                            </button>
                        </li>
                    </ul>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}
