import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
    beforeAll,
    afterEach,
    afterAll,
    describe,
    it,
    expect,
    vi,
} from "vitest";

import { LoadPreviousRoutesDialog } from "@/components/patrol/LoadPreviousRoutesDialog";
import { savedRouteHandlers, SAVED_ROUTE } from "./mocks/savedRouteHandlers";

const server = setupServer(...savedRouteHandlers);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("LoadPreviousRoutesDialog", () => {
    it("fetches and lists saved routes when opened", async () => {
        render(
            <LoadPreviousRoutesDialog
                open
                onOpenChange={vi.fn()}
                onLoad={vi.fn()}
            />,
        );

        const routeButton = await screen.findByRole("button", {
            name: /55 min/i,
        });
        expect(routeButton).toBeInTheDocument();
        expect(routeButton).toHaveAccessibleName(/22 L/i);
        expect(routeButton).toHaveAccessibleName(/42% risk/i);
        expect(routeButton).toHaveAccessibleName(/start: -24.30000, 31.05000/i);
    });

    it("shows an empty state when there are no saved routes", async () => {
        server.use(
            http.get("http://localhost:8000/v1/routes/saved", () =>
                HttpResponse.json({
                    total: 0,
                    page: 1,
                    page_size: 20,
                    results: [],
                }),
            ),
        );

        render(
            <LoadPreviousRoutesDialog
                open
                onOpenChange={vi.fn()}
                onLoad={vi.fn()}
            />,
        );

        expect(
            await screen.findByText(/no saved routes yet/i),
        ).toBeInTheDocument();
    });

    it("calls onLoad and closes when a route is clicked", async () => {
        const onLoad = vi.fn();
        const onOpenChange = vi.fn();
        render(
            <LoadPreviousRoutesDialog
                open
                onOpenChange={onOpenChange}
                onLoad={onLoad}
            />,
        );

        const routeButton = await screen.findByRole("button", {
            name: /55 min/i,
        });
        await userEvent.click(routeButton);

        expect(onLoad).toHaveBeenCalledWith(SAVED_ROUTE);
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("shows an error message when the fetch fails", async () => {
        server.use(
            http.get("http://localhost:8000/v1/routes/saved", () =>
                HttpResponse.json({ detail: "boom" }, { status: 500 }),
            ),
        );

        render(
            <LoadPreviousRoutesDialog
                open
                onOpenChange={vi.fn()}
                onLoad={vi.fn()}
            />,
        );

        expect(
            await screen.findByText(/failed to load saved routes/i),
        ).toBeInTheDocument();
    });

    it("calls onLoad when Enter is pressed on a route row", async () => {
        const onLoad = vi.fn();
        render(
            <LoadPreviousRoutesDialog
                open
                onOpenChange={vi.fn()}
                onLoad={onLoad}
            />,
        );

        const routeButton = await screen.findByRole("button", {
            name: /55 min/i,
        });
        routeButton.focus();
        await userEvent.keyboard("{Enter}");

        expect(onLoad).toHaveBeenCalledWith(SAVED_ROUTE);
    });

    it("asks for confirmation before deleting; cancel dismisses, confirm deletes", async () => {
        render(
            <LoadPreviousRoutesDialog
                open
                onOpenChange={vi.fn()}
                onLoad={vi.fn()}
            />,
        );

        const deleteButton = await screen.findByRole("button", {
            name: /delete saved route/i,
        });
        await userEvent.click(deleteButton);
        expect(
            screen.getByRole("heading", { name: /delete saved route\?/i }),
        ).toBeInTheDocument();

        await userEvent.click(
            screen.getByRole("button", { name: /^cancel$/i }),
        );
        expect(
            screen.queryByRole("heading", { name: /delete saved route\?/i }),
        ).not.toBeInTheDocument();

        await userEvent.click(
            await screen.findByRole("button", {
                name: /delete saved route/i,
            }),
        );
        await userEvent.click(
            screen.getByRole("button", { name: /^delete$/i }),
        );

        expect(
            await screen.findByText(/no saved routes yet/i),
        ).toBeInTheDocument();
    });
});
