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
import KlaserieWorkspace from "@/components/admin/KlaserieWorkspace";
import { notifySafe, notifyCritical } from "@/components/ui/toast";

vi.mock("@/components/ui/toast", () => ({
    notifySafe: vi.fn(),
    notifyCritical: vi.fn(),
}));

let insertCalls = 0;
const server = setupServer(
    http.post("**/v1/demo/workspace/klaserie", () => {
        insertCalls += 1;
        return new HttpResponse(null, { status: 204 });
    }),
);

beforeAll(() => server.listen());
beforeEach(() => {
    insertCalls = 0;
});
afterEach(() => {
    server.resetHandlers();
    vi.mocked(notifySafe).mockClear();
    vi.mocked(notifyCritical).mockClear();
});
afterAll(() => server.close());

async function openConfirmDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(
        screen.getByRole("button", { name: /insert klaserie workspace/i }),
    );
    return screen.findByRole("dialog");
}

describe("KlaserieWorkspace", () => {
    it("does nothing when the confirmation is cancelled", async () => {
        const user = userEvent.setup();
        render(<KlaserieWorkspace />);

        const dialog = await openConfirmDialog(user);
        await user.click(
            within(dialog).getByRole("button", { name: "Cancel" }),
        );

        await waitFor(() =>
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
        );
        expect(insertCalls).toBe(0);
    });

    it("inserts the workspace after confirming", async () => {
        const user = userEvent.setup();
        render(<KlaserieWorkspace />);

        const dialog = await openConfirmDialog(user);
        await user.click(
            within(dialog).getByRole("button", { name: /^replace$/i }),
        );

        await waitFor(() => expect(notifySafe).toHaveBeenCalledOnce());
        expect(insertCalls).toBe(1);
        expect(
            screen.getByRole("button", { name: /insert klaserie workspace/i }),
        ).toBeEnabled();
    });

    it("shows an error when the insert fails", async () => {
        server.use(
            http.post("**/v1/demo/workspace/klaserie", () =>
                HttpResponse.json({ detail: "boom" }, { status: 500 }),
            ),
        );
        const user = userEvent.setup();
        render(<KlaserieWorkspace />);

        const dialog = await openConfirmDialog(user);
        await user.click(
            within(dialog).getByRole("button", { name: /^replace$/i }),
        );

        await waitFor(() => expect(notifyCritical).toHaveBeenCalledOnce());
        expect(notifySafe).not.toHaveBeenCalled();
        expect(
            screen.getByRole("button", { name: /insert klaserie workspace/i }),
        ).toBeEnabled();
    });
});
