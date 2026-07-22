import * as React from "react";
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewReportTab } from "@/components/reports/NewReportTab";
import { blankDraftReportInput } from "@/types/reports";
import type { DraftReport, DraftReportInput } from "@/types/reports";

beforeAll(() => {
    URL.createObjectURL = vi.fn(() => "blob:mock-url");
    URL.revokeObjectURL = vi.fn();
});

function makeDraft(localId: string, description: string): DraftReport {
    return {
        ...blankDraftReportInput("incident"),
        incidentType: "Snare Found",
        lat: -25,
        lon: 28,
        description,
        localId,
        submittedBy: "ranger1",
        createdAt: "2020-01-01T08:00:00.000Z",
        syncStatus: "pending",
    };
}

async function fillMinimalIncidentFields() {
    await userEvent.type(
        screen.getByLabelText("Description"),
        "A new snare near the river.",
    );
    await userEvent.selectOptions(
        screen.getByRole("combobox", { name: "Incident Type" }),
        "Snare Found",
    );
    await userEvent.type(screen.getByLabelText("Latitude"), "-25.1");
    await userEvent.type(screen.getByLabelText("Longitude"), "28.1");
    const occurredAt = screen.getByLabelText("When did this happen?");
    await userEvent.clear(occurredAt);
    await userEvent.type(occurredAt, "2020-01-01T08:00");
}

function StatefulHarness() {
    const [drafts, setDrafts] = React.useState<DraftReport[]>([]);

    const onCreate = (input: DraftReportInput) => {
        const newDraft: DraftReport = {
            ...input,
            localId: `local-${drafts.length + 1}`,
            submittedBy: "ranger1",
            createdAt: "2020-01-01T08:00:00.000Z",
            syncStatus: "pending",
        };
        setDrafts((prev) => [...prev, newDraft]);
    };

    return (
        <NewReportTab
            myDrafts={drafts}
            onCreate={onCreate}
            onSave={vi.fn()}
            onDelete={vi.fn()}
        />
    );
}

describe("NewReportTab", () => {
    it("shows only the add chip and Submit Report when there are no drafts", () => {
        render(
            <NewReportTab
                myDrafts={[]}
                onCreate={vi.fn()}
                onSave={vi.fn()}
                onDelete={vi.fn()}
            />,
        );
        expect(
            screen.getByRole("button", { name: "Submit Report" }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "Save Draft" }),
        ).not.toBeInTheDocument();
    });

    it("calls onCreate with the submitted input when on the add chip", async () => {
        const onCreate = vi.fn();
        render(
            <NewReportTab
                myDrafts={[]}
                onCreate={onCreate}
                onSave={vi.fn()}
                onDelete={vi.fn()}
            />,
        );
        await fillMinimalIncidentFields();
        await userEvent.click(
            screen.getByRole("button", { name: "Submit Report" }),
        );
        expect(onCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                description: "A new snare near the river.",
            }),
        );
    });

    it("shows a numbered chip per existing draft plus a trailing add chip", () => {
        render(
            <NewReportTab
                myDrafts={[makeDraft("a", "First"), makeDraft("b", "Second")]}
                onCreate={vi.fn()}
                onSave={vi.fn()}
                onDelete={vi.fn()}
            />,
        );
        expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "2" })).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Start a new draft" }),
        ).toBeInTheDocument();
    });

    it("loads a draft into the form when its chip is clicked, and shows Save Draft", async () => {
        render(
            <NewReportTab
                myDrafts={[makeDraft("a", "First draft text")]}
                onCreate={vi.fn()}
                onSave={vi.fn()}
                onDelete={vi.fn()}
            />,
        );
        await userEvent.click(screen.getByRole("button", { name: "1" }));
        expect(
            screen.getByDisplayValue("First draft text"),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Save Draft" }),
        ).toBeInTheDocument();
    });

    it("calls onSave with the draft's localId when Save Draft is clicked", async () => {
        const onSave = vi.fn();
        render(
            <NewReportTab
                myDrafts={[makeDraft("a", "First draft text")]}
                onCreate={vi.fn()}
                onSave={onSave}
                onDelete={vi.fn()}
            />,
        );
        await userEvent.click(screen.getByRole("button", { name: "1" }));
        await userEvent.click(
            screen.getByRole("button", { name: "Save Draft" }),
        );
        expect(onSave).toHaveBeenCalledWith(
            "a",
            expect.objectContaining({ description: "First draft text" }),
        );
    });

    it("calls onDelete with the draft's localId after confirming deletion", async () => {
        const onDelete = vi.fn();
        render(
            <NewReportTab
                myDrafts={[makeDraft("a", "First draft text")]}
                onCreate={vi.fn()}
                onSave={vi.fn()}
                onDelete={onDelete}
            />,
        );
        await userEvent.click(screen.getByRole("button", { name: "1" }));
        await userEvent.click(
            screen.getByRole("button", { name: "Delete Draft" }),
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Delete Report" }),
        );
        expect(onDelete).toHaveBeenCalledWith("a");
    });

    it("resets the form to blank after submitting from the add chip, against a real synchronous parent", async () => {
        render(<StatefulHarness />);
        await fillMinimalIncidentFields();
        await userEvent.click(
            screen.getByRole("button", { name: "Submit Report" }),
        );

        expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Submit Report" }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "Delete Draft" }),
        ).not.toBeInTheDocument();
        expect(screen.getByLabelText("Description")).toHaveValue("");
    });
});
