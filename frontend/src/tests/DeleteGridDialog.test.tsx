import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, it, expect, vi } from "vitest";

import { DeleteGridDialog } from "@/components/upload/DeleteGridDialog";

function renderDialog(onConfirm = vi.fn(), isDeleting = false) {
    function Harness() {
        const [isOpen, setOpen] = useState(true);
        return (
            <>
                <button type="button" onClick={() => setOpen(true)}>
                    Reopen
                </button>
                <DeleteGridDialog
                    open={isOpen}
                    onOpenChange={setOpen}
                    onConfirm={onConfirm}
                    isDeleting={isDeleting}
                />
            </>
        );
    }
    render(<Harness />);
    return onConfirm;
}

const confirmButton = () =>
    screen.getByRole("button", { name: /^delete grid$/i });
const field = () =>
    screen.getByRole("textbox", { name: /type confirm deletion to continue/i });

describe("DeleteGridDialog", () => {
    it("explains what is deleted and starts with confirm disabled", () => {
        renderDialog();

        expect(
            screen.getByText(
                'Deleting the current grid would also delete all previously saved heatmaps and the trained model. Type "Confirm Deletion" into the field below to continue',
            ),
        ).toBeInTheDocument();
        expect(confirmButton()).toBeDisabled();
    });

    it("keeps confirm disabled when the text differs in case", async () => {
        renderDialog();

        await userEvent.type(field(), "confirm deletion");

        expect(confirmButton()).toBeDisabled();
    });

    it("enables confirm for the exact text, ignoring surrounding spaces", async () => {
        const onConfirm = renderDialog();

        await userEvent.type(field(), "  Confirm Deletion  ");
        expect(confirmButton()).toBeEnabled();

        await userEvent.click(confirmButton());
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("keeps confirm disabled while the delete is in progress", async () => {
        renderDialog(vi.fn(), true);

        await userEvent.type(field(), "Confirm Deletion");

        expect(confirmButton()).toBeDisabled();
    });

    it("clears the field when the dialog is closed and reopened", async () => {
        renderDialog();

        await userEvent.type(field(), "Confirm Deletion");
        // The dialog's corner close button is also named Cancel; use the footer one.
        const cancelButtons = screen.getAllByRole("button", {
            name: /cancel/i,
        });
        await userEvent.click(cancelButtons[cancelButtons.length - 1]);
        await userEvent.click(screen.getByRole("button", { name: /reopen/i }));

        expect(field()).toHaveValue("");
    });
});
