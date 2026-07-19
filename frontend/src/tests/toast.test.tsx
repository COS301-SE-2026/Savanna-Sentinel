import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { custom, dismiss } = vi.hoisted(() => ({
    custom: vi.fn(),
    dismiss: vi.fn(),
}));

vi.mock("sonner", () => ({
    toast: { custom, dismiss },
}));

import {
    notifySafe,
    notifyCaution,
    notifyCritical,
} from "@/components/ui/toast";

function renderToast(
    notify: typeof notifySafe,
    title: string,
    description?: string,
) {
    notify(title, description);
    const renderFn = custom.mock.calls[custom.mock.calls.length - 1][0];
    return render(renderFn("toast-id-1"));
}

describe("toast", () => {
    beforeEach(() => {
        custom.mockClear();
        dismiss.mockClear();
    });

    it("renders a safe toast with role status", () => {
        renderToast(notifySafe, "Saved", "All good");

        expect(screen.getByRole("status")).toBeInTheDocument();
        expect(screen.getByText("Saved")).toBeInTheDocument();
        expect(screen.getByText("All good")).toBeInTheDocument();
    });

    it("renders a caution toast with role status", () => {
        renderToast(notifyCaution, "Careful");

        expect(screen.getByRole("status")).toBeInTheDocument();
        expect(screen.getByText("Careful")).toBeInTheDocument();
    });

    it("renders a critical toast with role alert", () => {
        renderToast(notifyCritical, "Failed", "Something broke");

        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(screen.getByText("Failed")).toBeInTheDocument();
        expect(screen.getByText("Something broke")).toBeInTheDocument();
    });

    it("dismisses the toast when the close button is clicked", async () => {
        const user = userEvent.setup();
        renderToast(notifySafe, "Saved");

        await user.click(screen.getByRole("button", { name: /dismiss/i }));

        expect(dismiss).toHaveBeenCalledWith("toast-id-1");
    });
});
