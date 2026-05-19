import {
  LayoutDashboard,
  Map,
  FileText,
  RouteIcon,
  Upload,
  MessageSquare,
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
    roles: ["ranger", "analyst", "admin"],
  },
  {
    label: "Map",
    path: "/map",
    icon: Map,
    roles: ["ranger", "analyst", "admin"],
  },
  {
    label: "Reports",
    path: "/reports",
    icon: FileText,
    roles: ["ranger", "admin"],
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
    label: "Tip-offs",
    path: "/tipoffs",
    icon: MessageSquare,
    roles: ["community_liaison", "admin"],
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
