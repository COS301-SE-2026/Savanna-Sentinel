import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, afterEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import HelpPage from "@/pages/HelpPage";

const authUser = vi.hoisted(() => ({ current: { role: "admin" } }));

vi.mock("@/store/authStore", () => ({
    useAuthStore: (selector: (state: { user: { role: string } }) => unknown) =>
        selector({ user: authUser.current }),
}));

function renderHelpPage(role = "admin") {
    authUser.current = { role };
    return render(
        <MemoryRouter>
            <HelpPage />
        </MemoryRouter>,
    );
}

function expectTab(name: string) {
    expect(screen.getByRole("tab", { name })).toBeInTheDocument();
}

function expectNoTab(name: string) {
    expect(screen.queryByRole("tab", { name })).not.toBeInTheDocument();
}

describe("HelpPage", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it("shows the FAQ and the manual download callout by default", () => {
        renderHelpPage("community_liaison");

        expect(
            screen.getByText("Frequently Asked Questions"),
        ).toBeInTheDocument();
        expect(screen.getByText("What is this app for?")).toBeInTheDocument();
        expect(
            screen.getByText("How do I submit a tip-off?"),
        ).toBeInTheDocument();
        expect(screen.getByText("Still stuck?")).toBeInTheDocument();

        const manualLink = screen.getByRole("link", {
            name: "Download the User Manual",
        });
        expect(manualLink).toHaveAttribute(
            "href",
            "https://github.com/COS301-SE-2026/Savanna-Sentinel/blob/main/docs/demo4/PDF/User%20Manual.pdf?raw=true",
        );
        expect(manualLink).toHaveAttribute("download");
        expect(manualLink).toHaveAttribute("target", "_blank");
        expect(manualLink).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("shows the correct help tabs for an admin", () => {
        renderHelpPage("admin");

        [
            "FAQ",
            "User Profile",
            "Reports",
            "Heatmap",
            "Patrol Planner",
            "Workspace",
            "Admin Page",
        ].forEach(expectTab);
    });

    it("shows ranger tabs and patrol guidance, but hides analyst and admin tabs", () => {
        renderHelpPage("ranger");

        ["FAQ", "User Profile", "Reports", "Heatmap", "Patrol Planner"].forEach(
            expectTab,
        );
        expectNoTab("Workspace");
        expectNoTab("Admin Page");
        expect(screen.getByText("How do I plan a patrol?")).toBeInTheDocument();
        expect(
            screen.queryByText("How do I upload data for ingestion?"),
        ).not.toBeInTheDocument();
    });

    it("shows analyst tabs and ingestion guidance, but hides ranger and admin tabs", () => {
        renderHelpPage("analyst");

        ["FAQ", "User Profile", "Reports", "Heatmap", "Workspace"].forEach(
            expectTab,
        );
        expectNoTab("Patrol Planner");
        expectNoTab("Admin Page");
        expect(
            screen.getByText("How do I upload data for ingestion?"),
        ).toBeInTheDocument();
        expect(
            screen.queryByText("How do I plan a patrol?"),
        ).not.toBeInTheDocument();
    });

    it("limits community liaisons to the general and profile tabs", () => {
        renderHelpPage("community_liaison");

        ["FAQ", "User Profile"].forEach(expectTab);
        [
            "Reports",
            "Heatmap",
            "Patrol Planner",
            "Workspace",
            "Admin Page",
        ].forEach(expectNoTab);
        expect(
            screen.queryByText("What can I find on the dashboard?"),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByText("How do I file a report?"),
        ).not.toBeInTheDocument();
    });

    it("opens the relevant help content when tabs are selected", async () => {
        const user = userEvent.setup();
        renderHelpPage("admin");

        await user.click(screen.getByRole("tab", { name: "Reports" }));
        expect(screen.getByText("Field Reports")).toBeInTheDocument();

        await user.click(screen.getByRole("tab", { name: "Heatmap" }));
        expect(
            screen.getByText("Heatmap & Risk Engine Guide"),
        ).toBeInTheDocument();

        await user.click(screen.getByRole("tab", { name: "Patrol Planner" }));
        expect(
            screen.getByText("Creating your patrol route"),
        ).toBeInTheDocument();

        await user.click(screen.getByRole("tab", { name: "Workspace" }));
        expect(screen.getByText("Organising layers")).toBeInTheDocument();
        expect(
            screen.getByText("How layer changes reach features"),
        ).toBeInTheDocument();

        await user.click(screen.getByRole("tab", { name: "Admin Page" }));
        expect(screen.getByText("Account approvals")).toBeInTheDocument();

        await user.click(screen.getByRole("tab", { name: "User Profile" }));
        expect(screen.getByText("Changing your Password")).toBeInTheDocument();
    });

    it("checks password length in the Profile help", async () => {
        const user = userEvent.setup();
        renderHelpPage("community_liaison");

        const profileTab = screen.getByRole("tab", { name: "User Profile" });
        await user.click(profileTab);

        const profilePanel = screen.getByRole("tabpanel");
        const passwordInput =
            within(profilePanel).getByPlaceholderText("Enter a password");
        await user.type(passwordInput, "short");
        await user.click(
            within(profilePanel).getByRole("button", {
                name: "Check Password",
            }),
        );
        expect(
            within(profilePanel).getByText(
                /Passwords must be at least 8 characters/,
            ),
        ).toBeInTheDocument();

        await user.clear(passwordInput);
        await user.type(passwordInput, "long-enough");
        await user.click(
            within(profilePanel).getByRole("button", {
                name: "Check Password",
            }),
        );
        expect(
            within(profilePanel).getByText(
                "The password you entered would be valid",
            ),
        ).toBeInTheDocument();
    });
});
