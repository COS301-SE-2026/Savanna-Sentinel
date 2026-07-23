import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pagination } from "@/components/ui/pagination";

describe("Pagination", () => {
    it("renders numbered chips and ellipses matching the middle-page demo", () => {
        render(
            <Pagination
                currentPage={4}
                totalPages={7}
                onPageChange={vi.fn()}
            />,
        );
        expect(
            screen.getByRole("button", { name: "3", current: false }),
        ).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "4" })).toHaveAttribute(
            "aria-current",
            "page",
        );
        expect(screen.getByRole("button", { name: "5" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "7" })).toBeInTheDocument();
        expect(screen.getAllByText("...")).toHaveLength(2);
    });

    it("disables the previous button on page 1", () => {
        render(
            <Pagination
                currentPage={1}
                totalPages={7}
                onPageChange={vi.fn()}
            />,
        );
        expect(
            screen.getByRole("button", { name: "Previous page" }),
        ).toBeDisabled();
        expect(
            screen.getByRole("button", { name: "Next page" }),
        ).not.toBeDisabled();
    });

    it("disables the next button on the last page", () => {
        render(
            <Pagination
                currentPage={7}
                totalPages={7}
                onPageChange={vi.fn()}
            />,
        );
        expect(
            screen.getByRole("button", { name: "Next page" }),
        ).toBeDisabled();
        expect(
            screen.getByRole("button", { name: "Previous page" }),
        ).not.toBeDisabled();
    });

    it("calls onPageChange with the clicked page number", async () => {
        const onPageChange = vi.fn();
        render(
            <Pagination
                currentPage={4}
                totalPages={7}
                onPageChange={onPageChange}
            />,
        );
        await userEvent.click(screen.getByRole("button", { name: "5" }));
        expect(onPageChange).toHaveBeenCalledWith(5);
    });

    it("calls onPageChange with currentPage + 1 when next is clicked", async () => {
        const onPageChange = vi.fn();
        render(
            <Pagination
                currentPage={4}
                totalPages={7}
                onPageChange={onPageChange}
            />,
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Next page" }),
        );
        expect(onPageChange).toHaveBeenCalledWith(5);
    });

    it("renders a trailing add chip after the last numbered page", async () => {
        const onPageChange = vi.fn();
        render(
            <Pagination
                currentPage={3}
                totalPages={2}
                trailingAddChip
                onPageChange={onPageChange}
            />,
        );
        const addChip = screen.getByRole("button", {
            name: "Start a new draft",
        });
        expect(addChip).toHaveAttribute("aria-current", "page");
        await userEvent.click(addChip);
        expect(onPageChange).toHaveBeenCalledWith(3);
    });

    it("renders only the add chip when totalPages is 0", () => {
        render(
            <Pagination
                currentPage={1}
                totalPages={0}
                trailingAddChip
                onPageChange={vi.fn()}
            />,
        );
        expect(
            screen.getByRole("button", { name: "Start a new draft" }),
        ).toHaveAttribute("aria-current", "page");
        expect(
            screen.queryByRole("button", { name: "1" }),
        ).not.toBeInTheDocument();
    });
});
