import { useEffect, useRef, useState } from "react";
import type * as maplibregl from "maplibre-gl";
import {
    TerraDraw,
    TerraDrawPointMode,
    TerraDrawLineStringMode,
    TerraDrawPolygonMode,
    TerraDrawFreehandMode,
    TerraDrawFreehandLineStringMode,
    TerraDrawRectangleMode,
    TerraDrawCircleMode,
    TerraDrawSelectMode,
    TerraDrawModeUndoRedo,
} from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import {
    MousePointer2,
    CircleDot,
    Spline,
    Hexagon,
    PenTool,
    RectangleHorizontal,
    Circle,
} from "lucide-react";

import type { WorkspaceFeature } from "@/lib/workspace/types";
import {
    geoJsonTypeToFeatureType,
    simplifyFreehandGeometry,
    workspaceTypeToTerraDrawMode,
} from "@/lib/workspace/terraDrawGeometry";
import { useWorkspaceStore } from "@/store/workspaceStore";

declare global {
    interface Window {
        __terraDrawInstances__?: Record<string, unknown>;
    }
}

const TOOLBAR_MODES = [
    { mode: "select", label: "Select", Icon: MousePointer2 },
    { mode: "point", label: "Point", Icon: CircleDot },
    { mode: "linestring", label: "Line", Icon: Spline },
    { mode: "polygon", label: "Polygon", Icon: Hexagon },
    { mode: "freehand", label: "Freehand", Icon: PenTool },
    { mode: "rectangle", label: "Rectangle", Icon: RectangleHorizontal },
    { mode: "circle", label: "Circle", Icon: Circle },
] as const;

const CLICK_TO_ADD_MODES = new Set(["polygon", "linestring"]);
const FREEHAND_DRAW_MODES = new Set(["freehand", "freehand-linestring"]);

export interface DrawToolbarProps {
    map: maplibregl.Map | null;
    activeLayerId: string | null;
    editingFeature: WorkspaceFeature | null;
    onEditingFeatureHandled: () => void;
    finishEditSignal: number;
    cancelEditSignal: number;
    onModeChange?: (mode: string) => void;
    onFeatureDrawn?: (membershipId: string) => void;
}

