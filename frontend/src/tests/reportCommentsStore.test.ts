import { describe, it, expect, afterEach } from "vitest";
import { useReportCommentsStore } from "@/store/reportCommentsStore";
import type { ReportComment } from "@/types/reportComments";

afterEach(() => {
    useReportCommentsStore.setState({
        commentsByReportId: {},
        statusByReportId: {},
    });
});

function makeComment(overrides: Partial<ReportComment> = {}): ReportComment {
    return {
        id: "c1",
        reportId: "report-1",
        authorId: "u1",
        authorUsername: "ranger1",
        authorRole: "ranger",
        body: "Checked the area, no snares found.",
        photoUrls: [],
        createdAt: "2026-08-20T08:00:00.000Z",
        ...overrides,
    };
}

describe("reportCommentsStore", () => {
    it("defaults to no status for a report with no entries", () => {
        expect(useReportCommentsStore.getState().getStatus("report-1")).toBe(
            "none",
        );
    });

    it("adds a comment scoped to its reportId", () => {
        useReportCommentsStore.getState().addComment(makeComment());
        useReportCommentsStore
            .getState()
            .addComment(makeComment({ id: "c2", reportId: "report-2" }));

        expect(
            useReportCommentsStore.getState().commentsByReportId["report-1"],
        ).toHaveLength(1);
        expect(
            useReportCommentsStore.getState().commentsByReportId["report-2"],
        ).toHaveLength(1);
    });

    it("sets and reads status per report", () => {
        useReportCommentsStore.getState().setStatus("report-1", "resolved");

        expect(useReportCommentsStore.getState().getStatus("report-1")).toBe(
            "resolved",
        );
        expect(useReportCommentsStore.getState().getStatus("report-2")).toBe(
            "none",
        );
    });
});
