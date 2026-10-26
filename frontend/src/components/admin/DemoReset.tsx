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
import { notifyCritical } from "@/components/ui/toast";
import { demoApi } from "@/services/demoApi";
import { db } from "@/offline/db";

export const DemoReset = () => {
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    const handleConfirm = async () => {
        setIsConfirmOpen(false);
        setIsResetting(true);
        try {
            await demoApi.reset();
        } catch {
            notifyCritical("Reset failed", "Try again.");
            setIsResetting(false);
            return;
        }
        await Promise.all(db.tables.map((table) => table.clear()));
        window.location.reload();
    };

    return (
        <>
            <Button
                variant="destructive"
                disabled={isResetting}
                onClick={() => setIsConfirmOpen(true)}
            >
                {isResetting ? "Resetting..." : "Reset demo data"}
            </Button>

            <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                <DialogContent preventBackdropClose>
                    <DialogHeader>
                        <DialogTitle>Reset demo data?</DialogTitle>
                    </DialogHeader>
                    <DialogDescription>
                        This deletes everything added since the system was
                        installed and cannot be undone.
                    </DialogDescription>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsConfirmOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleConfirm}
                        >
                            Reset
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default DemoReset;
