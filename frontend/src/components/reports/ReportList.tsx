import * as React from "react";
import { Inbox } from "lucide-react";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { theadClass, cellClass, rowClass } from "@/components/ui/table-styles";
import { ReportSearchFilterBar } from "@/components/reports/ReportSearchFilterBar";
import { ReportDetailDialog } from "@/components/reports/ReportDetailDialog";
import {
    reportSortAccessors,
    type ReportSortKey,
} from "@/components/reports/reportColumns";
import {
    useReportSearchFilter,
    getSpeciesOptions,
} from "@/hooks/useReportSearchFilter";
import { useSort } from "@/hooks/useSort";
import {
    SEVERITY_OPTIONS,
    type DraftReport,
    type ReportType,
    type Severity,
} from "@/types/reports";

const PAGE_SIZE = 10;

const severityBadgeVariant: Record<Severity, "caution" | "alert" | "critical"> =
    {
        low: "caution",
        medium: "alert",
        high: "critical",
    };

const severityLabel: Record<Severity, string> = Object.fromEntries(
    SEVERITY_OPTIONS.map((option) => [option.value, option.label]),
) as Record<Severity, string>;

interface ReportListProps {
    reports: DraftReport[];
    canSubmit: boolean;
    onGoToNewReport: () => void;
}

export function ReportList({
    reports,
    canSubmit,
    onGoToNewReport,
}: ReportListProps) {
    const [search, setSearch] = React.useState("");
    const [typeFilter, setTypeFilter] = React.useState<ReportType[]>([]);
    const [severityFilter, setSeverityFilter] = React.useState<Severity[]>([]);
    const [speciesFilter, setSpeciesFilter] = React.useState<string[]>([]);
    const [page, setPage] = React.useState(1);
    const [selectedReport, setSelectedReport] =
        React.useState<DraftReport | null>(null);

    const speciesOptions = React.useMemo(
        () => getSpeciesOptions(reports),
        [reports],
    );

    const filtered = useReportSearchFilter(
        reports,
        search,
        typeFilter,
        severityFilter,
        speciesFilter,
    );

    const { sorted, sortKey, direction, requestSort } = useSort<
        DraftReport,
        ReportSortKey
    >(filtered, reportSortAccessors, { key: "createdAt", direction: "desc" });

    const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const pageItems = sorted.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE,
    );

    if (reports.length === 0) {
        return (
            <EmptyState
                icon={Inbox}
                title="No reports yet"
                body={
                    canSubmit
                        ? "Submitted field reports will appear here."
                        : "No reports have been submitted yet."
                }
                action={
                    canSubmit && (
                        <Button onClick={onGoToNewReport}>
                            Submit First Report
                        </Button>
                    )
                }
            />
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <ReportSearchFilterBar
                search={search}
                onSearchChange={(value) => {
                    setSearch(value);
                    setPage(1);
                }}
                typeFilter={typeFilter}
                onTypeFilterChange={(types) => {
                    setTypeFilter(types);
                    setPage(1);
                }}
                severityFilter={severityFilter}
                onSeverityFilterChange={(severities) => {
                    setSeverityFilter(severities);
                    setPage(1);
                }}
                speciesFilter={speciesFilter}
                onSpeciesFilterChange={(species) => {
                    setSpeciesFilter(species);
                    setPage(1);
                }}
                speciesOptions={speciesOptions}
            />

            {sorted.length === 0 ? (
                <p className="py-10 text-center text-sm text-color-text-secondary">
                    No reports match your search or filters.
                </p>
            ) : (
                <>
                    <div className="overflow-x-auto rounded-lg border border-color-border bg-color-surface-raised shadow-sm">
                        <Table>
                            <TableHeader className="bg-brand-primary">
                                <TableRow className="hover:bg-transparent">
                                    <SortableTableHead
                                        label="Type"
                                        active={sortKey === "reportType"}
                                        direction={direction}
                                        onSort={() => requestSort("reportType")}
                                    />
                                    <SortableTableHead
                                        label="Description"
                                        active={sortKey === "description"}
                                        direction={direction}
                                        onSort={() =>
                                            requestSort("description")
                                        }
                                    />
                                    <TableHead className={theadClass}>
                                        Details
                                    </TableHead>
                                    <TableHead className={theadClass}>
                                        Location
                                    </TableHead>
                                    <SortableTableHead
                                        label="Occurred At"
                                        active={sortKey === "occurredAt"}
                                        direction={direction}
                                        onSort={() => requestSort("occurredAt")}
                                    />
                                    <SortableTableHead
                                        label="Submitted By"
                                        active={sortKey === "submittedBy"}
                                        direction={direction}
                                        onSort={() =>
                                            requestSort("submittedBy")
                                        }
                                    />
                                    <TableHead className={theadClass}>
                                        Sync Status
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pageItems.map((report) => (
                                    <TableRow
                                        key={report.localId}
                                        className={`${rowClass} cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-primary`}
                                        tabIndex={0}
                                        aria-label={`View report: ${report.description}`}
                                        onClick={() =>
                                            setSelectedReport(report)
                                        }
                                        onKeyDown={(event) => {
                                            if (
                                                event.key === "Enter" ||
                                                event.key === " "
                                            ) {
                                                event.preventDefault();
                                                setSelectedReport(report);
                                            }
                                        }}
                                    >
                                        <TableCell className={cellClass}>
                                            <Badge variant="neutral">
                                                {report.reportType ===
                                                "incident"
                                                    ? "Incident"
                                                    : "Sighting"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell
                                            className={`${cellClass} max-w-xs truncate`}
                                        >
                                            {report.description}
                                        </TableCell>
                                        <TableCell className={cellClass}>
                                            {report.reportType ===
                                            "incident" ? (
                                                report.severity ? (
                                                    <Badge
                                                        variant={
                                                            severityBadgeVariant[
                                                                report.severity
                                                            ]
                                                        }
                                                    >
                                                        {
                                                            severityLabel[
                                                                report.severity
                                                            ]
                                                        }
                                                    </Badge>
                                                ) : (
                                                    "-"
                                                )
                                            ) : (
                                                `${report.species}${report.count ? ` x${report.count}` : ""}`
                                            )}
                                        </TableCell>
                                        <TableCell className={cellClass}>
                                            {report.lat !== null &&
                                            report.lon !== null
                                                ? `${report.lat.toFixed(4)}, ${report.lon.toFixed(4)}`
                                                : "-"}
                                        </TableCell>
                                        <TableCell
                                            className={`${cellClass} text-sm text-color-text-secondary`}
                                        >
                                            {new Date(
                                                report.occurredAt,
                                            ).toLocaleString(undefined, {
                                                dateStyle: "medium",
                                                timeStyle: "short",
                                            })}
                                        </TableCell>
                                        <TableCell className={cellClass}>
                                            {report.submittedByUsername ??
                                                report.submittedBy}
                                        </TableCell>
                                        <TableCell className={cellClass}>
                                            {report.syncStatus === "synced" ? (
                                                <Badge variant="safe">
                                                    Synced
                                                </Badge>
                                            ) : (
                                                <Badge variant="caution">
                                                    {report.syncStatus ===
                                                    "offline"
                                                        ? "Offline"
                                                        : "Pending Sync"}
                                                </Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setPage}
                    />
                </>
            )}

            <ReportDetailDialog
                report={selectedReport}
                onOpenChange={(open) => {
                    if (!open) setSelectedReport(null);
                }}
            />
        </div>
    );
}
