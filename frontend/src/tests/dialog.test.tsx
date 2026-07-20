import * as React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
    Dialog,
    DialogTrigger,
    DialogClose,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

describe("Dialog", () => {
    it("opens via DialogTrigger and closes via DialogClose", async () => {
        const user = userEvent.setup();
        render(
            <Dialog>
                <DialogTrigger>Open</DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Title</DialogTitle>
                    </DialogHeader>
                    <DialogDescription>Body</DialogDescription>
                    <DialogClose>Close</DialogClose>
                </DialogContent>
            </Dialog>,
        );

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Open" }));
        expect(screen.getByRole("dialog")).toBeInTheDocument();

        await user.click(screen.getAllByRole("button", { name: "Close" })[0]);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("does not close when clicking outside if preventBackdropClose is set", async () => {
        render(
            <Dialog open>
                <DialogContent preventBackdropClose>
                    <DialogHeader>
                        <DialogTitle>Title</DialogTitle>
                    </DialogHeader>
                    <DialogDescription>Body</DialogDescription>
                </DialogContent>
            </Dialog>,
        );

        expect(await screen.findByRole("dialog")).toBeInTheDocument();

        fireEvent.pointerDown(document.body);
        fireEvent.click(document.body);

        expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("closes when clicking outside if preventBackdropClose is not set", async () => {
        function Harness() {
            const [isOpen, setIsOpen] = React.useState(true);
            return (
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Title</DialogTitle>
                        </DialogHeader>
                        <DialogDescription>Body</DialogDescription>
                    </DialogContent>
                </Dialog>
            );
        }
        render(<Harness />);

        expect(await screen.findByRole("dialog")).toBeInTheDocument();

        fireEvent.pointerDown(document.body);
        fireEvent.click(document.body);

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
});
