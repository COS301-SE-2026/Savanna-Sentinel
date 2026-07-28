import * as React from "react";
import { ChevronLeft, ChevronRight, ImageOff, XIcon } from "lucide-react";

import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    SEVERITY_OPTIONS,
    type DraftReport,
    type Severity,
} from "@/types/reports";

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
                                        {report.submittedBy}
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
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog
                open={zoomIndex !== null}
                onOpenChange={(open) => !open && setZoomIndex(null)}
            >
                <DialogContent className="max-w-[95vw] border-0 bg-transparent p-0 shadow-none sm:max-w-3xl">
                    <DialogTitle className="sr-only">
                        Photo {zoomIndex !== null ? zoomIndex + 1 : ""}
                    </DialogTitle>
                    {zoomIndex !== null && photos[zoomIndex] && (
                        <div className="relative">
                            <img
                                src={photos[zoomIndex].previewUrl}
                                alt={`Attached photo ${zoomIndex + 1} of ${photos.length}, enlarged`}
                                className="max-h-[85vh] w-full rounded-lg object-contain"
                            />
                            <DialogClose asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-2 right-2 bg-black/50 text-color-text-inverse hover:bg-black/70 hover:text-color-text-inverse"
                                >
                                    <XIcon
                                        className="size-5"
                                        aria-hidden="true"
                                    />
                                    <span className="sr-only">
                                        Close photo preview
                                    </span>
                                </Button>
                            </DialogClose>
                            {photos.length > 1 && (
                                <>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() =>
                                            setZoomIndex(
                                                (zoomIndex -
                                                    1 +
                                                    photos.length) %
                                                    photos.length,
                                            )
                                        }
                                        className="absolute top-1/2 left-2 -translate-y-1/2 bg-black/50 text-color-text-inverse hover:bg-black/70 hover:text-color-text-inverse"
                                    >
                                        <ChevronLeft
                                            className="size-5"
                                            aria-hidden="true"
                                        />
                                        <span className="sr-only">
                                            Previous photo
                                        </span>
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() =>
                                            setZoomIndex(
                                                (zoomIndex + 1) % photos.length,
                                            )
                                        }
                                        className="absolute top-1/2 right-2 -translate-y-1/2 bg-black/50 text-color-text-inverse hover:bg-black/70 hover:text-color-text-inverse"
                                    >
                                        <ChevronRight
                                            className="size-5"
                                            aria-hidden="true"
                                        />
                                        <span className="sr-only">
                                            Next photo
                                        </span>
                                    </Button>
                                </>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
