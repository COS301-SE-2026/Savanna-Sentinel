import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ValidationErrors } from "@/components/ingestion/ValidationErrors";

describe("ValidationErrors", () => {
    it("renders nothing when there are no errors", () => {
        const { container } = render(<ValidationErrors errors={null} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("summarises affected row count and messages", () => {
        render(
            <ValidationErrors
                errors={{
                    row_1: [{ column: "id", error_type: "dup", message: "Duplicate id" }],
                    row_3: [{ column: "name", error_type: "req", message: "Name required" }],
                }}
            />,
        );
        expect(screen.getByText(/2 rows failed server validation/i)).toBeInTheDocument();
        expect(screen.getByText(/duplicate id/i)).toBeInTheDocument();
        expect(screen.getByText(/name required/i)).toBeInTheDocument();
    });
});
