import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";

import LandingPage from "@/pages/LandingPage";

describe("LandingPage", () => {
    it("renders the hero heading and account links", () => {
        render(
            <MemoryRouter>
                <LandingPage />
            </MemoryRouter>,
        );

        expect(
            screen.getByRole("heading", { level: 1, name: /savanna\s*sentinel/i }),
        ).toBeInTheDocument();

        const loginLink = screen.getByRole("link", { name: /log in/i });
        expect(loginLink).toHaveAttribute("href", "/login");

        const registerLink = screen.getByRole("link", { name: /register/i });
        expect(registerLink).toHaveAttribute("href", "/register");
    });

    it("lists the core feature tiles", () => {
        render(
            <MemoryRouter>
                <LandingPage />
            </MemoryRouter>,
        );

        expect(screen.getByText("Risk Heatmap")).toBeInTheDocument();
        expect(screen.getByText("Patrol Routes")).toBeInTheDocument();
        expect(screen.getByText("Field Reports")).toBeInTheDocument();
        expect(screen.getByText("Tip-offs")).toBeInTheDocument();
        expect(screen.getByText("Data Ingestion")).toBeInTheDocument();
        expect(screen.getByText("Model Insights")).toBeInTheDocument();
    });
});
