import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReportDetailDialog } from "@/components/reports/ReportDetailDialog";
import { blankDraftReportInput } from "@/types/reports";
import type { DraftReport } from "@/types/reports";

function makeReport(overrides: Partial<DraftReport>): DraftReport {
    return {
        ...blankDraftReportInput("incident"),
        incidentType: "Snare Found",
        severity: "medium",
        lat: -25.7461,
        lon: 28.1881,
        localId: "report-1",
        submittedBy: "ranger1",
        createdAt: "2020-01-01T08:00:00.000Z",
        syncStatus: "pending",
        ...overrides,
    };
}

describe("ReportDetailDialog", () => {
    it("renders nothing when report is null", () => {
        render(<ReportDetailDialog report={null} onOpenChange={vi.fn()} />);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("shows the report's fields when a report is provided", () => {
        const report = makeReport({ description: "Snare near fence" });
        render(<ReportDetailDialog report={report} onOpenChange={vi.fn()} />);

        const dialog = screen.getByRole("dialog");
        expect(within(dialog).getByText("Incident Report")).toBeInTheDocument();
        expect(
            within(dialog).getByText("Snare near fence"),
        ).toBeInTheDocument();
        expect(within(dialog).getByText("Snare Found")).toBeInTheDocument();
        expect(within(dialog).getByText("Medium")).toBeInTheDocument();
        expect(within(dialog).getByText("ranger1")).toBeInTheDocument();
        expect(
            within(dialog).getByText("-25.7461, 28.1881"),
        ).toBeInTheDocument();
    });

    it("shows the resolved submitter username instead of the raw ID when present", () => {
        const report = makeReport({
            submittedBy: "user-id-123",
            submittedByUsername: "ranger_jane",
        });
        render(<ReportDetailDialog report={report} onOpenChange={vi.fn()} />);

        const dialog = screen.getByRole("dialog");
        expect(within(dialog).getByText("ranger_jane")).toBeInTheDocument();
        expect(
            within(dialog).queryByText("user-id-123"),
        ).not.toBeInTheDocument();
    });

    it("shows a no-photos message when the report has no attachments", () => {
        const report = makeReport({});
        render(<ReportDetailDialog report={report} onOpenChange={vi.fn()} />);
        expect(screen.getByText("No photos attached.")).toBeInTheDocument();
    });

    it("shows photo thumbnails and opens an enlarged view when one is clicked", async () => {
        const user = userEvent.setup();
        const report = makeReport({
            photos: [
                { file: new File([], "a.jpg"), previewUrl: "blob:a" },
                { file: new File([], "b.jpg"), previewUrl: "blob:b" },
            ],
        });
        render(<ReportDetailDialog report={report} onOpenChange={vi.fn()} />);

        const thumbnail = screen.getByAltText("Attached photo 1 of 2");
        expect(thumbnail).toBeInTheDocument();

        await user.click(thumbnail);

        expect(
            screen.getByAltText("Attached photo 1 of 2, enlarged"),
        ).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Next photo" }));
        expect(
            screen.getByAltText("Attached photo 2 of 2, enlarged"),
        ).toBeInTheDocument();
    });

    it("calls onOpenChange when the dialog is closed", async () => {
        const user = userEvent.setup();
        const onOpenChange = vi.fn();
        const report = makeReport({});
        render(
            <ReportDetailDialog report={report} onOpenChange={onOpenChange} />,
        );

        await user.click(
            screen.getByRole("button", { name: /cancel, close dialog/i }),
        );
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("renders the comment thread for the given report", () => {
        const report = makeReport({ localId: "report-42" });
        render(<ReportDetailDialog report={report} onOpenChange={vi.fn()} />);

        expect(screen.getByText("Discussion")).toBeInTheDocument();
        expect(
            screen.getByText("No status", { selector: '[data-slot="badge"]' }),
        ).toBeInTheDocument();
    });
});
