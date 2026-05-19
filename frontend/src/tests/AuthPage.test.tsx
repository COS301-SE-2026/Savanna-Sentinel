import AuthPage from "@/pages/AdminAuthAccount"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { authHandlers, mockUsers} from "./mocks/adminauthHandlers"
import { describe, beforeAll, afterAll, afterEach, it, expect } from "vitest"
import { render, screen, within, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const server = setupServer(...authHandlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderAuthPage() {
  return render(<AuthPage />);
}

describe("Authpage - Pending Registrations", () => {
    it("shows a loading indicator then renders users", async () => {
        renderAuthPage()

        expect(screen.getByText(/loading pending users.../i)).toBeInTheDocument();

        expect(await screen.findByText("ranger1")).toBeInTheDocument();
        expect(screen.getByText("analyst2")).toBeInTheDocument();
        expect(screen.getByText("John Doe")).toBeInTheDocument();
        expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    })
    it("renders a fallback message if the incoming collection is empty", async () => {
        server.use(
            http.get("**/v1/users", () => {
                return HttpResponse.json({results: []})
            })
        );

        renderAuthPage();

        expect(await screen.findByText(/no pending registrations found/i)).toBeInTheDocument();
    })
    it("Renders an alert banner when the fetch fails", async () => {
        server.use(
            http.get("**/v1/users", () => {
                return new HttpResponse(null, {status: 500})
            })
        )

        renderAuthPage();

        expect(await screen.findByText(/failed to load pending registrations/i)).toBeInTheDocument();

    })
    it("Refreshes the page when accept is clicked, and calls the status update endpoint", async () => {
        renderAuthPage();

        const userRow = await screen.findByRole("row", {name: /ranger/i});
        const acceptButton = within(userRow).getByRole("button", {name: /accept/i})

        server.use(
            http.get("**/v1/users", () => {
                return HttpResponse.json({results: [mockUsers.results[1]]})
            })
        );

        await userEvent.click(acceptButton);
        expect(acceptButton).toBeDisabled();

        await waitFor(() => {
            expect(screen.queryByText("ranger1")).not.toBeInTheDocument();
        });

        expect(screen.getByText("analyst2")).toBeInTheDocument();

    })
        it("Refreshes the page when accept is clicked, and calls the status update endpoint", async () => {
        renderAuthPage();

        const userRow = await screen.findByRole("row", {name: /analyst2/i});
        const rejectButton = within(userRow).getByRole("button", {name: /reject/i})

        server.use(
            http.get("**/v1/users", () => {
                return HttpResponse.json({results: [mockUsers.results[0]]})
            })
        );

        await userEvent.click(rejectButton);
        expect(rejectButton).toBeDisabled();

        await waitFor(() => {
            expect(screen.queryByText("analyst2")).not.toBeInTheDocument();
        });
    })
})