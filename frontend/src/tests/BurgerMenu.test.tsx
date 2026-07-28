import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, it, expect, vi } from "vitest";

import BurgerMenu from "@/components/layout/BurgerMenu";
import { useAuthStore } from "@/store/authStore";

// Prevent the logout action from making a real network call.
vi.mock("@/services/authApi", () => ({
    authApi: {
        login: vi.fn(),
        register: vi.fn(),
        refresh: vi.fn(),
        logout: vi.fn().mockResolvedValue(undefined),
    },
}));

function setUser(role: string) {
    useAuthStore.setState({
        user: { id: "1", username: "testuser", role },
        accessToken: "fake-access",
        refreshToken: "fake-refresh",
    });
}

function renderMenu() {
    return render(
        <MemoryRouter>
            <BurgerMenu />
        </MemoryRouter>,
    );
}

const openMenu = async () => {
    await userEvent.click(
        screen.getByRole("button", { name: /open navigation menu/i }),
    );
    // Wait for the sheet content to appear in the portal
    await screen.findByText("Savanna Sentinel");
};

describe("BurgerMenu", () => {
    afterEach(() => {
        useAuthStore.setState({
            user: null,
            accessToken: null,
            refreshToken: null,
        });
        vi.clearAllMocks();
    });

    it("renders the trigger button", () => {
        setUser("ranger");
        renderMenu();
        expect(
            screen.getByRole("button", { name: /open navigation menu/i }),
        ).toBeInTheDocument();
    });

    it("opens the drawer when the trigger is clicked", async () => {
        setUser("ranger");
        renderMenu();
        await openMenu();
        expect(screen.getByText("Savanna Sentinel")).toBeInTheDocument();
    });

    it("displays the user role in the drawer header", async () => {
        setUser("community_liaison");
        renderMenu();
        await openMenu();
        expect(screen.getByText("community liaison")).toBeInTheDocument();
    });

    it("shows correct nav items for ranger", async () => {
        setUser("ranger");
        renderMenu();
        await openMenu();

        expect(screen.getByText("Reports")).toBeInTheDocument();
        expect(screen.getByText("Patrol Planner")).toBeInTheDocument();
        expect(screen.getByText("Profile")).toBeInTheDocument();
        expect(screen.queryByText("Ingestion")).not.toBeInTheDocument();
        expect(screen.queryByText("Admin")).not.toBeInTheDocument();
    });

    it("shows correct nav items for analyst", async () => {
        setUser("analyst");
        renderMenu();
        await openMenu();

        expect(screen.getByText("Ingestion")).toBeInTheDocument();
        expect(screen.getByText("Reports")).toBeInTheDocument();
        expect(screen.getByText("Profile")).toBeInTheDocument();
        expect(screen.queryByText("Patrol Planner")).not.toBeInTheDocument();
        expect(screen.queryByText("Admin")).not.toBeInTheDocument();
    });

    it("shows all nav items for admin", async () => {
        setUser("admin");
        renderMenu();
        await openMenu();

        expect(screen.getByText("Reports")).toBeInTheDocument();
        expect(screen.getByText("Patrol Planner")).toBeInTheDocument();
        expect(screen.getByText("Ingestion")).toBeInTheDocument();
        expect(screen.getByText("Admin")).toBeInTheDocument();
        expect(screen.getByText("Profile")).toBeInTheDocument();
    });

    it("renders a divider immediately before the Profile nav item", async () => {
        setUser("ranger");
        renderMenu();
        await openMenu();

        const nav = screen.getByText("Reports").closest("nav");
        expect(nav).not.toBeNull();
        const children = Array.from(nav!.children);
        const profileIndex = children.findIndex((el) =>
            el.textContent?.includes("Profile"),
        );
        expect(children[profileIndex - 1].tagName).toBe("HR");
    });

    it("shows only the Profile nav item for community_liaison", async () => {
        setUser("community_liaison");
        renderMenu();
        await openMenu();

        expect(screen.getByText("Profile")).toBeInTheDocument();
        expect(screen.queryByText("Reports")).not.toBeInTheDocument();
        expect(screen.queryByText("Patrol Planner")).not.toBeInTheDocument();
        expect(screen.queryByText("Ingestion")).not.toBeInTheDocument();
        expect(screen.queryByText("Admin")).not.toBeInTheDocument();
    });

    it("closes the drawer when the X button is clicked", async () => {
        setUser("ranger");
        renderMenu();
        await openMenu();

        await userEvent.click(
            screen.getByRole("button", { name: /close menu/i }),
        );

        await waitFor(() => {
            expect(screen.queryByText("Reports")).not.toBeInTheDocument();
        });
    });

    it("closes the drawer when a nav item is clicked", async () => {
        setUser("ranger");
        renderMenu();
        await openMenu();

        await userEvent.click(screen.getByText("Reports"));

        await waitFor(() => {
            expect(screen.queryByText("Patrol Planner")).not.toBeInTheDocument();
        });
    });

    it("clears auth state when the Log out button is clicked", async () => {
        setUser("ranger");
        renderMenu();
        await openMenu();

        await userEvent.click(screen.getByRole("button", { name: /log out/i }));

        expect(useAuthStore.getState().user).toBeNull();
        expect(useAuthStore.getState().accessToken).toBeNull();
    });
});
