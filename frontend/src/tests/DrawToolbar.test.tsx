import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("maplibre-gl", async () => {
    const { createMapLibreMock } = await import("./mocks/maplibreMock");
    return createMapLibreMock();
});
vi.mock("terra-draw", async () => {
    const { createTerraDrawMock } = await import("./mocks/terraDrawMock");
    return createTerraDrawMock();
});
vi.mock("terra-draw-maplibre-gl-adapter", async () => {
    const { createTerraDrawAdapterMock } =
        await import("./mocks/terraDrawMock");
    return createTerraDrawAdapterMock();
});

import * as maplibregl from "maplibre-gl";
import {
    TerraDrawFreehandMode,
    TerraDrawFreehandLineStringMode,
    TerraDrawLineStringMode,
    TerraDrawPolygonMode,
} from "terra-draw";
import type { FakeMap } from "./mocks/maplibreMock";
import { DrawToolbar } from "@/components/workspace/DrawToolbar";
import {
    useWorkspaceStore,
    initialWorkspaceState,
} from "@/store/workspaceStore";

afterEach(() => {
    useWorkspaceStore.setState(initialWorkspaceState, true);
});

function makeMap(): FakeMap {
    return new maplibregl.Map({
        container: document.createElement("div"),
    }) as unknown as FakeMap;
}

