import { Plus, Minus, Compass } from "lucide-react";
import type maplibregl from "maplibre-gl";

import { Button } from "@/components/ui/button";

export interface MapControlsProps {
    map: maplibregl.Map | null;
    defaultCenter?: [number, number];
    defaultZoom?: number;
}

export function MapControls({
    map,
    defaultCenter,
    defaultZoom,
}: MapControlsProps) {
    return (
        <div className="absolute top-2 right-2 z-[var(--z-sticky)] flex flex-col gap-1">
            <Button
                type="button"
                variant="outline"
                size="icon"
                className="bg-color-surface-raised shadow-sm"
                aria-label="Zoom in"
                onClick={() => map?.zoomIn()}
            >
                <Plus />
            </Button>
            <Button
                type="button"
                variant="outline"
                size="icon"
                className="bg-color-surface-raised shadow-sm"
                aria-label="Zoom out"
                onClick={() => map?.zoomOut()}
            >
                <Minus />
            </Button>
            <Button
                type="button"
                variant="outline"
                size="icon"
                className="mt-1 bg-color-surface-raised shadow-sm"
                aria-label="Reset view"
                onClick={() =>
                    map?.flyTo({
                        center: defaultCenter ?? map.getCenter(),
                        zoom: defaultZoom ?? map.getZoom(),
                        bearing: 0,
                        pitch: 0,
                        duration: 400,
                    })
                }
            >
                <Compass />
            </Button>
        </div>
    );
}
