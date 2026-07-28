import type { DraftReportInput } from "@/types/reports";

export interface ReportValidationErrors {
    description?: string;
    incidentType?: string;
    species?: string;
    count?: string;
    occurredAt?: string;
    lat?: string;
    lon?: string;
}

export function validateReportInput(
    input: DraftReportInput,
): ReportValidationErrors {
    const errors: ReportValidationErrors = {};

    if (input.description.trim() === "") {
        errors.description = "Description is required.";
    }

    if (input.reportType === "incident" && input.incidentType.trim() === "") {
        errors.incidentType = "Select an incident type.";
    }

    if (input.reportType === "sighting" && input.species.trim() === "") {
        errors.species = "Select a species.";
    }

    if (
        input.count !== null &&
        (!Number.isInteger(input.count) || input.count <= 0)
    ) {
        errors.count = "Count must be a positive number.";
    }

    if (input.occurredAt.trim() === "") {
        errors.occurredAt = "When this happened is required.";
    } else if (new Date(input.occurredAt).getTime() > Date.now()) {
        errors.occurredAt = "This can't be in the future.";
    }

    if (input.lat === null || input.lat < -90 || input.lat > 90) {
        errors.lat = "Latitude must be between -90 and 90.";
    }

    if (input.lon === null || input.lon < -180 || input.lon > 180) {
        errors.lon = "Longitude must be between -180 and 180.";
    }

    return errors;
}

export function isReportValid(errors: ReportValidationErrors): boolean {
    return Object.keys(errors).length === 0;
}
