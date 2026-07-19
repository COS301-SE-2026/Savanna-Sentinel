import * as React from "react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
    UserSearchFilterBar,
    type MultiSelectOption,
} from "@/components/admin/UserSearchFilterBar";

const roleOptions: MultiSelectOption[] = [
    { value: "ranger", label: "Ranger" },
    { value: "analyst", label: "Analyst" },
];

function Harness({
    initialSearch = "",
    initialRoles = [],
}: {
    initialSearch?: string;
    initialRoles?: string[];
}) {
    const [search, setSearch] = React.useState(initialSearch);
    const [selectedRoles, setSelectedRoles] =
        React.useState<string[]>(initialRoles);
    return (
        <UserSearchFilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search users..."
            roleOptions={roleOptions}
            selectedRoles={selectedRoles}
            onRolesChange={setSelectedRoles}
        />
    );
}

function openFilters() {
    return userEvent.click(
        screen.getByRole("button", { name: /open filters/i }),
    );
}

function openRoleList() {
    return userEvent.click(screen.getByRole("button", { name: /^role/i }));
}

function panelHeading() {
    return screen.queryByText("Role");
}

describe("UserSearchFilterBar", () => {
    beforeEach(() => {
        window.innerWidth = 1024;
    });

    afterEach(() => {
        window.innerWidth = 1024;
    });

    it("calls onSearchChange as the user types", async () => {
        const user = userEvent.setup();
        render(<Harness />);

        const input = screen.getByRole("searchbox", {
            name: /search users/i,
        });
        await user.type(input, "abc");

        expect(input).toHaveValue("abc");
    });

    it("shows a clear button once search has text and clears it on click", async () => {
        const user = userEvent.setup();
        render(<Harness initialSearch="abc" />);

        const clearButton = screen.getByRole("button", {
            name: /clear search/i,
        });
        await user.click(clearButton);

        expect(
            screen.getByRole("searchbox", { name: /search users/i }),
        ).toHaveValue("");
    });

    it("opens and closes the filter panel via the Filters button", async () => {
        const user = userEvent.setup();
        render(<Harness />);

        await openFilters();
        expect(panelHeading()).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /open filters/i }));
        expect(panelHeading()).not.toBeInTheDocument();
    });

    it("shows the active filter count badge when roles are selected", async () => {
        render(<Harness initialRoles={["ranger"]} />);

        expect(
            screen.getByRole("button", {
                name: /open filters, 1 active/i,
            }),
        ).toBeInTheDocument();
    });

    it("opens the role list and toggles individual roles, updating the summary", async () => {
        const user = userEvent.setup();
        render(<Harness />);

        await openFilters();
        expect(screen.getByText("None Selected")).toBeInTheDocument();

        const roleTrigger = screen.getByRole("button", { name: /role/i });
        await openRoleList();
        const listbox = screen.getByRole("listbox");
        await user.click(within(listbox).getByLabelText("Ranger"));

        expect(roleTrigger).toHaveTextContent("Ranger");

        await user.click(within(listbox).getByLabelText("Analyst"));
        expect(roleTrigger).toHaveTextContent("2 selected");
    });

    it("selects and deselects all roles via the select-all checkbox", async () => {
        const user = userEvent.setup();
        render(<Harness />);

        await openFilters();
        await openRoleList();

        const selectAll = screen.getByLabelText("Select all");
        await user.click(selectAll);
        expect(screen.getByText("2 selected")).toBeInTheDocument();

        await user.click(selectAll);
        expect(screen.getByText("None Selected")).toBeInTheDocument();
    });

    it("applies the draft role selection to the parent state", async () => {
        const user = userEvent.setup();
        render(<Harness />);

        await openFilters();
        await openRoleList();
        await user.click(screen.getByLabelText("Ranger"));
        await user.click(screen.getByRole("button", { name: /^apply$/i }));

        expect(panelHeading()).not.toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /open filters, 1 active/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", {
                name: /remove role filter: ranger/i,
            }),
        ).toBeInTheDocument();
    });

    it("resets the draft to the applied selection each time the panel reopens", async () => {
        const user = userEvent.setup();
        render(<Harness initialRoles={["ranger"]} />);

        await openFilters();
        await openRoleList();
        await user.click(screen.getByLabelText("Analyst"));
        expect(screen.getByText("2 selected")).toBeInTheDocument();

        await user.click(
            screen.getByRole("button", { name: /open filters, 1 active/i }),
        );
        await openFilters();

        expect(screen.getByText("Ranger")).toBeInTheDocument();
    });

    it("clears the draft selection via the Clear button without touching applied roles", async () => {
        const user = userEvent.setup();
        render(<Harness initialRoles={["ranger"]} />);

        await openFilters();
        await user.click(screen.getByRole("button", { name: /^clear$/i }));

        await openRoleList();
        expect(screen.getByText("None Selected")).toBeInTheDocument();
    });

    it("removes a role chip and notifies the parent", async () => {
        const user = userEvent.setup();
        render(<Harness initialRoles={["ranger", "analyst"]} />);

        await user.click(
            screen.getByRole("button", {
                name: /remove role filter: ranger/i,
            }),
        );

        expect(
            screen.queryByRole("button", {
                name: /remove role filter: ranger/i,
            }),
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole("button", {
                name: /remove role filter: analyst/i,
            }),
        ).toBeInTheDocument();
    });

    it("closes the role list on Escape, then closes the panel on a second Escape", async () => {
        render(<Harness />);

        await openFilters();
        await openRoleList();
        expect(screen.getByRole("listbox")).toBeInTheDocument();

        fireEvent.keyDown(document, { key: "Escape" });
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
        expect(panelHeading()).toBeInTheDocument();

        fireEvent.keyDown(document, { key: "Escape" });
        expect(panelHeading()).not.toBeInTheDocument();
    });

    it("ignores non-Escape keys", async () => {
        render(<Harness />);

        await openFilters();
        fireEvent.keyDown(document, { key: "Enter" });

        expect(panelHeading()).toBeInTheDocument();
    });

    it("closes the panel when clicking outside it", async () => {
        render(<Harness />);

        await openFilters();
        fireEvent.pointerDown(document.body);

        expect(panelHeading()).not.toBeInTheDocument();
    });

    it("closes only the role list when clicking outside it but still inside the panel", async () => {
        render(<Harness />);

        await openFilters();
        await openRoleList();
        expect(screen.getByRole("listbox")).toBeInTheDocument();

        fireEvent.pointerDown(panelHeading() as Node);

        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
        expect(panelHeading()).toBeInTheDocument();
    });

    it("falls back to the raw value when a selected role has no matching option", async () => {
        render(<Harness initialRoles={["unknown_role"]} />);

        expect(
            screen.getByRole("button", {
                name: /remove role filter: unknown_role/i,
            }),
        ).toBeInTheDocument();
    });

    it("deselects an individually selected role on a second click", async () => {
        const user = userEvent.setup();
        render(<Harness />);

        await openFilters();
        const roleTrigger = screen.getByRole("button", { name: /^role/i });
        await openRoleList();
        const listbox = screen.getByRole("listbox");
        const rangerCheckbox = within(listbox).getByLabelText("Ranger");

        await user.click(rangerCheckbox);
        expect(roleTrigger).toHaveTextContent("Ranger");

        await user.click(rangerCheckbox);
        expect(roleTrigger).toHaveTextContent("None Selected");
    });

    it("renders the mobile layout for the filter panel on small viewports", async () => {
        window.innerWidth = 500;
        render(<Harness />);

        await openFilters();

        expect(panelHeading()?.closest(".fixed")).toBeInTheDocument();
    });

    it("does not throw when unmounted while the panel listeners are attached", () => {
        const { unmount } = render(<Harness />);
        expect(() => unmount()).not.toThrow();
        vi.restoreAllMocks();
    });
});
