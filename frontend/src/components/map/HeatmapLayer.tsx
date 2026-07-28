import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import maplibregl from "maplibre-gl";

import type { ParkGridResponse } from "@/services/riskApi";
import {
    parseGridCells,
    buildGridFeatureCollection,
    type GridCell,
} from "@/lib/riskGrid";
import { getRiskLevel, type RiskLevel } from "@/lib/mapTokens";
import { getCellFactors } from "@/lib/cellFactors";
import { CellPopupContent } from "@/components/map/CellPopupContent";
import { CellAnalysisPanel } from "@/components/map/CellAnalysisPanel";

const SOURCE_ID = "patrol-risk-grid";
const LAYER_ID = "patrol-risk-grid-fill";

export interface HeatmapLayerProps {
    map: maplibregl.Map | null;
    grid: ParkGridResponse | null;
    riskByCell: Map<string, number>;
    pickingActive: boolean;
    isMobile: boolean;
}

interface SelectedCell {
    cell: GridCell;
    level: RiskLevel;
    score: number;
}

function cellCentroid(cell: GridCell): [number, number] {
    const [w, n] = cell.corners[0];
    const [e, s] = cell.corners[2];
    return [(w + e) / 2, (n + s) / 2];
}

export function HeatmapLayer({
    map,
    grid,
    riskByCell,
    pickingActive,
    isMobile,
}: HeatmapLayerProps) {
    const pickingActiveRef = useRef(pickingActive);
    useEffect(() => {
        pickingActiveRef.current = pickingActive;
    }, [pickingActive]);

    const riskByCellRef = useRef(riskByCell);
    useEffect(() => {
        riskByCellRef.current = riskByCell;
    }, [riskByCell]);

    const cellIndexRef = useRef<Map<string, GridCell>>(new Map());

    const [selected, setSelected] = useState<SelectedCell | null>(null);

    const [analysisCell, setAnalysisCell] = useState<SelectedCell | null>(null);
    const [isPanelClosing, setIsPanelClosing] = useState(false);
    const analysisCellRef = useRef(analysisCell);
    useEffect(() => {
        analysisCellRef.current = analysisCell;
    }, [analysisCell]);

    function openAnalysis(cell: SelectedCell) {
        setSelected(null);
        setAnalysisCell(cell);
        setIsPanelClosing(false);
    }

    function closeAnalysis() {
        setIsPanelClosing(true);
    }

    useEffect(() => {
        if (!map || !grid) return undefined;

        const cells = parseGridCells(grid);
        cellIndexRef.current = new Map(
            cells.map((cell) => [cell.cellId, cell]),
        );
        const data = buildGridFeatureCollection(cells, riskByCellRef.current);

        map.addSource(SOURCE_ID, { type: "geojson", data });
        map.addLayer({
            id: LAYER_ID,
            type: "fill",
            source: SOURCE_ID,
            paint: {
                "fill-color": ["get", "fillColor"],
                "fill-opacity": ["get", "fillOpacity"],
            },
        });

        const handleClick = (e: maplibregl.MapMouseEvent) => {
            if (pickingActiveRef.current) return;
            const feature = map.queryRenderedFeatures(e.point, {
                layers: [LAYER_ID],
            })[0];
            if (!feature) {
                setSelected(null);
                if (analysisCellRef.current) closeAnalysis();
                return;
            }
            const cellId = feature.properties?.cellId as string;
            const cell = cellIndexRef.current.get(cellId);
            if (!cell) return;
            const score = riskByCellRef.current.get(cellId) ?? 0;
            setSelected({ cell, level: getRiskLevel(score), score });
            if (analysisCellRef.current) closeAnalysis();
        };

        map.on("click", handleClick);

        return () => {
            map.off("click", handleClick);
            if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
            if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
            setSelected(null);
        };
    }, [map, grid]);

    // Refresh fill data whenever risk scores change, without touching the layer.
    useEffect(() => {
        if (!map || !grid) return;
        const source = map.getSource(SOURCE_ID) as
            maplibregl.GeoJSONSource | undefined;
        if (!source) return;
        const cells = parseGridCells(grid);
        source.setData(buildGridFeatureCollection(cells, riskByCell));
    }, [map, grid, riskByCell]);

    useEffect(() => {
        if (!map || (!selected && !analysisCell)) return undefined;
        const mapContainer = map.getContainer();

        const dismiss = () => {
            setSelected(null);
            if (analysisCellRef.current) closeAnalysis();
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") dismiss();
        };
        const handleDocumentClick = (e: MouseEvent) => {
            if (e.composedPath().includes(mapContainer)) return;
            dismiss();
        };

        document.addEventListener("keydown", handleKeyDown);
        document.addEventListener("click", handleDocumentClick);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener("click", handleDocumentClick);
        };
    }, [map, selected, analysisCell]);

    useEffect(() => {
        if (!map || !selected || isMobile) return undefined;

        const container = document.createElement("div");
        const root: Root = createRoot(container);
        root.render(
            <CellPopupContent
                level={selected.level}
                row={selected.cell.row}
                col={selected.cell.col}
                factors={getCellFactors(selected.cell.cellId)}
                onClose={() => setSelected(null)}
                onViewAnalysis={() => openAnalysis(selected)}
            />,
        );

        const popup = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 12,
            maxWidth: "none",
            className: "cell-popup",
        })
            .setLngLat(cellCentroid(selected.cell))
            .setDOMContent(container)
            .addTo(map);

        return () => {
            popup.remove();
            setTimeout(() => root.unmount(), 0);
        };
    }, [map, selected, isMobile]);

    // Mobile: anchored to the top of the canvas rather than the cell.
    const mobilePopup =
        isMobile && selected ? (
            <div className="pointer-events-none absolute inset-x-0 top-2 z-[var(--z-dropdown)] flex justify-center px-2">
                <div className="pointer-events-auto">
                    <CellPopupContent
                        level={selected.level}
                        row={selected.cell.row}
                        col={selected.cell.col}
                        factors={getCellFactors(selected.cell.cellId)}
                        onClose={() => setSelected(null)}
                        onViewAnalysis={() => openAnalysis(selected)}
                    />
                </div>
            </div>
        ) : null;

    if (!map) return null;

    return createPortal(
        <>
            {mobilePopup}
            {analysisCell && (
                <CellAnalysisPanel
                    level={analysisCell.level}
                    row={analysisCell.cell.row}
                    col={analysisCell.cell.col}
                    score={analysisCell.score}
                    factors={getCellFactors(analysisCell.cell.cellId)}
                    isClosing={isPanelClosing}
                    onClose={closeAnalysis}
                    onClosed={() => {
                        setAnalysisCell(null);
                        setIsPanelClosing(false);
                    }}
                />
            )}
        </>,
        map.getContainer(),
    );
}
