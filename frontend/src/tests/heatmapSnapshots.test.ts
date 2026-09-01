import { describe, it, expect } from "vitest";

import {
    groupSnapshotsByDay,
    formatSnapshotTime,
} from "@/lib/heatmapSnapshots";
import type { HeatmapSnapshot } from "@/services/riskApi";

describe("groupSnapshotsByDay", () => {
    it("groups snapshots by UTC calendar date", () => {
        const snapshots: HeatmapSnapshot[] = [
            { heatmap_id: "a", computed_at: "2026-08-20T06:00:00Z" },
            { heatmap_id: "b", computed_at: "2026-08-20T18:00:00Z" },
            { heatmap_id: "c", computed_at: "2026-08-21T06:00:00Z" },
        ];

        const groups = groupSnapshotsByDay(snapshots);

        expect(groups).toHaveLength(2);
        expect(groups[0].dateKey).toBe("2026-08-20");
        expect(groups[0].snapshots.map((s) => s.heatmap_id)).toEqual([
            "a",
            "b",
        ]);
        expect(groups[1].dateKey).toBe("2026-08-21");
        expect(groups[1].snapshots.map((s) => s.heatmap_id)).toEqual(["c"]);
    });

    it("sorts groups ascending by date regardless of input order", () => {
        const snapshots: HeatmapSnapshot[] = [
            { heatmap_id: "later", computed_at: "2026-08-21T06:00:00Z" },
            { heatmap_id: "earlier", computed_at: "2026-08-20T06:00:00Z" },
        ];

        const groups = groupSnapshotsByDay(snapshots);

        expect(groups.map((g) => g.dateKey)).toEqual([
            "2026-08-20",
            "2026-08-21",
        ]);
    });

    it("sorts snapshots within a day ascending by time", () => {
        const snapshots: HeatmapSnapshot[] = [
            { heatmap_id: "later", computed_at: "2026-08-20T18:00:00Z" },
            { heatmap_id: "earlier", computed_at: "2026-08-20T06:00:00Z" },
        ];

        const groups = groupSnapshotsByDay(snapshots);

        expect(groups[0].snapshots.map((s) => s.heatmap_id)).toEqual([
            "earlier",
            "later",
        ]);
    });

    it("returns an empty array for an empty input", () => {
        expect(groupSnapshotsByDay([])).toEqual([]);
    });
});

describe("formatSnapshotTime", () => {
    it("formats an ISO timestamp as a time string", () => {
        const formatted = formatSnapshotTime("2026-08-20T06:30:00Z");
        expect(formatted).toMatch(/\d{1,2}:\d{2}/);
    });
});
