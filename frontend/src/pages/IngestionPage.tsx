import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import React, { useState } from "react";
import {
    FILE_SCHEMA,
    type ColDef,
    validateData,
} from "@/lib/ingestionSchema";
import { ingestionApi } from "@/services/ingestionApi";
import { UploadWizard } from "@/components/ingestion/UploadWizard";

const BATCH_SIZE = 500;

interface DataRowProps {
    rowIndex: number;
    cells: string[];
    schema: ColDef[];
    rowServerErrors?: ServerValidationError[];
    onCellChange: (
        rowIndex: number,
        cellIndex: number,
        newValue: string,
    ) => void;
}

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
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {FILE_SCHEMA.map((col) => (
                                    <TableHead key={col.name}>
                                        {col.name} ({col.type})
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {parsedRows.map((row, i) => {
                                const rowKey = `row_${i + 1}`;
                                const rowErrors = serverErrors
                                    ? serverErrors[rowKey]
                                    : undefined;

                                return (
                                    <DataRow
                                        key={rowKey}
                                        rowIndex={i}
                                        cells={row}
                                        schema={FILE_SCHEMA}
                                        rowServerErrors={rowErrors}
                                        onCellChange={handleCellChange}
                                    />
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            ) : (
                !isComplete && "No data loaded"
            )}
        </div>
    );
};

const DataRow: React.FC<DataRowProps> = ({
    rowIndex,
    cells,
    schema,
    rowServerErrors,
    onCellChange,
}) => {
    return (
        <TableRow>
            {schema.map((typeDef, i) => {
                //Mark missing data as empty
                const cellValue = cells[i] ?? "";

                //Mark something out of bounds invalid automatically
                const isTypeValid = typeDef
                    ? validateData(cellValue, typeDef.type)
                    : false;

                const isEmpty = cellValue === "";

                const matchingServerError = rowServerErrors?.find(
                    (err) => err.column === typeDef.name,
                );
                const hasServerError = !!matchingServerError;
                const isInvalid = !isTypeValid || isEmpty || hasServerError;

                const shouldHighlightBg = isEmpty || hasServerError;

                let titleMessage: string | undefined = undefined;
                if (isEmpty) {
                    titleMessage = `Field "${typeDef.name}" is missing/empty`;
                } else if (!isTypeValid) {
                    titleMessage = `Expected ${typeDef.type} but got "${cellValue}"`;
                } else if (matchingServerError) {
                    titleMessage = `Server Validation Failed: ${matchingServerError.message}`;
                }

                return (
                    <TableCell key={typeDef.name}>
                        <div>
                            <input
                                type="text"
                                value={cellValue}
                                className={
                                    matchingServerError ? "border-red-500" : ""
                                }
                                onChange={(e) =>
                                    onCellChange(rowIndex, i, e.target.value)
                                }
                                style={{
                                    backgroundColor: shouldHighlightBg
                                        ? "rgb(239, 30, 30, 0.15)"
                                        : "transparent",
                                    color: isInvalid ? "red" : "inherit",
                                    fontWeight: isInvalid ? "bold" : "normal",
                                    border: matchingServerError
                                        ? "1px solid red"
                                        : "none",
                                    outline: matchingServerError
                                        ? "none"
                                        : undefined,
                                }}
                                title={titleMessage}
                            />
                        </div>
                    </TableCell>
                );
            })}
        </TableRow>
    );
};

export default IngestionPage;
