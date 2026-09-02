import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import TopBar from "@/components/layout/TopBar";
import { useAuthStore } from "@/store/authStore";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

vi.mock("@/services/authApi", () => ({
    authApi: {
        login: vi.fn(),
        register: vi.fn(),
        refresh: vi.fn(),
        logout: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock("@/hooks/useOnlineStatus", () => ({
    useOnlineStatus: vi.fn(() => true),
}));

function setUser(username: string, role = "ranger") {
    useAuthStore.setState({
        user: { id: "1", username, role },
        accessToken: "fake-access",
        refreshToken: "fake-refresh",
    });
}

function renderTopBar() {
    return render(
        <MemoryRouter>
            <TopBar />
        </MemoryRouter>,
    );
}

describe("TopBar", () => {
    afterEach(() => {
        useAuthStore.setState({
            user: null,
            accessToken: null,
            refreshToken: null,
        });
    });

    it("renders the burger button", () => {
        setUser("janedoe");
        renderTopBar();
        expect(
            screen.getByRole("button", { name: /open navigation menu/i }),
        ).toBeInTheDocument();
    });

    it("renders the wordmark", () => {
        setUser("janedoe");
        renderTopBar();
        expect(screen.getByText("Savanna Sentinel")).toBeInTheDocument();
    });

    it("renders Notifications with no click behavior", () => {
        setUser("janedoe");
        renderTopBar();
        expect(
            screen.getByRole("button", { name: "Notifications" }),
        ).toBeInTheDocument();
    });

    it("renders Help button with link to help page", () => {
        setUser("janedoe");
        renderTopBar();
        const helpButton = screen.getByRole("link", { name: "Help" });
        expect(helpButton).toBeInTheDocument();
        expect(helpButton).toHaveAttribute("href", "/help");
    });

    it("renders the avatar button with initials derived from the username", () => {
        setUser("janedoe");
        renderTopBar();
        const avatar = screen.getByRole("button", { name: "Account" });
        expect(avatar).toHaveTextContent("J");
    });

    it("does not render the offline indicator when online", () => {
        vi.mocked(useOnlineStatus).mockReturnValue(true);
        setUser("janedoe");
        renderTopBar();
        expect(
            screen.queryByRole("button", { name: /no internet connection/i }),
        ).not.toBeInTheDocument();
    });

    it("renders the offline indicator when offline", () => {
        vi.mocked(useOnlineStatus).mockReturnValue(false);
        setUser("janedoe");
        renderTopBar();
        expect(
            screen.getByRole("button", { name: /no internet connection/i }),
        ).toBeInTheDocument();
    });

    it("opens the offline popover on click and closes on outside click", async () => {
        vi.mocked(useOnlineStatus).mockReturnValue(false);
        setUser("janedoe");
        renderTopBar();

        await userEvent.click(
            screen.getByRole("button", { name: /no internet connection/i }),
        );
        expect(
            await screen.findByText("No Internet connection"),
        ).toBeInTheDocument();

        await userEvent.click(document.body);
        await waitFor(() => {
            expect(
                screen.queryByText("No Internet connection"),
            ).not.toBeInTheDocument();
        });
    });

    it("closes the offline popover on Escape", async () => {
        vi.mocked(useOnlineStatus).mockReturnValue(false);
        setUser("janedoe");
        renderTopBar();

        await userEvent.click(
            screen.getByRole("button", { name: /no internet connection/i }),
        );
        expect(
            await screen.findByText("No Internet connection"),
        ).toBeInTheDocument();

        await userEvent.keyboard("{Escape}");
        await waitFor(() => {
            expect(
                screen.queryByText("No Internet connection"),
            ).not.toBeInTheDocument();
        });
    });
});
