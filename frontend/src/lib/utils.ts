import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatRole(role: string) {
    return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function toDatetimeLocalValue(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function currentLocalDatetime(): string {
    return toDatetimeLocalValue(new Date());
}

export function formatToUTC(dateString: string): string {
    const parsed = new Date(dateString);
    if (isNaN(parsed.getTime())) {
        return new Date().toISOString();
    }

    const now = new Date();
    if (parsed > now) {
        return now.toISOString();
    }

    return parsed.toISOString();
}

export function getSnapHeightPx(snap: string | number): number {
    if (typeof snap === "string") return parseInt(snap, 10);
    return snap * window.innerHeight;
}

export function formatRelativeTime(timestamp: string) {
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const diffMin = Math.max(0, Math.floor(diffMs / 60_000));

    if (diffMin < 60) return `${diffMin} min ago`;

    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} hr ago`;

    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
}
