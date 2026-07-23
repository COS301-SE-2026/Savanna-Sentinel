import { describe, it, expect } from "vitest";
import { validateReportInput, isReportValid } from "@/lib/reportValidation";
import { blankDraftReportInput } from "@/types/reports";

function validInput() {
    return {
        ...blankDraftReportInput("incident"),
        description: "Found a wire snare near the eastern fence line.",
        incidentType: "Snare Found",
        severity: "medium" as const,
        occurredAt: "2020-01-01T08:00",
        lat: -25.7461,
        lon: 28.1881,
    };
}

describe("validateReportInput", () => {
    it("returns no errors for a fully valid incident report", () => {
        expect(validateReportInput(validInput())).toEqual({});
        expect(isReportValid(validateReportInput(validInput()))).toBe(true);
    });

    it("requires a description", () => {
        const errors = validateReportInput({
            ...validInput(),
            description: "   ",
        });
        expect(errors.description).toBe("Description is required.");
    });

    it("requires incidentType when reportType is incident", () => {
        const errors = validateReportInput({
            ...validInput(),
            incidentType: "",
        });
        expect(errors.incidentType).toBe("Select an incident type.");
    });

    it("requires species when reportType is sighting", () => {
        const errors = validateReportInput({
            ...blankDraftReportInput("sighting"),
            description: "Herd of elephants near the waterhole.",
            species: "",
            occurredAt: "2020-01-01T08:00",
            lat: -25.7461,
            lon: 28.1881,
        });
        expect(errors.species).toBe("Select a species.");
    });

    it("does not require incidentType for a sighting report", () => {
        const errors = validateReportInput({
            ...blankDraftReportInput("sighting"),
            description: "Herd of elephants near the waterhole.",
            species: "Elephant",
            occurredAt: "2020-01-01T08:00",
            lat: -25.7461,
            lon: 28.1881,
        });
        expect(errors.incidentType).toBeUndefined();
    });

    it("rejects a non-positive count", () => {
        const errors = validateReportInput({ ...validInput(), count: 0 });
        expect(errors.count).toBe("Count must be a positive number.");
    });

    it("rejects a fractional count", () => {
        const errors = validateReportInput({ ...validInput(), count: 2.5 });
        expect(errors.count).toBe("Count must be a positive number.");
    });

    it("allows a null count", () => {
        const errors = validateReportInput({ ...validInput(), count: null });
        expect(errors.count).toBeUndefined();
    });

    it("requires occurredAt", () => {
        const errors = validateReportInput({ ...validInput(), occurredAt: "" });
        expect(errors.occurredAt).toBe("When this happened is required.");
    });

    it("rejects a future occurredAt", () => {
        const future = new Date(Date.now() + 60 * 60 * 1000);
        const pad = (n: number) => String(n).padStart(2, "0");
        const futureLocal = `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}T${pad(future.getHours())}:${pad(future.getMinutes())}`;
        const errors = validateReportInput({
            ...validInput(),
            occurredAt: futureLocal,
        });
        expect(errors.occurredAt).toBe("This can't be in the future.");
    });

    it("rejects a missing latitude", () => {
        const errors = validateReportInput({ ...validInput(), lat: null });
        expect(errors.lat).toBe("Latitude must be between -90 and 90.");
    });

    it("rejects an out-of-range latitude", () => {
        const errors = validateReportInput({ ...validInput(), lat: 95 });
        expect(errors.lat).toBe("Latitude must be between -90 and 90.");
    });

    it("rejects an out-of-range longitude", () => {
        const errors = validateReportInput({ ...validInput(), lon: -200 });
        expect(errors.lon).toBe("Longitude must be between -180 and 180.");
    });
});
