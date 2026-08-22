import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Shield } from "lucide-react";
import { DashCard } from "@/components/dashboard/DashCard";

describe("DashCard", () => {
    it("renders title, value, and icon", () => {
        render(
            <DashCard
                label="Total Field Reports"
                value={124}
                badge={Shield}
            />,
        );
        expect(screen.getByText("Total Field Reports")).toBeInTheDocument();
        expect(screen.getByText("124")).toBeInTheDocument();
    });

    it("renders without an icon or subtext", () => {
        render(<DashCard label="Open Incidents" value={12} />);
        expect(screen.getByText("Open Incidents")).toBeInTheDocument();
        expect(screen.getByText("12")).toBeInTheDocument();
    });
});
