import { MapView } from "@/components/map/MapView";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileUploadDropzone } from "@/components/ui/file-upload-dropzone";
import { notifyCritical } from "@/components/ui/toast";
import { parseGridCells } from "@/lib/riskGrid";
import { riskApi } from "@/services/riskApi";
import { useEffect, useState } from "react";

const PARK_ID = "reserve";
const DEFAULT_ZOOM = 10;

const getGridCenterAndBounds = (cells: ReturnType<typeof parseGridCells>) => {
    let minLng = Infinity, maxLng = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;

    for (const cell of cells) {
        for (const [lng, lat] of cell.corners) {
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
        }
    }

    const center: [number, number] = [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
    const bounds: [[number, number], [number, number]] = [[minLng, minLat], [maxLng, maxLat]];

    return { center, bounds };
}

const ParkZoneUploadPage = () => {
    const [mapCenter, setMapCenter] = useState<[number, number]>([20.33, -34.41]);
    const [map, setMap] = useState<maplibregl.Map | null>(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);

    const handleFilesSelected = async (files: FileList | null) => {
        const file = files?.[0]
        if(!file){
            return;
        }

        await riskApi.uploadParkZone(file);

    }

    const handleConfirm = async () => {
        //set env variable here
        return;
    }

    useEffect(() => {
            let isCancelled = false;
            riskApi
                .getParkGrid(PARK_ID)
                .then((response) => {
                    setIsConfirmOpen(true)
                    if (isCancelled) return;
                    
                    const cells = parseGridCells(response)
                    
    
                    if (cells.length > 0){
                        const {center, bounds} = getGridCenterAndBounds(cells);
                        setMapCenter(center)
    
                        if (map) {
                            map.fitBounds(bounds, { padding: 40, animate: false });
                        }
                    }
                })
                .catch(() => {
                    if (!isCancelled) notifyCritical("Could not load risk grid");
                })
            return () => {
                isCancelled = true;
            };
        }, [map]);

    return (
        <div>
            <FileUploadDropzone
                inputId="park-geojson-file"
                //Expand later with testing
                accept=".geojson,.json" 
                title="Upload WGS84 Boundary File here (.geojson, .json)"
                hint="Upload the shape file of the game reserve."
                onFilesSelected={handleFilesSelected}
            />

            <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                <DialogContent preventBackdropClose>
                    <DialogHeader>
                        <DialogTitle>Confirm deletion</DialogTitle>
                    </DialogHeader>
                    <div className="relative my-4 h-64 w-full overflow-hidden rounded-md border border-color-border">
                        <MapView
                            center={mapCenter}
                            zoom={DEFAULT_ZOOM}
                            onMapReady={setMap}
                            onMapRemove={() => setMap(null)}
                            onMapClick={() => {}}
                            className="absolute inset-0"
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsConfirmOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleConfirm}
                        >
                            Confirm
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default ParkZoneUploadPage;