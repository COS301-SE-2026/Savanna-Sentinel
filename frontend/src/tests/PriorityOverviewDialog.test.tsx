import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";

import { PriorityOverviewDialog } from "@/components/workspace/PriorityOverviewDialog";
import {
    useWorkspaceStore,
    initialWorkspaceState,
} from "@/store/workspaceStore";

afterEach(() => {
    useWorkspaceStore.setState(initialWorkspaceState, true);
});

function drawPoint(name: string) {
    const { addLayer, setActiveLayer, drawFeature, renameFeature } =
        useWorkspaceStore.getState();
    setActiveLayer(addLayer("Layer", null));
    const created = drawFeature("point", {
        type: "Point",
        coordinates: [0, 0],
    })!;
    renameFeature(created.featureId, name);
    return created.featureId;
}

function renderDialog() {
    return render(<PriorityOverviewDialog open onOpenChange={() => {}} />);
}

describe("PriorityOverviewDialog", () => {
    it("shows an empty message when no feature has rules", () => {
        renderDialog();
        expect(
            screen.getByText("No features have rules set yet."),
        ).toBeVisible();
    });

    it("lists each feature with its priority per rule and a dash for rules that are off", () => {
        const river = drawPoint("River");
        const { setFeatureRule } = useWorkspaceStore.getState();
        setFeatureRule(river, "increase_risk", { priority: 7 });
        setFeatureRule(river, "avoid", { priority: 3 });

        renderDialog();
        const row = screen.getByRole("row", { name: /River/ });
        const cells = within(row).getAllByRole("cell");
        expect(cells.map((c) => c.textContent)).toEqual([
            "River",
            "7",
            "-Off",
            "-Off",
            "3",
        ]);
    });

    it("leaves out features that have no rules set", () => {
        const river = drawPoint("River");
        drawPoint("Road");
        useWorkspaceStore
            .getState()
            .setFeatureRule(river, "prefer", { priority: 2 });

        renderDialog();
        expect(screen.getByRole("row", { name: /River/ })).toBeVisible();
        expect(screen.queryByRole("row", { name: /Road/ })).toBeNull();
    });

    it("leaves out features that are not in effect", () => {
        const river = drawPoint("River");
        const road = drawPoint("Road");
        const { setFeatureRule, setFeatureInEffect } =
            useWorkspaceStore.getState();
        setFeatureRule(river, "prefer", { priority: 2 });
        setFeatureRule(road, "prefer", { priority: 2 });
        setFeatureInEffect(river, false);

        renderDialog();
        expect(screen.queryByRole("row", { name: /River/ })).toBeNull();
        expect(screen.getByRole("row", { name: /Road/ })).toBeVisible();
    });
});
