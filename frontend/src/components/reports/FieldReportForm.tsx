import * as React from "react";

import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { RadioGroup } from "@/components/ui/radio-group";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { PhotoPicker } from "@/components/reports/PhotoPicker";
import { LocationPickerMap } from "@/components/map/LocationPickerMap";
import { notifyCritical } from "@/components/ui/toast";
import { useParkCenter } from "@/hooks/useParkCenter";
import {
    validateReportInput,
    isReportValid,
    type ReportValidationErrors,
} from "@/lib/reportValidation";
import {
    blankDraftReportInput,
    INCIDENT_TYPE_OPTIONS,
    SPECIES_OPTIONS,
    SEVERITY_OPTIONS,
    type DraftReportInput,
    type PhotoAttachment,
    type ReportType,
} from "@/types/reports";
import type { LatLon } from "@/types/patrol";
import { cn } from "@/lib/utils";

const OTHER = "Other";

const REPORT_TYPE_OPTIONS: { value: ReportType; label: string }[] = [
    { value: "incident", label: "Incident" },
    { value: "sighting", label: "Sighting" },
];

const DEFAULT_ZOOM = 10;
const PIN_PRECISION = 6;

function toCoordString(value: number) {
    return String(Number(value.toFixed(PIN_PRECISION)));
}

function resolveSelectAndOther(value: string, options: readonly string[]) {
    if (value === "") return { select: "", other: "" };
    if (options.includes(value) && value !== OTHER) {
        return { select: value, other: "" };
    }
    return { select: OTHER, other: value };
}

export interface FieldReportFormProps {
    mode: "create" | "edit";
    initialValue?: DraftReportInput;
    onSubmit: (input: DraftReportInput) => void;
    onDelete?: () => void;
}

