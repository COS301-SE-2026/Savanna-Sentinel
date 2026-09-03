export type Expectation = "string" | "number" | "boolean" | "date";

export interface ColDef {
    name: string;
    type: Expectation;
    optional?: boolean;
}

export const FILE_SCHEMA: ColDef[] = [
    { name: "submitted_by", type: "string" },
    { name: "report_type", type: "string" },
    { name: "description", type: "string" },
    { name: "lat", type: "number" },
    { name: "lon", type: "number" },
    { name: "occurred_at", type: "date" },
    { name: "incident_type", type: "string", optional: true },
    { name: "severity", type: "string", optional: true },
    { name: "species", type: "string", optional: true },
    { name: "count", type: "number", optional: true },
];

export const validateData = (
    value: string,
    expected: Expectation,
    optional?: boolean,
): boolean => {
    if (!value) return !!optional;
    switch (expected) {
        case "number":
            return !Number.isNaN(Number(value));
        case "boolean":
            return ["true", "false", "1", "0"].includes(value.toLowerCase());
        case "date":
            return !Number.isNaN(Date.parse(value));
        case "string":
        default:
            return true;
    }
};
