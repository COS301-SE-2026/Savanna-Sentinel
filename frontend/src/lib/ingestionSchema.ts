export type Expectation = "string" | "number" | "boolean" | "date";

export interface ColDef {
    name: string;
    type: Expectation;
}

export const FILE_SCHEMA: ColDef[] = [
    { name: "record_id", type: "number" },
    { name: "ingestion_timestamp", type: "date" },
    { name: "source_system", type: "string" },
    { name: "data_domain", type: "string" },
    { name: "event_type", type: "string" },
    { name: "payload_size_kb", type: "number" },
    { name: "priority_level", type: "string" },
    { name: "retry_count", type: "number" },
    { name: "is_encrypted", type: "boolean" },
    { name: "status", type: "string" },
];

export const validateData = (value: string, expected: Expectation): boolean => {
    if (!value) return false;
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
