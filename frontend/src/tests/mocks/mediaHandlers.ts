import { http, HttpResponse } from "msw";

import type { UploadUrlResponse } from "@/services/mediaApi";

export const BASE = "http://localhost:8000/v1";
export const UPLOAD_URL =
    "https://media.example.com/bucket/reports/test-key.jpg";

export const TEST_UPLOAD_RESPONSE: UploadUrlResponse = {
    upload_url: UPLOAD_URL,
    object_url: "https://media.example.com/bucket/reports/test-key.jpg",
    expires_in: 300,
};

export const mediaHandlers = [
    http.post(`${BASE}/media/upload-url`, () =>
        HttpResponse.json(TEST_UPLOAD_RESPONSE),
    ),
    http.put(UPLOAD_URL, () => new HttpResponse(null, { status: 200 })),
];
