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
import { loadPinnedRoute, pinRouteToHeatmap } from "@/offline/pinnedRouteCache";
import { db } from "@/offline/db";
import { useAuthStore } from "@/store/authStore";

const server = setupServer(...savedRouteHandlers);
beforeAll(() => server.listen());
afterEach(async () => {
    server.resetHandlers();
    await db.cache.clear();
    useAuthStore.setState({
        user: null,
        accessToken: null,
        refreshToken: null,
    });
});
afterAll(() => server.close());

function renderDialog() {
    const props = {
        open: true,
        onOpenChange: vi.fn(),
        onLoad: vi.fn(),
        onSendToHeatmap: vi.fn(),
    };
    render(<LoadPreviousRoutesDialog {...props} />);
    return props;
}

describe("LoadPreviousRoutesDialog", () => {
    it("fetches and lists saved routes when opened", async () => {
        renderDialog();

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

        renderDialog();

        expect(
            await screen.findByText(/no saved routes yet/i),
        ).toBeInTheDocument();
    });

    it("calls onLoad and closes when a route is clicked", async () => {
        const { onLoad, onOpenChange } = renderDialog();

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

        renderDialog();

        expect(
            await screen.findByText(/failed to load saved routes/i),
        ).toBeInTheDocument();
    });

    it("calls onLoad when Enter is pressed on a route row", async () => {
        const { onLoad } = renderDialog();

        const routeButton = await screen.findByRole("button", {
            name: /55 min/i,
        });
        routeButton.focus();
        await userEvent.keyboard("{Enter}");

        expect(onLoad).toHaveBeenCalledWith(SAVED_ROUTE);
    });

    it("sends a route to the heatmap without also loading it into the planner", async () => {
        const { onSendToHeatmap, onLoad } = renderDialog();

        await userEvent.click(
            await screen.findByRole("button", {
                name: /show saved route on heatmap/i,
            }),
        );

        expect(onSendToHeatmap).toHaveBeenCalledWith(SAVED_ROUTE);
        expect(onLoad).not.toHaveBeenCalled();
    });

    it("asks for confirmation before deleting; cancel dismisses, confirm deletes", async () => {
        renderDialog();

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

    it("stops showing a route on the heatmap once it is deleted", async () => {
        useAuthStore.setState({
            user: { id: "u1", username: "tester", role: "ranger" },
            accessToken: "token",
            refreshToken: "refresh",
        });
        await pinRouteToHeatmap("u1", SAVED_ROUTE);
        renderDialog();

        await userEvent.click(
            await screen.findByRole("button", {
                name: /delete saved route/i,
            }),
        );
        await userEvent.click(
            screen.getByRole("button", { name: /^delete$/i }),
        );

        await screen.findByText(/no saved routes yet/i);
        expect(await loadPinnedRoute("u1")).toBeNull();
    });
});
