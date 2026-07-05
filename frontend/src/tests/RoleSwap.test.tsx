import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { describe, beforeAll, afterAll, afterEach, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RoleSwap from "@/components/admin/RoleSwap";
import { roleSwapHandlers } from "./mocks/roleSwapHandlers";

const server = setupServer(...roleSwapHandlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderRoleSwap() {
    return render(<RoleSwap />);
}

describe("RoleSwap - Role Management", () => {
    it("shows a loading indicator then renders users", async () => {
        renderRoleSwap();

        expect(screen.getByText(/loading users.../i)).toBeInTheDocument();

        expect(await screen.findByText("ranger1")).toBeInTheDocument();
        expect(screen.getByText("analyst2")).toBeInTheDocument();
        expect(screen.getByText("John Doe")).toBeInTheDocument();
        expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    });

    it("shows empty state when no active users exist", async () => {
        server.use(
            http.get("**/v1/users", () =>
                HttpResponse.json({
                    total: 0,
                    page: 1,
                    page_size: 20,
                    results: [],
                }),
            ),
        );

        renderRoleSwap();

        expect(
            await screen.findByText(/no active users found/i),
        ).toBeInTheDocument();
    });

    it("shows an error message when fetching users fails", async () => {
        server.use(
            http.get(
                "**/v1/users",
                () => new HttpResponse(null, { status: 500 }),
            ),
        );

        renderRoleSwap();

        expect(
            await screen.findByText(/failed to load users/i),
        ).toBeInTheDocument();
    });

    it("save button is disabled when role has not changed", async () => {
        renderRoleSwap();

        await screen.findByText("ranger1");

        const saveButtons = screen.getAllByRole("button", { name: /save/i });
        saveButtons.forEach((btn) => expect(btn).toBeDisabled());
    });

    it("save button enables after selecting a different role", async () => {
        const user = userEvent.setup();
        renderRoleSwap();

        await screen.findByText("ranger1");

        const triggers = screen.getAllByRole("combobox");
        await user.click(triggers[0]);

        const analystOption = await screen.findByRole("option", {
            name: /analyst/i,
        });
        await user.click(analystOption);

        const saveButtons = screen.getAllByRole("button", { name: /save/i });
        expect(saveButtons[0]).toBeEnabled();
    });

    it("shows success message after a successful role change", async () => {
        const user = userEvent.setup();
        renderRoleSwap();

        await screen.findByText("ranger1");

        const triggers = screen.getAllByRole("combobox");
        await user.click(triggers[0]);

        const analystOption = await screen.findByRole("option", {
            name: /analyst/i,
        });
        await user.click(analystOption);

        const saveButtons = screen.getAllByRole("button", { name: /save/i });
        await user.click(saveButtons[0]);

        expect(
            await screen.findByText(/role updated to analyst/i),
        ).toBeInTheDocument();
    });

    it("shows error message when role change fails", async () => {
        server.use(
            http.patch(
                "**/v1/users/:id/role",
                () => new HttpResponse(null, { status: 500 }),
            ),
        );

        const user = userEvent.setup();
        renderRoleSwap();

        await screen.findByText("ranger1");

        const triggers = screen.getAllByRole("combobox");
        await user.click(triggers[0]);

        const analystOption = await screen.findByRole("option", {
            name: /analyst/i,
        });
        await user.click(analystOption);

        const saveButtons = screen.getAllByRole("button", { name: /save/i });
        await user.click(saveButtons[0]);

        expect(
            await screen.findByText(/failed to update role/i),
        ).toBeInTheDocument();
    });

    it("success message disappears after 5 seconds", async () => {
        const user = userEvent.setup();
        renderRoleSwap();

        await screen.findByText("ranger1");

        const triggers = screen.getAllByRole("combobox");
        await user.click(triggers[0]);

        const analystOption = await screen.findByRole("option", {
            name: /analyst/i,
        });
        await user.click(analystOption);

        const saveButtons = screen.getAllByRole("button", { name: /save/i });
        await user.click(saveButtons[0]);

        expect(
            await screen.findByText(/role updated to analyst/i),
        ).toBeInTheDocument();

        await waitFor(
            () =>
                expect(
                    screen.queryByText(/role updated to analyst/i),
                ).not.toBeInTheDocument(),
            { timeout: 6000 },
        );
    }, 10000);
});
