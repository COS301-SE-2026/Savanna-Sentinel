import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Shield } from "lucide-react";
import { DashCard } from "@/components/dashboard/DashCard";

describe("DashCard", () => {
    it("renders title, value, and subtext", () => {
        render(
            <DashCard
                title="Total Field Reports"
                value={124}
                subtext="+12 this week"
                icon={Shield}
            />,
        );
        expect(screen.getByText("Total Field Reports")).toBeInTheDocument();
        expect(screen.getByText("124")).toBeInTheDocument();
        expect(screen.getByText("+12 this week")).toBeInTheDocument();
    });

    it("renders without an icon or subtext", () => {
        render(<DashCard title="Open Incidents" value={12} />);
        expect(screen.getByText("Open Incidents")).toBeInTheDocument();
        expect(screen.getByText("12")).toBeInTheDocument();
    });
});
