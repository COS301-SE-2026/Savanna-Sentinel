import { HeatmapLayer } from "@/components/map/HeatmapLayer";
import { MapView } from "@/components/map/MapView";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { FileUploadDropzone } from "@/components/ui/file-upload-dropzone";
import { notifyCritical } from "@/components/ui/toast";
import { parseGridCells } from "@/lib/riskGrid";
import { riskApi, type ParkGridResponse } from "@/services/riskApi";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const DEFAULT_ZOOM = 10;
const DEFAULT_RISK_SCORE = 0.5;

const getGridCenterAndBounds = (cells: ReturnType<typeof parseGridCells>) => {
    let minLng = Infinity,
        maxLng = -Infinity;
    let minLat = Infinity,
        maxLat = -Infinity;

    for (const cell of cells) {
        for (const [lng, lat] of cell.corners) {
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
        }
    }

    const center: [number, number] = [
        (minLng + maxLng) / 2,
        (minLat + maxLat) / 2,
    ];
    const bounds: [[number, number], [number, number]] = [
        [minLng, minLat],
        [maxLng, maxLat],
    ];

    return { center, bounds };
};

const ParkZoneUploadPage = () => {
    const [mapCenter, setMapCenter] = useState<[number, number]>([
        20.33, -34.41,
    ]);
    const [map, setMap] = useState<maplibregl.Map | null>(null);
    const [mapBounds, setMapBounds] = useState<
        [[number, number], [number, number]] | null
    >(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [grid, setGrid] = useState<ParkGridResponse | null>(null);
    const [riskByCell, setRiskByCell] = useState<Map<string, number>>(
        new Map(),
    );

    const navigate = useNavigate();

    const handleFilesSelected = async (files: FileList | null) => {
        const file = files?.[0];
        if (!file) {
            return;
        }
        try {
            await riskApi.uploadParkZone(file);
            const response = await riskApi.getParkGrid();
            setGrid(response);

            const cells = parseGridCells(response);
            if (cells.length > 0) {
                const emptyRiskMap = new Map<string, number>(
                    cells.map((cell) => [cell.cellId, DEFAULT_RISK_SCORE]),
                );
                setRiskByCell(emptyRiskMap);
                const { center, bounds } = getGridCenterAndBounds(cells);
                setMapCenter(center);
                setMapBounds(bounds);
            }
            setIsConfirmOpen(true);
        } catch {
            notifyCritical("Failed to upload park zone file");
        }
    };

    const handleConfirm = async () => {
        setIsConfirmOpen(false);
        navigate("/profile");
    };
    const handleReject = async () => {
        try {
            await riskApi.deleteUpload().then(() => {
                setIsConfirmOpen(false);
            });
        } catch {
            notifyCritical("Failed to delete park zone file");
        }
    };

    useEffect(() => {
        if (map && mapBounds) {
            map.fitBounds(mapBounds, { padding: 20, animate: false });
        }
    }, [map, mapBounds]);

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
                        <DialogTitle>Confirm Map Layout</DialogTitle>
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
                        <HeatmapLayer
                            map={map}
                            grid={grid}
                            riskByCell={riskByCell}
                            pickingActive={false}
                            isMobile={false}
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleReject}
                        >
                            Reject
                        </Button>
                        <Button
                            type="button"
                            variant="default"
                            onClick={handleConfirm}
                        >
                            Confirm
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ParkZoneUploadPage;
