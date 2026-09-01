import { currentLocalDatetime } from "@/lib/utils";

export type ReportType = "incident" | "sighting";
export type Severity = "low" | "medium" | "high";

export interface PhotoAttachment {
    file: File;
    previewUrl: string;
}

export interface DraftReportInput {
    reportType: ReportType;
    description: string;
    incidentType: string;
    severity: Severity | null;
    species: string;
    count: number | null;
    occurredAt: string;
    lat: number | null;
    lon: number | null;
    photos: PhotoAttachment[];
}

export interface DraftReport extends DraftReportInput {
    localId: string;
    submittedBy: string;
    submittedByUsername?: string | null;
    createdAt: string;
    syncStatus: "offline" | "pending" | "synced";
    status?: string;
}

export const INCIDENT_TYPE_OPTIONS = [
    "Snare Found",
    "Gunshot Heard",
    "Suspicious Tracks",
    "Suspicious Person",
    "Carcass Found",
    "Vehicle Tracks",
    "Other",
] as const;

export const SPECIES_OPTIONS = [
    "Elephant",
    "Rhino",
    "Lion",
    "Leopard",
    "Buffalo",
    "Other",
] as const;

export const SEVERITY_OPTIONS: { value: Severity; label: string }[] = [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
];

export function blankDraftReportInput(
    reportType: ReportType = "incident",
): DraftReportInput {
    return {
        reportType,
        description: "",
        incidentType: "",
        severity: null,
        species: "",
        count: null,
        occurredAt: currentLocalDatetime(),
        lat: null,
        lon: null,
        photos: [],
    };
}
