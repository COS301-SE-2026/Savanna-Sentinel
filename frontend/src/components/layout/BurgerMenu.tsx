import { useState } from "react";
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
                <Button
                    variant="ghost"
                    size="icon"
                    className="text-primary-foreground hover:bg-white/10 active:bg-white/15 focus-visible:ring-0 focus-visible:border-transparent aria-expanded:bg-transparent"
                    aria-label="Open navigation menu"
                >
                    <MenuIcon className="size-5" />
                </Button>
            </SheetTrigger>

            <SheetContent
                side="left"
                showCloseButton={false}
                className="w-64 bg-sidebar text-sidebar-foreground border-sidebar-border p-0 flex flex-col"
            >
                <SheetHeader className="flex-row items-start justify-between px-5 pt-5 pb-4 border-b border-sidebar-border">
                    <div>
                        <SheetTitle className="text-sidebar-foreground text-base font-semibold tracking-wide">
                            Savanna Sentinel
                        </SheetTitle>
                        {user && (
                            <p className="text-xs text-sidebar-foreground/60 capitalize mt-0.5">
                                {user.role.replace("_", " ")}
                            </p>
                        )}
                    </div>
                    <SheetClose asChild>
                        <button
                            className="rounded-md p-1 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"
                            aria-label="Close menu"
                        >
                            <XIcon className="size-5" />
                        </button>
                    </SheetClose>
                </SheetHeader>

                <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                    {visibleItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={() => setOpen(false)}
                            className={({ isActive }) =>
                                cn(
                                    "flex items-center gap-3 rounded-md px-4 py-3 text-sm font-medium transition-colors",
                                    isActive
                                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                                )
                            }
                        >
                            <item.icon className="size-5 shrink-0" />
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                <div className="px-3 py-4 border-t border-sidebar-border">
                    <button
                        onClick={() => {
                            setOpen(false);
                            logout();
                        }}
                        className="flex w-full items-center gap-3 rounded-md px-4 py-3 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors"
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
