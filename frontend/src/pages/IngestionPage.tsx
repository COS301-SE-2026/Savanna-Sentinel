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

type Expectation = "string" | "number" | "boolean" | "date";

interface ColDef {
    name: string;
    type: Expectation;
}

const FILE_SCHEMA: ColDef[] = [
    { name: "record_id", type: "number" },
    { name: "ingestion_timestamp", type: "date" },
    { name: "source_system", type: "string" },
    { name: "data_domain", type: "string" },
    { name: "event_type", type: "string" },
    { name: "payload_size_kb", type: "number" },
    { name: "priority_level", type: "string" },
    { name: "retry_count", type: "number" },
    { name: "is_encrypted", type: "boolean" },
    { name: "status", type: "string" },
];

interface DataRowProps {
    rowIndex: number;
    cells: string[];
    schema: ColDef[];
    onCellChange: (
        rowIndex: number,
        cellIndex: number,
        newValue: string,
    ) => void;
}

const validateData = (value: string, expected: Expectation): boolean => {
    if (!value) {
        return false;
    }

    switch (expected) {
        case "number":
            return !isNaN(Number(value));
        case "boolean":
            return (
                value.toLowerCase() === "true" ||
                value.toLowerCase() === "false" ||
                value.toLowerCase() === "1" ||
                value.toLowerCase() === "0"
            );
        case "date":
            return !isNaN(Date.parse(value));
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

    const validateSchema = (file: File): Promise<boolean> => {
        return new Promise((resolve) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                const text = e.target?.result;
                if (typeof text !== "string") {
                    return resolve(false);
                }

                //Use regex to get the first line of text
                const lines = text.split(/\r?\n/);
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

                //no error
                const data = lines
                    .slice(1)
                    .filter((line) => line.trim() !== "")
                    .map((line) => line.split(",").map((cell) => cell.trim()));
                setErrorMessage(null);
                setParsedRows(data);
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

        if (files.length > 1) {
            setErrorMessage("Please only upload 1 file");
            event.target.value = "";
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
    const handleDataSubmission = () => {
        if (!isDataValid()) {
            alert("Cannot submit, validation errors exist");
        }

        const body = parsedRows.map((row) => {
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

        //Publish code here
        console.log(body);
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

            <h1>File contents</h1>
            {selectedFile && parsedRows.length > 0 ? (
                <div>
                    <button onClick={handleDataSubmission}>
                        Submit (Non functional)
                    </button>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {FILE_SCHEMA.map((col, i) => (
                                    <TableHead key={i}>
                                        {col.name} ({col.type})
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {parsedRows.map((row, i) => (
                                <DataRow
                                    key={i}
                                    rowIndex={i}
                                    cells={row}
                                    schema={FILE_SCHEMA}
                                    onCellChange={handleCellChange}
                                />
                            ))}
                        </TableBody>
                    </Table>
                </div>
            ) : (
                "No data loaded"
            )}
        </div>
    );
};

const DataRow: React.FC<DataRowProps> = ({
    rowIndex,
    cells,
    schema,
    onCellChange,
}) => {
    //Determine if a row is malformed
    const isRowMalformed = cells.length !== schema.length;

    return (
        <TableRow
            style={{ backgroundColor: isRowMalformed ? "red" : "transparent" }}
        >
            {cells.map((cell: string, i: number) => {
                const typeDef = schema[i];

                //Mark something out of bounds invalid automatically
                const isTypeValid = typeDef
                    ? validateData(cell, typeDef.type)
                    : false;
                return (
                    <TableCell key={i}>
                        <div>
                            <input
                                type="text"
                                value={cell}
                                onChange={(e) =>
                                    onCellChange(rowIndex, i, e.target.value)
                                }
                                style={{
                                    color: !isTypeValid ? "red" : "inherit",
                                    fontWeight: !isTypeValid
                                        ? "bold"
                                        : "normal",
                                }}
                                title={
                                    !isTypeValid && typeDef
                                        ? `Expected ${typeDef.type} but got "${cell}"`
                                        : undefined
                                }
                            />
                        </div>
                    </TableCell>
                );
            })}
        </TableRow>
    );
};

export default IngestionPage;
