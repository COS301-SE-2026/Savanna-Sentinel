import { useState, type DragEvent } from "react";
import { CircleX, UploadCloud } from "lucide-react";

import { cn } from "@/lib/utils";

export interface FileUploadDropzoneProps {
    inputId: string;
    accept: string;
    multiple?: boolean;
    title: string;
    hint: string;
    state?: "idle" | "error";
    onFilesSelected: (files: FileList | null) => void;
}

export function FileUploadDropzone({
    inputId,
    accept,
    multiple = false,
    title,
    hint,
    state = "idle",
    onFilesSelected,
}: FileUploadDropzoneProps) {
    const isError = state === "error";
    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        event.stopPropagation();
    };

    const handleDragEnter = (event: DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (event: DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        setIsDragging(false);
    };

    const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
        onFilesSelected(event.dataTransfer.files);
    };

    return (
        <label
            htmlFor={inputId}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
                "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-[1.5px] px-6 py-8 text-center",
                "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-brand-primary has-[input:focus-visible]:[--tw-outline-style:solid]",
                isError
                    ? "border-solid border-status-critical bg-status-critical/[0.06]"
                    : isDragging
                      ? "border-solid border-brand-primary bg-brand-primary/[0.06]"
                      : "border-dashed border-color-input-border bg-color-surface-raised",
            )}
        >
            <input
                id={inputId}
                type="file"
                accept={accept}
                multiple={multiple}
                className="sr-only"
                onChange={(event) => onFilesSelected(event.target.files)}
            />
            <div className="flex size-12 items-center justify-center rounded-md bg-color-surface-bg">
                {isError ? (
                    <CircleX
                        className="size-6 text-status-critical"
                        aria-hidden="true"
                    />
                ) : (
                    <UploadCloud
                        className="size-6 text-brand-muted"
                        aria-hidden="true"
                    />
                )}
            </div>
            <span className="text-sm font-semibold text-color-text-primary">
                {title}
            </span>
            <span
                className={cn(
                    "text-xs",
                    isError
                        ? "text-status-critical-text"
                        : "text-color-text-primary",
                )}
            >
                {hint}
            </span>
        </label>
    );
}
