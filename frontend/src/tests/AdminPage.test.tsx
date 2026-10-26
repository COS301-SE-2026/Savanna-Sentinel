import { setupServer } from "msw/node";
import { describe, beforeAll, afterAll, afterEach, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminPage from "@/pages/AdminPage";
import { useAuthStore } from "@/store/authStore";
import { authHandlers } from "./mocks/adminauthHandlers";
import { roleSwapHandlers } from "./mocks/roleSwapHandlers";
import {
    deleteAccountsHandlers,
    resetMockActiveUsers,
} from "./mocks/deleteAccountsHandlers";

const server = setupServer();

function setAdmin(username: string) {
    useAuthStore.setState({
        user: { id: "1", username, role: "admin" },
        accessToken: "fake-access",
        refreshToken: "fake-refresh",
    });
}

beforeAll(() => server.listen());
afterEach(() => {
    useAuthStore.setState({ user: null });
    server.resetHandlers();
    resetMockActiveUsers();
});
afterAll(() => server.close());

describe("AdminPage", () => {
    it("renders the heading and tab list", () => {
        server.use(...authHandlers);
        render(<AdminPage />);

        expect(
            screen.getByRole("heading", { name: /admin panel/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("tab", { name: /account approvals/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("tab", { name: /role management/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("tab", { name: /delete accounts/i }),
        ).toBeInTheDocument();
    });

    it("shows the account approvals tab by default", async () => {
        server.use(...authHandlers);
        render(<AdminPage />);

        expect(
            await screen.findByRole("row", { name: /ranger/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("searchbox", {
                name: /search pending registrations/i,
            }),
        ).toBeInTheDocument();
    });

    it("switches to role management and loads active users", async () => {
        const user = userEvent.setup();
        server.use(...authHandlers);
        render(<AdminPage />);
        await screen.findByRole("row", { name: /ranger/i });

        server.use(...roleSwapHandlers);
        await user.click(screen.getByRole("tab", { name: /role management/i }));

        expect(
            await screen.findAllByRole("button", { name: /^apply$/i }),
        ).not.toHaveLength(0);
    });

    it("switches to delete accounts and loads active users", async () => {
        const user = userEvent.setup();
        server.use(...authHandlers);
        render(<AdminPage />);
        await screen.findByRole("row", { name: /ranger/i });

        server.use(...deleteAccountsHandlers);
        await user.click(screen.getByRole("tab", { name: /delete accounts/i }));

        expect(
            await screen.findAllByRole("button", { name: /^delete$/i }),
        ).not.toHaveLength(0);
    });

    it("switches to the demo tab and shows the reset button", async () => {
        const user = userEvent.setup();
        setAdmin("admin1");
        server.use(...authHandlers);
        render(<AdminPage />);

        await user.click(screen.getByRole("tab", { name: /^demo$/i }));

        expect(
            await screen.findByRole("button", { name: /reset demo data/i }),
        ).toBeInTheDocument();
    });

    it("hides the demo tab from admins other than admin1", () => {
        setAdmin("admin2");
        server.use(...authHandlers);
        render(<AdminPage />);

        expect(
            screen.queryByRole("tab", { name: /^demo$/i }),
        ).not.toBeInTheDocument();
    });
});
