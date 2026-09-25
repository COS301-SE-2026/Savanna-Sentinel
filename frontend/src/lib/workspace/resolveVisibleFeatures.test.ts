import { describe, it, expect } from "vitest";
import {
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
