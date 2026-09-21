import { render, screen } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";

import { LayerTreePanel } from "@/components/workspace/LayerTreePanel";
import {
    useWorkspaceStore,
    initialWorkspaceState,
} from "@/store/workspaceStore";

afterEach(() => {
    useWorkspaceStore.setState(initialWorkspaceState, true);
});

describe("LayerTreePanel drag-to-reorder", () => {
    it("renders a drag handle for every top-level layer", async () => {
        useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().addLayer("Roads", null);

        render(
            <LayerTreePanel
                activeLayerId={null}
                onSelectLayer={() => {}}
                onSelectMembership={() => {}}
            />,
        );

        expect(await screen.findAllByLabelText(/reorder/i)).toHaveLength(2);
    });

    it("reassigns sibling order when reorderLayer is called with a new order", () => {
        const { addLayer, reorderLayer } = useWorkspaceStore.getState();
        const waterId = addLayer("Water", null);
        const roadsId = addLayer("Roads", null);

        reorderLayer(null, [roadsId, waterId]);

        const layers = useWorkspaceStore.getState().layers;
        expect(layers.find((l) => l.id === roadsId)?.order).toBe(0);
        expect(layers.find((l) => l.id === waterId)?.order).toBe(1);
    });

    it("renders a drag handle for every feature membership in a layer", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] });
        useWorkspaceStore.getState().drawFeature("line", {
            type: "LineString",
            coordinates: [
                [0, 0],
                [1, 1],
            ],
        });

        render(
            <LayerTreePanel
                activeLayerId={null}
                onSelectLayer={() => {}}
                onSelectMembership={() => {}}
            />,
        );

        expect(await screen.findAllByLabelText(/reorder/i)).toHaveLength(3);
    });

    it("reassigns membership order when reorderMembership is called with a new order", () => {
        const { addLayer, setActiveLayer, drawFeature, reorderMembership } =
            useWorkspaceStore.getState();
        const waterId = addLayer("Water", null);
        setActiveLayer(waterId);
        const first = drawFeature("point", {
            type: "Point",
            coordinates: [0, 0],
        });
        const second = drawFeature("point", {
            type: "Point",
            coordinates: [1, 1],
        });

        reorderMembership(waterId, [second!.membershipId, first!.membershipId]);

        const memberships = useWorkspaceStore.getState().memberships;
        expect(
            memberships.find((m) => m.id === second!.membershipId)?.order,
        ).toBe(0);
        expect(
            memberships.find((m) => m.id === first!.membershipId)?.order,
        ).toBe(1);
    });
});
