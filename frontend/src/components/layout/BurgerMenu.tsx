import { Fragment, useState } from "react";
import { NavLink } from "react-router-dom";
import { MenuIcon, LogOutIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetTrigger,
    SheetClose,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { NAV_ITEMS } from "./navLinks";

const BurgerMenu = () => {
    const [isOpen, setOpen] = useState(false);
    const user = useAuthStore((s) => s.user);
    const logout = useAuthStore((s) => s.logout);

    const visibleItems = NAV_ITEMS.filter(
        (item) =>
            item.roles.length === 0 || (user && item.roles.includes(user.role)),
    );

    return (
        <Sheet open={isOpen} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open navigation menu">
                    <MenuIcon className="size-5" />
                </Button>
            </SheetTrigger>

            <SheetContent
                side="left"
                showCloseButton={false}
                className="w-64 bg-brand-primary text-color-text-inverse border-color-surface-deep p-0 flex flex-col"
            >
                <SheetHeader className="flex-row items-start justify-between px-5 pt-5 pb-4 border-b border-color-surface-deep">
                    <div>
                        <SheetTitle className="text-color-text-inverse text-base font-semibold tracking-wide">
                            Savanna Sentinel
                        </SheetTitle>
                        {user && (
                            <p className="text-xs text-color-text-inverse/60 capitalize mt-0.5">
                                {user.role.replace("_", " ")}
                            </p>
                        )}
                    </div>
                    <SheetClose asChild>
                        <button
                            className="rounded-md p-1 text-color-text-inverse/60 hover:text-color-text-inverse hover:bg-brand-mid/60 transition-colors"
                            aria-label="Close menu"
                        >
                            <XIcon className="size-5" />
                        </button>
                    </SheetClose>
                </SheetHeader>

                <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                    {visibleItems.map((item) => (
                        <Fragment key={item.path}>
                            {item.path === "/profile" && (
                                <hr className="h-px my-1 border-none bg-color-text-secondary" />
                            )}
                            <NavLink
                                to={item.path}
                                onClick={() => setOpen(false)}
                                className={({ isActive }) =>
                                    cn(
                                        "flex items-center gap-3 px-4 py-3 min-h-11 text-sm font-medium text-color-text-inverse outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-color-text-inverse focus-visible:[--tw-outline-style:solid] focus-visible:rounded-sm",
                                        isActive
                                            ? "bg-color-surface-deep"
                                            : "hover:bg-brand-mid",
                                    )
                                }
                            >
                                <item.icon className="size-4 shrink-0" />
                                {item.label}
                            </NavLink>
                        </Fragment>
                    ))}
                </nav>

                <div className="px-3 py-4 border-t border-color-surface-deep">
                    <button
                        onClick={() => {
                            setOpen(false);
                            logout();
                        }}
                        className="flex w-full items-center gap-3 rounded-md px-4 py-3 text-sm font-medium text-color-text-inverse/80 hover:bg-brand-mid/60 hover:text-color-text-inverse transition-colors"
                    >
                        <LogOutIcon className="size-5 shrink-0" />
                        Log out
                    </button>
                </div>
            </SheetContent>
        </Sheet>
    );
};

export default BurgerMenu;
