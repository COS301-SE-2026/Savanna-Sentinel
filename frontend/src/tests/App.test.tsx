import { render, screen } from "@testing-library/react";
import { setupServer } from "msw/node";
import { beforeAll, afterEach, afterAll, describe, it, expect } from "vitest";

import { authHandlers } from "./mocks/authHandlers";
import App from "@/App";

const server = setupServer(...authHandlers);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("App", () => {
    it("renders the login page and toaster at the /login route", () => {
        window.history.pushState({}, "", "/login");
        render(<App />);

        expect(
            screen.getByRole("img", { name: /savanna sentinel/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /log in/i }),
        ).toBeInTheDocument();
    });
});
