import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, afterEach } from "vitest";

import { LayerTreePanel } from "@/components/workspace/LayerTreePanel";
import {
    useWorkspaceStore,
    initialWorkspaceState,
} from "@/store/workspaceStore";

afterEach(() => {
    useWorkspaceStore.setState(initialWorkspaceState, true);
});

function renderPanel() {
    return render(
        <LayerTreePanel
            activeLayerId={null}
            onSelectLayer={() => {}}
            onSelectMembership={() => {}}
        />,
    );
}

describe("LayerTreePanel", () => {
    it("adds a top-level layer via the New Layer button", async () => {
        renderPanel();
        await userEvent.click(
            screen.getByRole("button", { name: /new layer/i }),
        );
        expect(useWorkspaceStore.getState().layers).toHaveLength(1);
        const tree = within(screen.getAllByRole("list")[0]);
        expect(await tree.findByText("New layer")).toBeInTheDocument();
    });

    it("renders nested layers indented under their parent", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().addLayer("Western water", waterId);
        renderPanel();
        expect(await screen.findByText("Water")).toBeInTheDocument();
        expect(await screen.findByText("Western water")).toBeInTheDocument();
    });

    it("shows an indeterminate layer checkbox when only some of its memberships are visible", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] });
        const secondFeature = useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [1, 1] });
        useWorkspaceStore
            .getState()
            .toggleMembershipVisibility(secondFeature!.membershipId, false);

        renderPanel();
        const row = (await screen.findByText("Water")).closest("div")!;
        const checkbox = within(row).getByRole("checkbox") as HTMLInputElement;
        expect(checkbox.indeterminate).toBe(true);
    });

    it("bulk-toggles every membership in a layer's subtree when its checkbox is clicked", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] });

        renderPanel();
        const row = (await screen.findByText("Water")).closest("div")!;
        await userEvent.click(within(row).getByRole("checkbox"));

        expect(
            useWorkspaceStore.getState().memberships.every((m) => !m.visible),
        ).toBe(true);
    });

    it("renames a layer through its kebab menu", async () => {
        useWorkspaceStore.getState().addLayer("Water", null);
        renderPanel();

        await userEvent.click(
            await screen.findByRole("button", { name: /options for water/i }),
        );
        await userEvent.click(await screen.findByText("Rename"));
        const input = await screen.findByDisplayValue("Water");
        await userEvent.clear(input);
        await userEvent.type(input, "Renamed water{Enter}");

        expect(useWorkspaceStore.getState().layers[0].name).toBe(
            "Renamed water",
        );
    });

    it("renames a feature through its kebab menu", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        const created = useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] });

        renderPanel();
        await userEvent.click(
            await screen.findByRole("button", { name: /feature options/i }),
        );
        await userEvent.click(await screen.findByText("Rename"));
        const input = await screen.findByDisplayValue("Point");
        await userEvent.clear(input);
        await userEvent.type(input, "Watering hole{Enter}");

        const feature = useWorkspaceStore
            .getState()
            .features.find((f) => f.id === created!.featureId);
        expect(feature?.name).toBe("Watering hole");
    });

    it("marks the selected layer's name button as current", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().addLayer("Roads", null);

        render(
            <LayerTreePanel
                activeLayerId={null}
                selection={{ kind: "layer", layerId: waterId }}
                onSelectLayer={() => {}}
                onSelectMembership={() => {}}
            />,
        );

        expect(
            await screen.findByRole("button", { name: "Water" }),
        ).toHaveAttribute("aria-current", "true");
        expect(
            screen.getByRole("button", { name: "Roads" }),
        ).not.toHaveAttribute("aria-current");
    });

    it("marks the selected feature's row as current", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        const created = useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] });

        render(
            <LayerTreePanel
                activeLayerId={null}
                selection={{
                    kind: "membership",
                    membershipId: created!.membershipId,
                }}
                onSelectLayer={() => {}}
                onSelectMembership={() => {}}
            />,
        );

        expect(
            await screen.findByRole("button", { name: "Point" }),
        ).toHaveAttribute("aria-current", "true");
    });

    it("highlights the active layer's row even when a feature in another layer is selected", async () => {
        useWorkspaceStore.getState().addLayer("Water", null);
        const roadsId = useWorkspaceStore.getState().addLayer("Roads", null);
        useWorkspaceStore.getState().setActiveLayer(roadsId);
        const created = useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] });

        render(
            <LayerTreePanel
                activeLayerId={roadsId}
                selection={{
                    kind: "membership",
                    membershipId: created!.membershipId,
                }}
                onSelectLayer={() => {}}
                onSelectMembership={() => {}}
            />,
        );

        const roadsRow = (await screen.findByText("Roads")).closest("div")!;
        expect(roadsRow.className).toMatch(/bg-brand-primary/);
        const waterRow = (await screen.findByText("Water")).closest("div")!;
        expect(waterRow.className).not.toMatch(/bg-brand-primary/);
    });

    it("deletes a feature everywhere via a membership's kebab menu", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] });

        renderPanel();
        await userEvent.click(
            await screen.findByRole("button", { name: /feature options/i }),
        );
        await userEvent.click(
            await screen.findByText("Delete feature everywhere"),
        );

        expect(useWorkspaceStore.getState().features).toHaveLength(0);
    });

    it("hides 'Remove from this layer' for a feature that belongs to only one layer", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] });

        renderPanel();
        await userEvent.click(
            await screen.findByRole("button", { name: /feature options/i }),
        );

        expect(
            screen.queryByText("Remove from this layer"),
        ).not.toBeInTheDocument();
    });

    it("shows 'Remove from this layer' once a feature is duplicated to another layer", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        const riverId = useWorkspaceStore.getState().addLayer("River", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        const created = useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] });
        useWorkspaceStore
            .getState()
            .duplicateFeatureToLayer(created!.membershipId, riverId);

        renderPanel();
        const optionButtons = await screen.findAllByRole("button", {
            name: /feature options/i,
        });
        await userEvent.click(optionButtons[0]);

        const removeItem = await screen.findByText("Remove from this layer");
        expect(removeItem).toBeInTheDocument();

        await userEvent.click(removeItem);
        expect(useWorkspaceStore.getState().memberships).toHaveLength(1);
    });

    it("excludes layers the feature already belongs to from the duplicate-to-layer picker", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().addLayer("River", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] });

        renderPanel();
        await userEvent.click(
            await screen.findByRole("button", { name: /feature options/i }),
        );
        await userEvent.click(
            await screen.findByText("Duplicate to another layer"),
        );

        const dialog = await screen.findByRole("dialog");
        expect(
            within(dialog).queryByRole("button", { name: "Water" }),
        ).not.toBeInTheDocument();
        expect(
            within(dialog).getByRole("button", { name: "River" }),
        ).toBeInTheDocument();

        await userEvent.click(
            within(dialog).getByRole("button", { name: "River" }),
        );
        expect(useWorkspaceStore.getState().memberships).toHaveLength(2);

        const optionButtons = await screen.findAllByRole("button", {
            name: /feature options/i,
        });
        await userEvent.click(optionButtons[0]);
        await userEvent.click(
            await screen.findByText("Duplicate to another layer"),
        );
        const secondDialog = await screen.findByRole("dialog");
        expect(
            within(secondDialog).getByText("No other layers yet."),
        ).toBeInTheDocument();
    });

    it("excludes every layer the feature already belongs to from the move-to-layer picker", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        const riverId = useWorkspaceStore.getState().addLayer("River", null);
        useWorkspaceStore.getState().addLayer("Roads", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        const created = useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] });
        useWorkspaceStore
            .getState()
            .duplicateFeatureToLayer(created!.membershipId, riverId);

        renderPanel();
        const optionButtons = await screen.findAllByRole("button", {
            name: /feature options/i,
        });
        await userEvent.click(optionButtons[0]);
        await userEvent.click(await screen.findByText("Move to layer"));

        const dialog = await screen.findByRole("dialog");
        expect(
            within(dialog).queryByRole("button", { name: "Water" }),
        ).not.toBeInTheDocument();
        expect(
            within(dialog).queryByRole("button", { name: "River" }),
        ).not.toBeInTheDocument();
        expect(
            within(dialog).getByRole("button", { name: "Roads" }),
        ).toBeInTheDocument();
    });

    it("deleting a layer from its menu keeps a duplicated feature under its other layer", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        const riverId = useWorkspaceStore.getState().addLayer("River", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        const created = useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] });
        useWorkspaceStore
            .getState()
            .duplicateFeatureToLayer(created!.membershipId, riverId);

        renderPanel();
        const waterRow = (await screen.findByText("Water")).closest("div")!;
        await userEvent.click(
            within(waterRow).getByRole("button", { name: "Options for Water" }),
        );
        await userEvent.click(await screen.findByText("Delete layer"));

        const state = useWorkspaceStore.getState();
        expect(state.layers.map((l) => l.id)).toEqual([riverId]);
        expect(state.features.map((f) => f.id)).toEqual([created!.featureId]);
        expect(state.memberships.map((m) => m.layerId)).toEqual([riverId]);
    });

    it("marks a feature that is not in effect with an accessible icon", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        const created = useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] })!;
        useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [1, 1] });
        useWorkspaceStore
            .getState()
            .setFeatureInEffect(created.featureId, false);

        renderPanel();
        await screen.findByText("Water");

        expect(
            screen.getAllByRole("img", { name: "Not in effect" }),
        ).toHaveLength(1);
    });

    it("marks the layer row too when every feature under it is out of effect", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        const created = useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] })!;
        useWorkspaceStore
            .getState()
            .setFeatureInEffect(created.featureId, false);

        renderPanel();
        await screen.findByText("Water");

        expect(
            screen.getAllByRole("img", { name: "Not in effect" }),
        ).toHaveLength(2);
    });

    it("shows no icon on an empty layer or a layer with a mix of features", async () => {
        useWorkspaceStore.getState().addLayer("Empty", null);
        const mixedId = useWorkspaceStore.getState().addLayer("Mixed", null);
        useWorkspaceStore.getState().setActiveLayer(mixedId);
        const a = useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] })!;
        useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [1, 1] });
        useWorkspaceStore.getState().setFeatureInEffect(a.featureId, false);

        renderPanel();
        await screen.findByText("Empty");

        const emptyRow = screen.getByText("Empty").closest("div")!;
        const mixedRow = screen.getByText("Mixed").closest("div")!;
        expect(within(emptyRow).queryByRole("img")).toBeNull();
        expect(within(mixedRow).queryByRole("img")).toBeNull();
    });

    it("Disable all children and Enable all children act on every feature under the layer", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] });
        useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [1, 1] });

        renderPanel();
        const waterRow = (await screen.findByText("Water")).closest("div")!;
        await userEvent.click(
            within(waterRow).getByRole("button", { name: "Options for Water" }),
        );
        await userEvent.click(await screen.findByText("Disable all children"));

        expect(
            useWorkspaceStore.getState().features.every((f) => !f.inEffect),
        ).toBe(true);

        await userEvent.click(
            within(waterRow).getByRole("button", { name: "Options for Water" }),
        );
        await userEvent.click(await screen.findByText("Enable all children"));

        expect(
            useWorkspaceStore.getState().features.every((f) => f.inEffect),
        ).toBe(true);
    });
});
