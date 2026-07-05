import React, { useState } from "react";
import { type ChangeEvent } from "react";

const IngestionPage = () => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        //Temporary log for debugging and testing purposes
        console.log(file);
    };
    return (
        <div>
            <h1>Example File Upload location</h1>
            {/* File type should always be .csv but adding it for dynamic reasons*/}
            <input type="file" accept=".csv" onChange={handleFileUpload} />
            <p>
                File Name:{" "}
                {selectedFile ? selectedFile.name : "No file selected"}
            </p>
            {errorMessage && <p>{errorMessage}</p>}
        </div>
    );
};

export default IngestionPage;
