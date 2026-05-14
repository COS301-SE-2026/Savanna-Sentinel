import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { setupServer } from "msw/node";
import { beforeAll, afterEach, afterAll, describe, it, expect } from "vitest";

import { authHandlers } from "./mocks/authHandlers";
import LoginPage from "@/pages/LoginPage";

const server = setupServer(...authHandlers);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );
}

describe("LoginPage — Savana Sentinel", () => {

  it("renders the logo, username field, password field, and Log In button", () => {
    renderLoginPage();
    expect(screen.getByRole("img", { name: /savana sentinel/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
  });

  it("shows a validation error when username is blank on submit", async () => {
    renderLoginPage();
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
    expect(await screen.findByText(/username is required/i)).toBeInTheDocument();
  });

  it("shows a validation error when password is blank", async () => {
    renderLoginPage();
    await userEvent.type(screen.getByLabelText(/username/i), "ranger");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
    expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
  });

  it("shows a generic error on 401 — no credential detail exposed (US1.3)", async () => {
    renderLoginPage();
    await userEvent.type(screen.getByLabelText(/username/i), "baduser");
    await userEvent.type(screen.getByLabelText(/^password$/i), "wrongpass");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));

    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent(/incorrect username or password/i);
    expect(banner.textContent).not.toMatch(/your password/i);
    expect(banner.textContent).not.toMatch(/no account found/i);
  });

  it("toggles password visibility when the eye icon is clicked", async () => {
    renderLoginPage();
    const passwordInput = screen.getByLabelText(/^password$/i);
    expect(passwordInput).toHaveAttribute("type", "password");

    await userEvent.click(screen.getByLabelText(/show password/i));
    expect(passwordInput).toHaveAttribute("type", "text");

    await userEvent.click(screen.getByLabelText(/hide password/i));
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("disables the Log In button and shows spinner while request is in-flight", async () => {
    renderLoginPage();
    await userEvent.type(screen.getByLabelText(/username/i), "ranger");
    await userEvent.type(screen.getByLabelText(/^password$/i), "SecurePass1!");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
    expect(screen.getByRole("button", { name: /logging in/i })).toBeDisabled();
  });

  it("navigates away from /login on successful credentials", async () => {
    renderLoginPage();
    await userEvent.type(screen.getByLabelText(/username/i), "ranger");
    await userEvent.type(screen.getByLabelText(/^password$/i), "SecurePass1!");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /log in/i })
      ).not.toBeInTheDocument();
    });
  });

  it("renders a Register link pointing to /register", () => {
    renderLoginPage();
    expect(screen.getByRole("link", { name: /register/i })).toHaveAttribute(
      "href",
      "/register"
    );
  });

});