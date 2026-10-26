import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { beforeAll, afterEach, afterAll, describe, it, expect } from "vitest";

import { authHandlers } from "./mocks/authHandlers";
import App from "@/App";
import { useAuthStore } from "@/store/authStore";

const server = setupServer(...authHandlers);
beforeAll(() => server.listen());
afterEach(() => {
    server.resetHandlers();
    useAuthStore.setState({
        accessToken: null,
        refreshToken: null,
        user: null,
        isUploaded: null,
    });
});
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

    it("renders the top bar on the park upload page", async () => {
        server.use(
            http.get("http://localhost:8000/v1/risk/initialise", () =>
                HttpResponse.json({ uploaded: false }),
            ),
            http.get("http://localhost:8000/v1/notifications", () =>
                HttpResponse.json([]),
            ),
        );
        useAuthStore.setState({
            accessToken: "token",
            refreshToken: "refresh",
            user: { id: "1", username: "admin1", role: "admin" },
        });
        window.history.pushState({}, "", "/upload");
        render(<App />);

        expect(
            await screen.findByRole("heading", {
                name: /park geojson upload/i,
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /open navigation menu/i }),
        ).toBeInTheDocument();
    });
});
