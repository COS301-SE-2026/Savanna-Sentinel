import { describe, it, expect, vi, afterEach } from "vitest";
import {
    cn,
    formatRole,
    formatRelativeTime,
    homePathForRole,
} from "@/lib/utils";

describe("cn", () => {
    it("merges and dedupes tailwind classes", () => {
        expect(cn("px-2", "px-4")).toBe("px-4");
        const isHidden = false;
        expect(cn("text-sm", isHidden && "hidden", "font-bold")).toBe(
            "text-sm font-bold",
        );
    });
});

describe("homePathForRole", () => {
    it("lands dashboard-capable roles on the dashboard", () => {
        expect(homePathForRole("ranger")).toBe("/dashboard");
        expect(homePathForRole("analyst")).toBe("/dashboard");
        expect(homePathForRole("admin")).toBe("/dashboard");
    });

    it("lands a community liaison on tipoffs", () => {
        expect(homePathForRole("community_liaison")).toBe("/tipoffs");
    });

    it("falls back to profile for an unknown or missing role", () => {
        expect(homePathForRole(undefined)).toBe("/profile");
        expect(homePathForRole("volunteer")).toBe("/profile");
    });
});

describe("formatRole", () => {
    it("replaces underscores with spaces and capitalizes each word", () => {
        expect(formatRole("community_liaison")).toBe("Community Liaison");
        expect(formatRole("ranger")).toBe("Ranger");
        expect(formatRole("analyst")).toBe("Analyst");
    });
});

describe("formatRelativeTime", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("shows minutes ago for under an hour", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-07-19T12:30:00.000Z"));

        expect(formatRelativeTime("2026-07-19T12:15:00.000Z")).toBe(
            "15 min ago",
        );
    });

    it("shows hours ago for under a day", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-07-19T12:00:00.000Z"));

        expect(formatRelativeTime("2026-07-19T07:00:00.000Z")).toBe("5 hr ago");
    });

    it("shows singular day ago for exactly one day", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-07-19T12:00:00.000Z"));

        expect(formatRelativeTime("2026-07-18T12:00:00.000Z")).toBe(
            "1 day ago",
        );
    });

    it("shows plural days ago for more than one day", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-07-19T12:00:00.000Z"));

        expect(formatRelativeTime("2026-07-16T12:00:00.000Z")).toBe(
            "3 days ago",
        );
    });
});
