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
        const value = row[i];
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
                "Some records in this batch failed validation. Correct the highlighted cells and resubmit.",
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
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [page, setPage] = useState<number>(1);
    const [isComplete, setIsComplete] = useState<boolean>(false);
    const [serverErrors, setServerErrors] = useState<ServerErrorsMap | null>(
        null,
    );

    const totalPages = Math.max(1, Math.ceil(parsedRows.length / REVIEW_PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const startIndex = (currentPage - 1) * REVIEW_PAGE_SIZE;
    const pageRows = parsedRows.slice(startIndex, startIndex + REVIEW_PAGE_SIZE);

    const handleFileAccepted = (lines: string[]) => {
        const dataLines = lines.slice(1); // header already validated by UploadWizard
        setParsedRows(
            dataLines.map((line) => line.split(",").map((cell) => cell.trim())),
        );
        setIsComplete(false);
        setServerErrors(null);
        setPage(1);
    };

    const handleReset = () => {
        setParsedRows([]);
        setErrorMessage(null);
        setIsComplete(false);
        setServerErrors(null);
        setPage(1);
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
                validateData(cell, FILE_SCHEMA[i].type),
            );
        });
    };
    const handleDataSubmission = async () => {
        if (!isDataValid()) {
            notifyCritical(
                "Cannot submit",
                "This batch has validation errors.",
            );
            return;
        }

        const records = parsedRows.map(mapRowToRecord);

        try {
            await ingestionApi.uploadFile(records, 1);

            setErrorMessage(null);
            setServerErrors(null);
            setIsComplete(true);
            setParsedRows([]);
            notifySafe(
                "Upload complete",
                "The entire file has been ingested.",
            );
        } catch (error: unknown) {
            console.error("Batch processing failed", error);

            let errorMessage =
                "A network issue occured while submitting this batch";

            const detail = parseServerError(error);
            if (detail) {
                if (detail.message) {
                    errorMessage = detail.message;
                }
                if (detail.errors) {
                    setServerErrors(detail.errors);
                }
            }

            setErrorMessage(errorMessage);
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
            {errorMessage && <p style={{ color: "red" }}>{errorMessage}</p>}
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
                    <div className="mb-4">
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setPage}
                        />
                    </div>
                    <div className="mb-4 flex gap-2">
                        <Button variant="outline" onClick={handleReset}>
                            Cancel
                        </Button>
                        <Button onClick={handleDataSubmission}>
                            Submit Current Batch
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
        </div>
    );
};

export default IngestionPage;
