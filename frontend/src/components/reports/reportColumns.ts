import type { DraftReport } from "@/types/reports";
import type { ReportSortField } from "@/services/reportsApi";

export type ReportSortKey =
    "reportType" | "description" | "occurredAt" | "submittedBy" | "createdAt";

export const reportSortAccessors: Record<
    ReportSortKey,
    (report: DraftReport) => string | number
> = {
    reportType: (r) => r.reportType,
    description: (r) => r.description.toLowerCase(),
    occurredAt: (r) => new Date(r.occurredAt).getTime(),
    submittedBy: (r) => r.submittedBy.toLowerCase(),
    createdAt: (r) => new Date(r.createdAt).getTime(),
};

export const reportSortFields: Record<ReportSortKey, ReportSortField> = {
    reportType: "report_type",
    description: "description",
    occurredAt: "occurred_at",
    submittedBy: "submitted_by",
    createdAt: "created_at",
};
