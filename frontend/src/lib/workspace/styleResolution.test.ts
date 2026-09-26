import { describe, it, expect } from "vitest";
import {
    resolveBufferAppearance,
    resolveLayerChainStyle,
    resolveMembershipStyle,
} from "./styleResolution";
import { APPLICATION_DEFAULT_STYLE, DEFAULT_BUFFER_OPACITY } from "./types";
import type { WorkspaceLayer, WorkspaceMembership } from "./types";

const water: WorkspaceLayer = {
    id: "water",
    name: "Water",
    parentId: null,
    order: 0,
    defaultStyle: { colour: "#2563eb", opacity: 0.8 },
};
const westernWater: WorkspaceLayer = {
    id: "western-water",
    name: "Western water",
    parentId: "water",
    order: 0,
    defaultStyle: { colour: "#0ea5e9" },
};

describe("resolveLayerChainStyle", () => {
    it("falls back to the application default when no layer sets a property", () => {
        const root: WorkspaceLayer = {
            id: "empty",
            name: "Empty",
            parentId: null,
            order: 0,
            defaultStyle: {},
        };
        expect(resolveLayerChainStyle([root], "empty")).toEqual(
            APPLICATION_DEFAULT_STYLE,
        );
    });

    it("lets a nested layer override only the properties it sets, inheriting the rest", () => {
        const style = resolveLayerChainStyle(
            [water, westernWater],
            "western-water",
        );
        expect(style.colour).toBe("#0ea5e9");
        expect(style.opacity).toBe(0.8);
    });
});

describe("resolveMembershipStyle", () => {
    it("lets a membership override win over every layer default", () => {
        const membership: WorkspaceMembership = {
            id: "m1",
            featureId: "f1",
            layerId: "western-water",
            order: 0,
            styleOverride: { colour: "#dc2626" },
            visible: true,
        };
        const style = resolveMembershipStyle([water, westernWater], membership);
        expect(style.colour).toBe("#dc2626");
        expect(style.opacity).toBe(0.8);
    });
});

describe("resolveBufferAppearance", () => {
    it("falls back to the feature colour and the default buffer opacity", () => {
        const style = resolveLayerChainStyle([water], "water");
        expect(resolveBufferAppearance(style)).toEqual({
            colour: "#2563eb",
            opacity: DEFAULT_BUFFER_OPACITY,
        });
    });

    it("uses an explicit buffer colour and opacity when the cascade sets them", () => {
        const bufferedWater: WorkspaceLayer = {
            ...water,
            defaultStyle: {
                ...water.defaultStyle,
                bufferColour: "#22c55e",
                bufferOpacity: 0.6,
            },
        };
        const style = resolveLayerChainStyle([bufferedWater], "water");
        expect(resolveBufferAppearance(style)).toEqual({
            colour: "#22c55e",
            opacity: 0.6,
        });
    });

    it("lets a membership override the layer's buffer opacity", () => {
        const membership: WorkspaceMembership = {
            id: "m1",
            featureId: "f1",
            layerId: "water",
            order: 0,
            styleOverride: { bufferOpacity: 0.9 },
            visible: true,
        };
        const style = resolveMembershipStyle([water], membership);
        expect(resolveBufferAppearance(style).opacity).toBe(0.9);
    });
});
