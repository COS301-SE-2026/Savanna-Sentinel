import { useState } from "react";
import { CircleCheck } from "lucide-react";
import { FILE_SCHEMA, validateData } from "@/lib/ingestionSchema";
import { ingestionApi } from "@/services/ingestionApi";
import { UploadWizard } from "@/components/ingestion/UploadWizard";
import { DataPreview } from "@/components/ingestion/DataPreview";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { notifySafe, notifyCritical } from "@/components/ui/toast";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";

const REVIEW_PAGE_SIZE = 50;

interface ServerValidationError {
    column: string;
    error_type: string;
    message: string;
}
type ServerErrorsMap = Record<string, ServerValidationError[]>;

const mapRowToRecord = (row: string[]): Record<string, unknown> => {
    const record: Record<string, unknown> = {};

    FILE_SCHEMA.forEach((col, i) => {
        const value = row[i]?.trim() ?? "";
        if (value === "") {
            record[col.name] = null;
            return;
        }
        if (col.type === "number") {
            record[col.name] = Number(value);
        } else if (col.type === "boolean") {
            record[col.name] =
                value.toLowerCase() === "true" || value.toLowerCase() === "1";
        } else {
            record[col.name] = value;
        }
    });

    return record;
};

interface ServerErrorDetail {
    message?: string;
    errors?: ServerErrorsMap;
}
interface FastApiValidationError {
    type: string;
    loc: (string | number)[];
    msg: string;
}

const isFastApiValidationErrors = (
    detail: unknown,
): detail is FastApiValidationError[] =>
    Array.isArray(detail) &&
    detail.every(
        (item) =>
            item &&
            typeof item === "object" &&
            Array.isArray((item as { loc?: unknown }).loc) &&
            typeof (item as { msg?: unknown }).msg === "string",
    );

// loc looks like ["body", "records", <row index>, <column name>]
const mapFastApiErrorsToServerErrors = (
    errors: FastApiValidationError[],
): ServerErrorsMap => {
    const map: ServerErrorsMap = {};

    errors.forEach(({ loc, msg, type }) => {
        const rowIndex = loc.find((part) => typeof part === "number");
        const column = loc[loc.length - 1];
        if (typeof rowIndex !== "number" || typeof column !== "string") {
            return;
        }

        const rowKey = `row_${rowIndex + 1}`;
        map[rowKey] = [
            ...(map[rowKey] ?? []),
            { column, error_type: type, message: msg },
        ];
    });

    return map;
};

const parseServerError = (error: unknown): ServerErrorDetail | null => {
    if (!error || typeof error !== "object" || !("response" in error)) {
        return null;
    }

    const axiosError = error as {
        response?: { data?: { detail?: unknown } };
    };
    const detail = axiosError.response?.data?.detail;

    if (isFastApiValidationErrors(detail)) {
        return {
            message:
                "Some records in this file failed validation. Correct the highlighted cells and resubmit.",
            errors: mapFastApiErrorsToServerErrors(detail),
        };
    }

    if (detail && typeof detail === "object") {
        return detail as ServerErrorDetail;
    }

    return null;
};

