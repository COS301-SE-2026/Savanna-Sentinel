import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { setupServer } from "msw/node";
import { beforeAll, afterEach, afterAll, describe, it, expect } from "vitest";

import { registerHandlers } from "./mocks/registerHandlers";
import RegisterPage from "@/pages/RegisterPage";
import { Toaster } from "@/components/ui/sonner";

const server = setupServer(...registerHandlers);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderRegisterPage() {
    return render(
        <MemoryRouter initialEntries={["/register"]}>
            <Toaster />
            <Routes>
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/login" element={<div>Login Page</div>} />
            </Routes>
        </MemoryRouter>,
    );
}

async function fillValidForm(overrides: Record<string, string> = {}) {
    const defaults = {
        first_name: "Jane",
        last_name: "Ranger",
        username: "jranger",
        email: "jane@example.com",
        password: "SecurePass1!",
    };
    const values = { ...defaults, ...overrides };

    await userEvent.type(
        screen.getByLabelText(/first name/i),
        values.first_name,
    );
    await userEvent.type(screen.getByLabelText(/last name/i), values.last_name);
    await userEvent.type(screen.getByLabelText(/username/i), values.username);
    await userEvent.type(screen.getByLabelText(/^email$/i), values.email);
    await userEvent.type(screen.getByLabelText(/^password$/i), values.password);
}

async function selectRole(name: RegExp) {
    await userEvent.selectOptions(screen.getByRole("combobox"), [
        screen.getByRole("option", { name }),
    ]);
}

describe("RegisterPage", () => {
    it("renders all form fields and the register button", () => {
        renderRegisterPage();
        expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /^register$/i }),
        ).toBeInTheDocument();
    });

    it("renders a log in link pointing to /login", () => {
        renderRegisterPage();
        expect(screen.getByRole("link", { name: /log in/i })).toHaveAttribute(
            "href",
            "/login",
        );
    });

    it("shows errors for blank text fields on submit", async () => {
        renderRegisterPage();
        await userEvent.click(
            screen.getByRole("button", { name: /^register$/i }),
        );
        expect(
            await screen.findByText(/first name is required/i),
        ).toBeInTheDocument();
        expect(screen.getByText(/last name is required/i)).toBeInTheDocument();
        expect(screen.getByText(/username is required/i)).toBeInTheDocument();
    });

    it("does not submit the form when no role is selected", async () => {
        renderRegisterPage();
        await fillValidForm();
        //submit without choosing a role
        await userEvent.click(
            screen.getByRole("button", { name: /^register$/i }),
        );
        //success screen shouldbt appear
        await new Promise((r) => setTimeout(r, 500));
        expect(screen.queryByText(/request sent/i)).not.toBeInTheDocument();
    });

    it("shows a error for an invalid email", async () => {
        renderRegisterPage();
        await userEvent.type(screen.getByLabelText(/^email$/i), "notanemail");
        await userEvent.click(
            screen.getByRole("button", { name: /^register$/i }),
        );
        expect(
            await screen.findByText(/enter a valid email address/i),
        ).toBeInTheDocument();
    });

    it("shows a error when password is too short", async () => {
        renderRegisterPage();
        await userEvent.type(screen.getByLabelText(/^password$/i), "short");
        await userEvent.click(
            screen.getByRole("button", { name: /^register$/i }),
        );
        expect(
            await screen.findByText(/password must be at least 8 characters/i),
        ).toBeInTheDocument();
    });

    it("toggles password visibility when the eye icon is clicked", async () => {
        renderRegisterPage();
        const passwordInput = screen.getByLabelText(/^password$/i);
        expect(passwordInput).toHaveAttribute("type", "password");

        await userEvent.click(screen.getByLabelText(/show password/i));
        expect(passwordInput).toHaveAttribute("type", "text");

        await userEvent.click(screen.getByLabelText(/hide password/i));
        expect(passwordInput).toHaveAttribute("type", "password");
    });

    it("shows a spinner and disables the button while submitting", async () => {
        renderRegisterPage();
        await fillValidForm();
        await selectRole(/^ranger$/i);
        await userEvent.click(
            screen.getByRole("button", { name: /^register$/i }),
        );
        expect(
            await screen.findByRole("button", { name: /registering/i }),
        ).toBeDisabled();
    });

    it("shows the success screen after a valid submission", async () => {
        renderRegisterPage();
        await fillValidForm();
        await selectRole(/^ranger$/i);
        await userEvent.click(
            screen.getByRole("button", { name: /^register$/i }),
        );

        await waitFor(() => {
            expect(screen.getByText(/request sent/i)).toBeInTheDocument();
        });
        expect(
            screen.getByText(/pending admin activation/i),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: /back to login/i }),
        ).toHaveAttribute("href", "/login");
    });

    it("shows a 409 error when username or email is already taken", async () => {
        renderRegisterPage();
        await fillValidForm({ username: "taken" });
        await selectRole(/^analyst$/i);
        await userEvent.click(
            screen.getByRole("button", { name: /^register$/i }),
        );

        const banner = await screen.findByRole("alert");
        expect(banner).toHaveTextContent(
            /email or username is already in use/i,
        );
    });

    it("renders all three role options in the dropdown", async () => {
        renderRegisterPage();
        await userEvent.click(screen.getByRole("combobox"));
        expect(
            await screen.findByRole("option", { name: /^ranger$/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("option", { name: /^analyst$/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("option", { name: /^community liaison$/i }),
        ).toBeInTheDocument();
    });
});
