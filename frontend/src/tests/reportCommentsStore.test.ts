import { describe, it, expect, afterEach, vi, beforeAll, beforeEach, afterAll } from "vitest";
import { useReportCommentsStore } from "@/store/reportCommentsStore";

import { setupServer } from "msw/node";
import { reportCommentHandlers } from "./mocks/reportCommentHandlers";

vi.mock("@/components/ui/toast", () => ({
  notifyCritical: vi.fn(),
}));

const server = setupServer(...reportCommentHandlers)

beforeAll(() => server.listen());
beforeEach(() => {
    useReportCommentsStore.setState({
        commentsByReportId: {},
        statusByReportId: {},
        isLoading: false,
    })
})

afterEach(() => {
    useReportCommentsStore.setState({
        commentsByReportId: {},
        statusByReportId: {},
    });
});
afterAll(() => server.close())

describe("reportCommentsStore", () => {
    it("defaults to no status for a report with no entries", () => {
        expect(useReportCommentsStore.getState().getStatus("report-1")).toBe(
            "none",
        );
    });
    it("fetches comments for a report", async () => {
        await useReportCommentsStore.getState().fetchComments("report-1");

        const comments = useReportCommentsStore.getState().commentsByReportId["report-1"];
        expect(comments).toHaveLength(1);
        expect(comments[0].body).toBe("Test comment");
    })

    it("adds a comment scoped to its reportId", async () => {
        await useReportCommentsStore.getState().addComment("report-1", {
        body: "Test comment 2",
        photoUrls: [],
        createdAt: "2026-08-20T08:00:00.000Z",
        status: "unresolved",
        });

        const comments = useReportCommentsStore.getState().commentsByReportId["report-1"];
        expect(comments).toHaveLength(1);
        expect(comments[0].body).toBe("Test comment 2");
    });

    it("sets and reads status per report", async () => {
        await useReportCommentsStore.getState().setStatus("report-1", "resolved");

        expect(useReportCommentsStore.getState().getStatus("report-1")).toBe(
            "resolved"
        );
        expect(useReportCommentsStore.getState().getStatus("report-2")).toBe(
            "none"
        );
    });
});
