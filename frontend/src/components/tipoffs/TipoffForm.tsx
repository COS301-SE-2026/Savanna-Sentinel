import * as React from "react";

import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { RadioGroup } from "@/components/ui/radio-group";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { Button } from "@/components/ui/button";
import { PhotoPicker } from "@/components/reports/PhotoPicker";
import { LocationPickerMap } from "@/components/map/LocationPickerMap";
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

const OTHER = "Other";

const REPORT_TYPE_OPTIONS: { value: ReportType; label: string }[] = [
    { value: "incident", label: "Incident" },
    { value: "sighting", label: "Sighting" },
];

const PARK_CENTER: [number, number] = [31.18, -24.2];
const DEFAULT_ZOOM = 10;

export interface TipoffFormProps {
    onSubmit: (input: DraftReportInput) => void;
    isSubmitting?: boolean;
}

export function TipoffForm({ onSubmit, isSubmitting }: TipoffFormProps) {
    const base = blankDraftReportInput();

    const [reportType, setReportType] = React.useState<ReportType>(
        base.reportType,
    );
    const [description, setDescription] = React.useState(base.description);
    const [incidentTypeSelect, setIncidentTypeSelect] = React.useState("");
    const [incidentTypeOther, setIncidentTypeOther] = React.useState("");
    const [severity, setSeverity] = React.useState(base.severity);
    const [speciesSelect, setSpeciesSelect] = React.useState("");
    const [speciesOther, setSpeciesOther] = React.useState("");
    const [count, setCount] = React.useState<string>("");
    const [occurredAt, setOccurredAt] = React.useState(base.occurredAt);
    const [location, setLocation] = React.useState<LatLon | null>(null);
    const [photos, setPhotos] = React.useState<PhotoAttachment[]>([]);
    const [locationError, setLocationError] = React.useState<string | null>(
        null,
    );
    const [errors, setErrors] = React.useState<ReportValidationErrors>({});

    const resolvedIncidentType =
        incidentTypeSelect === OTHER ? incidentTypeOther : incidentTypeSelect;
    const resolvedSpecies =
        speciesSelect === OTHER ? speciesOther : speciesSelect;

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
        lat: location?.lat ?? null,
        lon: location?.lon ?? null,
        photos,
    });

    const useCurrentLocation = () => {
        setLocationError(null);
        if (!navigator.geolocation) {
            setLocationError(
                "Couldn't get your location, drop a pin on the map instead.",
            );
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({
                    lat: position.coords.latitude,
                    lon: position.coords.longitude,
                });
            },
            () => {
                setLocationError(
                    "Couldn't get your location, drop a pin on the map instead.",
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
                    htmlFor="tipoff-description"
                    className="text-sm font-medium text-color-text-primary"
                >
                    Description
                </label>
                <Textarea
                    id="tipoff-description"
                    value={description}
                    maxLength={300}
                    placeholder="Describe what was reported..."
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
                            htmlFor="tipoff-incident-type"
                            className="text-sm font-medium text-color-text-primary"
                        >
                            Incident Type
                        </label>
                        <Select
                            id="tipoff-incident-type"
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
                            htmlFor="tipoff-species"
                            className="text-sm font-medium text-color-text-primary"
                        >
                            Species
                        </label>
                        <Select
                            id="tipoff-species"
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
                            htmlFor="tipoff-count"
                            className="text-sm font-medium text-color-text-primary"
                        >
                            Count
                        </label>
                        <Input
                            id="tipoff-count"
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
                    htmlFor="tipoff-occurred-at"
                    className="text-sm font-medium text-color-text-primary"
                >
                    When did this happen?
                </label>
                <DateTimeInput
                    id="tipoff-occurred-at"
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
                {locationError && (
                    <span className="text-xs text-status-critical">
                        {locationError}
                    </span>
                )}
                <LocationPickerMap
                    value={location}
                    onChange={setLocation}
                    center={PARK_CENTER}
                    zoom={DEFAULT_ZOOM}
                />
                <p className="text-xs text-color-text-secondary">
                    Click the map to drop a pin, or drag it to fine-tune the
                    location.
                </p>
                {(errors.lat || errors.lon) && (
                    <span className="text-xs text-status-critical">
                        Select a location on the map.
                    </span>
                )}
            </div>

            <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-color-text-primary">
                    Photos (optional)
                </span>
                <PhotoPicker photos={photos} onChange={setPhotos} />
            </div>

            <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Submitting..." : "Submit Tip-off"}
                </Button>
            </div>
        </form>
    );
}
