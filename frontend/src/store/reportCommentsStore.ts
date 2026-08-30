import { create } from "zustand";
import type { ReportComment, ReportStatus } from "@/types/reportComments";
import { api } from "@/services/api";
import { notifyCritical } from "@/components/ui/toast";

interface ReportCommentsState {
    commentsByReportId: Record<string, ReportComment[]>;
    statusByReportId: Record<string, ReportStatus>;
    isLoading: boolean;
    fetchComments: (reportId: string) => Promise<void>;
    addComment: (reportId: string, comment: {body: string, photoUrls: string[], createdAt: string, status: string}) => Promise<void>;
    setStatus: (reportId: string, status: ReportStatus) => void;
    getStatus: (reportId: string) => ReportStatus;
}

export const useReportCommentsStore = create<ReportCommentsState>()(
    (set, get) => ({
        commentsByReportId: {},
        statusByReportId: {},
        isLoading: false,

        fetchComments: async (reportId) => {
            set({isLoading: true});
            try{
                const res = await api.get<ReportComment[]>(`reports/${reportId}/comment`);

                set((state) => ({
                    commentsByReportId: {...state.commentsByReportId, [reportId]: res.data},
                }));
            }
            catch (error) {
                notifyCritical("Comment error", "Failed to retrieve comments");
                console.error(error);
            }
            finally{
                set({ isLoading: false})
            }
        },

        addComment: async (reportId: string, comment) => {
            const res = await api.post<ReportComment>(`reports/${reportId}/comment`, comment);

            set((state) => ({
                commentsByReportId: {
                    ...state.commentsByReportId,
                    [reportId]: [...(state.commentsByReportId[reportId] ?? []), res.data]
                },
            }));
        },

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
