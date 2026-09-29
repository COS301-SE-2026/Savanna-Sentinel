import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { getFeatureDisplayName } from "@/lib/workspace/featureDisplay";
import type { WorkspaceFeature } from "@/lib/workspace/types";

export interface ConfirmDeleteDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    onConfirm: () => void;
}

export function ConfirmDeleteDialog({
    open,
    onOpenChange,
    title,
    description,
    onConfirm,
}: ConfirmDeleteDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <DialogDescription>{description}</DialogDescription>
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={() => {
                            onConfirm();
                            onOpenChange(false);
                        }}
                    >
                        Delete
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export interface ConfirmDeleteFeatureDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    feature: WorkspaceFeature;
    onConfirm: () => void;
}

export function ConfirmDeleteFeatureDialog({
    open,
    onOpenChange,
    feature,
    onConfirm,
}: ConfirmDeleteFeatureDialogProps) {
    return (
        <ConfirmDeleteDialog
            open={open}
            onOpenChange={onOpenChange}
            title="Delete feature?"
            description={`"${getFeatureDisplayName(feature)}" will be removed from every layer it belongs to.`}
            onConfirm={onConfirm}
        />
    );
}
