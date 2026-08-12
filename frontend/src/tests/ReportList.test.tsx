import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReportList } from "@/components/reports/ReportList";
import { blankDraftReportInput } from "@/types/reports";
import type { DraftReport } from "@/types/reports";

vi.mock("@/hooks/useReportSearchFilter", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@/hooks/useReportSearchFilter")>();
    return {
        ...actual,
        getSpeciesOptions: vi
            .fn()
            .mockResolvedValue(["Elephant", "Lion", "Rhino"]),
        getUsernameOptions: vi
            .fn()
            .mockResolvedValue(["John Doe", "jane_ranger"]),
    };
});

function makeReport(overrides: Partial<DraftReport>): DraftReport {
    return {
        ...blankDraftReportInput("incident"),
        incidentType: "Snare Found",
        severity: "medium",
        lat: -25.7461,
        lon: 28.1881,
        localId: Math.random().toString(),
        submittedBy: "ranger1",
        createdAt: "2020-01-01T08:00:00.000Z",
        syncStatus: "pending",
        ...overrides,
    };
}

describe("ReportList", () => {
    it("shows the empty state with a Submit First Report action when canSubmit is true and there are no reports", () => {
        const onGoToNewReport = vi.fn();
        render(
            <ReportList
                reports={[]}
                canSubmit
                onGoToNewReport={onGoToNewReport}
                search=""
                setSearch={vi.fn()}
                typeFilter={[]}
                setTypeFilter={vi.fn()}
                severityFilter={[]}
                setSeverityFilter={vi.fn()}
                speciesFilter={[]}
                setSpeciesFilter={vi.fn()}
                usernameFilter={[]}
                setUsernameFilter={vi.fn()}
                isLoading={false}
            />,
        );
        expect(screen.getByText("No reports yet")).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Submit First Report" }),
        ).toBeInTheDocument();
    });

    it("omits the action button in the empty state when canSubmit is false", () => {
        render(
            <ReportList
                reports={[]}
                canSubmit={false}
                onGoToNewReport={vi.fn()}
                search=""
                setSearch={vi.fn()}
                typeFilter={[]}
                setTypeFilter={vi.fn()}
                severityFilter={[]}
                setSeverityFilter={vi.fn()}
                speciesFilter={[]}
                setSpeciesFilter={vi.fn()}
                usernameFilter={[]}
                setUsernameFilter={vi.fn()}
                isLoading={false}
            />,
        );
        expect(
            screen.getByText("No reports have been submitted yet."),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "Submit First Report" }),
        ).not.toBeInTheDocument();
    });

    it("calls onGoToNewReport when the empty state action is clicked", async () => {
        const onGoToNewReport = vi.fn();
        render(
            <ReportList
                reports={[]}
                canSubmit
                onGoToNewReport={onGoToNewReport}
                search=""
                setSearch={vi.fn()}
                typeFilter={[]}
                setTypeFilter={vi.fn()}
                severityFilter={[]}
                setSeverityFilter={vi.fn()}
                speciesFilter={[]}
                setSpeciesFilter={vi.fn()}
                usernameFilter={[]}
                setUsernameFilter={vi.fn()}
                isLoading={false}
            />,
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Submit First Report" }),
        );
        expect(onGoToNewReport).toHaveBeenCalledTimes(1);
    });

    it("renders a row per report with a Pending Sync badge", () => {
        render(
            <ReportList
                reports={[makeReport({ description: "Snare near fence" })]}
                canSubmit
                onGoToNewReport={vi.fn()}
                search=""
                setSearch={vi.fn()}
                typeFilter={[]}
                setTypeFilter={vi.fn()}
                severityFilter={[]}
                setSeverityFilter={vi.fn()}
                speciesFilter={[]}
                setSpeciesFilter={vi.fn()}
                usernameFilter={[]}
                setUsernameFilter={vi.fn()}
                isLoading={false}
            />,
        );
        expect(screen.getByText("Snare near fence")).toBeInTheDocument();
        expect(screen.getByText("Pending Sync")).toBeInTheDocument();
    });

    it("shows a no-match message when search excludes every report", async () => {
        render(
            <ReportList
                reports={[]}
                canSubmit
                onGoToNewReport={vi.fn()}
                search="nothing matches this"
                setSearch={vi.fn()}
                typeFilter={[]}
                setTypeFilter={vi.fn()}
                severityFilter={[]}
                setSeverityFilter={vi.fn()}
                speciesFilter={[]}
                setSpeciesFilter={vi.fn()}
                usernameFilter={[]}
                setUsernameFilter={vi.fn()}
                isLoading={false}
            />,
        );

        expect(
            await screen.findByText("No reports match your search or filters."),
        ).toBeInTheDocument();
    });

    it("formats the occurred-at time without seconds", () => {
        const report = makeReport({ occurredAt: "2024-03-15T21:05" });
        render(
            <ReportList
                reports={[report]}
                canSubmit
                onGoToNewReport={vi.fn()}
                search=""
                setSearch={vi.fn()}
                typeFilter={[]}
                setTypeFilter={vi.fn()}
                severityFilter={[]}
                setSeverityFilter={vi.fn()}
                speciesFilter={[]}
                setSpeciesFilter={vi.fn()}
                usernameFilter={[]}
                setUsernameFilter={vi.fn()}
                isLoading={false}
            />,
        );
        const expected = new Date(report.occurredAt).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
        });
        expect(screen.getByText(expected)).toBeInTheDocument();
        expect(expected.match(/:/g)).toHaveLength(1);
    });

    it("defaults to most-recently-created first", () => {
        render(
            <ReportList
                reports={[
                    makeReport({
                        description: "Older report",
                        createdAt: "2020-01-01T08:00:00.000Z",
                    }),
                    makeReport({
                        description: "Newer report",
                        createdAt: "2021-01-01T08:00:00.000Z",
                    }),
                ]}
                canSubmit
                onGoToNewReport={vi.fn()}
                search=""
                setSearch={vi.fn()}
                typeFilter={[]}
                setTypeFilter={vi.fn()}
                severityFilter={[]}
                setSeverityFilter={vi.fn()}
                speciesFilter={[]}
                setSpeciesFilter={vi.fn()}
                usernameFilter={[]}
                setUsernameFilter={vi.fn()}
                isLoading={false}
            />,
        );
        const rows = screen.getAllByRole("row").slice(1);
        expect(within(rows[0]).getByText("Newer report")).toBeInTheDocument();
        expect(within(rows[1]).getByText("Older report")).toBeInTheDocument();
    });

    it("sorts by a column when its header is clicked, and reverses on a second click", async () => {
        render(
            <ReportList
                reports={[
                    makeReport({
                        description: "Snare near fence",
                        submittedBy: "zoe",
                    }),
                    makeReport({
                        description: "Elephants at waterhole",
                        submittedBy: "amara",
                    }),
                ]}
                canSubmit
                onGoToNewReport={vi.fn()}
                search=""
                setSearch={vi.fn()}
                typeFilter={[]}
                setTypeFilter={vi.fn()}
                severityFilter={[]}
                setSeverityFilter={vi.fn()}
                speciesFilter={[]}
                setSpeciesFilter={vi.fn()}
                usernameFilter={[]}
                setUsernameFilter={vi.fn()}
                isLoading={false}
            />,
        );

        await userEvent.click(
            screen.getByRole("button", { name: /submitted by/i }),
        );
        let rows = screen.getAllByRole("row").slice(1);
        expect(
            within(rows[0]).getByText("Elephants at waterhole"),
        ).toBeInTheDocument();

        await userEvent.click(
            screen.getByRole("button", { name: /submitted by/i }),
        );
        rows = screen.getAllByRole("row").slice(1);
        expect(
            within(rows[0]).getByText("Snare near fence"),
        ).toBeInTheDocument();
    });

    it("paginates when there are more than 10 reports", () => {
        const reports = Array.from({ length: 11 }, (_, i) =>
            makeReport({ description: `Report number ${i}` }),
        );
        render(
            <ReportList
                reports={reports}
                canSubmit
                onGoToNewReport={vi.fn()}
                search=""
                setSearch={vi.fn()}
                typeFilter={[]}
                setTypeFilter={vi.fn()}
                severityFilter={[]}
                setSeverityFilter={vi.fn()}
                speciesFilter={[]}
                setSpeciesFilter={vi.fn()}
                usernameFilter={[]}
                setUsernameFilter={vi.fn()}
                isLoading={false}
            />,
        );
        expect(screen.getByRole("button", { name: "2" })).toBeInTheDocument();
    });

    it("opens the report detail dialog when a row is clicked", async () => {
        render(
            <ReportList
                reports={[makeReport({ description: "Snare near fence" })]}
                canSubmit
                onGoToNewReport={vi.fn()}
                search=""
                setSearch={vi.fn()}
                typeFilter={[]}
                setTypeFilter={vi.fn()}
                severityFilter={[]}
                setSeverityFilter={vi.fn()}
                speciesFilter={[]}
                setSpeciesFilter={vi.fn()}
                usernameFilter={[]}
                setUsernameFilter={vi.fn()}
                isLoading={false}
            />,
        );

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

        await userEvent.click(
            screen.getByRole("row", {
                name: "View report: Snare near fence",
            }),
        );

        const dialog = screen.getByRole("dialog");
        expect(
            within(dialog).getByText("Snare near fence"),
        ).toBeInTheDocument();
    });

    it("calls setSpeciesFilter when species filter is applied", async () => {
        const setSpeciesFilter = vi.fn();
        render(
            <ReportList
                reports={[
                    makeReport({
                        description: "Buffalo herd crossing",
                        reportType: "sighting",
                        species: "Buffalo",
                        incidentType: "",
                        severity: null,
                    }),
                ]}
                canSubmit
                onGoToNewReport={vi.fn()}
                search=""
                setSearch={vi.fn()}
                typeFilter={[]}
                setTypeFilter={vi.fn()}
                severityFilter={[]}
                setSeverityFilter={vi.fn()}
                speciesFilter={[]}
                setSpeciesFilter={setSpeciesFilter}
                usernameFilter={[]}
                setUsernameFilter={vi.fn()}
                isLoading={false}
            />,
        );

        await userEvent.click(
            screen.getByRole("button", { name: "Open filters" }),
        );
        await userEvent.click(
            screen.getByRole("button", { name: /^species/i }),
        );
        const elephantCheckbox = await screen.findByRole("checkbox", {
            name: /elephant/i,
        });
        await userEvent.click(elephantCheckbox);
        await userEvent.click(screen.getByRole("button", { name: /^apply$/i }));

        expect(setSpeciesFilter).toHaveBeenCalledWith(["Elephant"]);
    });

    it("opens the report detail dialog when a row is activated with the keyboard", async () => {
        render(
            <ReportList
                reports={[makeReport({ description: "Snare near fence" })]}
                canSubmit
                onGoToNewReport={vi.fn()}
                search=""
                setSearch={vi.fn()}
                typeFilter={[]}
                setTypeFilter={vi.fn()}
                severityFilter={[]}
                setSeverityFilter={vi.fn()}
                speciesFilter={[]}
                setSpeciesFilter={vi.fn()}
                usernameFilter={[]}
                setUsernameFilter={vi.fn()}
                isLoading={false}
            />,
        );

        const row = screen.getByRole("row", {
            name: "View report: Snare near fence",
        });
        row.focus();
        await userEvent.keyboard("{Enter}");

        expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
});
