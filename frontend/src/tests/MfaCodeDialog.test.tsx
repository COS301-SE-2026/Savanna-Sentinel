import * as React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MfaCodeDialog } from "@/components/auth/MfaCodeDialog";

function Harness({
    onSubmit,
    onResend = vi.fn(),
    isSubmitting = false,
}: {
    onSubmit: (code: string) => void;
    onResend?: () => void;
    isSubmitting?: boolean;
}) {
    const [isOpen, setIsOpen] = React.useState(true);
    return (
        <MfaCodeDialog
            open={isOpen}
            onOpenChange={setIsOpen}
            onSubmit={onSubmit}
            onResend={onResend}
            isSubmitting={isSubmitting}
        />
    );
}

afterEach(() => {
    vi.useRealTimers();
});

describe("MfaCodeDialog", () => {
    it("renders the heading, description, six digit boxes, and a Verify button", () => {
        render(<Harness onSubmit={() => {}} />);

        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(
            screen.getByRole("heading", { name: /mfa code/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByText(/enter the code sent to your email/i),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /verify/i }),
        ).toBeInTheDocument();

        const group = screen.getByRole("group", {
            name: /enter the code sent to your email/i,
        });
        expect(within(group).getAllByRole("textbox")).toHaveLength(6);
    });

    it("calls onSubmit with the combined code when Verify is clicked", async () => {
        const onSubmit = vi.fn();
        render(<Harness onSubmit={onSubmit} />);

        const boxes = screen.getAllByRole("textbox");
        await userEvent.type(boxes[0], "123456");
        expect(onSubmit).not.toHaveBeenCalled();

        await userEvent.click(screen.getByRole("button", { name: /verify/i }));
        expect(onSubmit).toHaveBeenCalledWith("123456");
    });

    it("moves focus to the previous box on backspace from an empty box", async () => {
        render(<Harness onSubmit={() => {}} />);

        const boxes = screen.getAllByRole("textbox");
        await userEvent.type(boxes[0], "12");
        expect(boxes[2]).toHaveFocus();

        await userEvent.keyboard("{Backspace}");
        expect(boxes[1]).toHaveFocus();
    });

    it("distributes a pasted 6-digit code across all boxes", async () => {
        render(<Harness onSubmit={() => {}} />);

        const boxes = screen.getAllByRole("textbox");
        boxes[0].focus();
        await userEvent.paste("654321");

        const digits = "654321".split("");
        boxes.forEach((box, i) => {
            expect(box).toHaveValue(digits[i]);
        });
    });

    it("disables the Verify button and boxes, and shows loading text, while submitting", () => {
        render(<Harness onSubmit={() => {}} isSubmitting />);

        expect(
            screen.getByRole("button", { name: /verifying/i }),
        ).toBeDisabled();
        screen.getAllByRole("textbox").forEach((box) => {
            expect(box).toBeDisabled();
        });
    });

    it("closes when Cancel is clicked", async () => {
        render(<Harness onSubmit={() => {}} />);

        await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("starts with fresh, empty boxes for each new challenge", async () => {
        function ChallengeHarness() {
            const [isOpen, setIsOpen] = React.useState(true);
            const [challengeId, setChallengeId] = React.useState(1);
            return (
                <>
                    <button
                        onClick={() => {
                            setChallengeId((n) => n + 1);
                            setIsOpen(true);
                        }}
                    >
                        new challenge
                    </button>
                    <MfaCodeDialog
                        key={challengeId}
                        open={isOpen}
                        onOpenChange={setIsOpen}
                        onSubmit={() => setIsOpen(false)}
                        onResend={() => {}}
                    />
                </>
            );
        }
        render(<ChallengeHarness />);

        const boxes = screen.getAllByRole("textbox");
        await userEvent.type(boxes[0], "123456");
        await userEvent.click(screen.getByRole("button", { name: /verify/i }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

        await userEvent.click(screen.getByText("new challenge"));
        const freshBoxes = await screen.findAllByRole("textbox");
        freshBoxes.forEach((box) => expect(box).toHaveValue(""));
    });

    describe("resend", () => {
        it("starts disabled with a 30s countdown", () => {
            render(<Harness onSubmit={() => {}} />);

            expect(
                screen.getByRole("button", { name: /resend code \(30s\)/i }),
            ).toBeDisabled();
        });

        it("becomes enabled once the cooldown elapses and calls onResend when clicked", async () => {
            vi.useFakeTimers();
            const onResend = vi.fn();
            render(<Harness onSubmit={() => {}} onResend={onResend} />);

            act(() => {
                vi.advanceTimersByTime(30000);
            });
            vi.useRealTimers();

            const resendButton = screen.getByRole("button", {
                name: "Resend code",
            });
            await userEvent.click(resendButton);

            expect(onResend).toHaveBeenCalledTimes(1);
            expect(
                screen.getByRole("button", { name: /resend code \(30s\)/i }),
            ).toBeDisabled();
        });
    });
});
