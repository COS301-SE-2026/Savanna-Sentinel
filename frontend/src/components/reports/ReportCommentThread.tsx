import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PhotoPicker } from "@/components/reports/PhotoPicker";
import { ReportCommentItem } from "@/components/reports/ReportCommentItem";
import { ReportStatusChangeItem } from "@/components/reports/ReportStatusChangeItem";
import { useAuthStore } from "@/store/authStore";
import { useReportCommentsStore } from "@/store/reportCommentsStore";
import type { ReportComment, ReportStatus } from "@/types/reportComments";
import type { PhotoAttachment } from "@/types/reports";
import { resolvePhotoUrls } from "@/lib/media";
import { notifyCritical } from "../ui/toast";

interface ReportCommentThreadProps {
    reportId: string;
}

// Must not be mutated, shared fallback reference returned by the selector below.
const EMPTY_COMMENTS: readonly ReportComment[] = [];

const STATUS_BADGE: Record<
    ReportStatus,
    { variant: "neutral" | "safe" | "caution"; label: string }
> = {
    none: { variant: "neutral", label: "No status" },
    unresolved: { variant: "caution", label: "Unresolved" },
    resolved: { variant: "safe", label: "Resolved" },
};

const STATUS_OPTIONS: { value: ReportStatus; label: string }[] = [
    { value: "none", label: "No status" },
    { value: "unresolved", label: "Unresolved" },
    { value: "resolved", label: "Resolved" },
];

export function ReportCommentThread({ reportId }: ReportCommentThreadProps) {
    const user = useAuthStore((s) => s.user);
    const canParticipate = user?.role === "ranger" || user?.role === "admin";

    const comments = useReportCommentsStore(
        (s) => s.commentsByReportId[reportId] ?? EMPTY_COMMENTS,
    );
    const status = useReportCommentsStore(
        (s) => s.statusByReportId[reportId] ?? "none",
    );
    const addComment = useReportCommentsStore((s) => s.addComment);
    const setStatus = useReportCommentsStore((s) => s.setStatus);

    const [body, setBody] = React.useState("");
    const [photos, setPhotos] = React.useState<PhotoAttachment[]>([]);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [pendingStatus, setPendingStatus] =
        React.useState<ReportStatus | null>(null);

    const handlePost = async () => {
        if (!user || (body.trim() === "" && photos.length === 0)) return;

        setIsSubmitting(true);
        try{
            const photoUrls = await resolvePhotoUrls(photos);

            await addComment(reportId, {
                body: body.trim(),
                photoUrls: photoUrls,
                createdAt: new Date().toISOString(),
                status: "None"
            })

            setBody("")
            setPhotos([])
        }
        catch (err) {
            notifyCritical("Comment error", "Failed to post comment");
            console.error(err);
        }
        finally {
            setIsSubmitting(false)
        }
    };

    const handleConfirmStatusChange = () => {
        if (!user || pendingStatus === null) return;

        setStatus(reportId, pendingStatus);
        addComment(reportId, {
            body: "",
            photoUrls: [],
            createdAt: new Date().toISOString(),
            status: pendingStatus,
        });
        setPendingStatus(null);
    };

    const pendingLabel = STATUS_BADGE[pendingStatus ?? status].label;

    return (
        <>
            <div className="flex flex-col gap-4 border-t border-color-border pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium tracking-[0.4px] text-color-text-secondary uppercase">
                        Discussion
                    </span>
                    <div className="flex items-center gap-2">
                        <Badge variant={STATUS_BADGE[status].variant}>
                            {STATUS_BADGE[status].label}
                        </Badge>
                        {canParticipate && (
                            <Select
                                aria-label="Report status"
                                value={status}
                                onChange={(e) =>
                                    setPendingStatus(
                                        e.target.value as ReportStatus,
                                    )
                                }
                            >
                                {STATUS_OPTIONS.map((option) => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </option>
                                ))}
                            </Select>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    {comments.length === 0 ? (
                        <p className="text-sm text-color-text-secondary">
                            No comments yet.
                        </p>
                    ) : (
                        comments.map((comment) =>
                            comment.statusChange !== undefined ? (
                                <ReportStatusChangeItem
                                    key={comment.id}
                                    comment={comment}
                                />
                            ) : (
                                <ReportCommentItem
                                    key={comment.id}
                                    comment={comment}
                                />
                            ),
                        )
                    )}
                </div>

                {canParticipate && (
                    <div className="flex flex-col gap-3">
                        <Textarea
                            aria-label="Comment"
                            placeholder="Add a comment..."
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            disabled={isSubmitting}
                        />
                        <PhotoPicker photos={photos} onChange={setPhotos} />
                        <Button
                            type="button"
                            onClick={handlePost}
                            disabled={isSubmitting || (body.trim() === "" && photos.length === 0)}
                            className="self-start"
                        >
                            {isSubmitting ? "Uploading..." : "Post comment"}
                        </Button>
                    </div>
                )}
            </div>

            <Dialog
                open={pendingStatus !== null}
                onOpenChange={(open) => !open && setPendingStatus(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Change report status?</DialogTitle>
                    </DialogHeader>
                    <DialogDescription>
                        Mark this report as {pendingLabel}? Everyone on this
                        report will see that you made this change.
                    </DialogDescription>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setPendingStatus(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleConfirmStatusChange}
                        >
                            Confirm
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
