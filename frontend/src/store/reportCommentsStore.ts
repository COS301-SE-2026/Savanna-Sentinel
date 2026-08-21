import { create } from "zustand";
import type { ReportComment, ReportStatus } from "@/types/reportComments";

// In memory, resets on refresh.
// Once API exists, replace

interface ReportCommentsState {
    commentsByReportId: Record<string, ReportComment[]>;
    statusByReportId: Record<string, ReportStatus>;
    addComment: (comment: ReportComment) => void;
    setStatus: (reportId: string, status: ReportStatus) => void;
    getStatus: (reportId: string) => ReportStatus;
}

export const useReportCommentsStore = create<ReportCommentsState>()(
    (set, get) => ({
        commentsByReportId: {},
        statusByReportId: {},

        addComment: (comment) =>
            set((state) => ({
                commentsByReportId: {
                    ...state.commentsByReportId,
                    [comment.reportId]: [
                        ...(state.commentsByReportId[comment.reportId] ?? []),
                        comment,
                    ],
                },
            })),

        setStatus: (reportId, status) =>
            set((state) => ({
                statusByReportId: {
                    ...state.statusByReportId,
                    [reportId]: status,
                },
            })),

        getStatus: (reportId) => get().statusByReportId[reportId] ?? "none",
    }),
);
