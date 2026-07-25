import { useState } from "react";
import { FileUploadDropzone } from "@/components/ui/file-upload-dropzone";
import { FILE_SCHEMA } from "@/lib/ingestionSchema";

interface UploadWizardProps {
    onFileAccepted: (lines: string[]) => void;
}

export function UploadWizard({ onFileAccepted }: UploadWizardProps) {
    const [error, setError] = useState<string | null>(null);

    const handleFilesSelected = async (files: FileList | null) => {
        const file = files?.[0];
        if (!file) return;

        if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
            setError("Only .csv files are accepted.");
            return;
        }

        try {
            const text = await file.text();
            const lines = text
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter((line) => line !== "");

            const firstLine = lines[0];
            if (!firstLine) {
                setError(
                    "The uploaded file is empty. The first row must be column headings.",
                );
                return;
            }

            const headers = firstLine.split(",").map((h) => h.trim());
            const isSchemaMatch =
                headers.length === FILE_SCHEMA.length &&
                FILE_SCHEMA.every((col, i) => headers[i] === col.name);

            if (!isSchemaMatch) {
                setError(
                    "The first row doesn't match the expected column schema.",
                );
                return;
            }

            setError(null);
            onFileAccepted(lines);
        } catch {
            setError("Couldn't read that file. Please try again.");
        }
    };

    return (
        <FileUploadDropzone
            inputId="ingestion-file-upload"
            accept=".csv"
            title={error ?? "Drop CSV here or click to browse"}
            hint={
                error
                    ? `Expected columns: ${FILE_SCHEMA.map((c) => c.name).join(", ")}`
                    : "Accepts .csv only, header row must match the expected schema"
            }
            state={error ? "error" : "idle"}
            onFilesSelected={handleFilesSelected}
        />
    );
}
