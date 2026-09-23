import { useEffect, useState } from "react";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { getLayerDisplayName } from "@/lib/workspace/featureDisplay";
import type { WorkspaceLayer } from "@/lib/workspace/types";

export interface LayerPickerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    excludeLayerIds?: string[];
    onPick: (layerId: string) => void;
}

export function LayerPickerDialog({
    open,
    onOpenChange,
    title,
    excludeLayerIds = [],
    onPick,
}: LayerPickerDialogProps) {
    const layers = useWorkspaceStore((s) => s.layers);
    const [pickable, setPickable] = useState<WorkspaceLayer[]>([]);

    useEffect(() => {
        if (open) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setPickable(layers.filter((l) => !excludeLayerIds.includes(l.id)));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <ul className="m-0 max-h-64 list-none space-y-1 overflow-y-auto p-0">
                    {pickable.length === 0 && (
                        <li className="px-2 py-1.5 text-sm text-color-text-secondary">
                            No other layers yet.
                        </li>
                    )}
                    {pickable.map((layer) => (
                        <li key={layer.id}>
                            <button
                                type="button"
                                onClick={() => {
                                    onPick(layer.id);
                                    onOpenChange(false);
                                }}
                                className="w-full rounded px-2 py-1.5 text-left text-sm text-color-text-primary hover:bg-color-surface-bg"
                            >
                                {getLayerDisplayName(layer)}
                            </button>
                        </li>
                    ))}
                </ul>
            </DialogContent>
        </Dialog>
    );
}
