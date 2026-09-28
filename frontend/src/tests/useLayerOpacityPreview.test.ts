import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useLayerOpacityPreview } from "@/hooks/useLayerOpacityPreview";
import { useWorkspaceStore } from "@/store/workspaceStore";
import type { WorkspaceLayer } from "@/lib/workspace/types";
import type { WorkspaceSelection } from "@/components/workspace/StyleEditorPanel";

const layerA: WorkspaceLayer = {
    id: "layer-a",
    name: "Layer A",
    parentId: null,
    order: 0,
    defaultStyle: { colour: "#ff0000", opacity: 1 },
    defaultRules: {},
};

const layerB: WorkspaceLayer = {
    id: "layer-b",
    name: "Layer B",
    parentId: null,
    order: 1,
    defaultStyle: { colour: "#00ff00", opacity: 1 },
    defaultRules: {},
};

describe("useLayerOpacityPreview", () => {
    beforeEach(() => {
        useWorkspaceStore.setState({
            layers: [layerA, layerB],
            features: [],
            memberships: [],
        });
    });

    it("keeps a per-layer opacity override when switching selection away and back", () => {
        const { result, rerender } = renderHook(
            ({ selection }: { selection: WorkspaceSelection }) =>
                useLayerOpacityPreview(selection),
            {
                initialProps: {
                    selection: { kind: "layer", layerId: "layer-a" },
                },
            },
        );

        expect(result.current.previewOpacity).toBe(100);

        act(() => result.current.setPreviewOpacity(40));
        expect(result.current.previewOpacity).toBe(40);

        rerender({ selection: null });

        expect(result.current.opacityOverrides).toEqual([
            { kind: "layer", id: "layer-a", value: 0.4 },
        ]);

        rerender({ selection: { kind: "layer", layerId: "layer-a" } });

        expect(result.current.previewOpacity).toBe(40);
    });
});
