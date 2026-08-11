import { MultiSelectFilterBar, type MultiSelectFilterGroup } from "@/components/ui/multi-select-filter-bar";
import type { ReportType, Severity } from "@/types/reports";
import React from "react";

const TYPE_OPTIONS: { value: ReportType; label: string }[] = [
    { value: "incident", label: "Incident" },
    { value: "sighting", label: "Sighting" },
];

const SEVERITY_OPTIONS: { value: Severity; label: string }[] = [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
];

interface ReportSearchFilterBarProps {
    search: string;
    onSearchChange: (value: string) => void;
    typeFilter: ReportType[];
    onTypeFilterChange: (types: ReportType[]) => void;
    severityFilter: Severity[];
    onSeverityFilterChange: (severities: Severity[]) => void;
    speciesFilter: string[];
    onSpeciesFilterChange: (species: string[]) => void;
    speciesOptions: string[];
}

function ReportSearchFilterBarBase({
    search,
    onSearchChange,
    typeFilter,
    onTypeFilterChange,
    severityFilter,
    onSeverityFilterChange,
    speciesFilter,
    onSpeciesFilterChange,
    speciesOptions,
}: ReportSearchFilterBarProps) {
    const filterGroups : MultiSelectFilterGroup[] = React.useMemo(
        () => [
                {
                    key: "type",
                    label: "Report Type",
                    chipLabel: "Type",
                    options: TYPE_OPTIONS,
                    selected: typeFilter,
                    onChange: (values) =>
                        onTypeFilterChange(values as ReportType[]),
                },
                {
                    key: "severity",
                    label: "Severity",
                    options: SEVERITY_OPTIONS,
                    selected: severityFilter,
                    onChange: (values) =>
                        onSeverityFilterChange(values as Severity[]),
                },
                {
                    key: "species",
                    label: "Species",
                    options: speciesOptions.map((species) => ({
                        value: species,
                        label: species,
                    })),
                    selected: speciesFilter,
                    onChange: onSpeciesFilterChange,
                },
            ],
            [
                typeFilter,
                onTypeFilterChange,
                severityFilter,
                onSeverityFilterChange,
                speciesOptions,
                speciesFilter,
                onSpeciesFilterChange,
            ]
    )
    return (
        <MultiSelectFilterBar
            search={search}
            onSearchChange={onSearchChange}
            searchPlaceholder="Search reports..."
            groups={filterGroups}
        />
    );
}

export const ReportSearchFilterBar = React.memo(ReportSearchFilterBarBase);
