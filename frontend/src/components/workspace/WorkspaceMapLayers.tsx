import { useEffect, useMemo, useRef } from "react";
import type * as maplibregl from "maplibre-gl";

import { useWorkspaceStore } from "@/store/workspaceStore";
import {
    getStackedLayerIds,
    resolveVisibleFeatures,
    toWorkspaceFeatureCollections,
} from "@/lib/workspace/resolveVisibleFeatures";
import { registerWorkspaceIcons } from "@/lib/workspace/icons";
import { bufferFeatureOutline } from "@/lib/workspace/haloBuffer";
import { pixelToleranceToDegrees } from "@/lib/workspace/terraDrawGeometry";

const SOURCE_POINTS = "workspace-points";
const SOURCE_LINES = "workspace-lines";
const SOURCE_BUFFERS = "workspace-buffers";
const BUFFERS_FILL = "workspace-buffers-fill";
const SOURCE_POLYGONS = "workspace-polygons";
const SOURCE_LINE_ICONS = "workspace-line-icons";
const SOURCE_POLYGON_ICONS = "workspace-polygon-icons";

const SOURCE_HALO_OUTLINE = "workspace-halo-outline";
const HALO_OUTLINE = "workspace-selection-halo-outline";
export const STACK_BOTTOM = "workspace-stack-bottom";
export const STACK_TOP = "workspace-stack-top";
const HALO_POINTS = "workspace-selection-halo-points";

const SELECTION_COLOUR = "#003a6b";
const NO_SELECTION_FILTER = [
    "==",
    ["get", "id"],
    "",
] as unknown as maplibregl.FilterSpecification;
const STATIC_HALO_LINE_WIDTH = 2.5;
const STATIC_HALO_LINE_OPACITY = 0.5;
const STATIC_HALO_CIRCLE_RADIUS = 11;
const STATIC_HALO_CIRCLE_OPACITY = 0.4;
const HALO_BUFFER_PX = 4;

const CLICK_BUFFER_PX = 6;

const SYMBOL_ICON_ANCHOR = "bottom" as const;
const SYMBOL_ICON_OFFSET = [0, -12] as [number, number];
const SYMBOL_TEXT_OFFSET = [0, 1] as [number, number];

const POINT_CIRCLE_RADIUS = [
    "interpolate",
    ["linear"],
    ["zoom"],
    7,
    0.3,
    10,
    3,
    14,
    6.5,
] as unknown as maplibregl.ExpressionSpecification;

const SYMBOL_ICON_SIZE = [
    "interpolate",
    ["linear"],
    ["zoom"],
    7,
    0.1,
    10,
    0.6,
    14,
    1.3,
] as unknown as maplibregl.ExpressionSpecification;
const SYMBOL_TEXT_SIZE = [
    "interpolate",
    ["linear"],
    ["zoom"],
    7,
    4,
    10,
    10,
    14,
    15,
] as unknown as maplibregl.ExpressionSpecification;

function selectionFilter(
    featureId: string | null,
): maplibregl.FilterSpecification {
    if (!featureId) return NO_SELECTION_FILTER;
    return [
        "==",
        ["get", "id"],
        featureId,
    ] as unknown as maplibregl.FilterSpecification;
}

const DASH_ARRAY_EXPRESSION = [
    "case",
    ["==", ["get", "lineDash"], "dashed"],
    ["literal", [2, 2]],
    ["==", ["get", "lineDash"], "dotted"],
    ["literal", [1, 2]],
    ["literal", [1, 0]],
] as unknown as maplibregl.ExpressionSpecification;

const CLICKABLE_PARTS = ["points-dot", "lines-stroke", "polygons-fill"];

function groupLayerId(layerId: string, part: string): string {
    return `workspace-${layerId}-${part}`;
}

