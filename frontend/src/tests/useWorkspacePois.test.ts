import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { useWorkspacePois } from "@/hooks/useWorkspacePois";
import { useWorkspaceStore } from "@/store/workspaceStore";

type WorkspaceFeature = ReturnType<
    typeof useWorkspaceStore.getState
>["features"][number];

function createMockFeature(
    overrides: Partial<WorkspaceFeature> &
        Pick<WorkspaceFeature, "id" | "geometry">,
): WorkspaceFeature {
    return {
        name: "Test Feature",
        type: "point",
        properties: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        inEffect: true,
        bufferEnabled: false,
        bufferDistanceM: 100,
        rules: {},
        ...overrides,
    } as WorkspaceFeature;
}

describe("useWorkspacePois", () => {
    beforeEach(() => {
        useWorkspaceStore.setState({ features: [] });
    });

    it("returns an empty array when no features exist in the store", () => {
        const { result } = renderHook(() => useWorkspacePois());
        expect(result.current).toEqual([]);
    });

    it("filters out non-Point geometries and correctly maps Point features to POIs", () => {
        useWorkspaceStore.setState({
            features: [
                createMockFeature({
                    id: "poi-1",
                    name: "Test 1",
                    geometry: {
                        type: "Point",
                        coordinates: [31.05, -24.3],
                    },
                }),
                createMockFeature({
                    id: "line-1",
                    name: "Test 2",
                    geometry: {
                        type: "LineString",
                        coordinates: [
                            [31.0, -24.0],
                            [31.1, -24.1],
                        ],
                    },
                }),
                createMockFeature({
                    id: "poly-1",
                    name: "Test 3",
                    geometry: {
                        type: "Polygon",
                        coordinates: [
                            [
                                [31.0, -24.0],
                                [31.1, -24.0],
                                [31.1, -24.1],
                                [31.0, -24.0],
                            ],
                        ],
                    },
                }),
            ],
        });

        const { result } = renderHook(() => useWorkspacePois());

        expect(result.current).toHaveLength(1);
        expect(result.current[0]).toEqual({
            id: "poi-1",
            name: "Test 1",
            lat: -24.3,
            lon: 31.05,
        });
    });

    it("defaults name to 'Unnamed' when feature name is missing or empty string", () => {
        useWorkspaceStore.setState({
            features: [
                createMockFeature({
                    id: "poi-no-name",
                    name: undefined,
                    geometry: {
                        type: "Point",
                        coordinates: [30.5, -25.0],
                    },
                }),
                createMockFeature({
                    id: "poi-empty-name",
                    name: "",
                    geometry: {
                        type: "Point",
                        coordinates: [30.6, -25.1],
                    },
                }),
            ],
        });

        const { result } = renderHook(() => useWorkspacePois());

        expect(result.current).toEqual([
            {
                id: "poi-no-name",
                name: "Unnamed",
                lat: -25.0,
                lon: 30.5,
            },
            {
                id: "poi-empty-name",
                name: "Unnamed",
                lat: -25.1,
                lon: 30.6,
            },
        ]);
    });

    it("updates reactively when workspace store features change", () => {
        const { result } = renderHook(() => useWorkspacePois());
        expect(result.current).toEqual([]);

        act(() => {
            useWorkspaceStore.setState({
                features: [
                    createMockFeature({
                        id: "poi-2",
                        name: "Waterhole 1",
                        geometry: {
                            type: "Point",
                            coordinates: [31.2, -24.5],
                        },
                    }),
                ],
            });
        });

        expect(result.current).toEqual([
            {
                id: "poi-2",
                name: "Waterhole 1",
                lat: -24.5,
                lon: 31.2,
            },
        ]);
    });
});
