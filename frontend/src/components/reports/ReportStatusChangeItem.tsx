import { CheckCircle2, CircleDashed, TriangleAlert } from "lucide-react";

import { statusVariantClasses } from "@/components/ui/badge";
import type { ReportComment, ReportStatus } from "@/types/reportComments";

interface ReportStatusChangeItemProps {
    comment: ReportComment;
}

const STATUS_LABEL: Record<ReportStatus, string> = {
    none: "No status",
    unresolved: "Unresolved",
    resolved: "Resolved",
};

const STATUS_VARIANT: Record<ReportStatus, keyof typeof statusVariantClasses> =
    {
        none: "neutral",
        unresolved: "caution",
        resolved: "safe",
    };

const STATUS_ICON: Record<ReportStatus, React.ReactNode> = {
    none: <CircleDashed className="size-4 shrink-0" aria-hidden="true" />,
    unresolved: (
        <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
    ),
    resolved: <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />,
};

export function ReportStatusChangeItem({
    comment,
}: ReportStatusChangeItemProps) {
    const status = comment.statusChange ?? "none";

    return (
        <div
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${statusVariantClasses[STATUS_VARIANT[status]]}`}
        >
            {STATUS_ICON[status]}
            <span>
                {comment.authorUsername} marked this report as{" "}
                {STATUS_LABEL[status]}
            </span>
            <span className="ml-auto text-xs font-normal text-color-text-secondary">
                {new Date(comment.createdAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                })}
            </span>
        </div>
    );
}
