import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import React, { useState } from "react";
import { type ChangeEvent } from "react";
import {
    FILE_SCHEMA,
    type Expectation,
    type ColDef,
} from "@/lib/ingestionSchema";
import { ingestionApi } from "@/services/ingestionApi";

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

const validateData = (value: string, expected: Expectation): boolean => {
    if (!value) {
        return false;
    }

    switch (expected) {
        case "number":
            return !Number.isNaN(Number(value));
        case "boolean":
            return (
                value.toLowerCase() === "true" ||
                value.toLowerCase() === "false" ||
                value.toLowerCase() === "1" ||
                value.toLowerCase() === "0"
            );
        case "date":
            return !Number.isNaN(Date.parse(value));
        //Add more data types as needed here
        case "string":
        default:
            return true;
    }
};

const IngestionPage = () => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
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

    const validateSchema = (file: File): Promise<boolean> => {
        return new Promise((resolve) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                const text = e.target?.result;
                if (typeof text !== "string") {
                    return resolve(false);
                }

                //Use regex to get the first line of text
                const lines = text
                    .split(/\r?\n/)
                    .filter((line) => line.trim() !== "");
                const firstLine = lines[0];

                if (!firstLine) {
                    setErrorMessage(
                        "The uploaded file is empty, please ensure the first row of the file indicates column headings.",
                    );
                    setSelectedFile(null);
                    setParsedRows([]);
                    return resolve(false);
                }

                //Check first row matches
                //trim is to trim the <CR><LF> character at the end of the row
                const headers = firstLine
                    .split(",")
                    .map((header) => header.trim());
                if (
                    headers.length !== FILE_SCHEMA.length ||
                    !FILE_SCHEMA.every((col, i) => headers[i] === col.name)
                ) {
                    setErrorMessage(
                        "Invalid first row, please ensure that the first row matches the expected schema.",
                    );
                    setSelectedFile(null);
                    setParsedRows([]);
                    return resolve(false);
                }
                setAllLines(lines);
                loadBatch(lines, 1);

                resolve(true);
            };

            reader.onerror = () => {
                setErrorMessage(
                    "Error reading the file. Please contact support.",
                );
                setSelectedFile(null);
                setParsedRows([]);
                resolve(false);
            };

            reader.readAsText(file);
        });
    };

    const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        //Use only the first selected file
        if (!files || files.length === 0) {
            return;
        }

        const file = files[0];

        if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
            setErrorMessage("The program only accepts .csv files.");
            event.target.value = "";
            return;
        }

        //Clear error messages
        setErrorMessage(null);
        setServerErrors(null);
        setIsComplete(false);
        const isValid = await validateSchema(file);
        if (!isValid) {
            event.target.value = "";
            return;
        }

        setSelectedFile(file);
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

        const records = parsedRows.map((row) => {
            //unknown currently used for dynamic reasons, switch to interface once interface is decided
            const record: Record<string, unknown> = {};
            FILE_SCHEMA.forEach((col, i) => {
                const value = row[i];
                //Convert to JSON correctly
                if (col.type === "number") {
                    record[col.name] = Number(value);
                } else if (col.type === "boolean") {
                    record[col.name] =
                        value.toLowerCase() === "true" ||
                        value.toLowerCase() === "1";
                } else {
                    record[col.name] = value;
                }
            });
            return record;
        });

        try {
            await ingestionApi.uploadFile(records, currentLineNumber);

            setErrorMessage(null);
            setServerErrors(null);

            //Advance to the next batch
            const nextLine = currentLineNumber + parsedRows.length;
            if (nextLine >= allLines.length) {
                setIsComplete(true);
                setParsedRows([]);
                setSelectedFile(null);
                alert("Success! The entire file has been uploaded");
            } else {
                loadBatch(allLines, nextLine);
            }
        } catch (error: unknown) {
            console.error("Batch processing failed", error);

            let errorMessage =
                "A network issue occured while submitting this batch";

            if (error && typeof error === "object" && "response" in error) {
                const axiosError = error as {
                    response?: {
                        data?: {
                            detail?: {
                                message?: string;
                                errors?: ServerErrorsMap;
                            };
                        };
                    };
                };

                const detail = axiosError.response?.data?.detail;
                if (detail) {
                    if (detail.message) {
                        errorMessage = detail.message;
                    }
                    if (detail.errors) {
                        setServerErrors(detail.errors);
                    }
                }
            }
            setErrorMessage(errorMessage);
        }
    };
    return (
        <div>
            <h1>Example File Upload location</h1>
            {/* File type should always be .csv but adding it for dynamic reasons*/}
            <input
                type="file"
                accept=".csv"
                aria-label="CSV file upload"
                onChange={handleFileUpload}
            />
            {errorMessage && <p style={{ color: "red" }}>{errorMessage}</p>}
            {isComplete && (
                <p style={{ color: "green" }}>
                    File batching sequence completed
                </p>
            )}

            <h1>File contents</h1>
            {selectedFile && parsedRows.length > 0 ? (
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
                                        key={i}
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
                    <TableCell key={i}>
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