export function FieldReportForm({
    mode,
    initialValue,
    onSubmit,
    onDelete,
}: FieldReportFormProps) {
    const base = initialValue ?? blankDraftReportInput();
    const initialIncident = resolveSelectAndOther(
        base.incidentType,
        INCIDENT_TYPE_OPTIONS,
    );
    const initialSpecies = resolveSelectAndOther(base.species, SPECIES_OPTIONS);

    const [reportType, setReportType] = React.useState<ReportType>(
        base.reportType,
    );
    const [description, setDescription] = React.useState(base.description);
    const [incidentTypeSelect, setIncidentTypeSelect] = React.useState(
        initialIncident.select,
    );
    const [incidentTypeOther, setIncidentTypeOther] = React.useState(
        initialIncident.other,
    );
    const [severity, setSeverity] = React.useState(base.severity);
    const [speciesSelect, setSpeciesSelect] = React.useState(
        initialSpecies.select,
    );
    const [speciesOther, setSpeciesOther] = React.useState(
        initialSpecies.other,
    );
    const [count, setCount] = React.useState<string>(
        base.count === null ? "" : String(base.count),
    );
    const [occurredAt, setOccurredAt] = React.useState(base.occurredAt);
    const [lat, setLat] = React.useState<string>(
        base.lat === null ? "" : String(base.lat),
    );
    const [lon, setLon] = React.useState<string>(
        base.lon === null ? "" : String(base.lon),
    );
    const [photos, setPhotos] = React.useState<PhotoAttachment[]>(base.photos);
    const [errors, setErrors] = React.useState<ReportValidationErrors>({});
    const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);

    const resolvedIncidentType =
        incidentTypeSelect === OTHER ? incidentTypeOther : incidentTypeSelect;
    const resolvedSpecies =
        speciesSelect === OTHER ? speciesOther : speciesSelect;

    const pinLocation = React.useMemo<LatLon | null>(() => {
        if (lat.trim() === "" || lon.trim() === "") return null;
        const latValue = Number(lat);
        const lonValue = Number(lon);
        if (!Number.isFinite(latValue) || !Number.isFinite(lonValue)) {
            return null;
        }
        if (latValue < -90 || latValue > 90) return null;
        if (lonValue < -180 || lonValue > 180) return null;
        return { lat: latValue, lon: lonValue };
    }, [lat, lon]);

    const handlePinChange = React.useCallback((point: LatLon) => {
        setLat(toCoordString(point.lat));
        setLon(toCoordString(point.lon));
    }, []);

    const parkCenter = useParkCenter();
    const [initialPin] = React.useState<[number, number] | null>(() =>
        base.lat !== null && base.lon !== null ? [base.lon, base.lat] : null,
    );
    const mapCenter = initialPin ?? parkCenter;

    const buildInput = (): DraftReportInput => ({
        reportType,
        description,
        incidentType: reportType === "incident" ? resolvedIncidentType : "",
        severity: reportType === "incident" ? severity : null,
        species: reportType === "sighting" ? resolvedSpecies : "",
        count:
            reportType === "sighting" && count.trim() !== ""
                ? Number(count)
                : null,
        occurredAt,
        lat: lat.trim() === "" ? null : Number(lat),
        lon: lon.trim() === "" ? null : Number(lon),
        photos,
    });

    const useCurrentLocation = () => {
        if (!navigator.geolocation) {
            notifyCritical(
                "Couldn't get your location, enter it manually below.",
            );
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLat(toCoordString(position.coords.latitude));
                setLon(toCoordString(position.coords.longitude));
            },
            () => {
                notifyCritical(
                    "Couldn't get your location, enter it manually below.",
                );
            },
        );
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        const input = buildInput();
        const validationErrors = validateReportInput(input);
        if (incidentTypeSelect === OTHER && incidentTypeOther.trim() === "") {
            validationErrors.incidentType = "Specify the incident type.";
        }
        if (speciesSelect === OTHER && speciesOther.trim() === "") {
            validationErrors.species = "Specify the species.";
        }
        setErrors(validationErrors);
        if (!isReportValid(validationErrors)) return;
        onSubmit(input);
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <RadioGroup
                legend="Report Type"
                name="reportType"
                options={REPORT_TYPE_OPTIONS}
                value={reportType}
                onChange={setReportType}
            />

            <div className="flex flex-col gap-1">
                <label
                    htmlFor="report-description"
                    className="text-sm font-medium text-color-text-primary"
                >
                    Description
                </label>
                <Textarea
                    id="report-description"
                    value={description}
                    maxLength={300}
                    placeholder="Describe what you observed..."
                    onChange={(event) => setDescription(event.target.value)}
                    aria-invalid={Boolean(errors.description)}
                />
                <div className="flex items-center justify-between">
                    <span className="text-xs text-status-critical">
                        {errors.description}
                    </span>
                    <span className="text-xs text-color-text-primary">
                        {description.length} / 300
                    </span>
                </div>
            </div>

            {reportType === "incident" && (
                <>
                    <div className="flex flex-col gap-1">
                        <label
                            htmlFor="incident-type"
                            className="text-sm font-medium text-color-text-primary"
                        >
                            Incident Type
                        </label>
                        <Select
                            id="incident-type"
                            value={incidentTypeSelect}
                            aria-invalid={Boolean(errors.incidentType)}
                            onChange={(event) =>
                                setIncidentTypeSelect(event.target.value)
                            }
                        >
                            <option value="">Select an incident type...</option>
                            {INCIDENT_TYPE_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </Select>
                        {incidentTypeSelect === OTHER && (
                            <Input
                                aria-label="Specify incident type"
                                aria-invalid={Boolean(errors.incidentType)}
                                placeholder="Specify incident type"
                                value={incidentTypeOther}
                                onChange={(event) =>
                                    setIncidentTypeOther(event.target.value)
                                }
                            />
                        )}
                        {errors.incidentType && (
                            <span className="text-xs text-status-critical">
                                {errors.incidentType}
                            </span>
                        )}
                    </div>

                    <RadioGroup
                        legend="Severity"
                        name="severity"
                        options={SEVERITY_OPTIONS}
                        value={severity}
                        onChange={setSeverity}
                    />
                </>
            )}

            {reportType === "sighting" && (
                <>
                    <div className="flex flex-col gap-1">
                        <label
                            htmlFor="species"
                            className="text-sm font-medium text-color-text-primary"
                        >
                            Species
                        </label>
                        <Select
                            id="species"
                            value={speciesSelect}
                            aria-invalid={Boolean(errors.species)}
                            onChange={(event) =>
                                setSpeciesSelect(event.target.value)
                            }
                        >
                            <option value="">Select a species...</option>
                            {SPECIES_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </Select>
                        {speciesSelect === OTHER && (
                            <Input
                                aria-label="Specify species"
                                aria-invalid={Boolean(errors.species)}
                                placeholder="Specify species"
                                value={speciesOther}
                                onChange={(event) =>
                                    setSpeciesOther(event.target.value)
                                }
                            />
                        )}
                        {errors.species && (
                            <span className="text-xs text-status-critical">
                                {errors.species}
                            </span>
                        )}
                    </div>

                    <div className="flex flex-col gap-1">
                        <label
                            htmlFor="count"
                            className="text-sm font-medium text-color-text-primary"
                        >
                            Count
                        </label>
                        <Input
                            id="count"
                            type="number"
                            min={1}
                            step={1}
                            value={count}
                            aria-invalid={Boolean(errors.count)}
                            onChange={(event) => setCount(event.target.value)}
                        />
                        {errors.count && (
                            <span className="text-xs text-status-critical">
                                {errors.count}
                            </span>
                        )}
                    </div>
                </>
            )}

            <div className="flex flex-col gap-1">
                <label
                    htmlFor="occurred-at"
                    className="text-sm font-medium text-color-text-primary"
                >
                    When did this happen?
                </label>
                <DateTimeInput
                    id="occurred-at"
                    value={occurredAt}
                    aria-invalid={Boolean(errors.occurredAt)}
                    onChange={(event) => setOccurredAt(event.target.value)}
                />
                {errors.occurredAt && (
                    <span className="text-xs text-status-critical">
                        {errors.occurredAt}
                    </span>
                )}
            </div>

            <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-color-text-primary">
                    Location
                </span>
                <Button
                    type="button"
                    variant="outline"
                    onClick={useCurrentLocation}
                    className="self-start"
                >
                    Use current location
                </Button>
                <LocationPickerMap
                    value={pinLocation}
                    onChange={handlePinChange}
                    center={mapCenter}
                    zoom={DEFAULT_ZOOM}
                />
                <p className="text-xs text-color-text-secondary">
                    Click the map to drop a pin, drag it to fine tune, or type
                    the coordinates below.
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                        <label
                            htmlFor="lat"
                            className="text-sm text-color-text-primary"
                        >
                            Latitude
                        </label>
                        <Input
                            id="lat"
                            type="number"
                            step="any"
                            value={lat}
                            aria-invalid={Boolean(errors.lat)}
                            onChange={(event) => setLat(event.target.value)}
                        />
                        {errors.lat && (
                            <span className="text-xs text-status-critical">
                                {errors.lat}
                            </span>
                        )}
                    </div>
                    <div className="flex flex-col gap-1">
                        <label
                            htmlFor="lon"
                            className="text-sm text-color-text-primary"
                        >
                            Longitude
                        </label>
                        <Input
                            id="lon"
                            type="number"
                            step="any"
                            value={lon}
                            aria-invalid={Boolean(errors.lon)}
                            onChange={(event) => setLon(event.target.value)}
                        />
                        {errors.lon && (
                            <span className="text-xs text-status-critical">
                                {errors.lon}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-color-text-primary">
                    Photos (optional)
                </span>
                {/* todo
                    upload each photo to a presigned MinIO URL
                    and replace this local state with the
                    resulting image URLs in the images: string[] field
                    before postings. */}
                <PhotoPicker photos={photos} onChange={setPhotos} />
            </div>

            <div
                className={cn(
                    "flex gap-3",
                    mode === "edit" ? "justify-between" : "justify-end",
                )}
            >
                {mode === "edit" && (
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={() => setIsDeleteOpen(true)}
                    >
                        Delete Draft
                    </Button>
                )}
                <Button type="submit">
                    {mode === "edit" ? "Save Draft" : "Submit Report"}
                </Button>
            </div>

            {mode === "edit" && (
                <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                    <DialogContent preventBackdropClose>
                        <DialogHeader>
                            <DialogTitle>Delete Report?</DialogTitle>
                        </DialogHeader>
                        <DialogDescription>
                            This report will be removed from your pending queue.
                            This cannot be undone.
                        </DialogDescription>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsDeleteOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={() => {
                                    setIsDeleteOpen(false);
                                    onDelete?.();
                                }}
                            >
                                Delete Report
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </form>
    );
}
