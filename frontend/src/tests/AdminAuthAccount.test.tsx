import { setupServer } from "msw/node";
import { describe, beforeAll, afterAll, afterEach, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuthPage from "@/pages/AdminAuthAccount";
import { authHandlers } from "./mocks/adminauthHandlers";

const server = setupServer(...authHandlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderAuthPage() {
    return render(<AuthPage />);
}

describe("AuthPage - Account Approvals", () => {
    it("does not offer Admin as a role filter option", async () => {
        const user = userEvent.setup();
        renderAuthPage();

        await screen.findByText("ranger1");

        await user.click(screen.getByRole("button", { name: /open filters/i }));
        await user.click(
            screen.getByRole("button", { name: /^role none selected/i }),
        );

        const listbox = screen.getByRole("listbox");
        expect(within(listbox).queryByLabelText("Admin")).not.toBeInTheDocument();
    });
});
