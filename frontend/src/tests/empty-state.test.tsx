import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

describe("EmptyState", () => {
    it("renders the title and body", () => {
        render(
            <EmptyState
                icon={Inbox}
                title="No reports yet"
                body="Submitted field reports will appear here."
            />,
        );
        expect(screen.getByText("No reports yet")).toBeInTheDocument();
        expect(
            screen.getByText("Submitted field reports will appear here."),
        ).toBeInTheDocument();
    });

    it("renders the action when provided", () => {
        render(
            <EmptyState
                icon={Inbox}
                title="No reports yet"
                body="Submitted field reports will appear here."
                action={<button>Submit First Report</button>}
            />,
        );
        expect(
            screen.getByRole("button", { name: "Submit First Report" }),
        ).toBeInTheDocument();
    });

    it("omits any action element when none is provided", () => {
        render(
            <EmptyState
                icon={Inbox}
                title="No reports yet"
                body="Submitted field reports will appear here."
            />,
        );
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
});