function symbolLayout(): maplibregl.SymbolLayerSpecification["layout"] {
    return {
        "icon-image": ["get", "icon"],
        "icon-anchor": SYMBOL_ICON_ANCHOR,
        "icon-offset": SYMBOL_ICON_OFFSET,
        "icon-allow-overlap": true,
        "icon-size": SYMBOL_ICON_SIZE,
        "text-field": ["get", "label"],
        "text-offset": SYMBOL_TEXT_OFFSET,
        "text-anchor": "top",
        "text-size": SYMBOL_TEXT_SIZE,
        "symbol-sort-key": ["get", "z"],
    };
}

const SYMBOL_PAINT: maplibregl.SymbolLayerSpecification["paint"] = {
    "icon-color": ["get", "iconColour"],
    "text-halo-color": "#ffffff",
    "text-halo-width": 1.5,
};

function groupLayerSpecs(layerId: string): maplibregl.LayerSpecification[] {
    const filter = [
        "==",
        ["get", "layerId"],
        layerId,
    ] as unknown as maplibregl.FilterSpecification;
    return [
        {
            id: groupLayerId(layerId, "polygons-fill"),
            type: "fill",
            source: SOURCE_POLYGONS,
            filter,
            layout: { "fill-sort-key": ["get", "z"] },
            paint: {
                "fill-color": ["get", "colour"],
                "fill-opacity": ["get", "opacity"],
            },
        },
        {
            id: groupLayerId(layerId, "polygons-outline"),
            type: "line",
            source: SOURCE_POLYGONS,
            filter,
            layout: { "line-sort-key": ["get", "z"] },
            paint: {
                "line-color": ["get", "colour"],
                "line-opacity": ["get", "outlineOpacity"],
                "line-width": ["get", "strokeWidth"],
                "line-dasharray": DASH_ARRAY_EXPRESSION,
            },
        },
        {
            id: groupLayerId(layerId, "polygons-symbol"),
            type: "symbol",
            source: SOURCE_POLYGON_ICONS,
            filter,
            layout: symbolLayout(),
            paint: SYMBOL_PAINT,
        },
        {
            id: groupLayerId(layerId, "lines-stroke"),
            type: "line",
            source: SOURCE_LINES,
            filter,
            layout: { "line-sort-key": ["get", "z"] },
            paint: {
                "line-color": ["get", "colour"],
                "line-opacity": ["get", "opacity"],
                "line-width": ["get", "strokeWidth"],
                "line-dasharray": DASH_ARRAY_EXPRESSION,
            },
        },
        {
            id: groupLayerId(layerId, "lines-symbol"),
            type: "symbol",
            source: SOURCE_LINE_ICONS,
            filter,
            layout: symbolLayout(),
            paint: SYMBOL_PAINT,
        },
        {
            id: groupLayerId(layerId, "points-dot"),
            type: "circle",
            source: SOURCE_POINTS,
            filter,
            layout: { "circle-sort-key": ["get", "z"] },
            paint: {
                "circle-color": ["get", "colour"],
                "circle-opacity": ["get", "opacity"],
                "circle-radius": POINT_CIRCLE_RADIUS,
            },
        },
        {
            id: groupLayerId(layerId, "points-symbol"),
            type: "symbol",
            source: SOURCE_POINTS,
            filter,
            layout: symbolLayout(),
            paint: SYMBOL_PAINT,
        },
    ];
}

export interface WorkspaceMapLayersProps {
    map: maplibregl.Map | null;
    excludedFeatureId: string | null;
    selectedFeatureId: string | null;
    onFeatureClick: (featureId: string | null) => void;
}

