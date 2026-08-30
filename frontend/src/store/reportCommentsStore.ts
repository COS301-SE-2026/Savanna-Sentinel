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

export interface ReportCommentResponse {
    id: string;
    report_id?: string;
    reportId?: string;
    author_id?: string;
    authorId?: string;
    author_username?: string;
    authorUsername?: string;
    author_role?: string;
    authorRole?: string;
    body: string;
    photo_urls?: string[];
    photoUrls?: string[];
    status_change?: string;
    statusChange?: string;
    created_at?: string;
    createdAt?: string;
}

function mapCommentResponse(data: ReportCommentResponse): ReportComment {
    return {
        id: data.id,
        reportId: data.report_id ?? data.reportId ?? "",
        authorId: data.author_id ?? data.authorId ?? "",
        authorUsername: data.author_username ?? data.authorUsername ?? "Unknown",
        authorRole: data.author_role ?? data.authorRole ?? "ranger",
        body: data.body,
        photoUrls: data.photo_urls ?? data.photoUrls ?? [],
        statusChange: (data.status_change ?? data.statusChange ?? "none") as ReportComment["statusChange"],
        createdAt: data.created_at ?? data.createdAt ?? new Date().toISOString(),
    };
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
            const newComment = mapCommentResponse(res.data)

            set((state) => ({
                commentsByReportId: {
                    ...state.commentsByReportId,
                    [reportId]: [...(state.commentsByReportId[reportId] ?? []), newComment]
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
