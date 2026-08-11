import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import {
    useReportSearchFilter,
    getSpeciesOptions,
} from "@/hooks/useReportSearchFilter";
import type { DraftReport } from "@/types/reports";

function makeReport(overrides: Partial<DraftReport>): DraftReport {
    return {
        reportType: "incident",
        description: "",
        incidentType: "",
        severity: null,
        species: "",
        count: null,
        occurredAt: "2020-01-01T08:00",
        lat: -25,
        lon: 28,
        photos: [],
        localId: Math.random().toString(),
        submittedBy: "ranger1",
        createdAt: "2020-01-01T08:00:00.000Z",
        syncStatus: "pending",
        ...overrides,
    };
}

describe("useReportSearchFilter", () => {
    const reports = [
        makeReport({
            reportType: "incident",
            description: "Wire snare found near fence",
            incidentType: "Snare Found",
            severity: "high",
            submittedBy: "ranger1",
        }),
        makeReport({
            reportType: "sighting",
            description: "Herd near the waterhole",
            species: "Elephant",
            severity: null,
            submittedBy: "ranger2",
        }),
        makeReport({
            reportType: "incident",
            description: "Vehicle tracks near border",
            incidentType: "Vehicle Tracks",
            severity: "low",
            submittedBy: "ranger2",
        }),
    ];

    it("returns everything when search and filters are empty", () => {
        const { result } = renderHook(() =>
            useReportSearchFilter(reports, "", [], [], []),
        );
        expect(result.current).toHaveLength(3);
    });

    it("filters by search text against description", () => {
        const { result } = renderHook(() =>
            useReportSearchFilter(reports, "waterhole", [], [], []),
        );
        expect(result.current).toHaveLength(1);
        expect(result.current[0].species).toBe("Elephant");
    });

    it("filters by search text against submittedBy", () => {
        const { result } = renderHook(() =>
            useReportSearchFilter(reports, "ranger1", [], [], []),
        );
        expect(result.current).toHaveLength(1);
    });

    it("filters by report type", () => {
        const { result } = renderHook(() =>
            useReportSearchFilter(reports, "", ["sighting"], [], []),
        );
        expect(result.current).toHaveLength(1);
        expect(result.current[0].reportType).toBe("sighting");
    });

    it("filters by severity, excluding sightings with no severity", () => {
        const { result } = renderHook(() =>
            useReportSearchFilter(reports, "", [], ["high"], []),
        );
        expect(result.current).toHaveLength(1);
        expect(result.current[0].incidentType).toBe("Snare Found");
    });

    it("combines type, severity, and search filters", () => {
        const { result } = renderHook(() =>
            useReportSearchFilter(reports, "border", ["incident"], ["low"], []),
        );
        expect(result.current).toHaveLength(1);
        expect(result.current[0].incidentType).toBe("Vehicle Tracks");
    });

    it("filters by search text against severity", () => {
        const { result } = renderHook(() =>
            useReportSearchFilter(reports, "high", [], [], []),
        );
        expect(result.current).toHaveLength(1);
        expect(result.current[0].incidentType).toBe("Snare Found");
    });

    it("filters by search text against report type", () => {
        const { result } = renderHook(() =>
            useReportSearchFilter(reports, "sighting", [], [], []),
        );
        expect(result.current).toHaveLength(1);
        expect(result.current[0].species).toBe("Elephant");
    });

    it("filters by search text against location coordinates", () => {
        const located = [
            ...reports,
            makeReport({
                description: "Tracks near river bend",
                lat: -25.75,
                lon: 28.19,
                submittedBy: "ranger3",
            }),
        ];
        const { result } = renderHook(() =>
            useReportSearchFilter(located, "-25.75", [], [], []),
        );
        expect(result.current).toHaveLength(1);
        expect(result.current[0].submittedBy).toBe("ranger3");
    });

    it("filters by search text against the occurred-at timestamp", () => {
        const dated = [
            ...reports,
            makeReport({
                description: "Late night patrol note",
                occurredAt: "2024-03-15T21:00",
                submittedBy: "ranger3",
            }),
        ];
        const { result } = renderHook(() =>
            useReportSearchFilter(dated, "2024-03-15", [], [], []),
        );
        expect(result.current).toHaveLength(1);
        expect(result.current[0].submittedBy).toBe("ranger3");
    });

    it("filters by search text against sighting count", () => {
        const counted = [
            ...reports,
            makeReport({
                reportType: "sighting",
                description: "Buffalo herd",
                species: "Buffalo",
                count: 42,
                submittedBy: "ranger3",
            }),
        ];
        const { result } = renderHook(() =>
            useReportSearchFilter(counted, "42", [], [], []),
        );
        expect(result.current).toHaveLength(1);
        expect(result.current[0].submittedBy).toBe("ranger3");
    });

    it("filters by species, excluding incidents with no species", () => {
        const { result } = renderHook(() =>
            useReportSearchFilter(reports, "", [], [], ["Elephant"]),
        );
        expect(result.current).toHaveLength(1);
        expect(result.current[0].species).toBe("Elephant");
    });

    it("matches any of multiple selected species", () => {
        const withBuffalo = [
            ...reports,
            makeReport({
                reportType: "sighting",
                description: "Buffalo herd",
                species: "Buffalo",
                severity: null,
                submittedBy: "ranger3",
            }),
        ];
        const { result } = renderHook(() =>
            useReportSearchFilter(
                withBuffalo,
                "",
                [],
                [],
                ["Elephant", "Buffalo"],
            ),
        );
        expect(result.current).toHaveLength(2);
    });

    it("filters by search text against submittedByUsername", () => {
        const reports2 = [
            makeReport({
                description: "Snare found",
                submittedByUsername: "jane_ranger",
            }),
            makeReport({
                description: "Herd sighted",
                submittedByUsername: "john_ranger",
            }),
        ];
        const { result } = renderHook(() =>
            useReportSearchFilter(reports2, "jane_ranger", [], [], []),
        );
        expect(result.current).toHaveLength(1);
        expect(result.current[0].description).toBe("Snare found");
    });

    it("filters by the submitted-by username filter, excluding reports with no resolved username", () => {
        const reports2 = [
            makeReport({ description: "A", submittedByUsername: "jane_ranger" }),
            makeReport({ description: "B", submittedByUsername: "john_ranger" }),
            makeReport({ description: "C", submittedByUsername: null }),
        ];
        const { result } = renderHook(() =>
            useReportSearchFilter(reports2, "", [], [], [], ["jane_ranger"]),
        );
        expect(result.current).toHaveLength(1);
        expect(result.current[0].description).toBe("A");
    });

    it("matches any of multiple selected usernames", () => {
        const reports2 = [
            makeReport({ description: "A", submittedByUsername: "jane_ranger" }),
            makeReport({ description: "B", submittedByUsername: "john_ranger" }),
            makeReport({ description: "C", submittedByUsername: "sam_ranger" }),
        ];
        const { result } = renderHook(() =>
            useReportSearchFilter(
                reports2,
                "",
                [],
                [],
                [],
                ["jane_ranger", "sam_ranger"],
            ),
        );
        expect(result.current).toHaveLength(2);
    });
});

describe("getSpeciesOptions", () => {
    it("returns the distinct, non-empty species values sorted alphabetically", () => {
        const reports = [
            makeReport({ reportType: "sighting", species: "Elephant" }),
            makeReport({ reportType: "incident", species: "" }),
            makeReport({ reportType: "sighting", species: "Buffalo" }),
            makeReport({ reportType: "sighting", species: "Elephant" }),
        ];
        expect(getSpeciesOptions(reports)).toEqual(["Buffalo", "Elephant"]);
    });

    it("returns an empty array when no report has a species", () => {
        const reports = [makeReport({ reportType: "incident", species: "" })];
        expect(getSpeciesOptions(reports)).toEqual([]);
    });

    it("sorts case-insensitively instead of by Unicode code point", () => {
        const reports = [
            makeReport({ reportType: "sighting", species: "Elephant" }),
            makeReport({ reportType: "sighting", species: "buffalo" }),
        ];
        expect(getSpeciesOptions(reports)).toEqual(["buffalo", "Elephant"]);
    });
});
