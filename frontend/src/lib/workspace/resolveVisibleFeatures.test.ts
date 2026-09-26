import { describe, it, expect } from "vitest";
import {
    getStackedLayerIds,
    resolveVisibleFeatures,
    toWorkspaceFeatureCollections,
} from "./resolveVisibleFeatures";
import type {
    WorkspaceFeature,
    WorkspaceLayer,
    WorkspaceMembership,
} from "./types";

const water: WorkspaceLayer = {
    id: "water",
    name: "Water",
    parentId: null,
    order: 0,
    defaultStyle: { colour: "#2563eb" },
};
const river: WorkspaceLayer = {
    id: "river",
    name: "River",
    parentId: null,
    order: 1,
    defaultStyle: { colour: "#16a34a" },
};

const dam: WorkspaceFeature = {
    id: "dam",
    type: "point",
    geometry: { type: "Point", coordinates: [1, 2] },
    createdAt: "now",
    updatedAt: "now",
    inEffect: true,
    bufferEnabled: false,
    bufferDistanceM: 100,
};

const fence: WorkspaceFeature = {
    id: "fence",
    type: "line",
    geometry: {
        type: "LineString",
        coordinates: [
            [0, 0],
            [10, 0],
        ],
    },
    createdAt: "now",
    updatedAt: "now",
    inEffect: true,
    bufferEnabled: false,
    bufferDistanceM: 100,
};

const zone: WorkspaceFeature = {
    id: "zone",
    type: "polygon",
    geometry: {
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
    },
    createdAt: "now",
    updatedAt: "now",
    inEffect: true,
    bufferEnabled: false,
    bufferDistanceM: 100,
};

describe("resolveVisibleFeatures", () => {
    it("omits a feature whose every membership is hidden", () => {
        const memberships: WorkspaceMembership[] = [
            {
                id: "m1",
                featureId: "dam",
                layerId: "water",
                order: 0,
                styleOverride: {},
                visible: false,
            },
        ];
        expect(resolveVisibleFeatures([water], [dam], memberships)).toEqual([]);
    });

    it("shows a feature visible via at least one membership", () => {
        const memberships: WorkspaceMembership[] = [
            {
                id: "m1",
                featureId: "dam",
                layerId: "water",
                order: 0,
                styleOverride: {},
                visible: true,
            },
        ];
        const resolved = resolveVisibleFeatures([water], [dam], memberships);
        expect(resolved).toHaveLength(1);
        expect(resolved[0].feature.id).toBe("dam");
        expect(resolved[0].style.colour).toBe("#2563eb");
    });

    it("picks the style of the first visible membership in tree precedence order", () => {
        const memberships: WorkspaceMembership[] = [
            {
                id: "m-river",
                featureId: "dam",
                layerId: "river",
                order: 0,
                styleOverride: {},
                visible: true,
            },
            {
                id: "m-water",
                featureId: "dam",
                layerId: "water",
                order: 0,
                styleOverride: {},
                visible: true,
            },
        ];
        const resolved = resolveVisibleFeatures(
            [water, river],
            [dam],
            memberships,
        );
        expect(resolved).toHaveLength(1);
        expect(resolved[0].style.colour).toBe("#2563eb");
    });
});

