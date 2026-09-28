import { useEffect, useState } from "react";

import type { WorkspaceSelection } from "@/components/workspace/StyleEditorPanel";
import { resolveVisibleFeatures } from "@/lib/workspace/resolveVisibleFeatures";
import { useWorkspaceStore } from "@/store/workspaceStore";

export function useReadOnlyWorkspace() {
    const [selection, setSelection] = useState<WorkspaceSelection>(null);
    const memberships = useWorkspaceStore((s) => s.memberships);
    const loadWorkspace = useWorkspaceStore((s) => s.loadWorkspace);

    const selectedFeatureId =
        selection?.kind === "membership"
            ? (memberships.find((m) => m.id === selection.membershipId)
                  ?.featureId ?? null)
            : null;

    useEffect(() => {
        const status = useWorkspaceStore.getState().status;
        if (status === "idle" || status === "error") {
            loadWorkspace();
        }
    }, [loadWorkspace]);

    function handleFeatureClick(featureId: string | null) {
        if (!featureId) {
            setSelection(null);
            return;
        }

        const current = useWorkspaceStore.getState();
        const rendered = resolveVisibleFeatures(
            current.layers,
            current.features,
            current.memberships,
        ).find((r) => r.feature.id === featureId);

        if (rendered) {
            setSelection({
                kind: "membership",
                membershipId: rendered.membershipId,
            });
        }
    }

    function handleSelectLayer(layerId: string | undefined) {
        setSelection(layerId ? { kind: "layer", layerId } : null);
    }

    function handleSelectMembership(membershipId: string | undefined) {
        setSelection(
            membershipId ? { kind: "membership", membershipId } : null,
        );
    }

    return {
        selection,
        selectedFeatureId,
        handleFeatureClick,
        handleSelectLayer,
        handleSelectMembership,
    };
}
