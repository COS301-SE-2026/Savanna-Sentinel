import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, it, expect, vi } from "vitest";

import AccountMenu from "@/components/layout/AccountMenu";
import { useAuthStore } from "@/store/authStore";

vi.mock("@/services/authApi", () => ({
    authApi: {
        login: vi.fn(),
        register: vi.fn(),
        refresh: vi.fn(),
        logout: vi.fn().mockResolvedValue(undefined),
    },
}));

function setUser(username: string, role = "ranger") {
    useAuthStore.setState({
        user: { id: "1", username, role },
        accessToken: "fake-access",
        refreshToken: "fake-refresh",
    });
}

function renderAccountMenu() {
    return render(
        <MemoryRouter>
            <AccountMenu />
        </MemoryRouter>,
    );
}

const openMenu = async () => {
    await userEvent.click(screen.getByRole("button", { name: "Account" }));
    await screen.findByRole("link", { name: /profile & settings/i });
};

describe("AccountMenu", () => {
    afterEach(() => {
        useAuthStore.setState({
            user: null,
            accessToken: null,
            refreshToken: null,
        });
    });

    it("renders the trigger with initials derived from the username", () => {
        setUser("janedoe");
        renderAccountMenu();
        expect(
            screen.getByRole("button", { name: "Account" }),
        ).toHaveTextContent("J");
    });

    it("shows the username and role once opened", async () => {
        setUser("janedoe", "community_liaison");
        renderAccountMenu();
        await openMenu();

        expect(screen.getByText("janedoe")).toBeInTheDocument();
        expect(screen.getByText("community liaison")).toBeInTheDocument();
    });

    it("links to the profile page", async () => {
        setUser("janedoe");
        renderAccountMenu();
        await openMenu();

        expect(
            screen.getByRole("link", { name: /profile & settings/i }),
        ).toHaveAttribute("href", "/profile");
    });

    it("logs out and closes the menu when Log out is clicked", async () => {
        setUser("janedoe");
        renderAccountMenu();
        await openMenu();

        await userEvent.click(screen.getByRole("button", { name: /log out/i }));

        expect(useAuthStore.getState().user).toBeNull();
        await waitFor(() => {
            expect(
                screen.queryByRole("link", { name: /profile & settings/i }),
            ).not.toBeInTheDocument();
        });
    });

    it("closes the menu on outside click", async () => {
        setUser("janedoe");
        renderAccountMenu();
        await openMenu();

        await userEvent.click(document.body);

        await waitFor(() => {
            expect(
                screen.queryByRole("link", { name: /profile & settings/i }),
            ).not.toBeInTheDocument();
        });
    });
});
