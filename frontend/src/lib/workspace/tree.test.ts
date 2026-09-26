import { describe, it, expect } from "vitest";
import {
    wouldCreateCycle,
    getDescendantLayerIds,
    computeLayerCheckboxState,
    getPrecedenceOrderedLayerIds,
    computeReorderedSiblingIds,
    computeLayerInEffectState,
} from "./tree";
import type {
    WorkspaceFeature,
    WorkspaceLayer,
    WorkspaceMembership,
} from "./types";

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

describe("computeLayerInEffectState", () => {
    const layers: WorkspaceLayer[] = [
        { id: "water", parentId: null, order: 0, defaultStyle: {} },
        { id: "western", parentId: "water", order: 0, defaultStyle: {} },
        { id: "empty", parentId: null, order: 1, defaultStyle: {} },
    ];
    const feature = (id: string, inEffect: boolean): WorkspaceFeature => ({
        id,
        type: "point",
        geometry: { type: "Point", coordinates: [0, 0] },
        createdAt: "now",
        updatedAt: "now",
        inEffect,
        bufferEnabled: false,
        bufferDistanceM: 100,
    });
    const membership = (
        id: string,
        featureId: string,
        layerId: string,
    ): WorkspaceMembership => ({
        id,
        featureId,
        layerId,
        order: 0,
        styleOverride: {},
        visible: true,
    });

    it("is empty for a layer with no features anywhere below it", () => {
        expect(computeLayerInEffectState(layers, [], [], "empty")).toBe(
            "empty",
        );
    });

    it("is disabled only when every feature in the subtree is out of effect", () => {
        const features = [feature("a", false), feature("b", false)];
        const memberships = [
            membership("m1", "a", "water"),
            membership("m2", "b", "western"),
        ];
        expect(
            computeLayerInEffectState(layers, memberships, features, "water"),
        ).toBe("disabled");
    });

    it("is mixed when some features are in effect and some are not", () => {
        const features = [feature("a", false), feature("b", true)];
        const memberships = [
            membership("m1", "a", "water"),
            membership("m2", "b", "western"),
        ];
        expect(
            computeLayerInEffectState(layers, memberships, features, "water"),
        ).toBe("mixed");
    });

    it("is enabled when every feature in the subtree is in effect", () => {
        const features = [feature("a", true)];
        const memberships = [membership("m1", "a", "western")];
        expect(
            computeLayerInEffectState(layers, memberships, features, "water"),
        ).toBe("enabled");
    });

    it("counts a feature shared with another layer once", () => {
        const features = [feature("a", false)];
        const memberships = [
            membership("m1", "a", "water"),
            membership("m2", "a", "western"),
        ];
        expect(
            computeLayerInEffectState(layers, memberships, features, "water"),
        ).toBe("disabled");
    });
});