export function DrawToolbar({
    map,
    activeLayerId,
    editingFeature,
    onEditingFeatureHandled,
    finishEditSignal,
    cancelEditSignal,
    onModeChange,
    onFeatureDrawn,
}: DrawToolbarProps) {
    const drawRef = useRef<TerraDraw | null>(null);
    const [instanceKey] = useState(() => crypto.randomUUID());
    const [activeMode, setActiveMode] = useState<string>("select");
    const onModeChangeRef = useRef(onModeChange);
    useEffect(() => {
        onModeChangeRef.current = onModeChange;
    }, [onModeChange]);
    const onFeatureDrawnRef = useRef(onFeatureDrawn);
    useEffect(() => {
        onFeatureDrawnRef.current = onFeatureDrawn;
    }, [onFeatureDrawn]);

    function updateActiveMode(mode: string) {
        setActiveMode(mode);
        onModeChangeRef.current?.(mode);
    }
    const [isFreehandMenuOpen, setIsFreehandMenuOpen] = useState(false);
    const freehandRef = useRef<HTMLDivElement>(null);
    const onEditingFeatureHandledRef = useRef(onEditingFeatureHandled);
    useEffect(() => {
        onEditingFeatureHandledRef.current = onEditingFeatureHandled;
    }, [onEditingFeatureHandled]);
    const editingFeatureRef = useRef(editingFeature);
    useEffect(() => {
        editingFeatureRef.current = editingFeature;
    }, [editingFeature]);
    const originalFeatureIdRef = useRef<string | null>(null);
    const originalGeometryRef = useRef<GeoJSON.Geometry | null>(null);

    function endEditingSession() {
        const draw = drawRef.current;
        const feature = editingFeatureRef.current;
        if (!draw || !feature) return;
        draw.deselectFeature(feature.id);
        draw.removeFeatures([feature.id]);
        draw.setMode("select");
        updateActiveMode("select");
        originalFeatureIdRef.current = null;
        originalGeometryRef.current = null;
        onEditingFeatureHandledRef.current();
    }

    function cancelEditingGeometry() {
        const feature = editingFeatureRef.current;
        const originalGeometry = originalGeometryRef.current;
        if (feature && originalGeometry) {
            useWorkspaceStore
                .getState()
                .editFeatureGeometry(feature.id, originalGeometry);
        }
        endEditingSession();
    }

    useEffect(() => {
        if (!map) return undefined;

        const draw = new TerraDraw({
            adapter: new TerraDrawMapLibreGLAdapter({
                map,
                minPixelDragDistance: 8,
            }),
            modes: [
                new TerraDrawPointMode(),
                new TerraDrawLineStringMode({
                    pointerDistance: 0,
                    showCoordinatePoints: true,
                    styles: { closingPointWidth: 0, closingPointOpacity: 0 },
                }),
                new TerraDrawPolygonMode({
                    pointerDistance: 0,
                    showCoordinatePoints: true,
                    styles: { closingPointWidth: 0, closingPointOpacity: 0 },
                }),
                new TerraDrawFreehandMode({
                    minDistance: 2,
                    pointerDistance: 0,
                }),
                new TerraDrawFreehandLineStringMode({ minDistance: 2 }),
                new TerraDrawRectangleMode(),
                new TerraDrawCircleMode(),
                new TerraDrawSelectMode({
                    flags: {
                        point: { feature: { draggable: true } },
                        linestring: {
                            feature: {
                                draggable: true,
                                coordinates: { draggable: true },
                            },
                        },
                        polygon: {
                            feature: {
                                draggable: true,
                                coordinates: { draggable: true },
                            },
                        },
                    },
                }),
            ],
            undoRedo: { modeLevel: new TerraDrawModeUndoRedo() },
        });

        draw.start();
        draw.setMode("select");

        draw.on("finish", (id, context) => {
            const snapshot = draw.getSnapshot();
            const drawnFeature = snapshot.find(
                (f) => String(f.id) === String(id),
            );
            if (!drawnFeature) return;

            if (context.action === "draw") {
                const featureType = geoJsonTypeToFeatureType(
                    drawnFeature.geometry.type,
                );
                if (!featureType) return;
                const geometry = FREEHAND_DRAW_MODES.has(context.mode)
                    ? simplifyFreehandGeometry(
                          drawnFeature.geometry as
                              GeoJSON.LineString | GeoJSON.Polygon,
                          map,
                      )
                    : drawnFeature.geometry;
                const result = useWorkspaceStore
                    .getState()
                    .drawFeature(featureType, geometry);
                draw.removeFeatures([id]);
                if (result) {
                    draw.setMode("select");
                    updateActiveMode("select");
                    onFeatureDrawnRef.current?.(result.membershipId);
                }
            } else {
                useWorkspaceStore
                    .getState()
                    .editFeatureGeometry(String(id), drawnFeature.geometry);
            }
        });

        drawRef.current = draw;
        window.__terraDrawInstances__ ??= {};
        window.__terraDrawInstances__[instanceKey] = draw;

        return () => {
            draw.stop();
            drawRef.current = null;
            if (window.__terraDrawInstances__)
                delete window.__terraDrawInstances__[instanceKey];
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map]);

    useEffect(() => {
        if (!map) return undefined;
        const canvas = map.getCanvas();

        function handleContextMenu(event: MouseEvent) {
            const draw = drawRef.current;
            if (!draw || !CLICK_TO_ADD_MODES.has(draw.getMode())) return;
            event.preventDefault();
            draw.undo();
        }

        canvas.addEventListener("contextmenu", handleContextMenu);
        return () =>
            canvas.removeEventListener("contextmenu", handleContextMenu);
    }, [map]);

    useEffect(() => {
        if (!map) return undefined;
        const canvas = map.getCanvas();

        function blockWhileDrawing(event: PointerEvent) {
            const draw = drawRef.current;
            if (!draw || !FREEHAND_DRAW_MODES.has(draw.getMode())) return;
            const isDrawing = draw
                .getSnapshot()
                .some(
                    (feature) => feature.properties?.currentlyDrawing === true,
                );
            if (isDrawing) event.stopImmediatePropagation();
        }

        canvas.addEventListener("pointerdown", blockWhileDrawing, {
            capture: true,
        });
        canvas.addEventListener("pointerup", blockWhileDrawing, {
            capture: true,
        });
        return () => {
            canvas.removeEventListener("pointerdown", blockWhileDrawing, {
                capture: true,
            });
            canvas.removeEventListener("pointerup", blockWhileDrawing, {
                capture: true,
            });
        };
    }, [map]);

    useEffect(() => {
        if (!isFreehandMenuOpen) return undefined;

        function handlePointerDown(event: PointerEvent) {
            if (freehandRef.current?.contains(event.target as Node)) return;
            setIsFreehandMenuOpen(false);
        }

        document.addEventListener("pointerdown", handlePointerDown);
        return () =>
            document.removeEventListener("pointerdown", handlePointerDown);
    }, [isFreehandMenuOpen]);

    useEffect(() => {
        if (finishEditSignal === 0) return;
        endEditingSession();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [finishEditSignal]);

    useEffect(() => {
        if (cancelEditSignal === 0) return;
        cancelEditingGeometry();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cancelEditSignal]);

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if (event.key !== "Enter" && event.key !== "Escape") return;
            if (!editingFeatureRef.current) return;
            const target = event.target as HTMLElement | null;
            if (
                target &&
                ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
            )
                return;
            event.preventDefault();
            if (event.key === "Enter") endEditingSession();
            else cancelEditingGeometry();
        }
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const draw = drawRef.current;
        if (!draw) return;
        if (!editingFeature) {
            const staleId = originalFeatureIdRef.current;
            if (!staleId) return;
            draw.deselectFeature(staleId);
            draw.removeFeatures([staleId]);
            draw.setMode("select");
            updateActiveMode("select");
            originalFeatureIdRef.current = null;
            originalGeometryRef.current = null;
            onEditingFeatureHandledRef.current();
            return;
        }

        if (originalFeatureIdRef.current === editingFeature.id) return;
        originalFeatureIdRef.current = editingFeature.id;
        originalGeometryRef.current = editingFeature.geometry;
        draw.addFeatures([
            {
                id: editingFeature.id,
                type: "Feature",
                geometry: editingFeature.geometry as
                    GeoJSON.Point | GeoJSON.LineString | GeoJSON.Polygon,
                properties: {
                    mode: workspaceTypeToTerraDrawMode(editingFeature.type),
                },
            },
        ]);
        draw.setMode("select");
        updateActiveMode("select");
        draw.selectFeature(editingFeature.id);
    }, [editingFeature]);

    return (
        <>
            <div ref={freehandRef}>
                <div
                    data-terra-draw-instance={instanceKey}
                    className="absolute left-2 top-2 z-[var(--z-dropdown)] flex gap-1 rounded-lg border border-color-border bg-color-surface-raised p-1 shadow-md"
                >
                    {TOOLBAR_MODES.map(({ mode, label, Icon }) => {
                        const isActive =
                            mode === "freehand"
                                ? FREEHAND_DRAW_MODES.has(activeMode)
                                : activeMode === mode;
                        return (
                            <button
                                key={mode}
                                type="button"
                                aria-label={label}
                                aria-pressed={isActive}
                                disabled={!activeLayerId}
                                onClick={() => {
                                    if (mode === "freehand") {
                                        setIsFreehandMenuOpen((open) => !open);
                                        return;
                                    }
                                    setIsFreehandMenuOpen(false);
                                    drawRef.current?.setMode(mode);
                                    updateActiveMode(mode);
                                }}
                                className={`flex size-8 items-center justify-center rounded hover:bg-color-surface-bg disabled:cursor-not-allowed disabled:opacity-40 ${
                                    isActive
                                        ? "bg-brand-primary/10 text-brand-primary"
                                        : "text-color-text-primary"
                                }`}
                            >
                                <Icon className="size-4" />
                            </button>
                        );
                    })}
                </div>
                {isFreehandMenuOpen && (
                    <div className="absolute left-2 top-12 z-[var(--z-dropdown)] flex gap-1 rounded-lg border border-color-border bg-color-surface-raised p-1 shadow-md">
                        <button
                            type="button"
                            aria-label="Freehand polygon"
                            aria-pressed={activeMode === "freehand"}
                            onClick={() => {
                                drawRef.current?.setMode("freehand");
                                updateActiveMode("freehand");
                                setIsFreehandMenuOpen(false);
                            }}
                            className={`flex size-8 items-center justify-center rounded hover:bg-color-surface-bg ${
                                activeMode === "freehand"
                                    ? "bg-brand-primary/10 text-brand-primary"
                                    : "text-color-text-primary"
                            }`}
                        >
                            <Hexagon className="size-4" />
                        </button>
                        <button
                            type="button"
                            aria-label="Freehand line"
                            aria-pressed={activeMode === "freehand-linestring"}
                            onClick={() => {
                                drawRef.current?.setMode("freehand-linestring");
                                updateActiveMode("freehand-linestring");
                                setIsFreehandMenuOpen(false);
                            }}
                            className={`flex size-8 items-center justify-center rounded hover:bg-color-surface-bg ${
                                activeMode === "freehand-linestring"
                                    ? "bg-brand-primary/10 text-brand-primary"
                                    : "text-color-text-primary"
                            }`}
                        >
                            <Spline className="size-4" />
                        </button>
                    </div>
                )}
            </div>
            {CLICK_TO_ADD_MODES.has(activeMode) && (
                <div className="pointer-events-none absolute bottom-2 left-1/2 z-[var(--z-dropdown)] -translate-x-1/2 whitespace-nowrap rounded-md bg-color-surface-raised px-3 py-1.5 text-xs text-color-text-primary shadow-sm">
                    Left click to add points · Right click to delete last point
                    · Enter to finish · Escape to cancel
                </div>
            )}
            {FREEHAND_DRAW_MODES.has(activeMode) && (
                <div className="pointer-events-none absolute bottom-2 left-1/2 z-[var(--z-dropdown)] -translate-x-1/2 whitespace-nowrap rounded-md bg-color-surface-raised px-3 py-1.5 text-xs text-color-text-primary shadow-sm">
                    Click to start, then move to draw · Enter to finish · Escape
                    to cancel
                </div>
            )}
        </>
    );
}
