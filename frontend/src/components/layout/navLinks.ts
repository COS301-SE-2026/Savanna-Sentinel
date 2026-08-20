import {
    LayoutDashboard,
    FileText,
    RouteIcon,
    Upload,
    ShieldCheck,
    User,
    type LucideIcon,
} from "lucide-react";

export interface NavItem {
    label: string;
    path: string;
    icon: LucideIcon;
    /** Roles that can see this item. Empty array = every authenticated role. */
    roles: string[];
}

export const NAV_ITEMS: NavItem[] = [
    {
        label: "Dashboard",
        path: "/dashboard",
        icon: LayoutDashboard,
        roles: [],
    },
    {
        label: "Reports",
        path: "/reports",
        icon: FileText,
        roles: ["ranger", "analyst", "admin"],
    },
    {
        label: "Patrol Planner",
        path: "/patrol",
        icon: RouteIcon,
        roles: ["ranger", "admin"],
    },
    {
        label: "Ingestion",
        path: "/ingestion",
        icon: Upload,
        roles: ["analyst", "admin"],
    },
    {
        label: "Admin",
        path: "/admin",
        icon: ShieldCheck,
        roles: ["admin"],
    },
    {
        label: "Profile",
        path: "/profile",
        icon: User,
        roles: [],
    },
];
