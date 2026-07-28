import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";

import { MapLegend } from "@/components/map/MapLegend";

describe("MapLegend", () => {
    it("renders collapsed by default, showing short labels only", () => {
        render(<MapLegend />);
        expect(
            screen.getByRole("button", { name: /expand risk legend/i }),
        ).toBeInTheDocument();
        expect(screen.queryByText("Critical")).not.toBeInTheDocument();
    });

    it("expands to show full risk level labels on click", async () => {
        render(<MapLegend />);
        await userEvent.click(
            screen.getByRole("button", { name: /expand risk legend/i }),
        );

        expect(screen.getByText("Critical")).toBeInTheDocument();
        expect(screen.getByText("High")).toBeInTheDocument();
        expect(screen.getByText("Medium")).toBeInTheDocument();
        expect(screen.getByText("Low")).toBeInTheDocument();
    });

    it("collapses again when the close control is clicked", async () => {
        render(<MapLegend />);
        await userEvent.click(
            screen.getByRole("button", { name: /expand risk legend/i }),
        );
        await userEvent.click(
            screen.getByRole("button", { name: /collapse risk legend/i }),
        );

        expect(screen.queryByText("Critical")).not.toBeInTheDocument();
    });

    it("retains focus on the same button element across the expand/collapse toggle", async () => {
        render(<MapLegend />);

        const toggleButton = screen.getByRole("button", {
            name: /expand risk legend/i,
        });
        toggleButton.focus();
        expect(document.activeElement).toBe(toggleButton);

        await userEvent.click(toggleButton);

        expect(
            screen.getByRole("button", { name: /collapse risk legend/i }),
        ).toBe(toggleButton);
        expect(document.activeElement).toBe(toggleButton);
        expect(toggleButton).toHaveAttribute("aria-expanded", "true");

        await userEvent.click(toggleButton);

        expect(
            screen.getByRole("button", { name: /expand risk legend/i }),
        ).toBe(toggleButton);
        expect(document.activeElement).toBe(toggleButton);
        expect(toggleButton).toHaveAttribute("aria-expanded", "false");
    });
});
