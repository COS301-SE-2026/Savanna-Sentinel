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
});
