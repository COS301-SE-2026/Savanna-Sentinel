import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const CONFIRMATION_TEXT = "Confirm Deletion";

export interface DeleteGridDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    isDeleting: boolean;
}

export function DeleteGridDialog({
    open,
    onOpenChange,
    onConfirm,
    isDeleting,
}: DeleteGridDialogProps) {
    const [typed, setTyped] = useState("");
    const isConfirmed = typed.trim() === CONFIRMATION_TEXT;

    function handleOpenChange(next: boolean) {
        if (isDeleting) return;
        if (!next) setTyped("");
        onOpenChange(next);
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete grid?</DialogTitle>
                </DialogHeader>
                <DialogDescription>
                    Deleting the current grid would also delete all previously
                    saved heatmaps and the trained model. Type "
                    {CONFIRMATION_TEXT}" into the field below to continue
                </DialogDescription>
                <div className="px-6 pb-5">
                    <Input
                        value={typed}
                        onChange={(e) => setTyped(e.target.value)}
                        aria-label="Type Confirm Deletion to continue"
                        autoComplete="off"
                    />
                </div>
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleOpenChange(false)}
                        disabled={isDeleting}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={onConfirm}
                        disabled={!isConfirmed || isDeleting}
                    >
                        {isDeleting && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        Delete grid
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
