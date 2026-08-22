export type ReportStatus = "none" | "unresolved" | "resolved";

export interface ReportComment {
    id: string;
    reportId: string;
    authorId: string;
    authorUsername: string;
    authorRole: string;
    body: string;
    photoUrls: string[];
    createdAt: string;
    statusChange?: ReportStatus;
}
