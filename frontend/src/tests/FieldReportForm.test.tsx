import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FieldReportForm } from "@/components/reports/FieldReportForm";
import { blankDraftReportInput } from "@/types/reports";
import type { DraftReportInput } from "@/types/reports";

beforeAll(() => {
    URL.createObjectURL = vi.fn(() => "blob:mock-url");
    URL.revokeObjectURL = vi.fn();
});

function fillCommonFields() {
    return userEvent.type(
        screen.getByLabelText("Description"),
        "Found a wire snare near the eastern fence line.",
    );
}

async function fillLocation() {
    await userEvent.type(screen.getByLabelText("Latitude"), "-25.7461");
    await userEvent.type(screen.getByLabelText("Longitude"), "28.1881");
}

async function fillOccurredAt() {
    const input = screen.getByLabelText("When did this happen?");
    await userEvent.clear(input);
    await userEvent.type(input, "2020-01-01T08:00");
}

describe("FieldReportForm", () => {
    it("shows incident-only fields when Report Type is Incident", () => {
        render(<FieldReportForm mode="create" onSubmit={vi.fn()} />);
        expect(screen.getByLabelText("Incident Type")).toBeInTheDocument();
        expect(screen.queryByLabelText("Species")).not.toBeInTheDocument();
    });

    it("shows sighting-only fields when Report Type is Sighting", async () => {
        render(<FieldReportForm mode="create" onSubmit={vi.fn()} />);
        await userEvent.click(screen.getByLabelText("Sighting"));
        expect(screen.getByLabelText("Species")).toBeInTheDocument();
        expect(screen.getByLabelText("Count")).toBeInTheDocument();
        expect(
            screen.queryByLabelText("Incident Type"),
        ).not.toBeInTheDocument();
    });

    it("shows an error and does not submit when description is empty", async () => {
        const onSubmit = vi.fn();
        render(<FieldReportForm mode="create" onSubmit={onSubmit} />);
        await userEvent.click(
            screen.getByRole("combobox", { name: "Incident Type" }),
        );
        await userEvent.selectOptions(
            screen.getByRole("combobox", { name: "Incident Type" }),
            "Snare Found",
        );
        await fillLocation();
        await userEvent.click(
            screen.getByRole("button", { name: "Submit Report" }),
        );
        expect(
            screen.getByText("Description is required."),
        ).toBeInTheDocument();
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it("submits a fully valid incident report", async () => {
        const onSubmit = vi.fn();
        render(<FieldReportForm mode="create" onSubmit={onSubmit} />);
        await fillCommonFields();
        await userEvent.selectOptions(
            screen.getByRole("combobox", { name: "Incident Type" }),
            "Snare Found",
        );
        await userEvent.click(screen.getByLabelText("Medium"));
        await fillOccurredAt();
        await fillLocation();
        await userEvent.click(
            screen.getByRole("button", { name: "Submit Report" }),
        );
        expect(onSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                reportType: "incident",
                incidentType: "Snare Found",
                severity: "medium",
                lat: -25.7461,
                lon: 28.1881,
            }),
        );
    });

    it("reveals a free-text field when Other is chosen as the incident type", async () => {
        render(<FieldReportForm mode="create" onSubmit={vi.fn()} />);
        await userEvent.selectOptions(
            screen.getByRole("combobox", { name: "Incident Type" }),
            "Other",
        );
        expect(
            screen.getByPlaceholderText("Specify incident type"),
        ).toBeInTheDocument();
    });

    it("submits a fully valid sighting report", async () => {
        const onSubmit = vi.fn();
        render(<FieldReportForm mode="create" onSubmit={onSubmit} />);
        await userEvent.click(screen.getByLabelText("Sighting"));
        await fillCommonFields();
        await userEvent.selectOptions(
            screen.getByRole("combobox", { name: "Species" }),
            "Elephant",
        );
        await userEvent.type(screen.getByLabelText("Count"), "4");
        await fillOccurredAt();
        await fillLocation();
        await userEvent.click(
            screen.getByRole("button", { name: "Submit Report" }),
        );
        expect(onSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                reportType: "sighting",
                species: "Elephant",
                count: 4,
            }),
        );
    });

    it("loads initialValue into the form fields in edit mode", () => {
        const initialValue: DraftReportInput = {
            ...blankDraftReportInput("incident"),
            description: "Existing draft description",
            incidentType: "Gunshot Heard",
            severity: "high",
            lat: -25.0,
            lon: 28.0,
        };
        render(
            <FieldReportForm
                mode="edit"
                initialValue={initialValue}
                onSubmit={vi.fn()}
                onDelete={vi.fn()}
            />,
        );
        expect(
            screen.getByDisplayValue("Existing draft description"),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("combobox", { name: "Incident Type" }),
        ).toHaveValue("Gunshot Heard");
        expect(screen.getByLabelText("High")).toBeChecked();
        expect(
            screen.getByRole("button", { name: "Save Draft" }),
        ).toBeInTheDocument();
    });

    it("opens a confirmation dialog before deleting, and only deletes on confirm", async () => {
        const onDelete = vi.fn();
        const initialValue: DraftReportInput = {
            ...blankDraftReportInput("incident"),
            description: "Existing draft description",
            incidentType: "Gunshot Heard",
            lat: -25.0,
            lon: 28.0,
        };
        render(
            <FieldReportForm
                mode="edit"
                initialValue={initialValue}
                onSubmit={vi.fn()}
                onDelete={onDelete}
            />,
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Delete Draft" }),
        );
        expect(screen.getByText("Delete Report?")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(onDelete).not.toHaveBeenCalled();

        await userEvent.click(
            screen.getByRole("button", { name: "Delete Draft" }),
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Delete Report" }),
        );
        expect(onDelete).toHaveBeenCalledTimes(1);
    });
});
