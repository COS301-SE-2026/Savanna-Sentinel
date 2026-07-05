import { http, HttpResponse } from "msw";

const BASE = "http://localhost:8000/v1";

export const registerHandlers = [
    http.post(`${BASE}/auth/register`, async ({ request }) => {
        const body = (await request.json()) as {
            username: string;
            email: string;
            password: string;
            first_name: string;
            last_name: string;
            requested_role: string;
        };

        if (body.username === "taken" || body.email === "taken@example.com") {
            return HttpResponse.json({ detail: "Conflict" }, { status: 409 });
        }

        if (body.username === "servererr") {
            return HttpResponse.json(
                { detail: "Internal Server Error" },
                { status: 500 },
            );
        }

        //delay
        await new Promise((resolve) => setTimeout(resolve, 300));

        return HttpResponse.json(
            {
                id: "abc-123",
                username: body.username,
                email: body.email,
                role: body.requested_role,
                is_active: false,
                created_at: new Date().toISOString(),
            },
            { status: 201 },
        );
    }),
];
