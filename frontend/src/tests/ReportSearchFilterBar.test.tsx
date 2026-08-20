import * as React from "react";
import { afterEach, beforeEach, describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReportSearchFilterBar } from "@/components/reports/ReportSearchFilterBar";
import type { ReportType, Severity } from "@/types/reports";

function Harness({
    speciesOptions = ["Elephant", "Rhino"],
    usernameOptions = ["ranger1", "ranger2"],
}: {
    speciesOptions?: string[];
    usernameOptions?: string[];
}) {
    const [search, setSearch] = React.useState("");
    const [typeFilter, setTypeFilter] = React.useState<ReportType[]>([]);
    const [severityFilter, setSeverityFilter] = React.useState<Severity[]>([]);
    const [speciesFilter, setSpeciesFilter] = React.useState<string[]>([]);
    const [usernameFilter, setUsernameFilter] = React.useState<string[]>([]);
    return (
        <ReportSearchFilterBar
            search={search}
            onSearchChange={setSearch}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
            severityFilter={severityFilter}
            onSeverityFilterChange={setSeverityFilter}
            speciesFilter={speciesFilter}
            onSpeciesFilterChange={setSpeciesFilter}
            speciesOptions={speciesOptions}
            usernameFilter={usernameFilter}
            onUsernameFilterChange={setUsernameFilter}
            usernameOptions={usernameOptions}
        />
    );
}

function openFilters() {
    return userEvent.click(
        screen.getByRole("button", { name: "Open filters" }),
    );
}

function openTypeList() {
    return userEvent.click(
        screen.getByRole("button", { name: /^report type/i }),
    );
}

function openSeverityList() {
    return userEvent.click(screen.getByRole("button", { name: /^severity/i }));
}

function openSpeciesList() {
    return userEvent.click(screen.getByRole("button", { name: /^species/i }));
}

function openUsernameList() {
    return userEvent.click(
        screen.getByRole("button", { name: /^submitted by/i }),
    );
}

describe("ReportSearchFilterBar", () => {
    beforeEach(() => {
        window.innerWidth = 1024;
    });
    afterEach(() => {
        window.innerWidth = 1024;
    });

    it("calls onSearchChange as the user types", async () => {
        render(<Harness />);
        await userEvent.type(
            screen.getByPlaceholderText("Search reports..."),
            "snare",
        );
        expect(screen.getByPlaceholderText("Search reports...")).toHaveValue(
            "snare",
        );
    });

    it("renders the type and severity filters as dropdown selectors, not inline checklists", async () => {
        render(<Harness />);
        await openFilters();

        expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /^report type/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /^severity/i }),
        ).toBeInTheDocument();
    });

    it("opens the type dropdown and applies a type filter as a chip", async () => {
        render(<Harness />);
        await openFilters();
        await openTypeList();
        await userEvent.click(
            within(screen.getByRole("listbox")).getByLabelText("Incident"),
        );
        await userEvent.click(screen.getByRole("button", { name: /^apply$/i }));
        expect(screen.getByText("Type: Incident")).toBeInTheDocument();
    });

    it("opens the severity dropdown and applies a severity filter as a chip", async () => {
        render(<Harness />);
        await openFilters();
        await openSeverityList();
        await userEvent.click(
            within(screen.getByRole("listbox")).getByLabelText("High"),
        );
        await userEvent.click(screen.getByRole("button", { name: /^apply$/i }));
        expect(screen.getByText("Severity: High")).toBeInTheDocument();
    });

    it("opening one dropdown closes the other", async () => {
        render(<Harness />);
        await openFilters();
        await openTypeList();
        expect(screen.getByRole("listbox")).toBeInTheDocument();

        await openSeverityList();
        const listboxes = screen.getAllByRole("listbox");
        expect(listboxes).toHaveLength(1);
    });

    it("removes an active filter chip", async () => {
        render(<Harness />);
        await openFilters();
        await openTypeList();
        await userEvent.click(
            within(screen.getByRole("listbox")).getByLabelText("Incident"),
        );
        await userEvent.click(screen.getByRole("button", { name: /^apply$/i }));
        await userEvent.click(
            screen.getByRole("button", {
                name: "Remove type filter: Incident",
            }),
        );
        expect(screen.queryByText("Type: Incident")).not.toBeInTheDocument();
    });

    it("clears draft selections without applying when Clear is clicked", async () => {
        render(<Harness />);
        await openFilters();
        await openTypeList();
        await userEvent.click(
            within(screen.getByRole("listbox")).getByLabelText("Incident"),
        );
        await userEvent.click(screen.getByRole("button", { name: /^clear$/i }));
        expect(screen.queryByText("Type: Incident")).not.toBeInTheDocument();
    });

    it("renders the species filter as a dropdown selector", async () => {
        render(<Harness />);
        await openFilters();
        expect(
            screen.getByRole("button", { name: /^species/i }),
        ).toBeInTheDocument();
    });

    it("opens the species dropdown and applies a species filter as a chip", async () => {
        render(<Harness />);
        await openFilters();
        await openSpeciesList();
        await userEvent.click(
            within(screen.getByRole("listbox")).getByLabelText("Elephant"),
        );
        await userEvent.click(screen.getByRole("button", { name: /^apply$/i }));
        expect(screen.getByText("Species: Elephant")).toBeInTheDocument();
    });

    it("removes an active species filter chip", async () => {
        render(<Harness />);
        await openFilters();
        await openSpeciesList();
        await userEvent.click(
            within(screen.getByRole("listbox")).getByLabelText("Elephant"),
        );
        await userEvent.click(screen.getByRole("button", { name: /^apply$/i }));
        await userEvent.click(
            screen.getByRole("button", {
                name: "Remove species filter: Elephant",
            }),
        );
        expect(screen.queryByText("Species: Elephant")).not.toBeInTheDocument();
    });

    it("opens the species dropdown with no selectable species when none are available", async () => {
        render(<Harness speciesOptions={[]} />);
        await openFilters();
        await openSpeciesList();
        expect(
            within(screen.getByRole("listbox")).getAllByRole("checkbox"),
        ).toHaveLength(1);
    });

    it("opens the submitted-by dropdown and applies a username filter as a chip", async () => {
        render(<Harness />);
        await openFilters();
        await openUsernameList();
        await userEvent.click(
            within(screen.getByRole("listbox")).getByLabelText("ranger1"),
        );
        await userEvent.click(screen.getByRole("button", { name: /^apply$/i }));
        expect(screen.getByText("Submitted By: ranger1")).toBeInTheDocument();
    });

    it("removes an active submitted-by filter chip", async () => {
        render(<Harness />);
        await openFilters();
        await openUsernameList();
        await userEvent.click(
            within(screen.getByRole("listbox")).getByLabelText("ranger1"),
        );
        await userEvent.click(screen.getByRole("button", { name: /^apply$/i }));
        await userEvent.click(
            screen.getByRole("button", {
                name: "Remove submitted by filter: ranger1",
            }),
        );
        expect(
            screen.queryByText("Submitted By: ranger1"),
        ).not.toBeInTheDocument();
    });
});
