import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import { GpsLossToggle } from "@/components/dev/GpsLossToggle";

describe("GpsLossToggle", () => {
    it("turns forcing on when clicked while off", async () => {
        const onToggle = vi.fn();
        render(<GpsLossToggle active={false} onToggle={onToggle} />);

        const button = screen.getByRole("button", {
            name: /simulate gps loss/i,
        });
        expect(button).toHaveAttribute("aria-pressed", "false");

        await userEvent.click(button);
        expect(onToggle).toHaveBeenCalledWith(true);
    });

    it("turns forcing off when clicked while on", async () => {
        const onToggle = vi.fn();
        render(<GpsLossToggle active onToggle={onToggle} />);

        const button = screen.getByRole("button", {
            name: /simulate gps loss/i,
        });
        expect(button).toHaveAttribute("aria-pressed", "true");

        await userEvent.click(button);
        expect(onToggle).toHaveBeenCalledWith(false);
    });
});
