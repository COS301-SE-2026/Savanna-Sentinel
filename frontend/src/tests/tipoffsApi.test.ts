import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { beforeAll, afterEach, afterAll, describe, it, expect } from "vitest";

import { tipoffsApi } from "@/services/tipoffsApi";
import type { TipoffListResponse } from "@/services/tipoffsApi";

const BASE = "http://localhost:8000/v1";

const SUBMIT_RESPONSE = {
    tipoff_id: "tip-1",
    report_type: "incident",
    status: "submitted",
    submitted_by: "u1",
    created_at: "2026-01-01T00:00:00Z",
};

const LIST_RESPONSE: TipoffListResponse = {
    total: 1,
    page: 1,
    page_size: 20,
    results: [
        {
            tipoff_id: "tip-1",
            report_type: "incident",
            location: { lat: -24.205, lon: 31.185 },
            occurred_at: "2026-01-01T00:00:00Z",
            description: "Suspicious tracks near the fence",
            incident_type: "Suspicious Tracks",
            severity: "medium",
            species: null,
            count: null,
            images: [],
            submitted_by: "u1",
            created_at: "2026-01-01T00:00:00Z",
        },
    ],
};

const server = setupServer();
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("tipoffsApi", () => {
    it("posts a tip-off and returns the created record", async () => {
        let body: unknown = null;
        server.use(
            http.post(`${BASE}/tipoffs`, async ({ request }) => {
                body = await request.json();
                return HttpResponse.json(SUBMIT_RESPONSE, { status: 201 });
            }),
        );

        const result = await tipoffsApi.submitTipoff({
            report_type: "incident",
            location: { lat: -24.205, lon: 31.185 },
            occurred_at: "2026-01-01T00:00:00Z",
            description: "Suspicious tracks near the fence",
        });

        expect(result).toEqual(SUBMIT_RESPONSE);
        expect(body).toMatchObject({ report_type: "incident" });
    });

    it("passes list filters through as query params", async () => {
        let url: URL | null = null;
        server.use(
            http.get(`${BASE}/tipoffs`, ({ request }) => {
                url = new URL(request.url);
                return HttpResponse.json(LIST_RESPONSE);
            }),
        );

        const result = await tipoffsApi.listTipoffs({
            report_type: "incident",
            page: 2,
            page_size: 5,
        });

        expect(result).toEqual(LIST_RESPONSE);
        expect(url!.searchParams.get("report_type")).toBe("incident");
        expect(url!.searchParams.get("page")).toBe("2");
        expect(url!.searchParams.get("page_size")).toBe("5");
    });

    it("requests the unfiltered list when no params are given", async () => {
        let url: URL | null = null;
        server.use(
            http.get(`${BASE}/tipoffs`, ({ request }) => {
                url = new URL(request.url);
                return HttpResponse.json(LIST_RESPONSE);
            }),
        );

        await tipoffsApi.listTipoffs();

        expect(url!.search).toBe("");
    });
});
