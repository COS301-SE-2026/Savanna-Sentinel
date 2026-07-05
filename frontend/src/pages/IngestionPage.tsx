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

const IngestionPage = () => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const validateSchema = (file: File) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const text = e.target?.result;
            if (typeof text === "string") {
                //Temporary since want to parse things
                return;
            }
        };

        reader.onerror = () => {
            setErrorMessage("Error reading the file. Please contact support.");
            setSelectedFile(null);
        };

        reader.readAsText(file);
    };

    const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
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
        setSelectedFile(file);
        validateSchema(file);
    };
    return (
        <div>
            <h1>Example File Upload location</h1>
            {/* File type should always be .csv but adding it for dynamic reasons*/}
            <input type="file" accept=".csv" onChange={handleFileUpload} />
            {errorMessage && <p>{errorMessage}</p>}
        </div>
    );
};

export default IngestionPage;
