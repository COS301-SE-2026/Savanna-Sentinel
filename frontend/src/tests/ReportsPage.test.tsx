import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReportsPage from "@/pages/ReportsPage";
import { useAuthStore } from "@/store/authStore";
import { notifySafe } from "@/components/ui/toast";

vi.mock("@/components/ui/toast", () => ({
    notifySafe: vi.fn(),
}));

function setUser(role: string) {
    useAuthStore.setState({
        user: { id: "u1", username: "ranger1", role },
        accessToken: "token",
        refreshToken: "refresh",
    });
}

async function submitMinimalIncidentReport(description: string) {
    await userEvent.type(screen.getByLabelText("Description"), description);
    await userEvent.selectOptions(
        screen.getByRole("combobox", { name: "Incident Type" }),
        "Snare Found",
    );
    await userEvent.type(screen.getByLabelText("Latitude"), "-25.1");
    await userEvent.type(screen.getByLabelText("Longitude"), "28.1");
    const occurredAt = screen.getByLabelText("When did this happen?");
    await userEvent.clear(occurredAt);
    await userEvent.type(occurredAt, "2020-01-01T08:00");
    await userEvent.click(
        screen.getByRole("button", { name: "Submit Report" }),
    );
}

describe("ReportsPage", () => {
    beforeEach(() => {
        URL.createObjectURL = vi.fn(() => "blob:mock-url");
        URL.revokeObjectURL = vi.fn();
        vi.mocked(notifySafe).mockClear();
        vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    });

    afterEach(() => {
        useAuthStore.setState({
            user: null,
            accessToken: null,
            refreshToken: null,
        });
    });

    it("shows both tabs for a ranger, defaulting to New Report", () => {
        setUser("ranger");
        render(<ReportsPage />);
        expect(screen.getByRole("tab", { name: "New Report" })).toHaveAttribute(
            "data-state",
            "active",
        );
        expect(
            screen.getByRole("tab", { name: "All Reports" }),
        ).toBeInTheDocument();
    });

    it("shows only All Reports for an analyst, with no submit controls", () => {
        setUser("analyst");
        render(<ReportsPage />);
        expect(
            screen.queryByRole("tab", { name: "New Report" }),
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole("tab", { name: "All Reports" }),
        ).toHaveAttribute("data-state", "active");
    });

    it("shows a submitted draft in All Reports with a Pending Sync badge", async () => {
        setUser("ranger");
        render(<ReportsPage />);
        await submitMinimalIncidentReport("Snare found near the river");
        await userEvent.click(screen.getByRole("tab", { name: "All Reports" }));
        expect(
            screen.getByText("Snare found near the river"),
        ).toBeInTheDocument();
        expect(screen.getByText("Pending Sync")).toBeInTheDocument();
    });

    it("switches to New Report when the empty state action is clicked", async () => {
        setUser("ranger");
        render(<ReportsPage />);
        await userEvent.click(screen.getByRole("tab", { name: "All Reports" }));
        await userEvent.click(
            screen.getByRole("button", { name: "Submit First Report" }),
        );
        expect(screen.getByRole("tab", { name: "New Report" })).toHaveAttribute(
            "data-state",
            "active",
        );
    });

    it("shows a toast and scrolls to top when a report is submitted", async () => {
        setUser("ranger");
        render(<ReportsPage />);
        await submitMinimalIncidentReport("Snare found near the river");
        expect(notifySafe).toHaveBeenCalledWith(
            "Report submitted",
            expect.any(String),
        );
        expect(window.scrollTo).toHaveBeenCalledWith({
            top: 0,
            behavior: "smooth",
        });
    });

    it("shows a toast and scrolls to top when a draft is saved", async () => {
        setUser("ranger");
        render(<ReportsPage />);
        await submitMinimalIncidentReport("Snare found near the river");
        vi.mocked(notifySafe).mockClear();
        vi.mocked(window.scrollTo).mockClear();

        await userEvent.click(screen.getByRole("button", { name: "1" }));
        await userEvent.click(
            screen.getByRole("button", { name: "Save Draft" }),
        );
        expect(notifySafe).toHaveBeenCalledWith(
            "Draft saved",
            "Your report has been updated.",
        );
        expect(window.scrollTo).toHaveBeenCalledWith({
            top: 0,
            behavior: "smooth",
        });
    });

    it("shows a toast when a report is deleted", async () => {
        setUser("ranger");
        render(<ReportsPage />);
        await submitMinimalIncidentReport("Snare found near the river");
        vi.mocked(notifySafe).mockClear();

        await userEvent.click(screen.getByRole("button", { name: "1" }));
        await userEvent.click(
            screen.getByRole("button", { name: "Delete Draft" }),
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Delete Report" }),
        );
        expect(notifySafe).toHaveBeenCalledWith("Report deleted");
    });
});
