import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, afterEach } from "vitest";

import { RuleEditorDialog } from "@/components/workspace/RuleEditorDialog";
import type { RuleTarget } from "@/components/workspace/RuleEditorDialog";
import {
    useWorkspaceStore,
    initialWorkspaceState,
} from "@/store/workspaceStore";

afterEach(() => {
    useWorkspaceStore.setState(initialWorkspaceState, true);
});

function setup() {
    const { addLayer, setActiveLayer, drawFeature } =
        useWorkspaceStore.getState();
    const layerId = addLayer("Water", null);
    setActiveLayer(layerId);
    const created = drawFeature("point", {
        type: "Point",
        coordinates: [0, 0],
    })!;
    return { layerId, ...created };
}

function renderDialog(target: RuleTarget) {
    return render(
        <RuleEditorDialog target={target} open onOpenChange={() => {}} />,
    );
}

function featureRules(featureId: string) {
    return useWorkspaceStore.getState().features.find((f) => f.id === featureId)
        ?.rules;
}

describe("RuleEditorDialog for a feature", () => {
    it("shows one section per intent, all off for a new feature", () => {
        const { featureId } = setup();
        renderDialog({ kind: "feature", featureId });

        for (const label of [
            "Increase risk",
            "Decrease risk",
            "Prefer following",
            "Avoid following",
        ]) {
            expect(screen.getByLabelText(label)).not.toBeChecked();
        }
        expect(screen.queryByLabelText("Avoid following strength")).toBeNull();
    });

    it("switching an intent on creates the rule and reveals its controls", async () => {
        const { featureId } = setup();
        renderDialog({ kind: "feature", featureId });

        await userEvent.click(screen.getByLabelText("Avoid following"));

        expect(featureRules(featureId)).toEqual({ avoid: { enabled: true } });
        expect(
            screen.getByLabelText("Avoid following strength"),
        ).toBeInTheDocument();
    });

    it("holds increase and decrease risk at the same time", async () => {
        const { featureId } = setup();
        renderDialog({ kind: "feature", featureId });

        await userEvent.click(screen.getByLabelText("Increase risk"));
        await userEvent.click(screen.getByLabelText("Decrease risk"));

        expect(Object.keys(featureRules(featureId) ?? {}).sort()).toEqual([
            "decrease_risk",
            "increase_risk",
        ]);
    });

    it("writes strength, decay and priority to the feature rule", async () => {
        const { featureId } = setup();
        useWorkspaceStore.getState().setFeatureBuffer(featureId, {
            enabled: true,
        });
        useWorkspaceStore
            .getState()
            .setFeatureRule(featureId, "avoid", { enabled: true });
        renderDialog({ kind: "feature", featureId });

        fireEvent.change(screen.getByLabelText("Avoid following strength"), {
            target: { value: "80" },
        });
        fireEvent.change(
            screen.getByLabelText("Avoid following buffer decay"),
            {
                target: { value: "50" },
            },
        );
        fireEvent.change(screen.getByLabelText("Avoid following priority"), {
            target: { value: "3" },
        });

        expect(featureRules(featureId)?.avoid).toEqual({
            enabled: true,
            strength: 0.8,
            bufferDecay: 0.5,
            priority: 3,
        });
    });

    it.each(["0", "100", "2.5", ""])(
        "does not commit an invalid priority of %j",
        (value) => {
            const { featureId } = setup();
            useWorkspaceStore
                .getState()
                .setFeatureRule(featureId, "avoid", { enabled: true });
            renderDialog({ kind: "feature", featureId });

            fireEvent.change(
                screen.getByLabelText("Avoid following priority"),
                {
                    target: { value },
                },
            );

            expect(featureRules(featureId)?.avoid).toEqual({ enabled: true });
        },
    );

    it("opens the priority overview from inside the dialog", async () => {
        const { featureId } = setup();
        renderDialog({ kind: "feature", featureId });

        await userEvent.click(
            screen.getByRole("button", {
                name: "Compare priorities across features",
            }),
        );

        expect(
            await screen.findByRole("dialog", { name: "Rule priorities" }),
        ).toBeVisible();
    });

    it("disables the decay slider with a hint while the feature has no buffer", () => {
        const { featureId } = setup();
        useWorkspaceStore
            .getState()
            .setFeatureRule(featureId, "avoid", { enabled: true });
        renderDialog({ kind: "feature", featureId });

        expect(
            screen.getByLabelText("Avoid following buffer decay"),
        ).toBeDisabled();
        expect(screen.getByText(/turn on the buffer/i)).toBeInTheDocument();
    });

    it("enables the decay slider once the buffer is on", () => {
        const { featureId } = setup();
        useWorkspaceStore.getState().setFeatureBuffer(featureId, {
            enabled: true,
        });
        useWorkspaceStore
            .getState()
            .setFeatureRule(featureId, "avoid", { enabled: true });
        renderDialog({ kind: "feature", featureId });

        expect(
            screen.getByLabelText("Avoid following buffer decay"),
        ).toBeEnabled();
    });

    it("resets an overridden property back to the inherited value", async () => {
        const { featureId, layerId } = setup();
        useWorkspaceStore
            .getState()
            .setLayerDefaultRule(layerId, "avoid", { strength: 0.9 });
        useWorkspaceStore
            .getState()
            .setFeatureRule(featureId, "avoid", { strength: 0.3 });
        renderDialog({ kind: "feature", featureId });

        await userEvent.click(
            screen.getByRole("button", {
                name: "Reset Avoid following strength",
            }),
        );

        expect(featureRules(featureId)?.avoid).toEqual({});
        expect(
            (
                screen.getByLabelText(
                    "Avoid following strength",
                ) as HTMLInputElement
            ).value,
        ).toBe("90");
    });

    it("shows a layer rule as inherited and lets the feature switch it off without touching the layer", async () => {
        const { featureId, layerId } = setup();
        useWorkspaceStore
            .getState()
            .setLayerDefaultRule(layerId, "avoid", { strength: 0.9 });
        renderDialog({ kind: "feature", featureId });

        expect(screen.getByLabelText("Avoid following")).toBeChecked();
        expect(screen.getByText(/inherited from layer/i)).toBeInTheDocument();

        await userEvent.click(screen.getByLabelText("Avoid following"));

        expect(featureRules(featureId)).toEqual({ avoid: { enabled: false } });
        expect(
            useWorkspaceStore.getState().layers.find((l) => l.id === layerId)
                ?.defaultRules,
        ).toEqual({ avoid: { strength: 0.9 } });
    });
});

