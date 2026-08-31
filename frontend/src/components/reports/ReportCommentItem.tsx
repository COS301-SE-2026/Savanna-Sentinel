import * as React from "react";

import { PhotoLightbox } from "@/components/reports/PhotoLightbox";
import type { ReportComment } from "@/types/reportComments";

interface ReportCommentItemProps {
    comment: ReportComment;
}

const AVATAR_COLORS = [
    "bg-brand-primary",
    "bg-brand-mid",
    "bg-brand-teal",
    "bg-brand-muted",
];

function avatarColorFor(username?: string): string {
    const safeUsername = username ?? "";
    let hash = 0;
    for (let i = 0; i < safeUsername.length; i++) {
        hash = (hash + safeUsername.charCodeAt(i)) % AVATAR_COLORS.length;
    }
    return AVATAR_COLORS[hash] ?? AVATAR_COLORS[0];
}

function initialsFor(username?: string): string {
    if (!username){
        return "??";
    } 
    return username.slice(0, 2).toUpperCase();
}

export function ReportCommentItem({ comment }: ReportCommentItemProps) {
    const [zoomIndex, setZoomIndex] = React.useState<number | null>(null);

    return (
        <>
            <div className="flex gap-3">
                <div
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-color-text-inverse ${avatarColorFor(comment.authorUsername)}`}
                    aria-hidden="true"
                >
                    {initialsFor(comment.authorUsername)}
                </div>
                <div className="flex flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-sm font-semibold text-color-text-primary">
                            {comment.authorUsername}
                        </span>
                        <span className="text-xs text-color-text-secondary capitalize">
                            {comment.authorRole}
                        </span>
                        <span className="text-xs text-color-text-secondary">
                            {new Date(comment.createdAt).toLocaleString(
                                undefined,
                                {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                },
                            )}
                        </span>
                    </div>
                    <p className="text-sm text-color-text-primary whitespace-pre-wrap">
                        {comment.body}
                    </p>
                    {comment.photoUrls.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-2">
                            {comment.photoUrls.map((url, index) => (
                                <button
                                    key={url}
                                    type="button"
                                    onClick={() => setZoomIndex(index)}
                                    className="size-16 shrink-0 overflow-hidden rounded-md border border-color-border transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                                >
                                    <img
                                        src={url}
                                        alt={`Comment attachment ${index + 1} of ${comment.photoUrls.length}`}
                                        className="size-full object-cover"
                                    />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <PhotoLightbox
                photos={comment.photoUrls}
                index={zoomIndex}
                onIndexChange={setZoomIndex}
                altPrefix="Comment attachment"
            />
        </>
    );
}
