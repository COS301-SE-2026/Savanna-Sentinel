import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
    describe,
    beforeAll,
    afterAll,
    afterEach,
    beforeEach,
    it,
    expect,
    vi,
} from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DemoReset from "@/components/admin/DemoReset";
import { notifyCritical } from "@/components/ui/toast";
import { db } from "@/offline/db";

vi.mock("@/components/ui/toast", () => ({
    notifySafe: vi.fn(),
    notifyCritical: vi.fn(),
}));

let resetCalls = 0;
const server = setupServer(
    http.post("**/v1/demo/reset", () => {
        resetCalls += 1;
        return new HttpResponse(null, { status: 204 });
    }),
);

const reload = vi.fn();
const originalLocation = window.location;

beforeAll(() => server.listen());
beforeEach(() => {
    resetCalls = 0;
    Object.defineProperty(window, "location", {
        configurable: true,
        value: { ...originalLocation, reload },
    });
});
afterEach(() => {
    server.resetHandlers();
    reload.mockClear();
    vi.mocked(notifyCritical).mockClear();
    Object.defineProperty(window, "location", {
        configurable: true,
        value: originalLocation,
    });
});
afterAll(() => server.close());

async function openConfirmDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: /reset demo data/i }));
    return screen.findByRole("dialog");
}

describe("DemoReset", () => {
    it("renders the reset button", () => {
        render(<DemoReset />);

        expect(
            screen.getByRole("button", { name: /reset demo data/i }),
        ).toBeInTheDocument();
    });

    it("does nothing when the confirmation is cancelled", async () => {
        const user = userEvent.setup();
        render(<DemoReset />);

        const dialog = await openConfirmDialog(user);
        await user.click(
            within(dialog).getByRole("button", { name: "Cancel" }),
        );

        await waitFor(() =>
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
        );
        expect(resetCalls).toBe(0);
        expect(reload).not.toHaveBeenCalled();
    });

    it("resets, clears offline data and reloads after confirming", async () => {
        const user = userEvent.setup();
        await db.cache.put({
            key: "workspace",
            userId: "admin-1",
            payload: {},
            fetchedAt: Date.now(),
        });
        render(<DemoReset />);

        const dialog = await openConfirmDialog(user);
        await user.click(
            within(dialog).getByRole("button", { name: /^reset$/i }),
        );

        await waitFor(() => expect(reload).toHaveBeenCalledOnce());
        expect(resetCalls).toBe(1);
        expect(await db.cache.count()).toBe(0);
    });

    it("shows an error and stays on the page when the reset fails", async () => {
        server.use(
            http.post("**/v1/demo/reset", () =>
                HttpResponse.json({ detail: "boom" }, { status: 500 }),
            ),
        );
        const user = userEvent.setup();
        render(<DemoReset />);

        const dialog = await openConfirmDialog(user);
        await user.click(
            within(dialog).getByRole("button", { name: /^reset$/i }),
        );

        await waitFor(() => expect(notifyCritical).toHaveBeenCalledOnce());
        expect(reload).not.toHaveBeenCalled();
        expect(
            screen.getByRole("button", { name: /reset demo data/i }),
        ).toBeEnabled();
    });
});
