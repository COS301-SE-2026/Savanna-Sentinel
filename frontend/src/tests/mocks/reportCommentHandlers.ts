import { http, HttpResponse } from "msw";

export const reportCommentHandlers = [
    http.get("*/reports/:reportId/comment", () => {
        return HttpResponse.json([
            {
                id: "c1",
                report_id: "report-1",
                author_id: "u1",
                author_username: "ranger1",
                author_role: "ranger",
                body: "Test comment",
                photo_urls: [],
                status_change: "none",
                created_at: "2026-08-20T08:00:00.000Z",
            },
        ]);
    }),

    http.post("*/reports/:reportId/comment", async ({ request }) => {
        const body = (await request.json()) as {
            body: string;
            photoUrls?: string[];
            createdAt: string;
        };

        return HttpResponse.json(
            {
                id: "c2",
                report_id: "report-1",
                author_id: "u1",
                author_username: "ranger1",
                author_role: "ranger",
                body: body.body,
                photo_urls: body.photoUrls ?? [],
                created_at: body.createdAt,
            },
            { status: 201 },
        );
    }),

    http.post("*/reports/:reportId/status/update", () => {
        return HttpResponse.json({ status: "success" });
    }),
];
