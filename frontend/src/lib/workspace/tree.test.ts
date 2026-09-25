import { describe, it, expect } from "vitest";
import {
    wouldCreateCycle,
    getDescendantLayerIds,
    computeLayerCheckboxState,
    getPrecedenceOrderedLayerIds,
    computeReorderedSiblingIds,
} from "./tree";
import type { WorkspaceLayer, WorkspaceMembership } from "./types";

function layer(id: string, parentId: string | null, order = 0): WorkspaceLayer {
    return { id, name: id, parentId, order, defaultStyle: {} };
}

describe("wouldCreateCycle", () => {
    it("allows moving a layer to a completely unrelated parent", () => {
        const layers = [layer("water", null), layer("roads", null)];
        expect(wouldCreateCycle(layers, "water", "roads")).toBe(false);
    });

    it("rejects making a layer its own parent", () => {
        const layers = [layer("water", null)];
        expect(wouldCreateCycle(layers, "water", "water")).toBe(true);
    });

    it("rejects making a layer a child of its own descendant", () => {
        const layers = [layer("water", null), layer("western-water", "water")];
        expect(wouldCreateCycle(layers, "water", "western-water")).toBe(true);
    });
});

describe("getDescendantLayerIds", () => {
    it("returns every nested descendant, not just direct children", () => {
        const layers = [
            layer("water", null),
            layer("western-water", "water"),
            layer("western-water-north", "western-water"),
            layer("roads", null),
        ];
        expect(getDescendantLayerIds(layers, "water").sort()).toEqual(
            ["western-water", "western-water-north"].sort(),
        );
    });
});

function membership(
    id: string,
    layerId: string,
    visible: boolean,
): WorkspaceMembership {
    return {
        id,
        featureId: `f-${id}`,
        layerId,
        order: 0,
        styleOverride: {},
        visible,
    };
}

describe("computeLayerCheckboxState", () => {
    const layers = [layer("water", null), layer("western-water", "water")];

    it("is unchecked when the subtree has no memberships", () => {
        expect(computeLayerCheckboxState(layers, [], "water")).toBe(
            "unchecked",
        );
    });

    it("is checked when every membership in the subtree is visible", () => {
        const memberships = [membership("m1", "western-water", true)];
        expect(computeLayerCheckboxState(layers, memberships, "water")).toBe(
            "checked",
        );
    });

    it("is indeterminate when only some memberships in the subtree are visible", () => {
        const memberships = [
            membership("m1", "western-water", true),
            membership("m2", "water", false),
        ];
        expect(computeLayerCheckboxState(layers, memberships, "water")).toBe(
            "indeterminate",
        );
    });
});

describe("getPrecedenceOrderedLayerIds", () => {
    it("orders depth-first by sibling order, parent before children", () => {
        const layers = [
            layer("river", null, 1),
            layer("water", null, 0),
            layer("western-water", "water", 0),
            layer("eastern-water", "water", 1),
        ];
        expect(getPrecedenceOrderedLayerIds(layers)).toEqual([
            "water",
            "western-water",
            "eastern-water",
            "river",
        ]);
    });
});

describe("computeReorderedSiblingIds", () => {
    it("moves the active id to the position of the over id", () => {
        expect(computeReorderedSiblingIds(["a", "b", "c"], "a", "c")).toEqual([
            "b",
            "c",
            "a",
        ]);
    });

    it("returns the original order unchanged if either id is missing", () => {
        expect(computeReorderedSiblingIds(["a", "b"], "a", "z")).toEqual([
            "a",
            "b",
        ]);
    });
});
