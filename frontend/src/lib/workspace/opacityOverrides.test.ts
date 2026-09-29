import { describe, it, expect } from "vitest";

import { applyOpacityOverrides } from "./opacityOverrides";
import type { ResolvedFeature } from "./resolveVisibleFeatures";
import type { FeatureStyle, WorkspaceFeature } from "./types";
import { DEFAULT_BUFFER_OPACITY } from "./types";

function makeFeature(id: string): WorkspaceFeature {
    return {
        id,
        type: "point",
        geometry: { type: "Point", coordinates: [0, 0] },
        createdAt: "now",
        updatedAt: "now",
        inEffect: true,
        bufferEnabled: false,
        bufferDistanceM: 100,
        rules: {},
    };
}

function makeResolved(
    membershipId: string,
    layerId: string,
    opacity = 1,
    style: Partial<FeatureStyle> = {},
): ResolvedFeature {
    return {
        feature: makeFeature(`feature-${membershipId}`),
        membershipId,
        layerId,
        z: 0,
        style: { colour: "#000000", opacity, ...style },
    };
}

describe("applyOpacityOverrides", () => {
    it("returns the input unchanged when there are no overrides", () => {
        const resolved = [makeResolved("m1", "layer-a")];

        expect(applyOpacityOverrides(resolved, [])).toEqual(resolved);
    });

    it("applies a layer override to every feature resolved under that layer", () => {
        const resolved = [
            makeResolved("m1", "layer-a"),
            makeResolved("m2", "layer-a"),
            makeResolved("m3", "layer-b"),
        ];

        const result = applyOpacityOverrides(resolved, [
            { kind: "layer", id: "layer-a", value: 0.4 },
        ]);

        expect(result.find((r) => r.membershipId === "m1")?.style.opacity).toBe(
            0.4,
        );
        expect(result.find((r) => r.membershipId === "m2")?.style.opacity).toBe(
            0.4,
        );
        expect(result.find((r) => r.membershipId === "m3")?.style.opacity).toBe(
            1,
        );
    });

    it("keeps a previously set override applied after it is no longer the active selection", () => {
        const resolved = [
            makeResolved("m1", "layer-a"),
            makeResolved("m2", "layer-b"),
        ];

        const result = applyOpacityOverrides(resolved, [
            { kind: "layer", id: "layer-a", value: 0.4 },
            { kind: "layer", id: "layer-b", value: 0.7 },
        ]);

        expect(result.find((r) => r.membershipId === "m1")?.style.opacity).toBe(
            0.4,
        );
        expect(result.find((r) => r.membershipId === "m2")?.style.opacity).toBe(
            0.7,
        );
    });

    it("prefers a membership override over a layer override for the same feature", () => {
        const resolved = [makeResolved("m1", "layer-a")];

        const result = applyOpacityOverrides(resolved, [
            { kind: "layer", id: "layer-a", value: 0.4 },
            { kind: "membership", id: "m1", value: 0.9 },
        ]);

        expect(result[0].style.opacity).toBe(0.9);
    });

    it("fades the border, icon and label along with the fill", () => {
        const resolved = [makeResolved("m1", "layer-a")];

        const result = applyOpacityOverrides(resolved, [
            { kind: "layer", id: "layer-a", value: 0.4 },
        ]);

        expect(result[0].style).toMatchObject({
            opacity: 0.4,
            outlineOpacity: 0.4,
            iconOpacity: 0.4,
            labelOpacity: 0.4,
        });
    });

    it("scales the saved buffer opacity instead of replacing it", () => {
        const resolved = [
            makeResolved("m1", "layer-a", 1, { bufferOpacity: 0.5 }),
        ];

        const result = applyOpacityOverrides(resolved, [
            { kind: "layer", id: "layer-a", value: 0.4 },
        ]);

        expect(result[0].style.bufferOpacity).toBeCloseTo(0.2);
    });

    it("scales the buffer relative to the feature's saved fill opacity", () => {
        const resolved = [
            makeResolved("m1", "layer-a", 0.5, { bufferOpacity: 0.4 }),
            makeResolved("m2", "layer-b", 0.5, { bufferOpacity: 0.4 }),
        ];

        const result = applyOpacityOverrides(resolved, [
            { kind: "layer", id: "layer-a", value: 0.25 },
            { kind: "layer", id: "layer-b", value: 0.5 },
        ]);

        expect(result[0].style.bufferOpacity).toBeCloseTo(0.2);
        expect(result[1].style.bufferOpacity).toBeCloseTo(0.4);
    });

    it("scales the default buffer opacity when none is saved", () => {
        const resolved = [makeResolved("m1", "layer-a")];

        const result = applyOpacityOverrides(resolved, [
            { kind: "layer", id: "layer-a", value: 0.5 },
        ]);

        expect(result[0].style.bufferOpacity).toBeCloseTo(
            DEFAULT_BUFFER_OPACITY * 0.5,
        );
    });

    it("uses the slider value as the scale when the saved fill is transparent", () => {
        const resolved = [
            makeResolved("m1", "layer-a", 0, { bufferOpacity: 0.6 }),
        ];

        const result = applyOpacityOverrides(resolved, [
            { kind: "layer", id: "layer-a", value: 0.5 },
        ]);

        expect(result[0].style.bufferOpacity).toBeCloseTo(0.3);
    });

    it("never pushes the buffer opacity above 1", () => {
        const resolved = [
            makeResolved("m1", "layer-a", 0.2, { bufferOpacity: 0.8 }),
        ];

        const result = applyOpacityOverrides(resolved, [
            { kind: "layer", id: "layer-a", value: 1 },
        ]);

        expect(result[0].style.bufferOpacity).toBe(1);
    });
});