export function WorkspaceMapLayers({
    map,
    excludedFeatureId,
    selectedFeatureId,
    onFeatureClick,
}: WorkspaceMapLayersProps) {
    const layers = useWorkspaceStore((s) => s.layers);
    const features = useWorkspaceStore((s) => s.features);
    const memberships = useWorkspaceStore((s) => s.memberships);

    const resolved = useMemo(
        () =>
            resolveVisibleFeatures(layers, features, memberships).filter(
                (r) => r.feature.id !== excludedFeatureId,
            ),
        [layers, features, memberships, excludedFeatureId],
    );
    const collections = useMemo(
        () => toWorkspaceFeatureCollections(resolved, selectedFeatureId),
        [resolved, selectedFeatureId],
    );
    const stackedKey = useMemo(
        () => JSON.stringify(getStackedLayerIds(resolved)),
        [resolved],
    );
    const selectedLayerId = useMemo(
        () =>
            resolved.find((r) => r.feature.id === selectedFeatureId)?.layerId ??
            null,
        [resolved, selectedFeatureId],
    );

    const selectedFeatureGeometry = useMemo(() => {
        const feature = features.find((f) => f.id === selectedFeatureId);
        if (!feature || feature.type === "point") return null;
        return feature.geometry as GeoJSON.Polygon | GeoJSON.LineString;
    }, [features, selectedFeatureId]);

    const lastSourceDataRef = useRef<Record<string, string>>({});

    const groupLayerIdsRef = useRef<string[]>([]);
    const clickableLayerIdsRef = useRef<string[]>([]);

    const onFeatureClickRef = useRef(onFeatureClick);
    useEffect(() => {
        onFeatureClickRef.current = onFeatureClick;
    }, [onFeatureClick]);

    useEffect(() => {
        if (!map) return undefined;

        registerWorkspaceIcons(map).catch(() => {});
        lastSourceDataRef.current = {};

        map.addSource(SOURCE_BUFFERS, {
            type: "geojson",
            data: collections.buffers,
        });
        map.addSource(SOURCE_POLYGONS, {
            type: "geojson",
            data: collections.polygons,
        });
        map.addSource(SOURCE_LINES, {
            type: "geojson",
            data: collections.lines,
        });
        map.addSource(SOURCE_POINTS, {
            type: "geojson",
            data: collections.points,
        });
        map.addSource(SOURCE_POLYGON_ICONS, {
            type: "geojson",
            data: collections.polygonIcons,
        });
        map.addSource(SOURCE_LINE_ICONS, {
            type: "geojson",
            data: collections.lineIcons,
        });
        map.addSource(SOURCE_HALO_OUTLINE, {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
        });

        map.addLayer({
            id: STACK_BOTTOM,
            type: "background",
            paint: { "background-opacity": 0 },
        });
        map.addLayer({
            id: STACK_TOP,
            type: "background",
            paint: { "background-opacity": 0 },
        });

        map.addLayer(
            {
                id: BUFFERS_FILL,
                type: "fill",
                source: SOURCE_BUFFERS,
                paint: {
                    "fill-color": ["get", "colour"],
                    "fill-opacity": ["get", "opacity"],
                },
            },
            STACK_TOP,
        );
        map.addLayer(
            {
                id: HALO_OUTLINE,
                type: "line",
                source: SOURCE_HALO_OUTLINE,
                layout: { "line-join": "round" },
                paint: {
                    "line-color": SELECTION_COLOUR,
                    "line-width": STATIC_HALO_LINE_WIDTH,
                    "line-opacity": STATIC_HALO_LINE_OPACITY,
                },
            },
            STACK_TOP,
        );
        map.addLayer(
            {
                id: HALO_POINTS,
                type: "circle",
                source: SOURCE_POINTS,
                filter: selectionFilter(selectedFeatureId),
                paint: {
                    "circle-color": SELECTION_COLOUR,
                    "circle-radius": STATIC_HALO_CIRCLE_RADIUS,
                    "circle-opacity": STATIC_HALO_CIRCLE_OPACITY,
                    "circle-blur": 0.4,
                },
            },
            STACK_TOP,
        );

        const handleClick = (e: maplibregl.MapMouseEvent) => {
            const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
                [e.point.x - CLICK_BUFFER_PX, e.point.y - CLICK_BUFFER_PX],
                [e.point.x + CLICK_BUFFER_PX, e.point.y + CLICK_BUFFER_PX],
            ];
            const layers = clickableLayerIdsRef.current;
            if (layers.length === 0) {
                onFeatureClickRef.current(null);
                return;
            }
            let topId: unknown = null;
            let topZ = -Infinity;
            let hasHit = false;
            for (const hit of map.queryRenderedFeatures(bbox, { layers })) {
                const z = hit.properties?.z;
                const hitZ = typeof z === "number" ? z : -Infinity;
                if (!hasHit || hitZ > topZ) {
                    hasHit = true;
                    topZ = hitZ;
                    topId = hit.properties?.id;
                }
            }
            onFeatureClickRef.current(typeof topId === "string" ? topId : null);
        };
        map.on("click", handleClick);

        return () => {
            map.off("click", handleClick);
            for (const id of [
                ...groupLayerIdsRef.current,
                BUFFERS_FILL,
                HALO_OUTLINE,
                HALO_POINTS,
                STACK_BOTTOM,
                STACK_TOP,
            ]) {
                if (map.getLayer(id)) map.removeLayer(id);
            }
            groupLayerIdsRef.current = [];
            clickableLayerIdsRef.current = [];
            for (const id of [
                SOURCE_BUFFERS,
                SOURCE_POLYGONS,
                SOURCE_LINES,
                SOURCE_POINTS,
                SOURCE_HALO_OUTLINE,
                SOURCE_POLYGON_ICONS,
                SOURCE_LINE_ICONS,
            ]) {
                if (map.getSource(id)) map.removeSource(id);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map]);

    useEffect(() => {
        if (!map) return undefined;

        const stackedLayerIds = JSON.parse(stackedKey) as string[];
        const added: string[] = [];
        for (const layerId of stackedLayerIds) {
            for (const spec of groupLayerSpecs(layerId)) {
                map.addLayer(spec, STACK_TOP);
                added.push(spec.id);
            }
        }
        groupLayerIdsRef.current = added;
        clickableLayerIdsRef.current = stackedLayerIds.flatMap((layerId) =>
            CLICKABLE_PARTS.map((part) => groupLayerId(layerId, part)),
        );

        return () => {
            for (const id of added) {
                if (map.getLayer(id)) map.removeLayer(id);
            }
            groupLayerIdsRef.current = [];
            clickableLayerIdsRef.current = [];
        };
    }, [map, stackedKey]);

    useEffect(() => {
        if (!map) return;
        const isStacked =
            selectedLayerId !== null &&
            (JSON.parse(stackedKey) as string[]).includes(selectedLayerId);
        const before = (part: string) =>
            isStacked ? groupLayerId(selectedLayerId, part) : STACK_TOP;
        if (map.getLayer(HALO_OUTLINE))
            map.moveLayer(HALO_OUTLINE, before("polygons-fill"));
        if (map.getLayer(HALO_POINTS))
            map.moveLayer(HALO_POINTS, before("points-dot"));
    }, [map, stackedKey, selectedLayerId]);

    useEffect(() => {
        if (!map) return;
        const pointsSource = map.getSource(SOURCE_POINTS) as
            maplibregl.GeoJSONSource | undefined;
        const linesSource = map.getSource(SOURCE_LINES) as
            maplibregl.GeoJSONSource | undefined;
        const buffersSource = map.getSource(SOURCE_BUFFERS) as
            maplibregl.GeoJSONSource | undefined;
        const polygonsSource = map.getSource(SOURCE_POLYGONS) as
            maplibregl.GeoJSONSource | undefined;
        const lineIconsSource = map.getSource(SOURCE_LINE_ICONS) as
            maplibregl.GeoJSONSource | undefined;
        const polygonIconsSource = map.getSource(SOURCE_POLYGON_ICONS) as
            maplibregl.GeoJSONSource | undefined;

        const setIfChanged = (
            id: string,
            source: maplibregl.GeoJSONSource | undefined,
            data: GeoJSON.FeatureCollection,
        ) => {
            const serialized = JSON.stringify(data);
            if (lastSourceDataRef.current[id] === serialized) return;
            lastSourceDataRef.current[id] = serialized;
            source?.setData(data);
        };
        setIfChanged(SOURCE_BUFFERS, buffersSource, collections.buffers);
        setIfChanged(SOURCE_POINTS, pointsSource, collections.points);
        setIfChanged(SOURCE_LINES, linesSource, collections.lines);
        setIfChanged(SOURCE_POLYGONS, polygonsSource, collections.polygons);
        setIfChanged(SOURCE_LINE_ICONS, lineIconsSource, collections.lineIcons);
        setIfChanged(
            SOURCE_POLYGON_ICONS,
            polygonIconsSource,
            collections.polygonIcons,
        );
    }, [map, collections]);

    useEffect(() => {
        if (!map) return undefined;

        function updateHaloOutline() {
            const source = map!.getSource(SOURCE_HALO_OUTLINE) as
                maplibregl.GeoJSONSource | undefined;
            if (!source) return;
            if (!selectedFeatureGeometry) {
                source.setData({ type: "FeatureCollection", features: [] });
                return;
            }
            const distanceDegrees = pixelToleranceToDegrees(
                map!,
                HALO_BUFFER_PX,
            );
            const buffered = bufferFeatureOutline(
                selectedFeatureGeometry,
                distanceDegrees,
            );
            source.setData({
                type: "FeatureCollection",
                features: buffered ? [buffered] : [],
            });
        }

        updateHaloOutline();

        map.on("zoomend", updateHaloOutline);
        return () => {
            map.off("zoomend", updateHaloOutline);
        };
    }, [map, selectedFeatureGeometry]);

    useEffect(() => {
        if (!map) return;
        if (map.getLayer(HALO_POINTS))
            map.setFilter(HALO_POINTS, selectionFilter(selectedFeatureId));
    }, [map, selectedFeatureId]);

    useEffect(() => {
        if (!map || !selectedFeatureId) return undefined;

        const isReducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
        ).matches;
        if (isReducedMotion) {
            if (map.getLayer(HALO_OUTLINE)) {
                map.setPaintProperty(
                    HALO_OUTLINE,
                    "line-width",
                    STATIC_HALO_LINE_WIDTH,
                );
                map.setPaintProperty(
                    HALO_OUTLINE,
                    "line-opacity",
                    STATIC_HALO_LINE_OPACITY,
                );
            }
            if (map.getLayer(HALO_POINTS)) {
                map.setPaintProperty(
                    HALO_POINTS,
                    "circle-radius",
                    STATIC_HALO_CIRCLE_RADIUS,
                );
                map.setPaintProperty(
                    HALO_POINTS,
                    "circle-opacity",
                    STATIC_HALO_CIRCLE_OPACITY,
                );
            }
            return undefined;
        }

        const start = performance.now();
        let frameId: number;
        const tick = (now: number) => {
            const wave = (Math.sin(((now - start) / 1000) * Math.PI) + 1) / 2;
            const lineWidth = 1.5 + wave * 2.5;
            const lineOpacity = 0.25 + wave * 0.45;
            const circleRadius = STATIC_HALO_CIRCLE_RADIUS - 1 + wave * 2;
            const circleOpacity = 0.25 + wave * 0.25;
            if (map.getLayer(HALO_OUTLINE)) {
                map.setPaintProperty(HALO_OUTLINE, "line-width", lineWidth);
                map.setPaintProperty(HALO_OUTLINE, "line-opacity", lineOpacity);
            }
            if (map.getLayer(HALO_POINTS)) {
                map.setPaintProperty(
                    HALO_POINTS,
                    "circle-radius",
                    circleRadius,
                );
                map.setPaintProperty(
                    HALO_POINTS,
                    "circle-opacity",
                    circleOpacity,
                );
            }
            frameId = requestAnimationFrame(tick);
        };
        frameId = requestAnimationFrame(tick);

        return () => cancelAnimationFrame(frameId);
    }, [map, selectedFeatureId]);

    return null;
}
