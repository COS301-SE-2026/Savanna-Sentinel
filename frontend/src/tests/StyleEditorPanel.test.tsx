import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";

import { StyleEditorPanel } from "@/components/workspace/StyleEditorPanel";
import {
    useWorkspaceStore,
    initialWorkspaceState,
} from "@/store/workspaceStore";

afterEach(() => {
    useWorkspaceStore.setState(initialWorkspaceState, true);
});

describe("StyleEditorPanel", () => {
    it("shows a placeholder when nothing is selected", () => {
        render(
            <StyleEditorPanel
                selection={null}
                editingFeatureId={null}
                onToggleEditGeometry={() => {}}
                onCancelEditGeometry={() => {}}
            />,
        );
        expect(
            screen.getByText(/select a layer or a feature/i),
        ).toBeInTheDocument();
    });

    it("editing opacity for a selected membership writes to its styleOverride", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        const created = useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] });

        render(
            <StyleEditorPanel
                selection={{
                    kind: "membership",
                    membershipId: created!.membershipId,
                }}
                editingFeatureId={null}
                onToggleEditGeometry={() => {}}
                onCancelEditGeometry={() => {}}
            />,
        );

        const slider = screen.getByLabelText("Opacity");
        fireEvent.change(slider, { target: { value: "50" } });

        const membership = useWorkspaceStore
            .getState()
            .memberships.find((m) => m.id === created!.membershipId);
        expect(membership?.styleOverride.opacity).toBeCloseTo(0.5);
    });

    it("editing outline opacity for a selected membership writes to its styleOverride, without touching the fill opacity", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        const created = useWorkspaceStore.getState().drawFeature("polygon", {
            type: "Polygon",
            coordinates: [
                [
                    [0, 0],
                    [10, 0],
                    [10, 10],
                    [0, 10],
                    [0, 0],
                ],
            ],
        });

        render(
            <StyleEditorPanel
                selection={{
                    kind: "membership",
                    membershipId: created!.membershipId,
                }}
                editingFeatureId={null}
                onToggleEditGeometry={() => {}}
                onCancelEditGeometry={() => {}}
            />,
        );

        const slider = screen.getByLabelText("Outline opacity");
        fireEvent.change(slider, { target: { value: "30" } });

        const membership = useWorkspaceStore
            .getState()
            .memberships.find((m) => m.id === created!.membershipId);
        expect(membership?.styleOverride.outlineOpacity).toBeCloseTo(0.3);
        expect(membership?.styleOverride.opacity).toBeUndefined();
    });

    it("hides outline opacity for a non-polygon feature", () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        const created = useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] });

        render(
            <StyleEditorPanel
                selection={{
                    kind: "membership",
                    membershipId: created!.membershipId,
                }}
                editingFeatureId={null}
                onToggleEditGeometry={() => {}}
                onCancelEditGeometry={() => {}}
            />,
        );

        expect(
            screen.queryByLabelText("Outline opacity"),
        ).not.toBeInTheDocument();
    });

    it("hides outline opacity when a layer is selected", () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);

        render(
            <StyleEditorPanel
                selection={{ kind: "layer", layerId: waterId }}
                editingFeatureId={null}
                onToggleEditGeometry={() => {}}
                onCancelEditGeometry={() => {}}
            />,
        );

        expect(
            screen.queryByLabelText("Outline opacity"),
        ).not.toBeInTheDocument();
    });

    it("shows an icon colour swatch defaulting to the baseline icon colour, independent of the shape colour", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        const created = useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] });

        render(
            <StyleEditorPanel
                selection={{
                    kind: "membership",
                    membershipId: created!.membershipId,
                }}
                editingFeatureId={null}
                onToggleEditGeometry={() => {}}
                onCancelEditGeometry={() => {}}
            />,
        );

        expect(
            screen.getByRole("button", { name: "Icon colour" }),
        ).toHaveTextContent("#1f2937");
    });

    it("editing icon colour for a selected membership writes to its styleOverride, without touching the shape colour", () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        const created = useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] });

        useWorkspaceStore
            .getState()
            .setMembershipStyleOverride(created!.membershipId, {
                iconColour: "#ffffff",
            });

        const membership = useWorkspaceStore
            .getState()
            .memberships.find((m) => m.id === created!.membershipId);
        expect(membership?.styleOverride.iconColour).toBe("#ffffff");
        expect(membership?.styleOverride.colour).toBeUndefined();
    });

    it("shows a reset button only once a property is overridden, and reset clears it", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        const created = useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] });

        render(
            <StyleEditorPanel
                selection={{
                    kind: "membership",
                    membershipId: created!.membershipId,
                }}
                editingFeatureId={null}
                onToggleEditGeometry={() => {}}
                onCancelEditGeometry={() => {}}
            />,
        );

        expect(
            screen.queryByRole("button", { name: /reset/i }),
        ).not.toBeInTheDocument();

        fireEvent.change(screen.getByLabelText("Opacity"), {
            target: { value: "50" },
        });
        const resetButton = await screen.findByRole("button", {
            name: /reset/i,
        });
        await userEvent.click(resetButton);

        const membership = useWorkspaceStore
            .getState()
            .memberships.find((m) => m.id === created!.membershipId);
        expect(membership?.styleOverride.opacity).toBeUndefined();
    });

    it("editing a selected layer's style writes to its defaultStyle, not a membership", () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);

        render(
            <StyleEditorPanel
                selection={{ kind: "layer", layerId: waterId }}
                editingFeatureId={null}
                onToggleEditGeometry={() => {}}
                onCancelEditGeometry={() => {}}
            />,
        );

        fireEvent.change(screen.getByLabelText("Opacity"), {
            target: { value: "40" },
        });

        const layer = useWorkspaceStore
            .getState()
            .layers.find((l) => l.id === waterId);
        expect(layer?.defaultStyle.opacity).toBeCloseTo(0.4);
    });

    it("shows a read-only layers section only when the feature has been duplicated to another layer", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        const riverId = useWorkspaceStore.getState().addLayer("River", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        const created = useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] });

        const { rerender } = render(
            <StyleEditorPanel
                selection={{
                    kind: "membership",
                    membershipId: created!.membershipId,
                }}
                editingFeatureId={null}
                onToggleEditGeometry={() => {}}
                onCancelEditGeometry={() => {}}
            />,
        );

        expect(screen.queryByText(/^Layers$/)).not.toBeInTheDocument();

        useWorkspaceStore
            .getState()
            .duplicateFeatureToLayer(created!.membershipId, riverId);
        rerender(
            <StyleEditorPanel
                selection={{
                    kind: "membership",
                    membershipId: created!.membershipId,
                }}
                editingFeatureId={null}
                onToggleEditGeometry={() => {}}
                onCancelEditGeometry={() => {}}
            />,
        );

        expect(await screen.findByText(/^Layers$/)).toBeInTheDocument();
        expect(screen.getByText("Water")).toBeInTheDocument();
        expect(screen.getByText("River")).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: /remove from/i }),
        ).not.toBeInTheDocument();
    });

    it("shows an editable name field for the selected feature, defaulting to its display name as a placeholder", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        const created = useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] });

        render(
            <StyleEditorPanel
                selection={{
                    kind: "membership",
                    membershipId: created!.membershipId,
                }}
                editingFeatureId={null}
                onToggleEditGeometry={() => {}}
                onCancelEditGeometry={() => {}}
            />,
        );

        const nameInput = screen.getByLabelText(
            "Feature name",
        ) as HTMLInputElement;
        expect(nameInput.value).toBe("");
        expect(nameInput.placeholder).toBe("Point");

        await userEvent.type(nameInput, "Watering hole");

        const feature = useWorkspaceStore
            .getState()
            .features.find((f) => f.id === created!.featureId);
        expect(feature?.name).toBe("Watering hole");
    });

    it("calls onToggleEditGeometry with the feature id", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        const created = useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] });

        const onToggleEditGeometry = vi.fn();
        render(
            <StyleEditorPanel
                selection={{
                    kind: "membership",
                    membershipId: created!.membershipId,
                }}
                editingFeatureId={null}
                onToggleEditGeometry={onToggleEditGeometry}
                onCancelEditGeometry={() => {}}
            />,
        );

        await userEvent.click(
            screen.getByRole("button", { name: /edit geometry/i }),
        );

        expect(onToggleEditGeometry).toHaveBeenCalledWith(created!.featureId);
    });

    it("shows a 'Finish editing' label while the feature is being edited, and toggles off on click", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        const created = useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] });

        const onToggleEditGeometry = vi.fn();
        const onCancelEditGeometry = vi.fn();
        render(
            <StyleEditorPanel
                selection={{
                    kind: "membership",
                    membershipId: created!.membershipId,
                }}
                editingFeatureId={created!.featureId}
                onToggleEditGeometry={onToggleEditGeometry}
                onCancelEditGeometry={onCancelEditGeometry}
            />,
        );

        const button = screen.getByRole("button", { name: /finish editing/i });
        await userEvent.click(button);

        expect(onToggleEditGeometry).toHaveBeenCalledWith(created!.featureId);

        const cancelButton = screen.getByRole("button", { name: /cancel/i });
        await userEvent.click(cancelButton);

        expect(onCancelEditGeometry).toHaveBeenCalled();
    });

    it("does not show a Cancel button when the feature is not being edited", () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        const created = useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] });

        render(
            <StyleEditorPanel
                selection={{
                    kind: "membership",
                    membershipId: created!.membershipId,
                }}
                editingFeatureId={null}
                onToggleEditGeometry={() => {}}
                onCancelEditGeometry={() => {}}
            />,
        );

        expect(
            screen.queryByRole("button", { name: /cancel/i }),
        ).not.toBeInTheDocument();
    });

    it("only commits stroke widths within 1 to 20 and lets the field be cleared mid-edit", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        const created = useWorkspaceStore.getState().drawFeature("line", {
            type: "LineString",
            coordinates: [
                [0, 0],
                [1, 1],
            ],
        });

        render(
            <StyleEditorPanel
                selection={{
                    kind: "membership",
                    membershipId: created!.membershipId,
                }}
                editingFeatureId={null}
                onToggleEditGeometry={() => {}}
                onCancelEditGeometry={() => {}}
            />,
        );

        const input = screen.getByLabelText("Stroke width");
        const strokeWidth = () =>
            useWorkspaceStore
                .getState()
                .memberships.find((m) => m.id === created!.membershipId)
                ?.styleOverride.strokeWidth;

        fireEvent.change(input, { target: { value: "" } });
        expect(input).toHaveValue(null);
        expect(strokeWidth()).toBeUndefined();

        fireEvent.change(input, { target: { value: "0" } });
        expect(strokeWidth()).toBeUndefined();

        fireEvent.change(input, { target: { value: "25" } });
        expect(strokeWidth()).toBeUndefined();

        fireEvent.change(input, { target: { value: "5" } });
        expect(strokeWidth()).toBe(5);

        fireEvent.change(input, { target: { value: "" } });
        fireEvent.blur(input);
        expect(input).toHaveValue(5);
    });
});
