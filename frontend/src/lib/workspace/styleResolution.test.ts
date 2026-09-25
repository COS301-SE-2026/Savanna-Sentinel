import { describe, it, expect } from "vitest";
import {
    resolveLayerChainStyle,
    resolveMembershipStyle,
} from "./styleResolution";
import { APPLICATION_DEFAULT_STYLE } from "./types";
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
