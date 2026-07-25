import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "@/components/ui/badge";

describe("Badge status variants", () => {
    it("renders the safe variant with a status-safe border", () => {
        render(<Badge variant="safe">Active</Badge>);
        expect(screen.getByText("Active")).toHaveClass("border-status-safe");
    });

    it("renders the caution variant with a status-caution border", () => {
        render(<Badge variant="caution">Pending Sync</Badge>);
        expect(screen.getByText("Pending Sync")).toHaveClass(
            "border-status-caution",
        );
    });

    it("renders the alert variant with a status-alert border", () => {
        render(<Badge variant="alert">Elevated</Badge>);
        expect(screen.getByText("Elevated")).toHaveClass("border-status-alert");
    });

    it("renders the critical variant with a status-critical border", () => {
        render(<Badge variant="critical">Critical</Badge>);
        expect(screen.getByText("Critical")).toHaveClass(
            "border-status-critical",
        );
    });

    it("still renders the pre-existing neutral variant unchanged", () => {
        render(<Badge variant="neutral">Incident</Badge>);
        expect(screen.getByText("Incident")).toHaveClass("border-brand-muted");
    });
});
