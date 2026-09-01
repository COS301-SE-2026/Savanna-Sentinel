import * as React from "react";
import { ImageOff } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
    SEVERITY_OPTIONS,
    type DraftReport,
    type Severity,
} from "@/types/reports";
import { PhotoLightbox } from "@/components/reports/PhotoLightbox";
import { ReportCommentThread } from "@/components/reports/ReportCommentThread";
import type { ReportStatus } from "@/types/reportComments";

const severityBadgeVariant: Record<Severity, "caution" | "alert" | "critical"> =
    {
        low: "caution",
        medium: "alert",
        high: "critical",
    };

const severityLabel: Record<Severity, string> = Object.fromEntries(
    SEVERITY_OPTIONS.map((option) => [option.value, option.label]),
) as Record<Severity, string>;

interface DetailFieldProps {
    label: string;
    children: React.ReactNode;
}

function DetailField({ label, children }: DetailFieldProps) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-xs font-medium tracking-[0.4px] text-color-text-secondary uppercase">
                {label}
            </span>
            <span className="text-sm text-color-text-primary">{children}</span>
        </div>
    );
}

interface ReportDetailDialogProps {
    report: DraftReport | null;
    onOpenChange: (open: boolean) => void;
}

export function ReportDetailDialog({
    report,
    onOpenChange,
}: ReportDetailDialogProps) {
    const [zoomIndex, setZoomIndex] = React.useState<number | null>(null);

    const photos = report?.photos ?? [];

    const handleOpenChange = (open: boolean) => {
        if (!open) setZoomIndex(null);
        onOpenChange(open);
    };

    return (
        <>
            <Dialog open={report !== null} onOpenChange={handleOpenChange}>
                <DialogContent className="max-h-[85vh] max-w-[90%] overflow-y-auto sm:max-w-xl">
                    {report && (
                        <>
                            <DialogHeader>
                                <DialogTitle>
                                    {report.reportType === "incident"
                                        ? "Incident Report"
                                        : "Sighting Report"}
                                </DialogTitle>
                            </DialogHeader>

                            <div className="flex flex-col gap-5 px-6 py-5">
                                <DetailField label="Description">
                                    {report.description}
                                </DetailField>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    {report.reportType === "incident" ? (
                                        <>
                                            <DetailField label="Incident Type">
                                                {report.incidentType || "-"}
                                            </DetailField>
                                            <DetailField label="Severity">
                                                {report.severity ? (
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
                                                )}
                                            </DetailField>
                                        </>
                                    ) : (
                                        <>
                                            <DetailField label="Species">
                                                {report.species || "-"}
                                            </DetailField>
                                            <DetailField label="Count">
                                                {report.count ?? "-"}
                                            </DetailField>
                                        </>
                                    )}

                                    <DetailField label="Occurred At">
                                        {new Date(
                                            report.occurredAt,
                                        ).toLocaleString(undefined, {
                                            dateStyle: "medium",
                                            timeStyle: "short",
                                        })}
                                    </DetailField>
                                    <DetailField label="Location">
                                        {report.lat !== null &&
                                        report.lon !== null
                                            ? `${report.lat.toFixed(4)}, ${report.lon.toFixed(4)}`
                                            : "Not recorded"}
                                    </DetailField>
                                    <DetailField label="Submitted By">
                                        {report.submittedByUsername ??
                                            report.submittedBy}
                                    </DetailField>
                                    <DetailField label="Sync Status">
                                        {report.syncStatus === "synced" ? (
                                            <Badge variant="safe">Synced</Badge>
                                        ) : (
                                            <Badge variant="caution">
                                                {report.syncStatus === "offline"
                                                    ? "Offline"
                                                    : "Pending Sync"}
                                            </Badge>
                                        )}
                                    </DetailField>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <span className="text-xs font-medium tracking-[0.4px] text-color-text-secondary uppercase">
                                        Photos
                                    </span>
                                    {photos.length === 0 ? (
                                        <div className="flex items-center gap-2 text-sm text-color-text-secondary">
                                            <ImageOff
                                                className="size-4"
                                                aria-hidden="true"
                                            />
                                            No photos attached.
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {photos.map((photo, index) => (
                                                <button
                                                    key={photo.previewUrl}
                                                    type="button"
                                                    onClick={() =>
                                                        setZoomIndex(index)
                                                    }
                                                    className="size-24 overflow-hidden rounded-md border border-color-border transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                                                >
                                                    <img
                                                        src={photo.previewUrl}
                                                        alt={`Attached photo ${index + 1} of ${photos.length}`}
                                                        className="size-full object-cover"
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <ReportCommentThread
                                    reportId={report.localId}
                                    initialStatus={
                                        report.status as ReportStatus
                                    }
                                />
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <PhotoLightbox
                photos={photos.map((photo) => photo.previewUrl)}
                index={zoomIndex}
                onIndexChange={setZoomIndex}
                altPrefix="Attached photo"
            />
        </>
    );
}
