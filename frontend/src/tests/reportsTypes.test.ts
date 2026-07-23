import { describe, it, expect } from "vitest";
import {
    blankDraftReportInput,
    INCIDENT_TYPE_OPTIONS,
    SPECIES_OPTIONS,
    SEVERITY_OPTIONS,
} from "@/types/reports";

describe("blankDraftReportInput", () => {
    it("defaults to an incident report with empty fields", () => {
        const blank = blankDraftReportInput();
        expect(blank.reportType).toBe("incident");
        expect(blank.description).toBe("");
        expect(blank.incidentType).toBe("");
        expect(blank.severity).toBeNull();
        expect(blank.species).toBe("");
        expect(blank.count).toBeNull();
        expect(blank.lat).toBeNull();
        expect(blank.lon).toBeNull();
        expect(blank.photos).toEqual([]);
    });

    it("accepts an explicit report type", () => {
        const blank = blankDraftReportInput("sighting");
        expect(blank.reportType).toBe("sighting");
    });

    it("sets occurredAt to a datetime-local formatted string matching the current minute", () => {
        const blank = blankDraftReportInput();
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        const expected = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
        expect(blank.occurredAt).toBe(expected);
    });
});

describe("option constants", () => {
    it("includes Other as the last incident type option", () => {
        expect(INCIDENT_TYPE_OPTIONS[INCIDENT_TYPE_OPTIONS.length - 1]).toBe(
            "Other",
        );
    });

    it("includes Other as the last species option", () => {
        expect(SPECIES_OPTIONS[SPECIES_OPTIONS.length - 1]).toBe("Other");
    });

    it("has three severity options matching the DB enum", () => {
        expect(SEVERITY_OPTIONS.map((o) => o.value)).toEqual([
            "low",
            "medium",
            "high",
        ]);
    });
});
