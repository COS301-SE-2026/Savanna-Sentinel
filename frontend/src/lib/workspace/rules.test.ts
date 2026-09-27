import { describe, it, expect } from "vitest";

import {
    isValidRulePatch,
    resolveFeatureRule,
    resolveLayerRule,
} from "./rules";
import { DEFAULT_RULE } from "./types";
import type {
    FeatureRules,
    WorkspaceFeature,
    WorkspaceLayer,
    WorkspaceMembership,
} from "./types";

function layer(
    id: string,
    order: number,
    defaultRules: FeatureRules = {},
    parentId: string | null = null,
): WorkspaceLayer {
    return { id, parentId, order, defaultStyle: {}, defaultRules };
}

function feature(rules: FeatureRules = {}): WorkspaceFeature {
    return {
        id: "f",
        type: "point",
        geometry: { type: "Point", coordinates: [0, 0] },
        createdAt: "now",
        updatedAt: "now",
        inEffect: true,
        bufferEnabled: false,
        bufferDistanceM: 100,
        rules,
    };
}

function member(id: string, layerId: string, order = 0): WorkspaceMembership {
    return {
        id,
        featureId: "f",
        layerId,
        order,
        styleOverride: {},
        visible: true,
    };
}

describe("resolveFeatureRule", () => {
    it("is not defined when nothing defines the intent", () => {
        const view = resolveFeatureRule(
            [layer("water", 0)],
            [member("m", "water")],
            feature(),
            "avoid",
        );
        expect(view.defined).toBe(false);
        expect(view.enabled).toBe(false);
        expect(view.values).toEqual(DEFAULT_RULE);
    });

    it("uses the feature's own rule and marks its properties as own", () => {
        const view = resolveFeatureRule(
            [layer("water", 0)],
            [member("m", "water")],
            feature({ avoid: { strength: 0.9 } }),
            "avoid",
        );
        expect(view.enabled).toBe(true);
        expect(view.values.strength).toBe(0.9);
        expect(view.source.strength).toBe("own");
        expect(view.source.priority).toBe("default");
    });

    it("inherits from the layer and lets the feature override single properties", () => {
        const view = resolveFeatureRule(
            [layer("water", 0, { avoid: { strength: 0.8, priority: 2 } })],
            [member("m", "water")],
            feature({ avoid: { priority: 5 } }),
            "avoid",
        );
        expect(view.values.strength).toBe(0.8);
        expect(view.source.strength).toBe("inherited");
        expect(view.values.priority).toBe(5);
        expect(view.source.priority).toBe("own");
    });

    it("lets a nested layer refine its parent property by property", () => {
        const layers = [
            layer("root", 0, { avoid: { strength: 0.4 } }),
            layer("child", 0, { avoid: { priority: 3 } }, "root"),
        ];
        const view = resolveFeatureRule(
            layers,
            [member("m", "child")],
            feature(),
            "avoid",
        );
        expect(view.values.strength).toBe(0.4);
        expect(view.values.priority).toBe(3);
    });

    it("suppresses an inherited rule when the feature disables the intent", () => {
        const view = resolveFeatureRule(
            [layer("water", 0, { avoid: { strength: 1 } })],
            [member("m", "water")],
            feature({ avoid: { enabled: false } }),
            "avoid",
        );
        expect(view.defined).toBe(true);
        expect(view.enabled).toBe(false);
    });

    it("applies each intent once, from the first layer in tree order", () => {
        const layers = [
            layer("first", 0, { avoid: { strength: 0.9 } }),
            layer("second", 1, { avoid: { strength: 0.2 } }),
        ];
        const view = resolveFeatureRule(
            layers,
            [member("m2", "second"), member("m1", "first")],
            feature(),
            "avoid",
        );
        expect(view.values.strength).toBe(0.9);
    });

    it("falls through to a later layer when the first does not define the intent", () => {
        const layers = [
            layer("first", 0, { prefer: {} }),
            layer("second", 1, { avoid: { strength: 0.6 } }),
        ];
        const view = resolveFeatureRule(
            layers,
            [member("m1", "first"), member("m2", "second")],
            feature(),
            "avoid",
        );
        expect(view.values.strength).toBe(0.6);
    });

    it("treats an empty rule as defined and enabled", () => {
        const view = resolveFeatureRule(
            [layer("water", 0)],
            [member("m", "water")],
            feature({ prefer: {} }),
            "prefer",
        );
        expect(view.defined).toBe(true);
        expect(view.enabled).toBe(true);
    });
});

describe("resolveLayerRule", () => {
    it("reads the layer's own rule over its ancestors' rule", () => {
        const layers = [
            layer("root", 0, { avoid: { strength: 0.4, priority: 2 } }),
            layer("child", 0, { avoid: { strength: 0.9 } }, "root"),
        ];
        const view = resolveLayerRule(layers, "child", "avoid");
        expect(view.values.strength).toBe(0.9);
        expect(view.source.strength).toBe("own");
        expect(view.values.priority).toBe(2);
        expect(view.source.priority).toBe("inherited");
    });

    it("is not defined for a layer whose chain never defines the intent", () => {
        expect(
            resolveLayerRule([layer("root", 0)], "root", "avoid").defined,
        ).toBe(false);
    });
});

describe("isValidRulePatch", () => {
    it.each([
        [{ strength: 0.1 }, true],
        [{ strength: 1 }, true],
        [{ strength: 0.05 }, false],
        [{ strength: 1.5 }, false],
        [{ strength: Number.NaN }, false],
        [{ bufferDecay: 0 }, true],
        [{ bufferDecay: 1 }, true],
        [{ bufferDecay: -0.1 }, false],
        [{ bufferDecay: 1.1 }, false],
        [{ priority: 1 }, true],
        [{ priority: 99 }, true],
        [{ priority: 0 }, false],
        [{ priority: 100 }, false],
        [{ priority: 2.5 }, false],
        [{ enabled: false }, true],
        [{}, true],
    ])("%j is %s", (patch, expected) => {
        expect(isValidRulePatch(patch)).toBe(expected);
    });
});
