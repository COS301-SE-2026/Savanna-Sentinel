import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, afterEach, vi } from "vitest";

import { LayerPickerDialog } from "@/components/workspace/LayerPickerDialog";
import {
    useWorkspaceStore,
    initialWorkspaceState,
} from "@/store/workspaceStore";

afterEach(() => {
    useWorkspaceStore.setState(initialWorkspaceState, true);
});

describe("LayerPickerDialog", () => {
    it("keeps the options list frozen against store changes while still open, so a pick's mutation can't alter it before it closes", () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().addLayer("River", null);

        const { rerender } = render(
            <LayerPickerDialog
                open
                onOpenChange={() => {}}
                title="Duplicate to layer"
                excludeLayerIds={[waterId]}
                onPick={() => {}}
            />,
        );

        expect(
            screen.getByRole("button", { name: "River" }),
        ).toBeInTheDocument();

        useWorkspaceStore.getState().addLayer("Forest", null);
        rerender(
            <LayerPickerDialog
                open
                onOpenChange={() => {}}
                title="Duplicate to layer"
                excludeLayerIds={[waterId]}
                onPick={() => {}}
            />,
        );

        expect(
            screen.getByRole("button", { name: "River" }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "Forest" }),
        ).not.toBeInTheDocument();
    });

    it("re-derives the options list each time it reopens", () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().addLayer("River", null);

        const { rerender } = render(
            <LayerPickerDialog
                open={false}
                onOpenChange={() => {}}
                title="Duplicate to layer"
                excludeLayerIds={[waterId]}
                onPick={() => {}}
            />,
        );

        useWorkspaceStore.getState().addLayer("Forest", null);
        rerender(
            <LayerPickerDialog
                open
                onOpenChange={() => {}}
                title="Duplicate to layer"
                excludeLayerIds={[waterId]}
                onPick={() => {}}
            />,
        );

        expect(
            screen.getByRole("button", { name: "River" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Forest" }),
        ).toBeInTheDocument();
    });

    it("calls onPick with the chosen layer id", async () => {
        const riverId = useWorkspaceStore.getState().addLayer("River", null);
        const onPick = vi.fn();

        render(
            <LayerPickerDialog
                open
                onOpenChange={() => {}}
                title="Duplicate to layer"
                onPick={onPick}
            />,
        );

        await userEvent.click(screen.getByRole("button", { name: "River" }));
        expect(onPick).toHaveBeenCalledWith(riverId);
    });

    it("lists nested layers under their parents, indented by depth", () => {
        const store = useWorkspaceStore.getState();
        const roadsId = store.addLayer("Roads", null);
        const waterId = store.addLayer("Water", null);
        const riversId = store.addLayer("Rivers", waterId);
        store.addLayer("Seasonal", riversId);
        store.addLayer("Tracks", roadsId);
        store.reorderLayer(null, [waterId, roadsId]);

        render(
            <LayerPickerDialog
                open
                onOpenChange={() => {}}
                title="Move to layer"
                onPick={() => {}}
            />,
        );

        const buttons = screen.getAllByRole("button", {
            name: /^(Water|Rivers|Seasonal|Roads|Tracks)$/,
        });
        expect(buttons.map((b) => b.textContent)).toEqual([
            "Water",
            "Rivers",
            "Seasonal",
            "Roads",
            "Tracks",
        ]);
        const indent = (name: string) =>
            parseInt(
                screen.getByRole("button", { name }).style.paddingLeft,
                10,
            );
        expect(indent("Rivers")).toBeGreaterThan(indent("Water"));
        expect(indent("Seasonal")).toBeGreaterThan(indent("Rivers"));
        expect(indent("Tracks")).toBe(indent("Rivers"));
    });

    it("shows an excluded parent as plain text when one of its children can be picked", () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().addLayer("Rivers", waterId);

        render(
            <LayerPickerDialog
                open
                onOpenChange={() => {}}
                title="Move to layer"
                excludeLayerIds={[waterId]}
                onPick={() => {}}
            />,
        );

        expect(
            screen.queryByRole("button", { name: "Water" }),
        ).not.toBeInTheDocument();
        expect(screen.getByText("Water")).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Rivers" }),
        ).toBeInTheDocument();
    });

    it("still lists a layer the feature is already in, marked and not clickable", () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().addLayer("Roads", null);

        render(
            <LayerPickerDialog
                open
                onOpenChange={() => {}}
                title="Move to layer"
                excludeLayerIds={[waterId]}
                onPick={() => {}}
            />,
        );

        expect(
            screen.queryByRole("button", { name: /Water/ }),
        ).not.toBeInTheDocument();
        expect(screen.getByText("Water")).toBeInTheDocument();
        expect(screen.getByText("already in")).toBeInTheDocument();
        expect(
            screen.queryByText("No other layers yet."),
        ).not.toBeInTheDocument();
    });

    it("says there is nowhere to go when every layer is already used", () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);

        render(
            <LayerPickerDialog
                open
                onOpenChange={() => {}}
                title="Move to layer"
                excludeLayerIds={[waterId]}
                onPick={() => {}}
            />,
        );

        expect(screen.getByText("No other layers yet.")).toBeInTheDocument();
        expect(screen.getByText("Water")).toBeInTheDocument();
    });
});
