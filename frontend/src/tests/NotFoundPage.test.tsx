import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";

import NotFoundPage from "@/pages/NotFoundPage";

describe("NotFoundPage", () => {
    it("renders a 404 message with a link back to the dashboard", () => {
        render(
            <MemoryRouter>
                <NotFoundPage />
            </MemoryRouter>,
        );

        expect(screen.getByText("404")).toBeInTheDocument();
        expect(screen.getByText(/page not found/i)).toBeInTheDocument();

        const link = screen.getByRole("link", { name: /return/i });
        expect(link).toHaveAttribute("href", "/dashboard");
    });
});
