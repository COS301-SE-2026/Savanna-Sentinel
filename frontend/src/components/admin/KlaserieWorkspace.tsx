import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { notifySafe, notifyCritical } from "@/components/ui/toast";
import { demoApi } from "@/services/demoApi";

export const KlaserieWorkspace = () => {
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isInserting, setIsInserting] = useState(false);

    const handleConfirm = async () => {
        setIsConfirmOpen(false);
        setIsInserting(true);
        try {
            await demoApi.insertKlaserieWorkspace();
            notifySafe(
                "Klaserie workspace inserted",
                "Terrain effects are being recomputed.",
            );
        } catch {
            notifyCritical("Insert failed", "Try again.");
        } finally {
            setIsInserting(false);
        }
    };

    return (
        <>
            <Button
                disabled={isInserting}
                onClick={() => setIsConfirmOpen(true)}
            >
                {isInserting ? "Inserting..." : "Insert Klaserie workspace"}
            </Button>

            <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                <DialogContent preventBackdropClose>
                    <DialogHeader>
                        <DialogTitle>Replace the workspace?</DialogTitle>
                    </DialogHeader>
                    <DialogDescription>
                        Every current layer and feature is deleted and replaced
                        with the Klaserie demo layers. This cannot be undone.
                    </DialogDescription>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsConfirmOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="button" onClick={handleConfirm}>
                            Replace
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default KlaserieWorkspace;
