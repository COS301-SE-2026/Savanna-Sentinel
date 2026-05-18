import AuthPage from "@/pages/AdminAuthAccount"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { authHandlers} from "./mocks/adminauthHandlers"
import { describe, beforeAll, afterAll, afterEach, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"

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
})