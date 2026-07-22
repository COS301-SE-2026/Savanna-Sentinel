import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DateTimeInput } from "@/components/ui/datetime-input";

function expectedMax() {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

describe("DateTimeInput", () => {
    it("renders as a datetime-local input", () => {
        render(<DateTimeInput aria-label="When did this happen?" />);
        expect(screen.getByLabelText("When did this happen?")).toHaveAttribute(
            "type",
            "datetime-local",
        );
    });

    it("sets max to the current local datetime so the future can't be picked", () => {
        render(<DateTimeInput aria-label="When did this happen?" />);
        expect(screen.getByLabelText("When did this happen?")).toHaveAttribute(
            "max",
            expectedMax(),
        );
    });

    it("forwards value and onChange like a normal input", async () => {
        const onChange = vi.fn();
        render(
            <DateTimeInput
                aria-label="When did this happen?"
                value="2020-01-01T08:00"
                onChange={onChange}
            />,
        );
        expect(screen.getByLabelText("When did this happen?")).toHaveValue(
            "2020-01-01T08:00",
        );
    });
});
