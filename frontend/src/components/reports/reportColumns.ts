import type { DraftReport } from "@/types/reports";

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
