import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecentFieldReportsCard } from "@/components/dashboard/RecentFieldReportsCard";

describe("RecentFieldReportsCard", () => {
    it("renders the table header columns", () => {
        render(<RecentFieldReportsCard reports={[]} />);
        expect(screen.getByText("ID")).toBeInTheDocument();
        expect(screen.getByText("Ranger")).toBeInTheDocument();
        expect(screen.getByText("Type")).toBeInTheDocument();
        expect(screen.getByText("Location")).toBeInTheDocument();
        expect(screen.getByText("Time")).toBeInTheDocument();
    });

    it("renders an empty state when there are no reports", () => {
        render(<RecentFieldReportsCard reports={[]} />);
        expect(screen.getByText("No recent field reports")).toBeInTheDocument();
    });

    it("renders populated report rows", () => {
        render(
            <RecentFieldReportsCard
                reports={[
                    {
                        report_id: "RPT-001",
                        ranger: "Amina Yusuf",
                        report_type: "Elephant sighting",
                        severity: "high",
                        zone: "North corridor",
                        occurred_at: "2026-08-22 08:30",
                    },
                ]}
            />,
        );

        expect(screen.getByText("RPT-001")).toBeInTheDocument();
        expect(screen.getByText("Amina Yusuf")).toBeInTheDocument();
        expect(screen.getByText("Elephant sighting")).toBeInTheDocument();
        expect(screen.getByText("North corridor")).toBeInTheDocument();
        expect(screen.getByText("2026-08-22 08:30")).toBeInTheDocument();
        expect(
            screen.queryByText("No recent field reports"),
        ).not.toBeInTheDocument();
    });
});
