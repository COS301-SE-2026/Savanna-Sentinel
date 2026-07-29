import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HelpPage from "@/pages/HelpPage";
import { describe, it, expect } from "vitest";
import { MemoryRouter } from "react-router-dom";

describe("Help Page tests", () => {
    it("renders the help page and tab content", async () => {
        const user = userEvent.setup();
        render(
            <MemoryRouter>
                <HelpPage />
            </MemoryRouter>,
        );
        expect(
            screen.getByText("Frequently Asked Questions"),
        ).toBeInTheDocument();
        await user.click(screen.getByRole("tab", { name: "Reports" }));
        expect(screen.getByText("Field Reports")).toBeInTheDocument();
        await user.click(screen.getByRole("tab", { name: "Patrol Planner" }));
        expect(screen.getByText("Route Parameters")).toBeInTheDocument();
        await user.click(screen.getByRole("tab", { name: "User Profile" }));
        expect(screen.getByText("Change Password")).toBeInTheDocument();
        await user.click(screen.getByRole("tab", { name: "User Manual" }));
        expect(
            screen.getByRole("link", {
                name: "Click to Download the User Manual",
            }),
        );
    });

    it("user manual download button has correct attributes", async () => {
        const user = userEvent.setup();
        render(
            <MemoryRouter>
                <HelpPage />
            </MemoryRouter>,
        );
        await user.click(screen.getByRole("tab", { name: "User Manual" }));
        const downloadButton = screen.getByRole("link", {
            name: "Click to Download the User Manual",
        });
        expect(downloadButton).toBeInTheDocument();
        expect(downloadButton).toHaveAttribute(
            "href",
            "https://github.com/COS301-SE-2026/Savanna-Sentinel/blob/main/docs/demo2/PDF/User%20Manual.pdf?raw=true",
        );
        expect(downloadButton).toHaveAttribute("download");
    });
});
