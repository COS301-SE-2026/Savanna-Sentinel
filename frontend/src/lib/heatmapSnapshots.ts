import type { HeatmapSnapshot } from "@/services/riskApi";

export interface DaySnapshotGroup {
    dateKey: string;
    label: string;
    snapshots: HeatmapSnapshot[];
}

export function groupSnapshotsByDay(
    snapshots: HeatmapSnapshot[],
): DaySnapshotGroup[] {
    const byDate = new Map<string, HeatmapSnapshot[]>();
    for (const snap of snapshots) {
        const dateKey = snap.computed_at.slice(0, 10);
        const existing = byDate.get(dateKey);
        if (existing) existing.push(snap);
        else byDate.set(dateKey, [snap]);
    }

    return Array.from(byDate.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dateKey, snaps]) => ({
            dateKey,
            label: new Date(`${dateKey}T00:00:00Z`).toLocaleDateString(
                undefined,
                { day: "numeric", month: "short", year: "numeric" },
            ),
            snapshots: [...snaps].sort((a, b) =>
                a.computed_at.localeCompare(b.computed_at),
            ),
        }));
}

export function formatSnapshotTime(computedAt: string): string {
    return new Date(computedAt).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
    });
}
