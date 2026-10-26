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
        isUploaded: true,
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
            isUploaded: null,
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

    it("does not trigger Radix's missing Description warning when opened", async () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        setUser("ranger");
        renderMenu();
        await openMenu();
        expect(warnSpy).not.toHaveBeenCalledWith(
            expect.stringContaining("Missing `Description`"),
        );
        warnSpy.mockRestore();
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
        expect(screen.getByText("Tip-offs")).toBeInTheDocument();
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
        expect(screen.getByText("Tip-offs")).toBeInTheDocument();
        expect(screen.queryByText("Patrol Planner")).not.toBeInTheDocument();
        expect(screen.queryByText("Admin")).not.toBeInTheDocument();
    });

    it("shows correct nav items for community liaison", async () => {
        setUser("community_liaison");
        renderMenu();
        await openMenu();

        expect(screen.getByText("Tip-offs")).toBeInTheDocument();
        expect(screen.getByText("Profile")).toBeInTheDocument();
        expect(screen.queryByText("Reports")).not.toBeInTheDocument();
        expect(screen.queryByText("Patrol Planner")).not.toBeInTheDocument();
        expect(screen.queryByText("Ingestion")).not.toBeInTheDocument();
        expect(screen.queryByText("Admin")).not.toBeInTheDocument();
    });

    it("shows all nav items for admin", async () => {
        setUser("admin");
        renderMenu();
        await openMenu();

        expect(screen.getByText("Reports")).toBeInTheDocument();
        expect(screen.getByText("Patrol Planner")).toBeInTheDocument();
        expect(screen.getByText("Tip-offs")).toBeInTheDocument();
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

    it("shows Upload Park to an admin once a park has been uploaded", async () => {
        setUser("admin");
        useAuthStore.setState({ isUploaded: true });
        renderMenu();
        await openMenu();

        expect(screen.getByText("Reports")).toBeInTheDocument();
        expect(screen.getByText("Upload Park")).toBeInTheDocument();
    });

    it("does not show Upload Park to an analyst once a park has been uploaded", async () => {
        setUser("analyst");
        useAuthStore.setState({ isUploaded: true });
        renderMenu();
        await openMenu();

        expect(screen.getByText("Reports")).toBeInTheDocument();
        expect(screen.queryByText("Upload Park")).not.toBeInTheDocument();
    });

    it("shows only Upload Park, Admin and Profile to an admin when no park is uploaded", async () => {
        setUser("admin");
        useAuthStore.setState({ isUploaded: false });
        renderMenu();
        await openMenu();

        const nav = screen.getByText("Profile").closest("nav");
        const labels = Array.from(nav!.querySelectorAll("a")).map(
            (link) => link.textContent,
        );
        expect(labels).toEqual(["Upload Park", "Admin", "Profile"]);
    });

    it.each(["ranger", "analyst", "community_liaison"])(
        "shows only Profile to a %s when no park is uploaded",
        async (role) => {
            setUser(role);
            useAuthStore.setState({ isUploaded: false });
            renderMenu();
            await openMenu();

            const nav = screen.getByText("Profile").closest("nav");
            const labels = Array.from(nav!.querySelectorAll("a")).map(
                (link) => link.textContent,
            );
            expect(labels).toEqual(["Profile"]);
        },
    );

    it("tells a non-admin that setup is in progress when no park is uploaded", async () => {
        setUser("ranger");
        useAuthStore.setState({ isUploaded: false });
        renderMenu();
        await openMenu();

        expect(screen.getByRole("status")).toHaveTextContent(
            "System setup in progress. Contact an admin",
        );
    });

    it("does not show the setup notice to an admin", async () => {
        setUser("admin");
        useAuthStore.setState({ isUploaded: false });
        renderMenu();
        await openMenu();

        expect(
            screen.queryByText(/system setup in progress/i),
        ).not.toBeInTheDocument();
    });

    it("hides park pages when the upload state is unknown, like ProtectedRoute", async () => {
        setUser("analyst");
        useAuthStore.setState({ isUploaded: null });
        renderMenu();
        await openMenu();

        expect(screen.queryByText("Heatmap")).not.toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent(
            "System setup in progress. Contact an admin",
        );
    });

    it("does not show the setup notice once a park is uploaded", async () => {
        setUser("ranger");
        useAuthStore.setState({ isUploaded: true });
        renderMenu();
        await openMenu();

        expect(
            screen.queryByText(/system setup in progress/i),
        ).not.toBeInTheDocument();
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
            expect(
                screen.queryByText("Patrol Planner"),
            ).not.toBeInTheDocument();
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
