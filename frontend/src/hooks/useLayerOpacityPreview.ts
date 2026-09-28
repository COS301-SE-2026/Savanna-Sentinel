import { useEffect, useMemo, useState } from "react";

import { useWorkspaceStore } from "@/store/workspaceStore";
import {
    resolveLayerChainStyle,
    resolveMembershipStyle,
} from "@/lib/workspace/styleResolution";
import {
    getFeatureDisplayName,
    getLayerDisplayName,
} from "@/lib/workspace/featureDisplay";
import type { LayerOpacityOverride } from "@/lib/workspace/opacityOverrides";
import type { WorkspaceSelection } from "@/components/workspace/StyleEditorPanel";

export type { LayerOpacityOverride };

export interface LayerOpacityPreview {
    previewOpacity: number;
    setPreviewOpacity: (opacity: number) => void;
    label: string | null;
    opacityOverrides: LayerOpacityOverride[];
}

function selectionKeyOf(selection: WorkspaceSelection): string | null {
    if (!selection) return null;
    return selection.kind === "layer"
        ? `layer:${selection.layerId}`
        : `membership:${selection.membershipId}`;
}

export function useLayerOpacityPreview(
    selection: WorkspaceSelection,
): LayerOpacityPreview {
    const layers = useWorkspaceStore((s) => s.layers);
    const memberships = useWorkspaceStore((s) => s.memberships);
    const features = useWorkspaceStore((s) => s.features);
    const [previewOpacity, setPreviewOpacityState] = useState(100);
    const [overrides, setOverrides] = useState<
        Record<string, LayerOpacityOverride>
    >({});
    const selectionKey = selectionKeyOf(selection);

    useEffect(() => {
        if (!selection || selectionKey === null) return;
        const existing = overrides[selectionKey];
        if (existing) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- restore opacity
            setPreviewOpacityState(Math.round(existing.value * 100));
            return;
        }
        if (selection.kind === "layer") {
            const resolved = resolveLayerChainStyle(layers, selection.layerId);
            setPreviewOpacityState(Math.round(resolved.opacity * 100));
            return;
        }
        const membership = memberships.find(
            (m) => m.id === selection.membershipId,
        );
        if (membership) {
            setPreviewOpacityState(
                Math.round(
                    resolveMembershipStyle(layers, membership).opacity * 100,
                ),
            );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- resets the preview only
    }, [selectionKey]);

    const setPreviewOpacity = (opacity: number) => {
        setPreviewOpacityState(opacity);
        if (selectionKey !== null && selection) {
            const override: LayerOpacityOverride =
                selection.kind === "layer"
                    ? {
                          kind: "layer",
                          id: selection.layerId,
                          value: opacity / 100,
                      }
                    : {
                          kind: "membership",
                          id: selection.membershipId,
                          value: opacity / 100,
                      };
            setOverrides((prev) => ({ ...prev, [selectionKey]: override }));
        }
    };

    const selectedLayer =
        selection?.kind === "layer"
            ? layers.find((l) => l.id === selection.layerId)
            : undefined;
    const selectedMembership =
        selection?.kind === "membership"
            ? memberships.find((m) => m.id === selection.membershipId)
            : undefined;
    const selectedFeature = selectedMembership
        ? features.find((f) => f.id === selectedMembership.featureId)
        : undefined;

    const label = selectedLayer
        ? `${getLayerDisplayName(selectedLayer)} Opacity`
        : selectedFeature
          ? `${getFeatureDisplayName(selectedFeature)} Opacity`
          : null;

    const opacityOverrides = useMemo(
        () => Object.values(overrides),
        [overrides],
    );

    return {
        previewOpacity,
        setPreviewOpacity,
        label,
        opacityOverrides,
    };
}
