import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileUploadDropzone } from "@/components/ui/file-upload-dropzone";

describe("FileUploadDropzone", () => {
    it("renders the idle title and hint", () => {
        render(
            <FileUploadDropzone
                inputId="photos"
                accept="image/*"
                multiple
                title="Add photos"
                hint="JPG or PNG, up to 5 photos, 10MB each"
                onFilesSelected={vi.fn()}
            />,
        );
        expect(screen.getByText("Add photos")).toBeInTheDocument();
        expect(
            screen.getByText("JPG or PNG, up to 5 photos, 10MB each"),
        ).toBeInTheDocument();
    });

    it("applies error styling to the dropzone label when state is error", () => {
        const { container } = render(
            <FileUploadDropzone
                inputId="photos"
                accept="image/*"
                title="Upload failed"
                hint="Not an image file."
                state="error"
                onFilesSelected={vi.fn()}
            />,
        );
        expect(container.querySelector("label")).toHaveClass(
            "border-status-critical",
        );
    });

    it("calls onFilesSelected when a file is chosen", async () => {
        const onFilesSelected = vi.fn();
        const { container } = render(
            <FileUploadDropzone
                inputId="photos"
                accept="image/*"
                multiple
                title="Add photos"
                hint="JPG or PNG, up to 5 photos, 10MB each"
                onFilesSelected={onFilesSelected}
            />,
        );
        const file = new File(["x"], "snare.jpg", { type: "image/jpeg" });
        const fileInput = container.querySelector(
            "input[type='file']",
        ) as HTMLInputElement;
        await userEvent.upload(fileInput, file);
        expect(onFilesSelected).toHaveBeenCalledTimes(1);
    });
});