describe("toWorkspaceFeatureCollections", () => {
    it("groups resolved features into a collection per geometry type with baked style properties", () => {
        const collections = toWorkspaceFeatureCollections([
            {
                feature: dam,
                membershipId: "m",
                layerId: "water",
                z: 0,
                style: { colour: "#2563eb", opacity: 0.8, icon: "droplet" },
            },
        ]);
        expect(collections.points.features).toHaveLength(1);
        expect(collections.lines.features).toHaveLength(0);
        expect(collections.polygons.features).toHaveLength(0);
        expect(collections.points.features[0].properties).toMatchObject({
            id: "dam",
            colour: "#2563eb",
            opacity: 0.8,
            icon: "droplet",
        });
    });

    it("falls back to a fully opaque outline when the style doesn't set one", () => {
        const collections = toWorkspaceFeatureCollections([
            {
                feature: zone,
                membershipId: "m",
                layerId: "water",
                z: 0,
                style: { colour: "#2563eb", opacity: 0.2 },
            },
        ]);
        expect(collections.polygons.features[0].properties).toMatchObject({
            outlineOpacity: 1,
        });
    });

    it("carries an explicit outline opacity through, independent of the fill opacity", () => {
        const collections = toWorkspaceFeatureCollections([
            {
                feature: zone,
                membershipId: "m",
                layerId: "water",
                z: 0,
                style: { colour: "#2563eb", opacity: 0.2, outlineOpacity: 0.9 },
            },
        ]);
        expect(collections.polygons.features[0].properties).toMatchObject({
            opacity: 0.2,
            outlineOpacity: 0.9,
        });
    });

    it("falls back to the baseline icon colour when the style doesn't set one", () => {
        const collections = toWorkspaceFeatureCollections([
            {
                feature: dam,
                membershipId: "m",
                layerId: "water",
                z: 0,
                style: { colour: "#2563eb", opacity: 0.8 },
            },
        ]);
        expect(collections.points.features[0].properties).toMatchObject({
            iconColour: "#1f2937",
        });
    });

    it("carries an explicit icon colour through to the feature's properties", () => {
        const collections = toWorkspaceFeatureCollections([
            {
                feature: dam,
                membershipId: "m",
                layerId: "water",
                z: 0,
                style: {
                    colour: "#2563eb",
                    opacity: 0.8,
                    iconColour: "#ffffff",
                },
            },
        ]);
        expect(collections.points.features[0].properties).toMatchObject({
            iconColour: "#ffffff",
        });
    });

    it("adds a single-point icon anchor for a line feature, carrying the same properties", () => {
        const collections = toWorkspaceFeatureCollections([
            {
                feature: fence,
                membershipId: "m",
                layerId: "water",
                z: 0,
                style: {
                    colour: "#2563eb",
                    opacity: 1,
                    icon: "fence",
                    label: "North fence",
                },
            },
        ]);
        expect(collections.lines.features).toHaveLength(1);
        expect(collections.lineIcons.features).toHaveLength(1);
        expect(collections.lineIcons.features[0].geometry).toEqual({
            type: "Point",
            coordinates: [5, 0],
        });
        expect(collections.lineIcons.features[0].properties).toMatchObject({
            id: "fence",
            icon: "fence",
            label: "North fence",
        });
    });

    it("adds a single-point icon anchor for a polygon feature, carrying the same properties", () => {
        const collections = toWorkspaceFeatureCollections([
            {
                feature: zone,
                membershipId: "m",
                layerId: "water",
                z: 0,
                style: {
                    colour: "#2563eb",
                    opacity: 1,
                    icon: "flag",
                    label: "No-go zone",
                },
            },
        ]);
        expect(collections.polygons.features).toHaveLength(1);
        expect(collections.polygonIcons.features).toHaveLength(1);
        const [x, y] = (
            collections.polygonIcons.features[0].geometry as GeoJSON.Point
        ).coordinates;
        expect(x).toBeCloseTo(5);
        expect(y).toBeCloseTo(5);
        expect(collections.polygonIcons.features[0].properties).toMatchObject({
            id: "zone",
            icon: "flag",
            label: "No-go zone",
        });
    });
});

describe("stacking order", () => {
    const top: WorkspaceLayer = {
        id: "top",
        parentId: null,
        order: 0,
        defaultStyle: {},
    };
    const topChild: WorkspaceLayer = {
        id: "top-child",
        parentId: "top",
        order: 0,
        defaultStyle: {},
    };
    const bottom: WorkspaceLayer = {
        id: "bottom",
        parentId: null,
        order: 1,
        defaultStyle: {},
    };

    function member(
        featureId: string,
        layerId: string,
        order = 0,
        visible = true,
    ): WorkspaceMembership {
        return {
            id: `m-${featureId}-${layerId}`,
            featureId,
            layerId,
            order,
            styleOverride: {},
            visible,
        };
    }

    function pointFeature(id: string): WorkspaceFeature {
        return { ...dam, id };
    }

    function zById(resolved: ReturnType<typeof resolveVisibleFeatures>) {
        return Object.fromEntries(resolved.map((r) => [r.feature.id, r.z]));
    }

    it("stacks a higher layer's feature above a lower layer's, whatever order the features are stored in", () => {
        const layers = [top, bottom];
        const memberships = [member("hi", "top"), member("lo", "bottom")];
        for (const features of [
            [pointFeature("hi"), pointFeature("lo")],
            [pointFeature("lo"), pointFeature("hi")],
        ]) {
            const z = zById(
                resolveVisibleFeatures(layers, features, memberships),
            );
            expect(z.hi).toBeGreaterThan(z.lo);
        }
    });

    it("stacks a higher-listed feature within a layer above the ones listed after it", () => {
        const memberships = [
            member("first", "top", 0),
            member("second", "top", 1),
        ];
        const z = zById(
            resolveVisibleFeatures(
                [top],
                [pointFeature("second"), pointFeature("first")],
                memberships,
            ),
        );
        expect(z.first).toBeGreaterThan(z.second);
    });

    it("stacks a polygon in a higher layer above a point and a line in a lower layer", () => {
        const memberships = [
            member("zone", "top"),
            member("dam", "bottom"),
            member("fence", "bottom"),
        ];
        const z = zById(
            resolveVisibleFeatures(
                [top, bottom],
                [dam, fence, zone],
                memberships,
            ),
        );
        expect(z.zone).toBeGreaterThan(z.dam);
        expect(z.zone).toBeGreaterThan(z.fence);
    });

    it("stacks points above lines above polygons inside one layer", () => {
        const memberships = [
            member("dam", "top", 2),
            member("fence", "top", 1),
            member("zone", "top", 0),
        ];
        const z = zById(
            resolveVisibleFeatures([top], [zone, fence, dam], memberships),
        );
        expect(z.dam).toBeGreaterThan(z.fence);
        expect(z.fence).toBeGreaterThan(z.zone);
    });

    it("stacks a parent layer's features above its child layer's, and the child above the next sibling's", () => {
        const memberships = [
            member("parent", "top"),
            member("child", "top-child"),
            member("sibling", "bottom"),
        ];
        const z = zById(
            resolveVisibleFeatures(
                [top, topChild, bottom],
                [
                    pointFeature("sibling"),
                    pointFeature("child"),
                    pointFeature("parent"),
                ],
                memberships,
            ),
        );
        expect(z.parent).toBeGreaterThan(z.child);
        expect(z.child).toBeGreaterThan(z.sibling);
    });

    it("keeps the same stacking after a layer is hidden and shown again", () => {
        const layers = [top, bottom];
        const features = [pointFeature("lo"), pointFeature("hi")];
        const shown = [member("hi", "top"), member("lo", "bottom")];
        const hidden = [member("hi", "top", 0, false), member("lo", "bottom")];

        const before = resolveVisibleFeatures(layers, features, shown);
        const during = resolveVisibleFeatures(layers, features, hidden);
        const after = resolveVisibleFeatures(layers, features, shown);

        expect(during.map((r) => r.feature.id)).toEqual(["lo"]);
        expect(after).toEqual(before);
    });

    it("lists resolved features bottom first and reports the layer that owns each", () => {
        const resolved = resolveVisibleFeatures(
            [top, bottom],
            [pointFeature("hi"), pointFeature("lo")],
            [member("hi", "top"), member("lo", "bottom")],
        );
        expect(resolved.map((r) => r.feature.id)).toEqual(["lo", "hi"]);
        expect(resolved.map((r) => r.layerId)).toEqual(["bottom", "top"]);
        expect(getStackedLayerIds(resolved)).toEqual(["bottom", "top"]);
    });

    it("bakes the owning layer and stacking position into the feature properties", () => {
        const resolved = resolveVisibleFeatures(
            [top, bottom],
            [pointFeature("hi"), pointFeature("lo")],
            [member("hi", "top"), member("lo", "bottom")],
        );
        const { points } = toWorkspaceFeatureCollections(resolved);
        const byId = Object.fromEntries(
            points.features.map((f) => [f.properties?.id, f.properties]),
        );
        expect(byId.hi).toMatchObject({ layerId: "top" });
        expect(byId.hi.z).toBeGreaterThan(byId.lo.z);
    });
});

