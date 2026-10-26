import { HeatmapLayer } from "@/components/map/HeatmapLayer";
import { MapView } from "@/components/map/MapView";
import type * as maplibregl from "maplibre-gl";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { FileUploadDropzone } from "@/components/ui/file-upload-dropzone";
import { notifyCritical, notifySafe } from "@/components/ui/toast";
import { DeleteGridDialog } from "@/components/upload/DeleteGridDialog";
import { getGridCenterAndBounds, parseGridCells } from "@/lib/riskGrid";
import { riskApi, type ParkGridResponse } from "@/services/riskApi";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import axios from "axios";

const DEFAULT_ZOOM = 10;
const DEFAULT_RISK_SCORE = 0.5;

const ExistingGrid = () => {
    const setIsUploaded = useAuthStore((s) => s.setIsUploaded);
    const [grid, setGrid] = useState<ParkGridResponse | null>(null);
    const [hasLoadFailed, setHasLoadFailed] = useState(false);
    const [map, setMap] = useState<maplibregl.Map | null>(null);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        riskApi
            .getParkGrid()
            .then(setGrid)
            .catch(() => setHasLoadFailed(true));
    }, []);

    const cells = useMemo(() => (grid ? parseGridCells(grid) : []), [grid]);
    const view = useMemo(
        () => (cells.length > 0 ? getGridCenterAndBounds(cells) : null),
        [cells],
    );
    // Same flat placeholder score the upload preview uses, so the saved grid
    // renders in the same colour.
    const riskByCell = useMemo(
        () =>
            new Map<string, number>(
                cells.map((cell) => [cell.cellId, DEFAULT_RISK_SCORE]),
            ),
        [cells],
    );

    useEffect(() => {
        if (map && view) {
            map.fitBounds(view.bounds, { padding: 20, animate: false });
        }
    }, [map, view]);

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await riskApi.deleteUpload();
            notifySafe("Park grid deleted");
            setIsUploaded(false);
        } catch {
            notifyCritical("Could not delete the park grid");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div>
            {view ? (
                <div className="relative my-4 h-64 w-full overflow-hidden rounded-md border border-color-border">
                    <MapView
                        center={view.center}
                        zoom={DEFAULT_ZOOM}
                        onMapReady={setMap}
                        onMapRemove={() => setMap(null)}
                        className="absolute inset-0"
                    />
                    <HeatmapLayer
                        map={map}
                        grid={grid}
                        riskByCell={riskByCell}
                        pickingActive={false}
                        isMobile={false}
                        interactive={false}
                    />
                </div>
            ) : (
                <p className="my-4 text-sm text-color-text-secondary">
                    {hasLoadFailed
                        ? "Could not load the current grid."
                        : "Loading the current grid..."}
                </p>
            )}
            <Button
                type="button"
                variant="destructive"
                onClick={() => setIsDeleteOpen(true)}
            >
                Delete grid
            </Button>
            <DeleteGridDialog
                open={isDeleteOpen}
                onOpenChange={setIsDeleteOpen}
                onConfirm={handleDelete}
                isDeleting={isDeleting}
            />
        </div>
    );
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
    const isUploaded = useAuthStore((s) => s.isUploaded);
    const setIsUploaded = useAuthStore((s) => s.setIsUploaded);

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
        } catch (err: unknown) {
            let errorMessage = "Empty";
            if (axios.isAxiosError(err)) {
                if (!err.response) {
                    errorMessage =
                        "Unable to reach the server. Please check your internet connection.";
                } else {
                    switch (err.response.status) {
                        case 400:
                            errorMessage =
                                "The uploaded file is unreadable or not a valid GeoJSON file.";
                            break;
                        case 401:
                            errorMessage =
                                "Your session has expired. Please log in again.";
                            break;
                        case 403:
                            errorMessage =
                                "You do not have permission to upload park zones.";
                            break;
                        case 409:
                            // Another session saved a grid, so show that one.
                            errorMessage =
                                "A park grid already exists. Delete it before uploading a new one.";
                            setIsUploaded(true);
                            break;
                        case 422:
                            errorMessage =
                                "Boundary coordinates must follow standard WGS 84 latitude/longitude formats.";
                            break;
                        default:
                            errorMessage =
                                "An unexpected server error occurred. Please try again or contact the developers.";
                            break;
                    }
                }
            }
            notifyCritical(errorMessage);
        }
    };

    const handleConfirm = async () => {
        setIsUploaded(true);
        setIsConfirmOpen(false);
        navigate("/dashboard");
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
        <div className="mx-auto max-w-[1120px] px-4 pt-8 pb-10 md:px-6">
            <h1 className="mb-6 font-heading text-3xl leading-[1.1] font-bold text-brand-primary">
                Park GeoJson Upload
            </h1>
            {isUploaded ? (
                <ExistingGrid />
            ) : (
                <div>
                    <FileUploadDropzone
                        inputId="park-geojson-file"
                        accept=".geojson,.json"
                        title="Upload WGS84 Boundary File here (.geojson, .json)"
                        hint="Upload the shape file of the game reserve."
                        onFilesSelected={handleFilesSelected}
                    />

                    <Dialog
                        open={isConfirmOpen}
                        onOpenChange={(open) => {
                            // Escape or the close button counts as a reject,
                            // or the saved grid would block the next upload.
                            if (!open) handleReject();
                        }}
                    >
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
                                    interactive={false}
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
            )}
        </div>
    );
};

export default ParkZoneUploadPage;
