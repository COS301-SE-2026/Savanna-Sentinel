import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Textarea } from "@/components/ui/textarea";

describe("Textarea", () => {
    it("renders a textarea element", () => {
        render(<Textarea aria-label="Description" />);
        expect(
            screen.getByRole("textbox", { name: "Description" }),
        ).toBeInTheDocument();
    });

    it("calls onChange as the user types", async () => {
        const onChange = vi.fn();
        render(<Textarea aria-label="Description" onChange={onChange} />);
        await userEvent.type(screen.getByRole("textbox"), "hi");
        expect(onChange).toHaveBeenCalledTimes(2);
    });

    it("respects the disabled attribute", () => {
        render(<Textarea aria-label="Description" disabled />);
        expect(screen.getByRole("textbox")).toBeDisabled();
    });

    it("marks itself invalid when aria-invalid is set", () => {
        render(<Textarea aria-label="Description" aria-invalid="true" />);
        expect(screen.getByRole("textbox")).toHaveAttribute(
            "aria-invalid",
            "true",
        );
    });
});