const IngestionPage = () => {
    const [parsedRows, setParsedRows] = useState<string[][]>([]);
    const [page, setPage] = useState<number>(1);
    const [isComplete, setIsComplete] = useState<boolean>(false);
    const [serverErrors, setServerErrors] = useState<ServerErrorsMap | null>(
        null,
    );
    const [filename, setFilename] = useState<string | null>(null);
    const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
    const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const totalPages = Math.max(
        1,
        Math.ceil(parsedRows.length / REVIEW_PAGE_SIZE),
    );
    const currentPage = Math.min(page, totalPages);
    const startIndex = (currentPage - 1) * REVIEW_PAGE_SIZE;
    const pageRows = parsedRows.slice(
        startIndex,
        startIndex + REVIEW_PAGE_SIZE,
    );

    const handleFileAccepted = (lines: string[], name: string) => {
        // header already validated by UploadWizard
        const dataLines = lines.slice(1);
        setParsedRows(
            dataLines.map((line) => line.split(",").map((cell) => cell.trim())),
        );
        setFilename(name);
        setIsComplete(false);
        setServerErrors(null);
        setPage(1);
    };

    const handleReset = () => {
        setParsedRows([]);
        setFilename(null);
        setIsComplete(false);
        setServerErrors(null);
        setPage(1);
    };

    const confirmCancel = () => {
        setIsCancelConfirmOpen(false);
        handleReset();
    };

    const handleCellChange = (
        rowIndex: number,
        colIndex: number,
        newValue: string,
    ) => {
        setParsedRows((prevRows) => {
            const updatedRows = [...prevRows];
            updatedRows[rowIndex] = [...updatedRows[rowIndex]];
            updatedRows[rowIndex][colIndex] = newValue;
            return updatedRows;
        });

        if (serverErrors) {
            const rowKey = `row_${rowIndex + 1}`;
            if (serverErrors[rowKey]) {
                setServerErrors((prev) => {
                    if (!prev) {
                        return null;
                    }
                    const updated = { ...prev };
                    delete updated[rowKey];
                    return updated;
                });
            }
        }
    };

    //Revalidate data after edit
    const isDataValid = () => {
        return parsedRows.every((row) => {
            if (row.length !== FILE_SCHEMA.length) {
                return false;
            }
            return row.every((cell, i) =>
                validateData(
                    cell,
                    FILE_SCHEMA[i].type,
                    FILE_SCHEMA[i].optional,
                ),
            );
        });
    };
    const handleDataSubmission = async () => {
        const records = parsedRows.map(mapRowToRecord);

        try {
            await ingestionApi.uploadFile(records, 1, filename ?? undefined);

            setServerErrors(null);
            setIsComplete(true);
            setParsedRows([]);
            notifySafe("Upload complete", "The entire file has been ingested.");
        } catch (error: unknown) {
            console.error("File processing failed", error);

            let resolvedMessage =
                "A network issue occured while submitting this file";

            const detail = parseServerError(error);
            if (detail) {
                if (detail.message) {
                    resolvedMessage = detail.message;
                }
                if (detail.errors) {
                    setServerErrors(detail.errors);
                }
            }

            notifyCritical(resolvedMessage);
        }
    };

    const onSubmitClick = () => {
        if (!isDataValid()) {
            notifyCritical("Cannot submit", "This file has validation errors.");
            return;
        }
        setIsSubmitConfirmOpen(true);
    };

    const confirmSubmission = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            await handleDataSubmission();
        } finally {
            setIsSubmitting(false);
            setIsSubmitConfirmOpen(false);
        }
    };
    return (
        <div className="mx-auto max-w-[1120px] px-4 pt-8 pb-10 md:px-6">
            <h1 className="mb-6 font-heading text-3xl leading-[1.1] font-bold text-brand-primary">
                Data Ingestion
            </h1>
            {parsedRows.length === 0 && !isComplete && (
                <UploadWizard onFileAccepted={handleFileAccepted} />
            )}
            {isComplete && (
                <EmptyState
                    className="mb-4"
                    icon={CircleCheck}
                    title="Upload complete"
                    body="The entire file has been ingested."
                    action={
                        <Button onClick={handleReset}>
                            Upload another file
                        </Button>
                    }
                />
            )}

            {parsedRows.length > 0 ? (
                <div>
                    <div className="mb-2">
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setPage}
                        />
                    </div>
                    <div className="mb-4 flex items-center justify-between">
                        <Button onClick={onSubmitClick}>Submit</Button>
                        <Button
                            variant="outline"
                            onClick={() => setIsCancelConfirmOpen(true)}
                        >
                            Cancel
                        </Button>
                    </div>
                    <DataPreview
                        schema={FILE_SCHEMA}
                        rows={pageRows}
                        startIndex={startIndex}
                        serverErrors={serverErrors}
                        onCellChange={handleCellChange}
                    />
                </div>
            ) : (
                !isComplete && "No data loaded"
            )}

            <Dialog
                open={isCancelConfirmOpen}
                onOpenChange={setIsCancelConfirmOpen}
            >
                <DialogContent preventBackdropClose>
                    <DialogHeader>
                        <DialogTitle>Discard this upload?</DialogTitle>
                    </DialogHeader>
                    <DialogDescription>
                        All loaded rows and any edits you&apos;ve made will be
                        lost. This can&apos;t be undone.
                    </DialogDescription>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsCancelConfirmOpen(false)}
                        >
                            Keep editing
                        </Button>
                        <Button variant="destructive" onClick={confirmCancel}>
                            Discard
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={isSubmitConfirmOpen}
                onOpenChange={(open) => {
                    if (!open && !isSubmitting) setIsSubmitConfirmOpen(false);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm submission</DialogTitle>
                    </DialogHeader>
                    <DialogDescription>
                        You are about to submit this file for ingestion. Confirm
                        to continue.
                    </DialogDescription>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsSubmitConfirmOpen(false)}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="default"
                            onClick={confirmSubmission}
                            disabled={isSubmitting}
                        >
                            Confirm Submission
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default IngestionPage;
