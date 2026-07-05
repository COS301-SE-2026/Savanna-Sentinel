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
    data: string;
    schema: ColDef[];
}

const IngestionPage = () => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [fileContents, setFileContents] = useState<string | null>(null);
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
                const firstLine = text.split(/\r?\n/)[0];

                if (!firstLine) {
                    setErrorMessage(
                        "The uploaded file is empty, please ensure the first row of the file indicates column headings.",
                    );
                    setSelectedFile(null);
                    setFileContents(null);
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
                    setFileContents(null);
                    return resolve(false);
                }

                //no error
                setErrorMessage(null);
                setFileContents(text);
                resolve(true);
            };

            reader.onerror = () => {
                setErrorMessage(
                    "Error reading the file. Please contact support.",
                );
                setSelectedFile(null);
                setFileContents(null);
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
    return (
        <div>
            <h1>Example File Upload location</h1>
            {/* File type should always be .csv but adding it for dynamic reasons*/}
            <input type="file" accept=".csv" onChange={handleFileUpload} />
            {errorMessage && <p>{errorMessage}</p>}

            <h1>File contents</h1>
            {selectedFile && fileContents ? (
                <div>
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
                            {
                                //Skip first line of text
                                fileContents
                                    .split(/\r?\n/)
                                    .slice(1)
                                    .map((row, i) => {
                                        if (!row.trim()) {
                                            return null;
                                        }
                                        return (
                                            <DataRow
                                                key={i}
                                                data={row}
                                                schema={FILE_SCHEMA}
                                            />
                                        );
                                    })
                            }
                        </TableBody>
                    </Table>
                </div>
            ) : (
                "No data loaded"
            )}
        </div>
    );
};

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

const DataRow: React.FC<DataRowProps> = ({ data, schema }) => {
    const cells = data.split(",").map((cell: string) => cell.trim());
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
                    <TableCell
                        key={i}
                        style={{
                            color: !isTypeValid ? "red" : "inherit",
                            fontWeight: !isTypeValid ? "bold" : "normal",
                        }}
                        title={
                            !isTypeValid && typeDef
                                ? `Expected ${typeDef.type} but got "${cell}"`
                                : undefined
                        }
                    >
                        {cell}
                    </TableCell>
                );
            })}
        </TableRow>
    );
};

export default IngestionPage;
