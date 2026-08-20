import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecentFieldReportsCard } from "@/components/dashboard/RecentFieldReportsCard";

describe("RecentFieldReportsCard", () => {
    it("renders the table header columns", () => {
        render(<RecentFieldReportsCard />);
        expect(screen.getByText("ID")).toBeInTheDocument();
        expect(screen.getByText("Ranger")).toBeInTheDocument();
        expect(screen.getByText("Type")).toBeInTheDocument();
        expect(screen.getByText("Location")).toBeInTheDocument();
        expect(screen.getByText("Time")).toBeInTheDocument();
    });

    it("renders an empty state when there are no reports", () => {
        render(<RecentFieldReportsCard />);
        expect(screen.getByText("No recent field reports")).toBeInTheDocument();
    });
});
