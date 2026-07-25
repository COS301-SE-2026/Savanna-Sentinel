import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DataPreview } from "@/components/ingestion/DataPreview";
import type { ColDef } from "@/lib/ingestionSchema";

const schema: ColDef[] = [
    { name: "id", type: "number" },
    { name: "name", type: "string" },
];

describe("DataPreview", () => {
    it("renders one input per cell", () => {
        render(
            <DataPreview
                schema={schema}
                rows={[["1", "Alice"]]}
                serverErrors={null}
                onCellChange={vi.fn()}
            />,
        );
        expect(screen.getByDisplayValue("1")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Alice")).toBeInTheDocument();
    });

    it("flags a type-invalid cell with a critical badge", () => {
        render(
            <DataPreview
                schema={schema}
                rows={[["not-a-number", "Alice"]]}
                serverErrors={null}
                onCellChange={vi.fn()}
            />,
        );
        expect(screen.getByText(/expected number/i)).toBeInTheDocument();
    });

    it("flags a server-validation error on the matching cell", () => {
        render(
            <DataPreview
                schema={schema}
                rows={[["1", "Alice"]]}
                serverErrors={{
                    row_1: [
                        {
                            column: "name",
                            error_type: "duplicate",
                            message: "Duplicate name",
                        },
                    ],
                }}
                onCellChange={vi.fn()}
            />,
        );
        expect(screen.getByText("Duplicate name")).toBeInTheDocument();
    });

    it("calls onCellChange when a cell is edited", async () => {
        const onCellChange = vi.fn();
        render(
            <DataPreview
                schema={schema}
                rows={[["1", "Alice"]]}
                serverErrors={null}
                onCellChange={onCellChange}
            />,
        );
        const input = screen.getByDisplayValue("Alice");
        (input as HTMLInputElement).focus();
        await import("@testing-library/user-event").then(({ default: ue }) =>
            ue.setup().type(input, "x"),
        );
        expect(onCellChange).toHaveBeenCalled();
    });
});
