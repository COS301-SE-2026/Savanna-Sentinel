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

    it("renders one row per report with a severity/type badge", () => {
        render(<RecentFieldReportsCard />);
        expect(screen.getByText("RPT-041")).toBeInTheDocument();
        expect(screen.getAllByText("ranger1")).toHaveLength(2);
        expect(screen.getByText("Zone A-3")).toBeInTheDocument();
        expect(screen.getByText("2h ago")).toBeInTheDocument();
        expect(screen.getByText("High")).toBeInTheDocument();
        expect(screen.getAllByText("Sighting")).toHaveLength(2);
        expect(screen.getByText("Medium")).toBeInTheDocument();
        expect(screen.getByText("Low")).toBeInTheDocument();
    });
});
