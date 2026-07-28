import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { SidebarMenuSkeleton } from "@/components/ui/sidebar";

describe("SidebarMenuSkeleton", () => {
    it("renders a text skeleton with a randomized width between 50% and 90%", () => {
        render(<SidebarMenuSkeleton />);

        const text = document.querySelector(
            '[data-sidebar="menu-skeleton-text"]',
        ) as HTMLElement | null;
        const width = text?.style.getPropertyValue("--skeleton-width");

        expect(width).toMatch(/^\d+%$/);
        const value = Number(width?.replace("%", ""));
        expect(value).toBeGreaterThanOrEqual(50);
        expect(value).toBeLessThanOrEqual(89);
    });

    it("renders an icon skeleton when showIcon is true", () => {
        render(<SidebarMenuSkeleton showIcon />);

        expect(
            document.querySelector('[data-sidebar="menu-skeleton-icon"]'),
        ).not.toBeNull();
    });
});
