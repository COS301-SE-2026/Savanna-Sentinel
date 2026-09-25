import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import { ColourPickerPopover } from "@/components/workspace/ColourPickerPopover";
import { WORKSPACE_QUICK_COLOURS } from "@/lib/workspace/colours";

describe("ColourPickerPopover", () => {
    it("shows the current colour on the trigger button", () => {
        render(
            <ColourPickerPopover
                label="Colour"
                colour="#0070bf"
                onChange={() => {}}
            />,
        );
        expect(
            screen.getByRole("button", { name: "Colour" }),
        ).toHaveTextContent("#0070bf");
    });

    it("lets the colour be typed in manually as a hex code", async () => {
        const onChange = vi.fn();
        render(
            <ColourPickerPopover
                label="Colour"
                colour="#0070bf"
                onChange={onChange}
            />,
        );

        await userEvent.click(screen.getByRole("button", { name: "Colour" }));
        const hexInput = await screen.findByRole("textbox", {
            name: "Colour hex code",
        });
        await userEvent.clear(hexInput);
        await userEvent.type(hexInput, "009193");

        expect(onChange).toHaveBeenCalledWith("#009193");
    });

    it("selects a colour from the quick-selection swatches", async () => {
        const onChange = vi.fn();
        render(
            <ColourPickerPopover
                label="Colour"
                colour="#0070bf"
                onChange={onChange}
            />,
        );

        await userEvent.click(screen.getByRole("button", { name: "Colour" }));
        const swatch = WORKSPACE_QUICK_COLOURS[0];
        await userEvent.click(
            await screen.findByRole("button", { name: swatch.label }),
        );

        expect(onChange).toHaveBeenCalledWith(swatch.value);
    });

    it("marks the swatch matching the current colour as pressed", async () => {
        const swatch = WORKSPACE_QUICK_COLOURS[0];
        render(
            <ColourPickerPopover
                label="Colour"
                colour={swatch.value}
                onChange={() => {}}
            />,
        );

        await userEvent.click(screen.getByRole("button", { name: "Colour" }));

        expect(
            await screen.findByRole("button", { name: swatch.label }),
        ).toHaveAttribute("aria-pressed", "true");
    });
});
