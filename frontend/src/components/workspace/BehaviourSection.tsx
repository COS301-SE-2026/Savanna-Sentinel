import { useState } from "react";

import { Button } from "@/components/ui/button";
import { RuleEditorDialog, type RuleTarget } from "./RuleEditorDialog";

export function BehaviourSection({ target }: { target: RuleTarget }) {
    const [isOpen, setOpen] = useState(false);
    return (
        <div className="flex flex-col items-start gap-2 border-t border-color-border p-3">
            <p className="text-sm font-semibold text-color-text-primary">
                Terrain Aware Intelligence
            </p>
            <Button
                type="button"
                size="sm"
                variant="outline"
                aria-haspopup="dialog"
                onClick={() => setOpen(true)}
            >
                Behaviour
            </Button>
            <RuleEditorDialog
                target={target}
                open={isOpen}
                onOpenChange={setOpen}
            />
        </div>
    );
}
