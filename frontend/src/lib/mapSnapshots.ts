// static/mock

export interface Snapshot {
    label: string;
    value: string;
}

export const SNAPSHOTS: Snapshot[] = [
    { label: "15 Jan 2025", value: "2025-01-15" },
    { label: "15 Mar 2025", value: "2025-03-15" },
    { label: "1 May 2025", value: "2025-05-01" },
    { label: "15 Jun 2025", value: "2025-06-15" },
    { label: "1 Aug 2025", value: "2025-08-01" },
    { label: "15 Sep 2025", value: "2025-09-15" },
    { label: "1 Nov 2025", value: "2025-11-01" },
    { label: "15 Dec 2025", value: "2025-12-15" },
    { label: "1 Mar 2026", value: "2026-03-01" },
    { label: "14 May 2026", value: "2026-05-14" },
];

export const TIME_OF_DAY_SLOTS = ["00:00", "06:00", "12:00", "18:00"];
