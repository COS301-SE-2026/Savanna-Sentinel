import { describe, it, expect, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReportCommentThread } from "@/components/reports/ReportCommentThread";
import { useReportCommentsStore } from "@/store/reportCommentsStore";
import { useAuthStore } from "@/store/authStore";

function setUser(role: string) {
    useAuthStore.setState({
        user: { id: "u1", username: "ranger1", role },
        accessToken: "token",
        refreshToken: "refresh",
    });
}

function statusBadge(label: string) {
    return screen.getByText(label, { selector: '[data-slot="badge"]' });
}

afterEach(() => {
    useReportCommentsStore.setState({
        commentsByReportId: {},
        statusByReportId: {},
    });
});

describe("ReportCommentThread", () => {
    it("shows a no status badge by default", () => {
        setUser("ranger");
        render(<ReportCommentThread reportId="report-1" />);
        expect(statusBadge("No status")).toBeInTheDocument();
    });

    it("shows an empty-thread message when there are no comments", () => {
        setUser("ranger");
        render(<ReportCommentThread reportId="report-1" />);
        expect(screen.getByText(/no comments yet/i)).toBeInTheDocument();
    });

    it("lets a ranger post a comment, which appears in the list", async () => {
        const user = userEvent.setup();
        setUser("ranger");
        render(<ReportCommentThread reportId="report-1" />);

        await user.type(
            screen.getByRole("textbox", { name: /comment/i }),
            "Followed up on this sighting.",
        );
        await user.click(screen.getByRole("button", { name: /post comment/i }));

        expect(
            screen.getByText("Followed up on this sighting."),
        ).toBeInTheDocument();
        expect(
            useReportCommentsStore.getState().commentsByReportId["report-1"],
        ).toHaveLength(1);
    });

    it("shows a confirm dialog when changing status and does not apply it until confirmed", async () => {
        const user = userEvent.setup();
        setUser("admin");
        render(<ReportCommentThread reportId="report-1" />);

        await user.selectOptions(
            screen.getByRole("combobox", { name: /report status/i }),
            "Resolved",
        );

        expect(
            screen.getByRole("dialog", { name: /change report status/i }),
        ).toBeInTheDocument();
        expect(statusBadge("No status")).toBeInTheDocument();
    });

    it("cancelling the confirm dialog leaves the status unchanged", async () => {
        const user = userEvent.setup();
        setUser("admin");
        render(<ReportCommentThread reportId="report-1" />);

        await user.selectOptions(
            screen.getByRole("combobox", { name: /report status/i }),
            "Resolved",
        );
        await user.click(screen.getByRole("button", { name: "Cancel" }));

        expect(
            screen.queryByRole("dialog", { name: /change report status/i }),
        ).not.toBeInTheDocument();
        expect(statusBadge("No status")).toBeInTheDocument();
        expect(useReportCommentsStore.getState().getStatus("report-1")).toBe(
            "none",
        );
    });

    it("confirming a status change applies it and posts a system message naming who changed it", async () => {
        const user = userEvent.setup();
        setUser("admin");
        render(<ReportCommentThread reportId="report-1" />);

        await user.selectOptions(
            screen.getByRole("combobox", { name: /report status/i }),
            "Resolved",
        );
        await user.click(screen.getByRole("button", { name: /confirm/i }));

        expect(
            screen.queryByRole("dialog", { name: /change report status/i }),
        ).not.toBeInTheDocument();
        expect(statusBadge("Resolved")).toBeInTheDocument();
        expect(
            screen.getByText(/ranger1 marked this report as resolved/i),
        ).toBeInTheDocument();
        expect(useReportCommentsStore.getState().getStatus("report-1")).toBe(
            "resolved",
        );
    });

    it("lets a ranger or admin cycle a report through no status, resolved, unresolved, and back to no status", async () => {
        const user = userEvent.setup();
        setUser("admin");
        render(<ReportCommentThread reportId="report-1" />);

        await user.selectOptions(
            screen.getByRole("combobox", { name: /report status/i }),
            "Resolved",
        );
        await user.click(screen.getByRole("button", { name: /confirm/i }));
        expect(statusBadge("Resolved")).toBeInTheDocument();

        await user.selectOptions(
            screen.getByRole("combobox", { name: /report status/i }),
            "Unresolved",
        );
        await user.click(screen.getByRole("button", { name: /confirm/i }));
        expect(statusBadge("Unresolved")).toBeInTheDocument();

        await user.selectOptions(
            screen.getByRole("combobox", { name: /report status/i }),
            "No status",
        );
        await user.click(screen.getByRole("button", { name: /confirm/i }));
        expect(statusBadge("No status")).toBeInTheDocument();
        expect(useReportCommentsStore.getState().getStatus("report-1")).toBe(
            "none",
        );
    });

    it("hides the composer and status control for analysts", () => {
        setUser("analyst");
        render(<ReportCommentThread reportId="report-1" />);

        expect(
            screen.queryByRole("textbox", { name: /comment/i }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole("combobox", { name: /report status/i }),
        ).not.toBeInTheDocument();
        expect(statusBadge("No status")).toBeInTheDocument();
    });

    it("only shows comments for the given reportId", () => {
        setUser("ranger");
        useReportCommentsStore.getState().addComment({
            id: "c1",
            reportId: "other-report",
            authorId: "u2",
            authorUsername: "ranger2",
            authorRole: "ranger",
            body: "Comment on a different report.",
            photoUrls: [],
            createdAt: "2026-08-20T08:00:00.000Z",
        });

        render(<ReportCommentThread reportId="report-1" />);

        expect(
            screen.queryByText("Comment on a different report."),
        ).not.toBeInTheDocument();
    });

    it("renders photo thumbnails for a comment that has attachments", () => {
        setUser("ranger");
        useReportCommentsStore.getState().addComment({
            id: "c-photo",
            reportId: "report-1",
            authorId: "u2",
            authorUsername: "ranger2",
            authorRole: "ranger",
            body: "Found this near the fence.",
            photoUrls: ["blob:a", "blob:b"],
            createdAt: "2026-08-20T08:00:00.000Z",
        });

        render(<ReportCommentThread reportId="report-1" />);

        expect(
            screen.getByAltText("Comment attachment 1 of 2"),
        ).toBeInTheDocument();
        expect(
            screen.getByAltText("Comment attachment 2 of 2"),
        ).toBeInTheDocument();
        expect(screen.getByText("ranger2")).toBeInTheDocument();
    });

    it("opens a lightbox with prev/next navigation when a comment photo is clicked", async () => {
        const user = userEvent.setup();
        setUser("ranger");
        useReportCommentsStore.getState().addComment({
            id: "c-photo",
            reportId: "report-1",
            authorId: "u2",
            authorUsername: "ranger2",
            authorRole: "ranger",
            body: "Found this near the fence.",
            photoUrls: ["blob:a", "blob:b"],
            createdAt: "2026-08-20T08:00:00.000Z",
        });

        render(<ReportCommentThread reportId="report-1" />);

        await user.click(screen.getByAltText("Comment attachment 1 of 2"));

        expect(
            screen.getByAltText("Comment attachment 1 of 2, enlarged"),
        ).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Next photo" }));
        expect(
            screen.getByAltText("Comment attachment 2 of 2, enlarged"),
        ).toBeInTheDocument();

        await user.click(
            screen.getByRole("button", { name: "Close photo preview" }),
        );
        expect(
            screen.queryByAltText("Comment attachment 2 of 2, enlarged"),
        ).not.toBeInTheDocument();
    });
});