describe("DrawToolbar", () => {
    it("creates a new workspace feature when terra-draw finishes a fresh drawing", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);

        const map = makeMap();
        const { container } = render(
            <DrawToolbar
                map={map as never}
                activeLayerId={waterId}
                editingFeature={null}
                onEditingFeatureHandled={() => {}}
                finishEditSignal={0}
                cancelEditSignal={0}
            />,
        );

        const instance = getLastTerraDrawInstance(container);
        instance.setSnapshotFeature({
            id: "terra-1",
            type: "Feature",
            geometry: { type: "Point", coordinates: [1, 2] },
            properties: {},
        });
        instance.fireFinish("terra-1", { action: "draw", mode: "point" });

        const state = useWorkspaceStore.getState();
        expect(state.features).toHaveLength(1);
        expect(state.features[0].type).toBe("point");
        expect(state.memberships[0].layerId).toBe(waterId);
    });

    it("switches to the select tool and selects the new feature after finishing a drawing", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);

        const map = makeMap();
        const onFeatureDrawn = vi.fn();
        const { container } = render(
            <DrawToolbar
                map={map as never}
                activeLayerId={waterId}
                editingFeature={null}
                onEditingFeatureHandled={() => {}}
                finishEditSignal={0}
                cancelEditSignal={0}
                onFeatureDrawn={onFeatureDrawn}
            />,
        );

        const instance = getLastTerraDrawInstance(container);
        instance.setSnapshotFeature({
            id: "terra-1",
            type: "Feature",
            geometry: { type: "Point", coordinates: [1, 2] },
            properties: {},
        });
        instance.fireFinish("terra-1", { action: "draw", mode: "point" });

        const state = useWorkspaceStore.getState();
        expect(instance.setMode).toHaveBeenCalledWith("select");
        expect(onFeatureDrawn).toHaveBeenCalledWith(state.memberships[0].id);
        expect(
            await screen.findByRole("button", { name: "Select" }),
        ).toHaveAttribute("aria-pressed", "true");
    });

    it("keeps editing active across multiple drags without exiting edit mode", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        const created = useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] });

        const map = makeMap();
        const onEditingFeatureHandled = vi.fn();
        const { container } = render(
            <DrawToolbar
                map={map as never}
                activeLayerId={waterId}
                editingFeature={{
                    id: created!.featureId,
                    type: "point",
                    geometry: { type: "Point", coordinates: [0, 0] },
                    createdAt: "now",
                    updatedAt: "now",
                }}
                onEditingFeatureHandled={onEditingFeatureHandled}
                finishEditSignal={0}
                cancelEditSignal={0}
            />,
        );

        const instance = getLastTerraDrawInstance(container);
        instance.setSnapshotFeature({
            id: created!.featureId,
            type: "Feature",
            geometry: { type: "Point", coordinates: [9, 9] },
            properties: {},
        });
        instance.fireFinish(created!.featureId, {
            action: "dragCoordinate",
            mode: "point",
        });

        expect(useWorkspaceStore.getState().features[0].geometry).toEqual({
            type: "Point",
            coordinates: [9, 9],
        });
        expect(onEditingFeatureHandled).not.toHaveBeenCalled();
        expect(instance.removeFeatures).not.toHaveBeenCalled();

        instance.setSnapshotFeature({
            id: created!.featureId,
            type: "Feature",
            geometry: { type: "Point", coordinates: [3, 4] },
            properties: {},
        });
        instance.fireFinish(created!.featureId, {
            action: "dragCoordinate",
            mode: "point",
        });

        expect(useWorkspaceStore.getState().features[0].geometry).toEqual({
            type: "Point",
            coordinates: [3, 4],
        });
        expect(onEditingFeatureHandled).not.toHaveBeenCalled();
    });

    it("finishes editing on Enter key press", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        const created = useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] });

        const map = makeMap();
        const onEditingFeatureHandled = vi.fn();
        const { container } = render(
            <DrawToolbar
                map={map as never}
                activeLayerId={waterId}
                editingFeature={{
                    id: created!.featureId,
                    type: "point",
                    geometry: { type: "Point", coordinates: [0, 0] },
                    createdAt: "now",
                    updatedAt: "now",
                }}
                onEditingFeatureHandled={onEditingFeatureHandled}
                finishEditSignal={0}
                cancelEditSignal={0}
            />,
        );
        const instance = getLastTerraDrawInstance(container);

        await userEvent.keyboard("{Enter}");

        expect(instance.deselectFeature).toHaveBeenCalledWith(
            created!.featureId,
        );
        expect(instance.removeFeatures).toHaveBeenCalledWith([
            created!.featureId,
        ]);
        expect(instance.setMode).toHaveBeenCalledWith("select");
        expect(onEditingFeatureHandled).toHaveBeenCalled();
    });

    it("reverts to the pre-edit geometry and exits editing on Escape key press", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        const created = useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] });

        const map = makeMap();
        const onEditingFeatureHandled = vi.fn();
        const { container } = render(
            <DrawToolbar
                map={map as never}
                activeLayerId={waterId}
                editingFeature={{
                    id: created!.featureId,
                    type: "point",
                    geometry: { type: "Point", coordinates: [0, 0] },
                    createdAt: "now",
                    updatedAt: "now",
                }}
                onEditingFeatureHandled={onEditingFeatureHandled}
                finishEditSignal={0}
                cancelEditSignal={0}
            />,
        );
        const instance = getLastTerraDrawInstance(container);

        instance.setSnapshotFeature({
            id: created!.featureId,
            type: "Feature",
            geometry: { type: "Point", coordinates: [9, 9] },
            properties: {},
        });
        instance.fireFinish(created!.featureId, {
            action: "dragCoordinate",
            mode: "point",
        });
        expect(useWorkspaceStore.getState().features[0].geometry).toEqual({
            type: "Point",
            coordinates: [9, 9],
        });

        await userEvent.keyboard("{Escape}");

        expect(useWorkspaceStore.getState().features[0].geometry).toEqual({
            type: "Point",
            coordinates: [0, 0],
        });
        expect(instance.removeFeatures).toHaveBeenCalledWith([
            created!.featureId,
        ]);
        expect(onEditingFeatureHandled).toHaveBeenCalled();
    });

    it("reverts to the pre-edit geometry when cancelEditSignal increments", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        const created = useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] });

        const map = makeMap();
        const onEditingFeatureHandled = vi.fn();
        const editingFeature = {
            id: created!.featureId,
            type: "point" as const,
            geometry: { type: "Point" as const, coordinates: [0, 0] },
            createdAt: "now",
            updatedAt: "now",
        };
        const { container, rerender } = render(
            <DrawToolbar
                map={map as never}
                activeLayerId={waterId}
                editingFeature={editingFeature}
                onEditingFeatureHandled={onEditingFeatureHandled}
                finishEditSignal={0}
                cancelEditSignal={0}
            />,
        );
        const instance = getLastTerraDrawInstance(container);

        instance.setSnapshotFeature({
            id: created!.featureId,
            type: "Feature",
            geometry: { type: "Point", coordinates: [9, 9] },
            properties: {},
        });
        instance.fireFinish(created!.featureId, {
            action: "dragCoordinate",
            mode: "point",
        });
        expect(useWorkspaceStore.getState().features[0].geometry).toEqual({
            type: "Point",
            coordinates: [9, 9],
        });

        rerender(
            <DrawToolbar
                map={map as never}
                activeLayerId={waterId}
                editingFeature={editingFeature}
                onEditingFeatureHandled={onEditingFeatureHandled}
                finishEditSignal={0}
                cancelEditSignal={1}
            />,
        );

        expect(useWorkspaceStore.getState().features[0].geometry).toEqual({
            type: "Point",
            coordinates: [0, 0],
        });
        expect(instance.removeFeatures).toHaveBeenCalledWith([
            created!.featureId,
        ]);
        expect(onEditingFeatureHandled).toHaveBeenCalled();
    });

    it("finishes editing when finishEditSignal increments", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        const created = useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] });

        const map = makeMap();
        const onEditingFeatureHandled = vi.fn();
        const editingFeature = {
            id: created!.featureId,
            type: "point" as const,
            geometry: { type: "Point" as const, coordinates: [0, 0] },
            createdAt: "now",
            updatedAt: "now",
        };
        const { container, rerender } = render(
            <DrawToolbar
                map={map as never}
                activeLayerId={waterId}
                editingFeature={editingFeature}
                onEditingFeatureHandled={onEditingFeatureHandled}
                finishEditSignal={0}
                cancelEditSignal={0}
            />,
        );
        const instance = getLastTerraDrawInstance(container);

        rerender(
            <DrawToolbar
                map={map as never}
                activeLayerId={waterId}
                editingFeature={editingFeature}
                onEditingFeatureHandled={onEditingFeatureHandled}
                finishEditSignal={1}
                cancelEditSignal={0}
            />,
        );

        expect(instance.removeFeatures).toHaveBeenCalledWith([
            created!.featureId,
        ]);
        expect(onEditingFeatureHandled).toHaveBeenCalled();
    });

    it("switches terra-draw's mode when a toolbar button is clicked", async () => {
        const map = makeMap();
        const { container } = render(
            <DrawToolbar
                map={map as never}
                activeLayerId="water"
                editingFeature={null}
                onEditingFeatureHandled={() => {}}
                finishEditSignal={0}
                cancelEditSignal={0}
            />,
        );
        const instance = getLastTerraDrawInstance(container);

        await userEvent.click(
            await screen.findByRole("button", { name: /point/i }),
        );

        expect(instance.setMode).toHaveBeenCalledWith("point");
    });

    it("marks the active tool as pressed and clears the previous tool's pressed state", async () => {
        const map = makeMap();
        render(
            <DrawToolbar
                map={map as never}
                activeLayerId="water"
                editingFeature={null}
                onEditingFeatureHandled={() => {}}
                finishEditSignal={0}
                cancelEditSignal={0}
            />,
        );

        const selectButton = await screen.findByRole("button", {
            name: "Select",
        });
        const pointButton = await screen.findByRole("button", {
            name: "Point",
        });
        expect(selectButton).toHaveAttribute("aria-pressed", "true");
        expect(pointButton).toHaveAttribute("aria-pressed", "false");

        await userEvent.click(pointButton);

        expect(selectButton).toHaveAttribute("aria-pressed", "false");
        expect(pointButton).toHaveAttribute("aria-pressed", "true");
    });

    it("shows the drawing hint and deletes the last point on right-click while drawing a polygon", async () => {
        const map = makeMap();
        const { container } = render(
            <DrawToolbar
                map={map as never}
                activeLayerId="water"
                editingFeature={null}
                onEditingFeatureHandled={() => {}}
                finishEditSignal={0}
                cancelEditSignal={0}
            />,
        );
        const instance = getLastTerraDrawInstance(container);

        await userEvent.click(
            await screen.findByRole("button", { name: /polygon/i }),
        );

        expect(
            await screen.findByText(/right click to delete last point/i),
        ).toBeInTheDocument();

        map.getCanvas().dispatchEvent(
            new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
        );

        expect(instance.undo).toHaveBeenCalledTimes(1);
    });

    it("configures both freehand modes with a low minDistance so the line tracks the cursor closely", () => {
        const map = makeMap();
        render(
            <DrawToolbar
                map={map as never}
                activeLayerId="water"
                editingFeature={null}
                onEditingFeatureHandled={() => {}}
                finishEditSignal={0}
                cancelEditSignal={0}
            />,
        );

        // @ts-expect-error `instances` is exposed by the mock only, for assertions in this test
        const freehand = TerraDrawFreehandMode.instances.at(-1);
        // @ts-expect-error `instances` is exposed by the mock only, for assertions in this test
        const freehandLine = TerraDrawFreehandLineStringMode.instances.at(-1);

        expect(freehand?.options?.minDistance).toBeLessThanOrEqual(5);
        expect(freehandLine?.options?.minDistance).toBeLessThanOrEqual(5);
    });

    it("shows a vertex marker per click while drawing a line, matching polygon mode", () => {
        const map = makeMap();
        render(
            <DrawToolbar
                map={map as never}
                activeLayerId="water"
                editingFeature={null}
                onEditingFeatureHandled={() => {}}
                finishEditSignal={0}
                cancelEditSignal={0}
            />,
        );

        // @ts-expect-error `instances` is exposed by the mock only, for assertions in this test
        const lineString = TerraDrawLineStringMode.instances.at(-1);
        // @ts-expect-error `instances` is exposed by the mock only, for assertions in this test
        const polygon = TerraDrawPolygonMode.instances.at(-1);

        expect(lineString?.options?.showCoordinatePoints).toBe(true);
        expect(polygon?.options?.showCoordinatePoints).toBe(true);
    });

    it("opens a polygon/line choice menu instead of setting a mode when Freehand is clicked", async () => {
        const map = makeMap();
        const { container } = render(
            <DrawToolbar
                map={map as never}
                activeLayerId="water"
                editingFeature={null}
                onEditingFeatureHandled={() => {}}
                finishEditSignal={0}
                cancelEditSignal={0}
            />,
        );
        const instance = getLastTerraDrawInstance(container);

        await userEvent.click(
            await screen.findByRole("button", { name: /freehand/i }),
        );

        expect(instance.setMode).not.toHaveBeenCalledWith("freehand");
        expect(instance.setMode).not.toHaveBeenCalledWith(
            "freehand-linestring",
        );
        expect(
            await screen.findByRole("button", { name: /freehand polygon/i }),
        ).toBeInTheDocument();
        expect(
            await screen.findByRole("button", { name: /freehand line/i }),
        ).toBeInTheDocument();
    });

    it("sets the freehand polygon mode when Polygon is chosen from the freehand menu", async () => {
        const map = makeMap();
        const { container } = render(
            <DrawToolbar
                map={map as never}
                activeLayerId="water"
                editingFeature={null}
                onEditingFeatureHandled={() => {}}
                finishEditSignal={0}
                cancelEditSignal={0}
            />,
        );
        const instance = getLastTerraDrawInstance(container);

        await userEvent.click(
            await screen.findByRole("button", { name: /freehand/i }),
        );
        await userEvent.click(
            await screen.findByRole("button", { name: /freehand polygon/i }),
        );

        expect(instance.setMode).toHaveBeenCalledWith("freehand");
        expect(
            screen.queryByRole("button", { name: /freehand line/i }),
        ).not.toBeInTheDocument();
    });

    it("sets the freehand linestring mode when Line is chosen from the freehand menu", async () => {
        const map = makeMap();
        const { container } = render(
            <DrawToolbar
                map={map as never}
                activeLayerId="water"
                editingFeature={null}
                onEditingFeatureHandled={() => {}}
                finishEditSignal={0}
                cancelEditSignal={0}
            />,
        );
        const instance = getLastTerraDrawInstance(container);

        await userEvent.click(
            await screen.findByRole("button", { name: /freehand/i }),
        );
        await userEvent.click(
            await screen.findByRole("button", { name: /freehand line/i }),
        );

        expect(instance.setMode).toHaveBeenCalledWith("freehand-linestring");
    });

    it("closes the freehand menu without changing mode on outside click", async () => {
        const map = makeMap();
        const { container } = render(
            <DrawToolbar
                map={map as never}
                activeLayerId="water"
                editingFeature={null}
                onEditingFeatureHandled={() => {}}
                finishEditSignal={0}
                cancelEditSignal={0}
            />,
        );
        const instance = getLastTerraDrawInstance(container);

        await userEvent.click(
            await screen.findByRole("button", { name: /freehand/i }),
        );
        expect(
            await screen.findByRole("button", { name: /freehand polygon/i }),
        ).toBeInTheDocument();

        await userEvent.click(document.body);

        expect(
            screen.queryByRole("button", { name: /freehand polygon/i }),
        ).not.toBeInTheDocument();
        expect(instance.setMode).not.toHaveBeenCalledWith("freehand");
        expect(instance.setMode).not.toHaveBeenCalledWith(
            "freehand-linestring",
        );
    });

    it("creates a line workspace feature when a freehand-linestring drawing finishes", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);

        const map = makeMap();
        const { container } = render(
            <DrawToolbar
                map={map as never}
                activeLayerId={waterId}
                editingFeature={null}
                onEditingFeatureHandled={() => {}}
                finishEditSignal={0}
                cancelEditSignal={0}
            />,
        );
        const instance = getLastTerraDrawInstance(container);

        instance.setSnapshotFeature({
            id: "terra-freehand-line",
            type: "Feature",
            geometry: {
                type: "LineString",
                coordinates: [
                    [0, 0],
                    [1, 1],
                ],
            },
            properties: {},
        });
        instance.fireFinish("terra-freehand-line", {
            action: "draw",
            mode: "freehand-linestring",
        });

        const state = useWorkspaceStore.getState();
        expect(state.features).toHaveLength(1);
        expect(state.features[0].type).toBe("line");
    });

    it("simplifies a densely-sampled freehand line before storing it", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);

        const map = makeMap();
        const { container } = render(
            <DrawToolbar
                map={map as never}
                activeLayerId={waterId}
                editingFeature={null}
                onEditingFeatureHandled={() => {}}
                finishEditSignal={0}
                cancelEditSignal={0}
            />,
        );
        const instance = getLastTerraDrawInstance(container);

        const noisyCoordinates = Array.from({ length: 200 }, (_, i) => {
            const t = i / 199;
            const jitter = (i % 2 === 0 ? 1 : -1) * 0.0001;
            return [t * 10, jitter];
        });
        instance.setSnapshotFeature({
            id: "terra-freehand-line",
            type: "Feature",
            geometry: { type: "LineString", coordinates: noisyCoordinates },
            properties: {},
        });
        instance.fireFinish("terra-freehand-line", {
            action: "draw",
            mode: "freehand-linestring",
        });

        const geometry = useWorkspaceStore.getState().features[0]
            .geometry as GeoJSON.LineString;
        expect(geometry.coordinates.length).toBeLessThan(
            noisyCoordinates.length,
        );
    });

    it("does not simplify geometry from a non-freehand draw mode", async () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);

        const map = makeMap();
        const { container } = render(
            <DrawToolbar
                map={map as never}
                activeLayerId={waterId}
                editingFeature={null}
                onEditingFeatureHandled={() => {}}
                finishEditSignal={0}
                cancelEditSignal={0}
            />,
        );
        const instance = getLastTerraDrawInstance(container);

        const coordinates = [
            [0, 0],
            [5, 0],
            [10, 0],
        ];
        instance.setSnapshotFeature({
            id: "terra-linestring",
            type: "Feature",
            geometry: { type: "LineString", coordinates },
            properties: {},
        });
        instance.fireFinish("terra-linestring", {
            action: "draw",
            mode: "linestring",
        });

        const geometry = useWorkspaceStore.getState().features[0]
            .geometry as GeoJSON.LineString;
        expect(geometry.coordinates).toEqual(coordinates);
    });

    it("does not undo on right-click outside a point-by-point draw mode", async () => {
        const map = makeMap();
        const { container } = render(
            <DrawToolbar
                map={map as never}
                activeLayerId="water"
                editingFeature={null}
                onEditingFeatureHandled={() => {}}
                finishEditSignal={0}
                cancelEditSignal={0}
            />,
        );
        const instance = getLastTerraDrawInstance(container);

        expect(
            screen.queryByText(/right click to delete last point/i),
        ).not.toBeInTheDocument();

        map.getCanvas().dispatchEvent(
            new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
        );

        expect(instance.undo).not.toHaveBeenCalled();
    });

    it("shows a click-to-start hint (not the right-click-to-delete hint) while free drawing", async () => {
        const map = makeMap();
        render(
            <DrawToolbar
                map={map as never}
                activeLayerId="water"
                editingFeature={null}
                onEditingFeatureHandled={() => {}}
                finishEditSignal={0}
                cancelEditSignal={0}
            />,
        );

        await userEvent.click(
            await screen.findByRole("button", { name: /freehand/i }),
        );
        await userEvent.click(
            await screen.findByRole("button", { name: /freehand polygon/i }),
        );

        expect(
            screen.queryByText(/right click to delete last point/i),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByText(/left click to add points/i),
        ).not.toBeInTheDocument();
        expect(
            await screen.findByText(/click to start, then move to draw/i),
        ).toBeInTheDocument();
    });

    it("does not undo on right-click while free drawing", async () => {
        const map = makeMap();
        const { container } = render(
            <DrawToolbar
                map={map as never}
                activeLayerId="water"
                editingFeature={null}
                onEditingFeatureHandled={() => {}}
                finishEditSignal={0}
                cancelEditSignal={0}
            />,
        );
        const instance = getLastTerraDrawInstance(container);

        await userEvent.click(
            await screen.findByRole("button", { name: /freehand/i }),
        );
        await userEvent.click(
            await screen.findByRole("button", { name: /freehand polygon/i }),
        );

        map.getCanvas().dispatchEvent(
            new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
        );

        expect(instance.undo).not.toHaveBeenCalled();
    });

    it("blocks a click or held press once a freehand shape is mid-trace, so it can't add a point or finish early", async () => {
        const map = makeMap();
        const { container } = render(
            <DrawToolbar
                map={map as never}
                activeLayerId="water"
                editingFeature={null}
                onEditingFeatureHandled={() => {}}
                finishEditSignal={0}
                cancelEditSignal={0}
            />,
        );
        const instance = getLastTerraDrawInstance(container);

        await userEvent.click(
            await screen.findByRole("button", { name: /freehand/i }),
        );
        await userEvent.click(
            await screen.findByRole("button", { name: /freehand polygon/i }),
        );

        instance.setSnapshotFeature({
            id: "terra-freehand-wip",
            type: "Feature",
            geometry: {
                type: "Polygon",
                coordinates: [
                    [
                        [0, 0],
                        [0, 0],
                        [0, 0],
                        [0, 0],
                    ],
                ],
            },
            properties: { mode: "freehand", currentlyDrawing: true },
        });

        const canvas = map.getCanvas();
        const downEvent = new PointerEvent("pointerdown", {
            bubbles: true,
            cancelable: true,
        });
        const upEvent = new PointerEvent("pointerup", {
            bubbles: true,
            cancelable: true,
        });
        const downSpy = vi.spyOn(downEvent, "stopImmediatePropagation");
        const upSpy = vi.spyOn(upEvent, "stopImmediatePropagation");

        canvas.dispatchEvent(downEvent);
        canvas.dispatchEvent(upEvent);

        expect(downSpy).toHaveBeenCalled();
        expect(upSpy).toHaveBeenCalled();
    });

    it("does not block the initial click that starts a freehand shape", async () => {
        const map = makeMap();
        render(
            <DrawToolbar
                map={map as never}
                activeLayerId="water"
                editingFeature={null}
                onEditingFeatureHandled={() => {}}
                finishEditSignal={0}
                cancelEditSignal={0}
            />,
        );

        await userEvent.click(
            await screen.findByRole("button", { name: /freehand/i }),
        );
        await userEvent.click(
            await screen.findByRole("button", { name: /freehand polygon/i }),
        );

        const canvas = map.getCanvas();
        const downEvent = new PointerEvent("pointerdown", {
            bubbles: true,
            cancelable: true,
        });
        const downSpy = vi.spyOn(downEvent, "stopImmediatePropagation");

        canvas.dispatchEvent(downEvent);

        expect(downSpy).not.toHaveBeenCalled();
    });

    it("cleans up the edit session when the edited feature is deleted mid-edit", () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        const created = useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] });

        const map = makeMap();
        const onEditingFeatureHandled = vi.fn();
        const editingFeature = {
            id: created!.featureId,
            type: "point" as const,
            geometry: { type: "Point" as const, coordinates: [0, 0] },
            createdAt: "now",
            updatedAt: "now",
        };
        const { container, rerender } = render(
            <DrawToolbar
                map={map as never}
                activeLayerId={waterId}
                editingFeature={editingFeature}
                onEditingFeatureHandled={onEditingFeatureHandled}
                finishEditSignal={0}
                cancelEditSignal={0}
            />,
        );
        const instance = getLastTerraDrawInstance(container);
        expect(onEditingFeatureHandled).not.toHaveBeenCalled();

        rerender(
            <DrawToolbar
                map={map as never}
                activeLayerId={waterId}
                editingFeature={null}
                onEditingFeatureHandled={onEditingFeatureHandled}
                finishEditSignal={0}
                cancelEditSignal={0}
            />,
        );

        expect(instance.removeFeatures).toHaveBeenCalledWith([
            created!.featureId,
        ]);
        expect(instance.setMode).toHaveBeenLastCalledWith("select");
        expect(onEditingFeatureHandled).toHaveBeenCalledTimes(1);
    });

    it("cancels the default action of Enter while editing so a focused button is not also activated", () => {
        const waterId = useWorkspaceStore.getState().addLayer("Water", null);
        useWorkspaceStore.getState().setActiveLayer(waterId);
        const created = useWorkspaceStore
            .getState()
            .drawFeature("point", { type: "Point", coordinates: [0, 0] });

        render(
            <DrawToolbar
                map={makeMap() as never}
                activeLayerId={waterId}
                editingFeature={{
                    id: created!.featureId,
                    type: "point",
                    geometry: { type: "Point", coordinates: [0, 0] },
                    createdAt: "now",
                    updatedAt: "now",
                }}
                onEditingFeatureHandled={vi.fn()}
                finishEditSignal={0}
                cancelEditSignal={0}
            />,
        );

        const isDefaultAllowed = fireEvent.keyDown(document.body, {
            key: "Enter",
        });

        expect(isDefaultAllowed).toBe(false);
    });
});

function getLastTerraDrawInstance(container: HTMLElement) {
    const marker = container.querySelector("[data-terra-draw-instance]");
    if (!marker)
        throw new Error(
            "DrawToolbar did not render its terra-draw instance marker",
        );
    const key = marker.getAttribute("data-terra-draw-instance");
    // @ts-expect-error attached by DrawToolbar in test builds only via a data attribute lookup table
    return window.__terraDrawInstances__[key];
}
