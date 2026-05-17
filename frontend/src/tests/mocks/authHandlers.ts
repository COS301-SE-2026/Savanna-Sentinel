import { http, HttpResponse } from "msw";

const BASE = "http://localhost:8000/v1";

export const authHandlers = [
  http.post(`${BASE}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as {
      username: string;
      password: string;
    };

    const isValid = body.username === "ranger" && body.password === "SecurePass1!";

    // Add delay to allow tests to check loading state
    await new Promise(resolve => setTimeout(resolve, 300));

    if(isValid)
    {
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

    return HttpResponse.json({ detail: "Invalid credentials" }, { status: 401 });
  }),
];