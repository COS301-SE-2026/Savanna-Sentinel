import { render, screen, within, fireEvent } from "@testing-library/react";
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

    it("starts root layers collapsed when rootLayersCollapsed is set", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().addLayer("Western water", waterId);
        render(
            <LayerTreePanel
                activeLayerId={null}
                rootLayersCollapsed
                onSelectLayer={() => {}}
                onSelectMembership={() => {}}
            />,
        );

        expect(await screen.findByText("Water")).toBeInTheDocument();
        expect(screen.queryByText("Western water")).not.toBeInTheDocument();

        await userEvent.click(
            screen.getByRole("button", { name: "Expand layer" }),
        );

        expect(screen.getByText("Western water")).toBeInTheDocument();
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

    it("shades every ancestor layer of the selected feature in gray", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        const riversId = useWorkspaceStore
            .getState()
            .addLayer("Rivers", waterId);
        const seasonalId = useWorkspaceStore
            .getState()
            .addLayer("Seasonal", riversId);
        useWorkspaceStore.getState().addLayer("Roads", null);
        useWorkspaceStore.getState().setActiveLayer(seasonalId);
        const created = useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] });

        render(
            <LayerTreePanel
                activeLayerId={seasonalId}
                selection={{
                    kind: "membership",
                    membershipId: created!.membershipId,
                }}
                onSelectLayer={() => {}}
                onSelectMembership={() => {}}
            />,
        );

        const rowOf = async (name: string) =>
            (await screen.findByText(name)).closest("div")!.className;
        expect(await rowOf("Water")).toMatch(/bg-color-surface-bg/);
        expect(await rowOf("Rivers")).toMatch(/bg-color-surface-bg/);
        expect(await rowOf("Seasonal")).toMatch(/bg-brand-primary/);
        expect(await rowOf("Seasonal")).not.toMatch(/bg-color-surface-bg/);
        expect(await rowOf("Roads")).not.toMatch(/bg-color-surface-bg/);
    });

    it("shades the other instances of a duplicated feature in gray", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        const riverId = useWorkspaceStore.getState().addLayer("River", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        const created = useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] })!;
        useWorkspaceStore.getState().drawFeature("line", {
            type: "LineString",
            coordinates: [
                [0, 0],
                [1, 1],
            ],
        });
        useWorkspaceStore
            .getState()
            .duplicateFeatureToLayer(created.membershipId, riverId);

        render(
            <LayerTreePanel
                activeLayerId={waterId}
                selection={{
                    kind: "membership",
                    membershipId: created.membershipId,
                }}
                onSelectLayer={() => {}}
                onSelectMembership={() => {}}
            />,
        );

        const [selectedRow, otherInstanceRow] = (
            await screen.findAllByRole("button", { name: "Point" })
        ).map((button) => button.closest("li")!.className);
        expect(selectedRow).toMatch(/bg-brand-primary/);
        expect(selectedRow).not.toMatch(/bg-color-surface-bg/);
        expect(otherInstanceRow).toMatch(/bg-color-surface-bg/);
        const unrelatedRow = screen
            .getByRole("button", { name: "Line" })
            .closest("li")!.className;
        expect(unrelatedRow).not.toMatch(/bg-color-surface-bg/);
    });

    it("does not shade ancestor layers when a layer is selected", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        const riversId = useWorkspaceStore
            .getState()
            .addLayer("Rivers", waterId);

        render(
            <LayerTreePanel
                activeLayerId={riversId}
                selection={{ kind: "layer", layerId: riversId }}
                onSelectLayer={() => {}}
                onSelectMembership={() => {}}
            />,
        );

        const waterRow = (await screen.findByText("Water")).closest("div")!;
        expect(waterRow.className).not.toMatch(/bg-color-surface-bg/);
    });

    it("selects the heatmap row, highlights it, and reveals its opacity slider", async () => {
        render(
            <LayerTreePanel
                activeLayerId={null}
                onSelectLayer={() => {}}
                onSelectMembership={() => {}}
                heatmapSelected={false}
                onSelectHeatmap={() => {}}
            />,
        );

        expect(
            screen.queryByLabelText("Heatmap opacity"),
        ).not.toBeInTheDocument();

        const heatmapButton = screen.getByRole("button", { name: "Heatmap" });
        expect(heatmapButton).not.toHaveAttribute("aria-current");
    });

    it("shows the heatmap row highlighted and its opacity slider once selected", async () => {
        render(
            <LayerTreePanel
                activeLayerId={null}
                onSelectLayer={() => {}}
                onSelectMembership={() => {}}
                heatmapSelected
                onSelectHeatmap={() => {}}
                heatmapOpacity={42}
                onHeatmapOpacityChange={() => {}}
            />,
        );

        const heatmapButton = screen.getByRole("button", { name: "Heatmap" });
        expect(heatmapButton).toHaveAttribute("aria-current", "true");
        expect(heatmapButton.closest("div")?.className).toMatch(
            /bg-brand-primary/,
        );

        const slider = screen.getByLabelText(
            "Heatmap opacity",
        ) as HTMLInputElement;
        expect(slider.value).toBe("42");
    });

    it("calls onSelectHeatmap when the heatmap row is clicked", async () => {
        let hasClicked = false;
        render(
            <LayerTreePanel
                activeLayerId={null}
                onSelectLayer={() => {}}
                onSelectMembership={() => {}}
                onSelectHeatmap={() => {
                    hasClicked = true;
                }}
            />,
        );

        await userEvent.click(screen.getByRole("button", { name: "Heatmap" }));
        expect(hasClicked).toBe(true);
    });

    it("reports opacity changes from the heatmap slider", async () => {
        let reported: number | null = null;
        render(
            <LayerTreePanel
                activeLayerId={null}
                onSelectLayer={() => {}}
                onSelectMembership={() => {}}
                heatmapSelected
                heatmapOpacity={30}
                onHeatmapOpacityChange={(value) => {
                    reported = value;
                }}
            />,
        );

        fireEvent.change(screen.getByLabelText("Heatmap opacity"), {
            target: { value: "80" },
        });

        expect(reported).toBe(80);
    });

    it("renders the Patrol Route label as plain text when no selection handler is given", () => {
        render(
            <LayerTreePanel
                activeLayerId={null}
                onSelectLayer={() => {}}
                onSelectMembership={() => {}}
                hasRoute
                routeVisible
            />,
        );

        expect(
            screen.queryByRole("button", { name: "Patrol Route" }),
        ).not.toBeInTheDocument();
        expect(screen.getByText("Patrol Route")).toBeInTheDocument();
    });

    it("selects the patrol route row and highlights it when a selection handler is given", async () => {
        render(
            <LayerTreePanel
                activeLayerId={null}
                onSelectLayer={() => {}}
                onSelectMembership={() => {}}
                hasRoute
                routeVisible
                patrolRouteSelected={false}
                onSelectPatrolRoute={() => {}}
            />,
        );

        const routeButton = screen.getByRole("button", {
            name: "Patrol Route",
        });
        expect(routeButton).not.toHaveAttribute("aria-current");
    });

    it("shows the patrol route row highlighted once selected", async () => {
        render(
            <LayerTreePanel
                activeLayerId={null}
                onSelectLayer={() => {}}
                onSelectMembership={() => {}}
                hasRoute
                routeVisible
                patrolRouteSelected
                onSelectPatrolRoute={() => {}}
            />,
        );

        const routeButton = screen.getByRole("button", {
            name: "Patrol Route",
        });
        expect(routeButton).toHaveAttribute("aria-current", "true");
        expect(routeButton.closest("div")?.className).toMatch(
            /bg-brand-primary/,
        );
    });

    it("calls onSelectPatrolRoute when the patrol route row is clicked", async () => {
        let hasClicked = false;
        render(
            <LayerTreePanel
                activeLayerId={null}
                onSelectLayer={() => {}}
                onSelectMembership={() => {}}
                hasRoute
                routeVisible
                onSelectPatrolRoute={() => {
                    hasClicked = true;
                }}
            />,
        );

        await userEvent.click(
            screen.getByRole("button", { name: "Patrol Route" }),
        );
        expect(hasClicked).toBe(true);
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
        expect(useWorkspaceStore.getState().features).toHaveLength(1);

        const dialog = await screen.findByRole("dialog");
        await userEvent.click(
            within(dialog).getByRole("button", { name: "Delete" }),
        );

        expect(useWorkspaceStore.getState().features).toHaveLength(0);
    });

    it("keeps the feature when its delete confirmation is cancelled", async () => {
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
        const dialog = await screen.findByRole("dialog");
        await userEvent.click(
            within(dialog).getByRole("button", { name: "Cancel" }),
        );

        expect(useWorkspaceStore.getState().features).toHaveLength(1);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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
        expect(useWorkspaceStore.getState().layers).toHaveLength(2);
        const dialog = await screen.findByRole("dialog");
        await userEvent.click(
            within(dialog).getByRole("button", { name: "Delete" }),
        );

        const state = useWorkspaceStore.getState();
        expect(state.layers.map((l) => l.id)).toEqual([riverId]);
        expect(state.features.map((f) => f.id)).toEqual([created!.featureId]);
        expect(state.memberships.map((m) => m.layerId)).toEqual([riverId]);
    });

    it("keeps the layer when its delete confirmation is cancelled", async () => {
        useWorkspaceStore.getState().addLayer("Water", null);

        renderPanel();
        const waterRow = (await screen.findByText("Water")).closest("div")!;
        await userEvent.click(
            within(waterRow).getByRole("button", { name: "Options for Water" }),
        );
        await userEvent.click(await screen.findByText("Delete layer"));
        const dialog = await screen.findByRole("dialog");
        await userEvent.click(
            within(dialog).getByRole("button", { name: "Cancel" }),
        );

        expect(useWorkspaceStore.getState().layers).toHaveLength(1);
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
