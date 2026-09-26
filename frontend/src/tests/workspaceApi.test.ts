import { setupServer } from "msw/node";
import {
    describe,
    it,
    expect,
    beforeAll,
    beforeEach,
    afterEach,
    afterAll,
} from "vitest";

import {
    fetchWorkspace,
    saveWorkspace,
    styleFromApi,
    styleToApi,
    WorkspaceConflictError,
} from "@/services/workspaceApi";
import {
    workspaceHandlers,
    workspaceState,
    resetWorkspaceMock,
} from "./mocks/workspaceHandlers";

const server = setupServer(...workspaceHandlers);

beforeAll(() => server.listen());
beforeEach(() => resetWorkspaceMock());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const FULL_STYLE = {
    colour: "#003a6b",
    opacity: 0.5,
    icon: "tent",
    iconColour: "#ffffff",
    strokeWidth: 4,
    lineDash: "dashed" as const,
    label: "Camp one",
    outlineOpacity: 0.25,
    bufferColour: "#22c55e",
    bufferOpacity: 0.3,
};

const FULL_STYLE_WIRE = {
    colour: "#003a6b",
    opacity: 0.5,
    icon: "tent",
    icon_colour: "#ffffff",
    stroke_width: 4,
    line_dash: "dashed" as const,
    label: "Camp one",
    outline_opacity: 0.25,
    buffer_colour: "#22c55e",
    buffer_opacity: 0.3,
};

describe("style mapping", () => {
    it("carries every property in both directions", () => {
        expect(styleToApi(FULL_STYLE)).toEqual(FULL_STYLE_WIRE);
        expect(styleFromApi(FULL_STYLE_WIRE)).toEqual(FULL_STYLE);
    });

    it("leaves unset properties out rather than sending null", () => {
        expect(styleToApi({ opacity: 0 })).toEqual({ opacity: 0 });
        expect(styleFromApi({})).toEqual({});
        expect(styleFromApi(null)).toEqual({});
    });

    it("drops nulls coming back from the server", () => {
        expect(
            styleFromApi({
                colour: "#003a6b",
                label: undefined,
            }),
        ).toEqual({ colour: "#003a6b" });
    });
});

describe("workspace requests", () => {
    it("reshapes a loaded workspace into the map layer types", async () => {
        workspaceState.current = {
            version: 3,
            layers: [
                {
                    id: "l1",
                    name: null,
                    parent_id: "l0",
                    order: 2,
                    default_style: { colour: "#b30000" },
                },
            ],
            features: [
                {
                    id: "f1",
                    type: "line",
                    name: "Fence",
                    geometry: {
                        type: "LineString",
                        coordinates: [
                            [31.1, -24.4],
                            [31.2, -24.5],
                        ],
                    },
                    created_at: "2026-01-01T00:00:00Z",
                    updated_at: "2026-01-02T00:00:00Z",
                },
            ],
            memberships: [
                {
                    id: "m1",
                    feature_id: "f1",
                    layer_id: "l1",
                    order: 0,
                    style_override: { stroke_width: 6 },
                    visible: false,
                },
            ],
        };

        const snapshot = await fetchWorkspace();

        expect(snapshot.version).toBe(3);
        expect(snapshot.layers[0]).toEqual({
            id: "l1",
            name: undefined,
            parentId: "l0",
            order: 2,
            defaultStyle: { colour: "#b30000" },
        });
        expect(snapshot.features[0].createdAt).toBe("2026-01-01T00:00:00Z");
        expect(snapshot.memberships[0]).toEqual({
            id: "m1",
            featureId: "f1",
            layerId: "l1",
            order: 0,
            styleOverride: { strokeWidth: 6 },
            visible: false,
        });
    });

    it("sends the snake case payload the API expects", async () => {
        await saveWorkspace(0, {
            layers: [
                {
                    id: "l1",
                    name: "Water",
                    parentId: null,
                    order: 0,
                    defaultStyle: { colour: "#0070bf" },
                },
            ],
            features: [
                {
                    id: "f1",
                    type: "point",
                    geometry: { type: "Point", coordinates: [31.1, -24.4] },
                    createdAt: "2026-01-01T00:00:00Z",
                    updatedAt: "2026-01-01T00:00:00Z",
                    inEffect: true,
                    bufferEnabled: false,
                    bufferDistanceM: 100,
                },
            ],
            memberships: [
                {
                    id: "m1",
                    featureId: "f1",
                    layerId: "l1",
                    order: 0,
                    styleOverride: { iconColour: "#ffffff" },
                    visible: true,
                },
            ],
        });

        const sent = workspaceState.saveCalls[0];
        expect(sent.base_version).toBe(0);
        expect(sent.layers).toEqual([
            {
                id: "l1",
                name: "Water",
                parent_id: null,
                order: 0,
                default_style: { colour: "#0070bf" },
            },
        ]);
        expect(sent.features[0]).toMatchObject({
            id: "f1",
            type: "point",
            name: null,
            created_at: "2026-01-01T00:00:00Z",
        });
        expect(sent.memberships[0]).toEqual({
            id: "m1",
            feature_id: "f1",
            layer_id: "l1",
            order: 0,
            style_override: { icon_colour: "#ffffff" },
            visible: true,
        });
    });

    it("turns a 409 into a conflict error carrying the current version", async () => {
        workspaceState.current = { ...workspaceState.current, version: 7 };

        await expect(
            saveWorkspace(2, { layers: [], features: [], memberships: [] }),
        ).rejects.toMatchObject({
            name: "WorkspaceConflictError",
            currentVersion: 7,
        });
    });

    it("lets other failures through untouched", async () => {
        workspaceState.failSave = true;

        await expect(
            saveWorkspace(0, { layers: [], features: [], memberships: [] }),
        ).rejects.not.toBeInstanceOf(WorkspaceConflictError);
    });
});

describe("feature buffer and in-effect mapping", () => {
    it("sends and restores in_effect, buffer_enabled and buffer_distance_m", async () => {
        const featureId = "11111111-1111-4111-8111-111111111111";
        const layerId = "22222222-2222-4222-8222-222222222222";
        const membershipId = "33333333-3333-4333-8333-333333333333";

        const saved = await saveWorkspace(0, {
            layers: [
                {
                    id: layerId,
                    parentId: null,
                    order: 0,
                    defaultStyle: {},
                },
            ],
            features: [
                {
                    id: featureId,
                    type: "point",
                    geometry: { type: "Point", coordinates: [1, 2] },
                    createdAt: "2026-01-01T00:00:00Z",
                    updatedAt: "2026-01-01T00:00:00Z",
                    inEffect: false,
                    bufferEnabled: true,
                    bufferDistanceM: 250,
                },
            ],
            memberships: [
                {
                    id: membershipId,
                    featureId,
                    layerId,
                    order: 0,
                    styleOverride: {},
                    visible: true,
                },
            ],
        });

        expect(workspaceState.saveCalls[0].features[0]).toMatchObject({
            in_effect: false,
            buffer_enabled: true,
            buffer_distance_m: 250,
        });
        expect(saved.features[0]).toMatchObject({
            inEffect: false,
            bufferEnabled: true,
            bufferDistanceM: 250,
        });

        const fetched = await fetchWorkspace();
        expect(fetched.features[0]).toMatchObject({
            inEffect: false,
            bufferEnabled: true,
            bufferDistanceM: 250,
        });
    });
});
