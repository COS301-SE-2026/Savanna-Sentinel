import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { describe, beforeAll, afterAll, afterEach, it, expect } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DeleteAccounts from "@/components/admin/DeleteAccounts";
import {
    deleteAccountsHandlers,
    resetMockActiveUsers,
} from "./mocks/deleteAccountsHandlers";

const server = setupServer(...deleteAccountsHandlers);

beforeAll(() => server.listen());
afterEach(() => {
    server.resetHandlers();
    resetMockActiveUsers();
});
afterAll(() => server.close());

function renderDeleteAccounts() {
    return render(<DeleteAccounts />);
}

async function openDeleteDialog(
    user: ReturnType<typeof userEvent.setup>,
    rowIndex = 0,
) {
    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    await user.click(deleteButtons[rowIndex]);
    return screen.findByRole("dialog");
}

describe("DeleteAccounts - Delete Accounts", () => {
    it("shows a loading indicator then renders non-admin active users", async () => {
        renderDeleteAccounts();

        expect(screen.getByText(/loading users.../i)).toBeInTheDocument();

        expect(await screen.findByText("ranger1")).toBeInTheDocument();
        expect(screen.getByText("analyst2")).toBeInTheDocument();
        expect(screen.getByText("John Doe")).toBeInTheDocument();
        expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    });

    it("excludes admin accounts from the list", async () => {
        renderDeleteAccounts();

        await screen.findByText("ranger1");

        expect(screen.queryByText("admin1")).not.toBeInTheDocument();
        expect(screen.queryByText("Ada Min")).not.toBeInTheDocument();
    });

    it("shows empty state when no non-admin active users exist", async () => {
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

        renderDeleteAccounts();

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

        renderDeleteAccounts();

        expect(
            await screen.findByText(/failed to load users/i),
        ).toBeInTheDocument();
    });

    it("clicking delete opens a confirmation dialog naming the user", async () => {
        const user = userEvent.setup();
        renderDeleteAccounts();

        await screen.findByText("ranger1");

        const dialog = await openDeleteDialog(user);
        expect(
            within(dialog).getByText(/delete john doe's account/i),
        ).toBeInTheDocument();
    });

    it("cancel closes the dialog and leaves the row in place", async () => {
        const user = userEvent.setup();
        renderDeleteAccounts();

        await screen.findByText("ranger1");

        const dialog = await openDeleteDialog(user);
        await user.click(
            within(dialog).getByRole("button", { name: "Cancel" }),
        );

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.getByText("ranger1")).toBeInTheDocument();
    });

    it("confirm closes the dialog and removes the deleted user from the list", async () => {
        const user = userEvent.setup();
        renderDeleteAccounts();

        await screen.findByText("ranger1");

        const dialog = await openDeleteDialog(user);
        await user.click(
            within(dialog).getByRole("button", { name: /confirm/i }),
        );

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        await waitFor(() =>
            expect(screen.queryByText("ranger1")).not.toBeInTheDocument(),
        );
        expect(screen.getByText("analyst2")).toBeInTheDocument();
    });

    it("shows an error and keeps the row when the delete request fails", async () => {
        server.use(
            http.delete(
                "**/v1/users/:id",
                () => new HttpResponse(null, { status: 500 }),
            ),
        );

        const user = userEvent.setup();
        renderDeleteAccounts();

        await screen.findByText("ranger1");

        const dialog = await openDeleteDialog(user);
        await user.click(
            within(dialog).getByRole("button", { name: /confirm/i }),
        );

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(
            await screen.findByText(/failed to delete account/i),
        ).toBeInTheDocument();
        expect(screen.getByText("ranger1")).toBeInTheDocument();
    });

    it("sorts users by each column when its header is clicked", async () => {
        const user = userEvent.setup();
        renderDeleteAccounts();

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

    it("closes the confirmation dialog via the header close button", async () => {
        const user = userEvent.setup();
        renderDeleteAccounts();

        await screen.findByText("ranger1");

        const dialog = await openDeleteDialog(user);
        await user.click(
            within(dialog).getByRole("button", {
                name: /cancel, close dialog/i,
            }),
        );

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.getByText("ranger1")).toBeInTheDocument();
    });
});