describe("RuleEditorDialog for a layer", () => {
    it("edits the layer's default rules and always allows decay", async () => {
        const { layerId } = setup();
        renderDialog({ kind: "layer", layerId });

        await userEvent.click(screen.getByLabelText("Prefer following"));
        fireEvent.change(screen.getByLabelText("Prefer following strength"), {
            target: { value: "70" },
        });

        expect(
            screen.getByLabelText("Prefer following buffer decay"),
        ).toBeEnabled();
        expect(
            useWorkspaceStore.getState().layers.find((l) => l.id === layerId)
                ?.defaultRules,
        ).toEqual({ prefer: { enabled: true, strength: 0.7 } });
    });

    it("offers no Reset on a top-level layer, which has nothing to inherit from", () => {
        const { layerId } = setup();
        useWorkspaceStore
            .getState()
            .setLayerDefaultRule(layerId, "avoid", { strength: 0.9 });
        renderDialog({ kind: "layer", layerId });

        expect(
            screen.queryByRole("button", {
                name: "Reset Avoid following strength",
            }),
        ).not.toBeInTheDocument();
    });

    it("offers Reset on a nested layer's own rule settings", () => {
        const { layerId } = setup();
        const childId = useWorkspaceStore
            .getState()
            .addLayer("Rivers", layerId);
        useWorkspaceStore
            .getState()
            .setLayerDefaultRule(childId, "avoid", { strength: 0.9 });
        renderDialog({ kind: "layer", layerId: childId });

        expect(
            screen.getByRole("button", {
                name: "Reset Avoid following strength",
            }),
        ).toBeInTheDocument();
    });

    it("names the layer in the title", () => {
        const { layerId } = setup();
        renderDialog({ kind: "layer", layerId });

        expect(
            within(screen.getByRole("dialog")).getByText(/water/i),
        ).toBeInTheDocument();
    });
});
