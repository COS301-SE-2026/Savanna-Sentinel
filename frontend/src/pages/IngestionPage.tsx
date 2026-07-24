import { useState } from "react";
import { FILE_SCHEMA, validateData } from "@/lib/ingestionSchema";
import { ingestionApi } from "@/services/ingestionApi";
import { UploadWizard } from "@/components/ingestion/UploadWizard";
import { DataPreview } from "@/components/ingestion/DataPreview";

const BATCH_SIZE = 500;

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

const parseServerError = (error: unknown): ServerErrorDetail | null => {
    if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as {
            response?: {
                data?: {
                    detail?: ServerErrorDetail;
                };
            };
        };
        return axiosError.response?.data?.detail ?? null;
    }
    return null;
};

const IngestionPage = () => {
    const [parsedRows, setParsedRows] = useState<string[][]>([]);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [currentLineNumber, setCurrentLineNumber] = useState<number>(1);
    const [allLines, setAllLines] = useState<string[]>([]);
    const [isComplete, setIsComplete] = useState<boolean>(false);
    const [serverErrors, setServerErrors] = useState<ServerErrorsMap | null>(
        null,
    );

    const loadBatch = (lines: string[], startLine: number) => {
        const endLine = Math.min(startLine + BATCH_SIZE, lines.length);
        const batchSlice = lines.slice(startLine, endLine);

        const parsedBatch = batchSlice.map((line) =>
            line.split(",").map((cell) => cell.trim()),
        );

        setParsedRows(parsedBatch);
        setCurrentLineNumber(startLine);
        setServerErrors(null);
    };

    const handleFileAccepted = (lines: string[]) => {
        setAllLines(lines);
        setIsComplete(false);
        loadBatch(lines, 1);
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
            alert("Cannot submit, validation errors exist in this batch");
            return;
        }

        const records = parsedRows.map(mapRowToRecord);

        try {
            await ingestionApi.uploadFile(records, currentLineNumber);

            setErrorMessage(null);
            setServerErrors(null);

            //Advance to the next batch
            const nextLine = currentLineNumber + parsedRows.length;
            if (nextLine >= allLines.length) {
                setIsComplete(true);
                setParsedRows([]);
                alert("Success! The entire file has been uploaded");
            } else {
                loadBatch(allLines, nextLine);
            }
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
            {allLines.length === 0 && (
                <UploadWizard onFileAccepted={handleFileAccepted} />
            )}
            {errorMessage && <p style={{ color: "red" }}>{errorMessage}</p>}
            {isComplete && (
                <p style={{ color: "green" }}>
                    File batching sequence completed
                </p>
            )}

            <h1>File contents</h1>
            {allLines.length > 0 && parsedRows.length > 0 ? (
                <div>
                    <h3>
                        Displaying rows {currentLineNumber} to{" "}
                        {Math.min(
                            currentLineNumber + parsedRows.length - 1,
                            allLines.length - 1,
                        )}
                    </h3>
                    <button onClick={handleDataSubmission}>
                        Submit Current Batch
                    </button>
                    {parsedRows.length > 0 && (
                        <DataPreview
                            schema={FILE_SCHEMA}
                            rows={parsedRows}
                            serverErrors={serverErrors}
                            onCellChange={handleCellChange}
                        />
                    )}
                </div>
            ) : (
                !isComplete && "No data loaded"
            )}
        </div>
    );
};

export default IngestionPage;
