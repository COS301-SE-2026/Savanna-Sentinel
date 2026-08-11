import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TipoffForm } from "@/components/tipoffs/TipoffForm";

beforeAll(() => {
    URL.createObjectURL = vi.fn(() => "blob:mock-url");
    URL.revokeObjectURL = vi.fn();
});

function fillCommonFields() {
    return userEvent.type(
        screen.getByLabelText("Description"),
        "Snare found near the eastern fence line.",
    );
}

async function fillOccurredAt() {
    const input = screen.getByLabelText("When did this happen?");
    await userEvent.clear(input);
    await userEvent.type(input, "2020-01-01T08:00");
}

describe("TipoffForm", () => {
    it("shows incident-only fields when Report Type is Incident", () => {
        render(<TipoffForm onSubmit={vi.fn()} />);
        expect(screen.getByLabelText("Incident Type")).toBeInTheDocument();
        expect(screen.queryByLabelText("Species")).not.toBeInTheDocument();
    });

    it("shows sighting-only fields when Report Type is Sighting", async () => {
        render(<TipoffForm onSubmit={vi.fn()} />);
        await userEvent.click(screen.getByLabelText("Sighting"));
        expect(screen.getByLabelText("Species")).toBeInTheDocument();
        expect(screen.getByLabelText("Count")).toBeInTheDocument();
        expect(
            screen.queryByLabelText("Incident Type"),
        ).not.toBeInTheDocument();
    });

    it("shows an error and does not submit when description is empty", async () => {
        const onSubmit = vi.fn();
        render(<TipoffForm onSubmit={onSubmit} />);
        await userEvent.selectOptions(
            screen.getByRole("combobox", { name: "Incident Type" }),
            "Snare Found",
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Submit Tip-off" }),
        );
        expect(
            screen.getByText("Description is required."),
        ).toBeInTheDocument();
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it("shows an error and does not submit when no location is picked", async () => {
        const onSubmit = vi.fn();
        render(<TipoffForm onSubmit={onSubmit} />);
        await fillCommonFields();
        await userEvent.selectOptions(
            screen.getByRole("combobox", { name: "Incident Type" }),
            "Snare Found",
        );
        await fillOccurredAt();
        await userEvent.click(
            screen.getByRole("button", { name: "Submit Tip-off" }),
        );
        expect(
            screen.getByText("Select a location on the map."),
        ).toBeInTheDocument();
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it("reveals a free-text field when Other is chosen as the incident type", async () => {
        render(<TipoffForm onSubmit={vi.fn()} />);
        await userEvent.selectOptions(
            screen.getByRole("combobox", { name: "Incident Type" }),
            "Other",
        );
        expect(
            screen.getByPlaceholderText("Specify incident type"),
        ).toBeInTheDocument();
    });

    it("disables the submit button and changes its label while submitting", () => {
        render(<TipoffForm onSubmit={vi.fn()} isSubmitting />);
        const button = screen.getByRole("button", { name: "Submitting..." });
        expect(button).toBeDisabled();
    });
});
