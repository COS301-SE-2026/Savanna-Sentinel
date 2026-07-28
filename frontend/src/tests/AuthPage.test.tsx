import AuthPage from "@/pages/AdminAuthAccount";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { authHandlers, mockUsers } from "./mocks/adminauthHandlers";
import { describe, beforeAll, afterAll, afterEach, it, expect } from "vitest";
import {
    render,
    screen,
    within,
    waitFor,
    fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const server = setupServer(...authHandlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderAuthPage() {
    return render(<AuthPage />);
}

describe("Authpage - Pending Registrations", () => {
    it("shows a loading indicator then renders users", async () => {
        renderAuthPage();

        expect(
            screen.getByText(/loading pending users.../i),
        ).toBeInTheDocument();

        expect(await screen.findByText("ranger1")).toBeInTheDocument();
        expect(screen.getByText("analyst2")).toBeInTheDocument();
        expect(screen.getByText("John Doe")).toBeInTheDocument();
        expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    });
    it("renders a fallback message if the incoming collection is empty", async () => {
        server.use(
            http.get("**/v1/users", () => {
                return HttpResponse.json({ results: [] });
            }),
        );

        renderAuthPage();

        expect(
            await screen.findByText(/no pending registrations found/i),
        ).toBeInTheDocument();
    });
    it("Renders an alert banner when the fetch fails", async () => {
        server.use(
            http.get("**/v1/users", () => {
                return new HttpResponse(null, { status: 500 });
            }),
        );

        renderAuthPage();

        expect(
            await screen.findByText(/failed to load pending registrations/i),
        ).toBeInTheDocument();
    });
    it("Refreshes the page when accept is confirmed, and calls the status update endpoint", async () => {
        renderAuthPage();

        const userRow = await screen.findByRole("row", { name: /ranger/i });
        const acceptButton = within(userRow).getByRole("button", {
            name: /accept/i,
        });

        server.use(
            http.get("**/v1/users", () => {
                return HttpResponse.json({ results: [mockUsers.results[1]] });
            }),
        );

        await userEvent.click(acceptButton);
        const dialog = await screen.findByRole("dialog");
        const confirmButton = within(dialog).getByRole("button", {
            name: /confirm/i,
        });
        await userEvent.click(confirmButton);

        await waitFor(() => {
            expect(screen.queryByText("ranger1")).not.toBeInTheDocument();
        });

        expect(screen.getByText("analyst2")).toBeInTheDocument();
    });
    it("Refreshes the page when reject is confirmed, and calls the status update endpoint", async () => {
        renderAuthPage();

        const userRow = await screen.findByRole("row", { name: /analyst2/i });
        const rejectButton = within(userRow).getByRole("button", {
            name: /reject/i,
        });

        server.use(
            http.get("**/v1/users", () => {
                return HttpResponse.json({ results: [mockUsers.results[0]] });
            }),
        );

        await userEvent.click(rejectButton);
        const dialog = await screen.findByRole("dialog");
        const confirmButton = within(dialog).getByRole("button", {
            name: /confirm/i,
        });
        await userEvent.click(confirmButton);

        await waitFor(() => {
            expect(screen.queryByText("analyst2")).not.toBeInTheDocument();
        });
    });
    it("closes the dialog without calling the API when cancelled", async () => {
        renderAuthPage();

        const userRow = await screen.findByRole("row", { name: /ranger/i });
        const acceptButton = within(userRow).getByRole("button", {
            name: /accept/i,
        });

        await userEvent.click(acceptButton);
        const dialog = await screen.findByRole("dialog");
        await userEvent.click(
            within(dialog).getByRole("button", { name: "Cancel" }),
        );

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.getByText("ranger1")).toBeInTheDocument();
    });
    it("Displays a warning when an admin somehow ends up in the list", async () => {
        server.use(
            http.get("**/v1/users", () => {
                return HttpResponse.json({
                    results: [
                        {
                            id: "admin-error-id",
                            username: "illegal_admin",
                            email: "admin@test.com",
                            first_name: "Test",
                            last_name: "User",
                            role: "admin",
                            is_active: false,
                            created_at: "2026-05-14T12:00:00.000Z",
                        },
                    ],
                });
            }),
        );

        renderAuthPage();

        const acceptButton = await screen.findByRole("button", {
            name: /accept/i,
        });
        await userEvent.click(acceptButton);
        const dialog = await screen.findByRole("dialog");
        await userEvent.click(
            within(dialog).getByRole("button", { name: /confirm/i }),
        );

        expect(
            await screen.findByText(/permission denied. cannot modify admins/i),
        ).toBeInTheDocument();
        expect(acceptButton).not.toBeDisabled();
    });
    it("Displays an error message when accept call returns an error message", async () => {
        renderAuthPage();

        const userRow = await screen.findByRole("row", { name: /ranger/i });
        const acceptButton = within(userRow).getByRole("button", {
            name: /accept/i,
        });

        server.use(
            http.patch("**/v1/users/:id/status", () => {
                return new HttpResponse(null, { status: 500 });
            }),
        );

        await userEvent.click(acceptButton);
        const dialog = await screen.findByRole("dialog");
        await userEvent.click(
            within(dialog).getByRole("button", { name: /confirm/i }),
        );

        expect(await screen.findByText(/failed to accept user\./i));
        expect(acceptButton).not.toBeDisabled();
        expect(screen.getByText("ranger1")).toBeInTheDocument();
    });
    it("Displays an error message when reject call returns an error message", async () => {
        renderAuthPage();

        const userRow = await screen.findByRole("row", { name: /analyst2/i });
        const rejectButton = within(userRow).getByRole("button", {
            name: /reject/i,
        });

        server.use(
            http.delete("**/admin/users/delete/:id", () => {
                return new HttpResponse(null, { status: 500 });
            }),
        );

        await userEvent.click(rejectButton);
        const dialog = await screen.findByRole("dialog");
        await userEvent.click(
            within(dialog).getByRole("button", { name: /confirm/i }),
        );

        expect(
            await screen.findByText(/failed to reject user\./i),
        ).toBeInTheDocument();
        expect(rejectButton).not.toBeDisabled();
        expect(screen.getByText("analyst2")).toBeInTheDocument();
    });
    it("does not close the reject confirmation when clicking outside the dialog", async () => {
        renderAuthPage();

        const userRow = await screen.findByRole("row", { name: /analyst2/i });
        const rejectButton = within(userRow).getByRole("button", {
            name: /reject/i,
        });

        await userEvent.click(rejectButton);
        const dialog = await screen.findByRole("dialog");
        expect(
            within(dialog).getByText(/confirm rejection/i),
        ).toBeInTheDocument();

        fireEvent.pointerDown(document.body);

        expect(await screen.findByRole("dialog")).toBeInTheDocument();
        expect(screen.getByText(/confirm rejection/i)).toBeInTheDocument();
    });
    it("still closes the accept confirmation when clicking outside the dialog", async () => {
        renderAuthPage();

        const userRow = await screen.findByRole("row", { name: /ranger/i });
        const acceptButton = within(userRow).getByRole("button", {
            name: /accept/i,
        });

        await userEvent.click(acceptButton);
        expect(await screen.findByRole("dialog")).toBeInTheDocument();

        fireEvent.pointerDown(document.body);
        fireEvent.click(document.body);

        await waitFor(() => {
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        });
    });

    it("sorts pending registrations by each column when its header is clicked", async () => {
        renderAuthPage();
        await screen.findByRole("row", { name: /ranger/i });

        const getUsernames = () =>
            screen
                .getAllByRole("row")
                .slice(1)
                .map((row) => within(row).getAllByRole("cell")[0].textContent);

        await userEvent.click(screen.getByRole("button", { name: "Username" }));
        expect(getUsernames()).toEqual(["analyst2", "ranger1"]);

        await userEvent.click(screen.getByRole("button", { name: "Username" }));
        expect(getUsernames()).toEqual(["ranger1", "analyst2"]);

        await userEvent.click(screen.getByRole("button", { name: "Name" }));
        expect(getUsernames()).toEqual(["analyst2", "ranger1"]);

        await userEvent.click(
            screen.getByRole("button", { name: "Role Claim" }),
        );
        expect(getUsernames()).toEqual(["analyst2", "ranger1"]);

        await userEvent.click(
            screen.getByRole("button", { name: "Created At" }),
        );
        expect(getUsernames()).toEqual(["ranger1", "analyst2"]);
    });

    it("closes the accept confirmation via the header close button", async () => {
        renderAuthPage();

        const userRow = await screen.findByRole("row", { name: /ranger/i });
        const acceptButton = within(userRow).getByRole("button", {
            name: /accept/i,
        });

        await userEvent.click(acceptButton);
        const dialog = await screen.findByRole("dialog");
        await userEvent.click(
            within(dialog).getByRole("button", {
                name: /cancel, close dialog/i,
            }),
        );

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
});
