import * as React from "react";
import { X } from "lucide-react";

import { FileUploadDropzone } from "@/components/ui/file-upload-dropzone";
import type { PhotoAttachment } from "@/types/reports";

const MAX_PHOTOS = 5;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

interface PhotoPickerProps {
    photos: PhotoAttachment[];
    onChange: (photos: PhotoAttachment[]) => void;
}

export function PhotoPicker({ photos, onChange }: PhotoPickerProps) {
    const [error, setError] = React.useState<string | null>(null);
    const inputId = React.useId();

    const handleFiles = (fileList: FileList | null) => {
        if (!fileList || fileList.length === 0) return;
        const files = Array.from(fileList);

        for (const file of files) {
            if (!file.type.startsWith("image/")) {
                setError(`"${file.name}" isn't an image file.`);
                return;
            }
            if (file.size > MAX_FILE_SIZE_BYTES) {
                setError(`"${file.name}" is over the 10MB limit.`);
                return;
            }
        }

        if (photos.length + files.length > MAX_PHOTOS) {
            setError(`You can attach up to ${MAX_PHOTOS} photos.`);
            return;
        }

        setError(null);
        const added = files.map((file) => ({
            file,
            previewUrl: URL.createObjectURL(file),
        }));
        onChange([...photos, ...added]);
    };

    const removePhoto = (index: number) => {
        URL.revokeObjectURL(photos[index].previewUrl);
        onChange(photos.filter((_, i) => i !== index));
    };

    return (
        <div className="flex flex-col gap-3">
            <FileUploadDropzone
                inputId={inputId}
                accept="image/*"
                multiple
                state={error ? "error" : "idle"}
                title={error ? "Upload failed" : "Add photos"}
                hint={
                    error ?? `JPG or PNG, up to ${MAX_PHOTOS} photos, 10MB each`
                }
                onFilesSelected={handleFiles}
            />

            {photos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {photos.map((photo, index) => (
                        <div
                            key={photo.previewUrl}
                            className="relative size-20 overflow-hidden rounded-md border border-color-border"
                        >
                            <img
                                src={photo.previewUrl}
                                alt={`Photo ${index + 1}`}
                                className="size-full object-cover"
                            />
                            <button
                                type="button"
                                aria-label={`Remove photo ${index + 1}`}
                                onClick={() => removePhoto(index)}
                                className="absolute top-1 right-1 inline-flex size-5 items-center justify-center rounded-full bg-color-border text-color-text-secondary hover:bg-status-critical hover:text-color-text-inverse"
                            >
                                <X className="size-3" aria-hidden="true" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
