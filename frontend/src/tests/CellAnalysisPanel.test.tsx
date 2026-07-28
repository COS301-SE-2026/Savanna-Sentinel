import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import { CellAnalysisPanel } from "@/components/map/CellAnalysisPanel";

const FACTORS = [{ label: "Randomly given", pct: 62 }];

describe("CellAnalysisPanel", () => {
    it("renders the risk score, cell label, and factor rows", () => {
        render(
            <CellAnalysisPanel
                level="critical"
                row={14}
                col={7}
                score={0.82}
                factors={FACTORS}
                isClosing={false}
                onClose={vi.fn()}
                onClosed={vi.fn()}
            />,
        );

        expect(screen.getByText("Cell 14, 7")).toBeInTheDocument();
        expect(screen.getByText("Risk score: 82%")).toBeInTheDocument();
        expect(screen.getByText("Critical Risk")).toBeInTheDocument();
        expect(screen.getByText("Randomly given")).toBeInTheDocument();
        expect(
            screen.getByRole("progressbar", {
                name: "Randomly given confidence",
            }),
        ).toHaveAttribute("aria-valuenow", "62");
    });

    it("shows placeholder model metadata rather than fabricated stats", () => {
        render(
            <CellAnalysisPanel
                level="safe"
                row={1}
                col={2}
                score={0.1}
                factors={FACTORS}
                isClosing={false}
                onClose={vi.fn()}
                onClosed={vi.fn()}
            />,
        );

        expect(screen.getAllByText("Not available yet")).toHaveLength(3);
    });

    it("calls onClose from both the header close button and the footer button", async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(
            <CellAnalysisPanel
                level="safe"
                row={1}
                col={2}
                score={0.1}
                factors={FACTORS}
                isClosing={false}
                onClose={onClose}
                onClosed={vi.fn()}
            />,
        );

        await user.click(
            screen.getByRole("button", { name: "Close analysis" }),
        );
        await user.click(
            screen.getByRole("button", { name: "Close Analysis" }),
        );
        expect(onClose).toHaveBeenCalledTimes(2);
    });

    it("calls onClosed after the close animation once isClosing is true", () => {
        vi.useFakeTimers();
        const onClosed = vi.fn();
        const { rerender } = render(
            <CellAnalysisPanel
                level="safe"
                row={1}
                col={2}
                score={0.1}
                factors={FACTORS}
                isClosing={false}
                onClose={vi.fn()}
                onClosed={onClosed}
            />,
        );

        rerender(
            <CellAnalysisPanel
                level="safe"
                row={1}
                col={2}
                score={0.1}
                factors={FACTORS}
                isClosing
                onClose={vi.fn()}
                onClosed={onClosed}
            />,
        );

        expect(onClosed).not.toHaveBeenCalled();
        vi.advanceTimersByTime(250);
        expect(onClosed).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
    });
});
