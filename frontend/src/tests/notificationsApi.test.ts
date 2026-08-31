import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { beforeAll, afterEach, afterAll, describe, it, expect } from "vitest";

import { notificationsApi } from "@/services/notificationsApi";

const BASE = "http://localhost:8000/v1";

const LIST_RESPONSE = {
    total: 2,
    unread_count: 1,
    page: 1,
    page_size: 20,
    results: [
        {
            id: "n1",
            type: "tipoff_submitted",
            title: "New incident tip-off",
            body: "liaison1 reported poaching near the river",
            read: false,
            related_type: "tipoff",
            related_id: "tip-1",
            created_at: "2026-01-01T00:00:00Z",
        },
        {
            id: "n2",
            type: "ingestion_complete",
            title: "CSV ingestion complete",
            body: "42 records were ingested.",
            read: true,
            related_type: null,
            related_id: null,
            created_at: "2026-01-01T01:00:00Z",
        },
    ],
};

const server = setupServer();
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("notificationsApi", () => {
    it("maps the list response into the store's notification shape", async () => {
        server.use(
            http.get(`${BASE}/notifications`, () =>
                HttpResponse.json(LIST_RESPONSE),
            ),
        );

        const result = await notificationsApi.list();

        expect(result.total).toBe(2);
        expect(result.unreadCount).toBe(1);
        expect(result.notifications).toEqual([
            {
                id: "n1",
                type: "tipoff_submitted",
                title: "New incident tip-off",
                body: "liaison1 reported poaching near the river",
                timestamp: "2026-01-01T00:00:00Z",
                read: false,
            },
            {
                id: "n2",
                type: "ingestion_complete",
                title: "CSV ingestion complete",
                body: "42 records were ingested.",
                timestamp: "2026-01-01T01:00:00Z",
                read: true,
            },
        ]);
    });

    it("passes pagination params through as query params", async () => {
        let url: URL | null = null;
        server.use(
            http.get(`${BASE}/notifications`, ({ request }) => {
                url = new URL(request.url);
                return HttpResponse.json(LIST_RESPONSE);
            }),
        );

        await notificationsApi.list({ page: 2, page_size: 10 });

        expect(url!.searchParams.get("page")).toBe("2");
        expect(url!.searchParams.get("page_size")).toBe("10");
    });

    it("marks a single notification as read", async () => {
        let hitUrl = "";
        server.use(
            http.post(`${BASE}/notifications/:id/read`, ({ params }) => {
                hitUrl = params.id as string;
                return new HttpResponse(null, { status: 204 });
            }),
        );

        await notificationsApi.markRead("n1");

        expect(hitUrl).toBe("n1");
    });

    it("marks all notifications as read", async () => {
        let called = false;
        server.use(
            http.post(`${BASE}/notifications/read-all`, () => {
                called = true;
                return new HttpResponse(null, { status: 204 });
            }),
        );

        await notificationsApi.markAllRead();

        expect(called).toBe(true);
    });
});