describe("toWorkspaceFeatureCollections buffers", () => {
    const membership: WorkspaceMembership = {
        id: "m-dam",
        featureId: "dam",
        layerId: "water",
        order: 0,
        styleOverride: {},
        visible: true,
    };

    it("puts no feature in the buffers collection while the buffer is off", () => {
        const resolved = resolveVisibleFeatures([water], [dam], [membership]);
        expect(
            toWorkspaceFeatureCollections(resolved, "dam").buffers.features,
        ).toHaveLength(0);
    });

    it("draws the buffer only for the selected feature", () => {
        const buffered: WorkspaceFeature = {
            ...dam,
            bufferEnabled: true,
            bufferDistanceM: 500,
        };
        const resolved = resolveVisibleFeatures(
            [water],
            [buffered],
            [membership],
        );
        expect(
            toWorkspaceFeatureCollections(resolved).buffers.features,
        ).toHaveLength(0);
        expect(
            toWorkspaceFeatureCollections(resolved, "other").buffers.features,
        ).toHaveLength(0);
        expect(
            toWorkspaceFeatureCollections(resolved, "dam").buffers.features,
        ).toHaveLength(1);
    });

    it("adds a polygon per feature with the buffer on, using the buffer appearance", () => {
        const buffered: WorkspaceFeature = {
            ...dam,
            bufferEnabled: true,
            bufferDistanceM: 500,
        };
        const bufferedWater: WorkspaceLayer = {
            ...water,
            defaultStyle: { colour: "#2563eb", bufferOpacity: 0.5 },
        };
        const resolved = resolveVisibleFeatures(
            [bufferedWater],
            [buffered],
            [membership],
        );
        const { buffers } = toWorkspaceFeatureCollections(resolved, "dam");
        expect(buffers.features).toHaveLength(1);
        expect(buffers.features[0].geometry.type).toBe("Polygon");
        expect(buffers.features[0].properties).toEqual({
            id: "dam",
            colour: "#2563eb",
            opacity: 0.5,
        });
    });

    it("still draws the buffer for a feature that is not in effect", () => {
        const outOfEffect: WorkspaceFeature = {
            ...dam,
            inEffect: false,
            bufferEnabled: true,
            bufferDistanceM: 500,
        };
        const resolved = resolveVisibleFeatures(
            [water],
            [outOfEffect],
            [membership],
        );
        expect(
            toWorkspaceFeatureCollections(resolved, "dam").buffers.features,
        ).toHaveLength(1);
    });
});
