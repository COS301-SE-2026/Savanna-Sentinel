import { ChevronLeft, ChevronRight, XIcon } from "lucide-react";

import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PhotoLightboxProps {
    photos: string[];
    index: number | null;
    onIndexChange: (index: number | null) => void;
    altPrefix?: string;
}

export function PhotoLightbox({
    photos,
    index,
    onIndexChange,
    altPrefix = "Photo",
}: PhotoLightboxProps) {
    return (
        <Dialog
            open={index !== null}
            onOpenChange={(open) => !open && onIndexChange(null)}
        >
            <DialogContent className="max-w-[95vw] border-0 bg-transparent p-0 shadow-none sm:max-w-3xl">
                <DialogTitle className="sr-only">
                    Photo {index !== null ? index + 1 : ""}
                </DialogTitle>
                {index !== null && photos[index] && (
                    <div className="relative">
                        <img
                            src={photos[index]}
                            alt={`${altPrefix} ${index + 1} of ${photos.length}, enlarged`}
                            className="max-h-[85vh] w-full rounded-lg object-contain"
                        />
                        <DialogClose asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-2 right-2 bg-black/50 text-color-text-inverse hover:bg-black/70 hover:text-color-text-inverse"
                            >
                                <XIcon className="size-5" aria-hidden="true" />
                                <span className="sr-only">
                                    Close photo preview
                                </span>
                            </Button>
                        </DialogClose>
                        {photos.length > 1 && (
                            <>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() =>
                                        onIndexChange(
                                            (index - 1 + photos.length) %
                                                photos.length,
                                        )
                                    }
                                    className="absolute top-1/2 left-2 !h-32 !w-12 -translate-y-1/2 bg-black/50 text-color-text-inverse hover:bg-black/70 hover:text-color-text-inverse"
                                >
                                    <ChevronLeft
                                        className="size-5"
                                        aria-hidden="true"
                                    />
                                    <span className="sr-only">
                                        Previous photo
                                    </span>
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() =>
                                        onIndexChange(
                                            (index + 1) % photos.length,
                                        )
                                    }
                                    className="absolute top-1/2 right-2 !h-32 !w-12 -translate-y-1/2 bg-black/50 text-color-text-inverse hover:bg-black/70 hover:text-color-text-inverse"
                                >
                                    <ChevronRight
                                        className="size-5"
                                        aria-hidden="true"
                                    />
                                    <span className="sr-only">Next photo</span>
                                </Button>
                            </>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
