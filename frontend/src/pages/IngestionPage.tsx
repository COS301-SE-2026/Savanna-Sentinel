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

const FILE_SCHEMA = [
    "record_id",
    "ingestion_timestamp",
    "source_system",
    "data_domain",
    "event_type",
    "payload_size_kb",
    "priority_level",
    "retry_count",
    "is_encrypted",
    "status",
];

interface DataRowProps {
    data: string;
    index: number;
    length: number;
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
                    !FILE_SCHEMA.every((col, i) => headers[i] === col)
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
                                    <TableHead key={i}>{col}</TableHead>
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
                                                index={i}
                                                length={FILE_SCHEMA.length}
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

const DataRow: React.FC<DataRowProps> = ({ data, index, length }) => {
    const cells = data.split(",").map((cell: string) => cell.trim());
    //Determine if a row is malformed
    const isMalformed = cells.length !== length;

    return (
        <TableRow
            key={index}
            style={{ backgroundColor: isMalformed ? "red" : "transparent" }}
        >
            {cells.map((cell: string, i: number) => {
                return <TableCell key={i}>{cell}</TableCell>;
            })}
        </TableRow>
    );
};

export default IngestionPage;
