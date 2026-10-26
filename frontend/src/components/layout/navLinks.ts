import {
    LayoutDashboard,
    FileText,
    Map,
    RouteIcon,
    Upload,
    ShieldCheck,
    User,
    Megaphone,
    Layers,
    MapPinned,
    type LucideIcon,
} from "lucide-react";

export interface NavItem {
    label: string;
    path: string;
    icon: LucideIcon;
    /** Roles that can see this item. Empty array = every authenticated role. */
    roles: string[];
}

/** Paths still reachable while no park boundary has been uploaded. */
export const NO_PARK_PATHS = ["/upload", "/admin", "/profile", "/help"];

export function canRoleSee(item: NavItem, role: string | undefined): boolean {
    return item.roles.length === 0 || (!!role && item.roles.includes(role));
}

export const NAV_ITEMS: NavItem[] = [
    {
        label: "Dashboard",
        path: "/dashboard",
        icon: LayoutDashboard,
        roles: ["ranger", "analyst", "admin"],
    },
    {
        label: "Reports",
        path: "/reports",
        icon: FileText,
        roles: ["ranger", "analyst", "admin"],
    },
    {
        label: "Heatmap",
        path: "/map",
        icon: Map,
        roles: ["ranger", "analyst", "admin"],
    },
    {
        label: "Patrol Planner",
        path: "/patrol",
        icon: RouteIcon,
        roles: ["ranger", "admin"],
    },
    {
        label: "Tip-offs",
        path: "/tipoffs",
        icon: Megaphone,
        roles: ["community_liaison", "analyst", "ranger", "admin"],
    },
    {
        label: "Ingestion",
        path: "/ingestion",
        icon: Upload,
        roles: ["analyst", "admin"],
    },
    {
        label: "Workspace",
        path: "/workspace",
        icon: Layers,
        roles: ["analyst", "admin"],
    },
    {
        label: "Upload Park",
        path: "/upload",
        icon: MapPinned,
        roles: ["admin"],
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
