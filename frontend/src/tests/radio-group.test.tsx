import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RadioGroup } from "@/components/ui/radio-group";

type Choice = "a" | "b";

const options: { value: Choice; label: string }[] = [
    { value: "a", label: "Option A" },
    { value: "b", label: "Option B" },
];

describe("RadioGroup", () => {
    it("renders the legend and every option", () => {
        render(
            <RadioGroup
                legend="Pick one"
                name="choice"
                options={options}
                value={null}
                onChange={vi.fn()}
            />,
        );
        expect(screen.getByText("Pick one")).toBeInTheDocument();
        expect(screen.getByLabelText("Option A")).toBeInTheDocument();
        expect(screen.getByLabelText("Option B")).toBeInTheDocument();
    });

    it("reflects the checked option from value", () => {
        render(
            <RadioGroup
                legend="Pick one"
                name="choice"
                options={options}
                value="b"
                onChange={vi.fn()}
            />,
        );
        expect(screen.getByLabelText("Option A")).not.toBeChecked();
        expect(screen.getByLabelText("Option B")).toBeChecked();
    });

    it("calls onChange with the clicked option's value", async () => {
        const onChange = vi.fn();
        render(
            <RadioGroup
                legend="Pick one"
                name="choice"
                options={options}
                value="a"
                onChange={onChange}
            />,
        );
        await userEvent.click(screen.getByLabelText("Option B"));
        expect(onChange).toHaveBeenCalledWith("b");
    });

    it("shares one name attribute across all options so they behave as one group", () => {
        render(
            <RadioGroup
                legend="Pick one"
                name="choice"
                options={options}
                value={null}
                onChange={vi.fn()}
            />,
        );
        expect(screen.getByLabelText("Option A")).toHaveAttribute(
            "name",
            "choice",
        );
        expect(screen.getByLabelText("Option B")).toHaveAttribute(
            "name",
            "choice",
        );
    });
});
