import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { describe, beforeAll, afterAll, afterEach, it, expect } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RoleSwap from "@/components/admin/RoleSwap";
import {
    roleSwapHandlers,
    resetMockActiveUsers,
} from "./mocks/roleSwapHandlers";

const server = setupServer(...roleSwapHandlers);

beforeAll(() => server.listen());
afterEach(() => {
    server.resetHandlers();
    resetMockActiveUsers();
});
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

    it("apply button is disabled when role has not changed", async () => {
        renderRoleSwap();

        await screen.findByText("ranger1");

        const applyButtons = screen.getAllByRole("button", {
            name: /apply/i,
        });
        applyButtons.forEach((btn) => expect(btn).toBeDisabled());
    });

    it("apply button enables after selecting a different role", async () => {
        const user = userEvent.setup();
        renderRoleSwap();

        await screen.findByText("ranger1");

        const triggers = screen.getAllByRole("combobox");
        const analystOption = await within(triggers[0]).findByRole("option", {
            name: /analyst/i,
        });
        await user.selectOptions(triggers[0], [analystOption]);

        const applyButtons = screen.getAllByRole("button", {
            name: /apply/i,
        });
        expect(applyButtons[0]).toBeEnabled();
    });

    it("clicking apply opens a confirmation dialog naming the role change", async () => {
        const user = userEvent.setup();
        renderRoleSwap();

        await screen.findByText("ranger1");

        const triggers = screen.getAllByRole("combobox");
        const analystOption = await within(triggers[0]).findByRole("option", {
            name: /analyst/i,
        });
        await user.selectOptions(triggers[0], [analystOption]);

        const applyButtons = screen.getAllByRole("button", {
            name: /apply/i,
        });
        await user.click(applyButtons[0]);

        const dialog = await screen.findByRole("dialog");
        expect(
            within(dialog).getByText(/update john doe from ranger to analyst/i),
        ).toBeInTheDocument();
    });

    it("shows success message after confirming a role change", async () => {
        const user = userEvent.setup();
        renderRoleSwap();

        await screen.findByText("ranger1");

        const triggers = screen.getAllByRole("combobox");
        const analystOption = await within(triggers[0]).findByRole("option", {
            name: /analyst/i,
        });
        await user.selectOptions(triggers[0], [analystOption]);

        const applyButtons = screen.getAllByRole("button", {
            name: /apply/i,
        });
        await user.click(applyButtons[0]);

        const dialog = await screen.findByRole("dialog");
        await user.click(
            within(dialog).getByRole("button", { name: /confirm/i }),
        );

        expect(
            await screen.findByText(/role updated to analyst/i),
        ).toBeInTheDocument();
    });

    it("does not change the role when the dialog is cancelled", async () => {
        const user = userEvent.setup();
        renderRoleSwap();

        await screen.findByText("ranger1");

        const triggers = screen.getAllByRole("combobox");
        const analystOption = await within(triggers[0]).findByRole("option", {
            name: /analyst/i,
        });
        await user.selectOptions(triggers[0], [analystOption]);

        const applyButtons = screen.getAllByRole("button", {
            name: /apply/i,
        });
        await user.click(applyButtons[0]);

        const dialog = await screen.findByRole("dialog");
        await user.click(
            within(dialog).getByRole("button", { name: "Cancel" }),
        );

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(
            screen.queryByText(/role updated to analyst/i),
        ).not.toBeInTheDocument();
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
        const analystOption = await within(triggers[0]).findByRole("option", {
            name: /analyst/i,
        });
        await user.selectOptions(triggers[0], [analystOption]);

        const applyButtons = screen.getAllByRole("button", {
            name: /apply/i,
        });
        await user.click(applyButtons[0]);

        const dialog = await screen.findByRole("dialog");
        await user.click(
            within(dialog).getByRole("button", { name: /confirm/i }),
        );

        expect(
            await screen.findByText(/failed to update role/i),
        ).toBeInTheDocument();
    });

    it("success message disappears after 5 seconds", async () => {
        const user = userEvent.setup();
        renderRoleSwap();

        await screen.findByText("ranger1");

        const triggers = screen.getAllByRole("combobox");
        const analystOption = await within(triggers[0]).findByRole("option", {
            name: /analyst/i,
        });
        await user.selectOptions(triggers[0], [analystOption]);

        const applyButtons = screen.getAllByRole("button", {
            name: /apply/i,
        });
        await user.click(applyButtons[0]);

        const dialog = await screen.findByRole("dialog");
        await user.click(
            within(dialog).getByRole("button", { name: /confirm/i }),
        );

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

    it("sorts users by each column when its header is clicked", async () => {
        const user = userEvent.setup();
        renderRoleSwap();

        await screen.findByText("ranger1");

        const getUsernames = () =>
            screen
                .getAllByRole("row")
                .slice(1)
                .map((row) => within(row).getAllByRole("cell")[0].textContent);

        await user.click(screen.getByRole("button", { name: "Username" }));
        expect(getUsernames()).toEqual(["analyst2", "ranger1"]);

        await user.click(screen.getByRole("button", { name: "Username" }));
        expect(getUsernames()).toEqual(["ranger1", "analyst2"]);

        await user.click(screen.getByRole("button", { name: "Name" }));
        expect(getUsernames()).toEqual(["analyst2", "ranger1"]);

        await user.click(screen.getByRole("button", { name: "Email" }));
        expect(getUsernames()).toEqual(["analyst2", "ranger1"]);

        await user.click(screen.getByRole("button", { name: "Current Role" }));
        expect(getUsernames()).toEqual(["analyst2", "ranger1"]);
    });

    it("closes the confirmation dialog via the header close button without applying the change", async () => {
        const user = userEvent.setup();
        renderRoleSwap();

        await screen.findByText("ranger1");

        const triggers = screen.getAllByRole("combobox");
        const analystOption = await within(triggers[0]).findByRole("option", {
            name: /analyst/i,
        });
        await user.selectOptions(triggers[0], [analystOption]);

        const applyButtons = screen.getAllByRole("button", {
            name: /apply/i,
        });
        await user.click(applyButtons[0]);

        const dialog = await screen.findByRole("dialog");
        await user.click(
            within(dialog).getByRole("button", {
                name: /cancel, close dialog/i,
            }),
        );

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(
            screen.queryByText(/role updated to analyst/i),
        ).not.toBeInTheDocument();
    });
});
