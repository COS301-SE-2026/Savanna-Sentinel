import { useMemo } from "react";

import type { DraftReport, ReportType, Severity } from "@/types/reports";

export function getSpeciesOptions(reports: DraftReport[]): string[] {
    const species = new Set(
        reports.map((r) => r.species).filter((s) => s !== ""),
    );
    return Array.from(species).sort((a, b) => a.localeCompare(b));
}

export function useReportSearchFilter(
    reports: DraftReport[],
    search: string,
    typeFilter: ReportType[],
    severityFilter: Severity[],
    speciesFilter: string[],
): DraftReport[] {
    return useMemo(() => {
        const query = search.trim().toLowerCase();
        return reports.filter((report) => {
            const isTypeMatch =
                typeFilter.length === 0 ||
                typeFilter.includes(report.reportType);
            const isSeverityMatch =
                severityFilter.length === 0 ||
                (report.severity !== null &&
                    severityFilter.includes(report.severity));
            const isSpeciesMatch =
                speciesFilter.length === 0 ||
                speciesFilter.includes(report.species);
            const isSearchMatch =
                query === "" ||
                [
                    report.reportType,
                    report.description,
                    report.incidentType,
                    report.severity ?? "",
                    report.species,
                    report.count !== null ? String(report.count) : "",
                    report.occurredAt,
                    report.lat !== null ? String(report.lat) : "",
                    report.lon !== null ? String(report.lon) : "",
                    report.submittedBy,
                ]
                    .join(" ")
                    .toLowerCase()
                    .includes(query);
            return (
                isTypeMatch &&
                isSeverityMatch &&
                isSpeciesMatch &&
                isSearchMatch
            );
        });
    }, [reports, search, typeFilter, severityFilter, speciesFilter]);
}
