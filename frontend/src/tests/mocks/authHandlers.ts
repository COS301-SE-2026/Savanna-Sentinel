import { http, HttpResponse } from "msw";

const BASE = "http://localhost:8000/v1";

export const VALID_MFA_TOKEN = "fake-mfa-token";
export const VALID_MFA_CODE = "123456";

export const authHandlers = [
    http.post(`${BASE}/auth/login`, async ({ request }) => {
        const body = (await request.json()) as {
            username: string;
            password: string;
        };

        // Add delay to allow tests to check loading state
        await new Promise((resolve) => setTimeout(resolve, 300));

        if (body.username === "ranger" && body.password === "SecurePass1!") {
            /*
             * JWT NOTE: Real backend returns signed JWTs here.
             * Fake strings used so tests run without a live backend.
             */
            return HttpResponse.json({
                access_token: "fake-access-token",
                refresh_token: "fake-refresh-token",
                token_type: "bearer",
                expires_in: 3600,
                user: { id: "user-001", username: "ranger", role: "ranger" },
            });
        }

        if (body.username === "admin" && body.password === "SecurePass1!") {
            return HttpResponse.json({
                mfa_required: true,
                mfa_token: VALID_MFA_TOKEN,
                expires_in: 300,
            });
        }

        return HttpResponse.json(
            { detail: "Invalid credentials" },
            { status: 401 },
        );
    }),

    http.post(`${BASE}/auth/mfa/verify`, async ({ request }) => {
        const body = (await request.json()) as {
            mfa_token: string;
            code: string;
        };

        if (
            body.mfa_token === VALID_MFA_TOKEN &&
            body.code === VALID_MFA_CODE
        ) {
            return HttpResponse.json({
                access_token: "fake-admin-access-token",
                refresh_token: "fake-admin-refresh-token",
                token_type: "bearer",
                expires_in: 3600,
                user: { id: "user-003", username: "admin", role: "admin" },
            });
        }

        return HttpResponse.json(
            { detail: "Invalid credentials" },
            { status: 401 },
        );
    }),
];
