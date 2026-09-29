import { useEffect, useState } from "react";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { getLayerDisplayName } from "@/lib/workspace/featureDisplay";
import {
    getLayerChainIds,
    getPrecedenceOrderedLayerIds,
} from "@/lib/workspace/tree";
import type { WorkspaceLayer } from "@/lib/workspace/types";

export interface LayerPickerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    excludeLayerIds?: string[];
    onPick: (layerId: string) => void;
}

interface PickerRow {
    layer: WorkspaceLayer;
    depth: number;
    isPickable: boolean;
}

const INDENT_PX = 16;
const BASE_PADDING_PX = 8;

function buildRows(
    layers: WorkspaceLayer[],
    excludeLayerIds: string[],
): PickerRow[] {
    const byId = new Map(layers.map((l) => [l.id, l]));
    return getPrecedenceOrderedLayerIds(layers).map((id) => ({
        layer: byId.get(id)!,
        depth: getLayerChainIds(layers, id).length - 1,
        isPickable: !excludeLayerIds.includes(id),
    }));
}

export function LayerPickerDialog({
    open,
    onOpenChange,
    title,
    excludeLayerIds = [],
    onPick,
}: LayerPickerDialogProps) {
    const layers = useWorkspaceStore((s) => s.layers);
    const [rows, setRows] = useState<PickerRow[]>([]);

    useEffect(() => {
        if (open) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setRows(buildRows(layers, excludeLayerIds));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <ul className="m-0 max-h-[60vh] list-none space-y-1 overflow-y-auto p-2">
                    {!rows.some((row) => row.isPickable) && (
                        <li className="px-2 py-1.5 text-sm text-color-text-secondary">
                            No other layers yet.
                        </li>
                    )}
                    {rows.map(({ layer, depth, isPickable }) => {
                        const paddingLeft = `${BASE_PADDING_PX + depth * INDENT_PX}px`;
                        return (
                            <li key={layer.id}>
                                {isPickable ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onPick(layer.id);
                                            onOpenChange(false);
                                        }}
                                        className="w-full rounded py-1.5 pr-2 text-left text-sm text-color-text-primary hover:bg-color-surface-bg"
                                        style={{ paddingLeft }}
                                    >
                                        {getLayerDisplayName(layer)}
                                    </button>
                                ) : (
                                    <span
                                        className="flex items-center gap-2 py-1.5 pr-2 text-sm text-color-text-secondary"
                                        style={{ paddingLeft }}
                                    >
                                        <span>
                                            {getLayerDisplayName(layer)}
                                        </span>
                                        <span className="text-xs italic">
                                            already in
                                        </span>
                                    </span>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </DialogContent>
        </Dialog>
    );
}
