import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { describe, beforeAll, afterAll, afterEach, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DeleteAccounts from "@/components/admin/DeleteAccounts";
import { deleteAccountsHandlers } from "./mocks/deleteAccountsHandlers";

const server = setupServer(...deleteAccountsHandlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderDeleteAccounts() {
    return render(<DeleteAccounts />);
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

        const deleteButtons = screen.getAllByRole("button", {
            name: /delete/i,
        });
        await user.click(deleteButtons[0]);

        const dialog = await screen.findByRole("dialog");
        expect(
            within(dialog).getByText(/delete john doe's account/i),
        ).toBeInTheDocument();
    });

    it("cancel closes the dialog and leaves the row in place", async () => {
        const user = userEvent.setup();
        renderDeleteAccounts();

        await screen.findByText("ranger1");

        const deleteButtons = screen.getAllByRole("button", {
            name: /delete/i,
        });
        await user.click(deleteButtons[0]);

        const dialog = await screen.findByRole("dialog");
        await user.click(
            within(dialog).getByRole("button", { name: "Cancel" }),
        );

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.getByText("ranger1")).toBeInTheDocument();
    });

    it("confirm closes the dialog and leaves the row in place", async () => {
        const user = userEvent.setup();
        renderDeleteAccounts();

        await screen.findByText("ranger1");

        const deleteButtons = screen.getAllByRole("button", {
            name: /delete/i,
        });
        await user.click(deleteButtons[0]);

        const dialog = await screen.findByRole("dialog");
        await user.click(
            within(dialog).getByRole("button", { name: /confirm/i }),
        );

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.getByText("ranger1")).toBeInTheDocument();
    });
});
