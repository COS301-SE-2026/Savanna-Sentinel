import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { beforeAll, afterEach, afterAll, describe, it, expect } from "vitest";

import { mediaApi } from "@/services/mediaApi";
import {
    mediaHandlers,
    TEST_UPLOAD_RESPONSE,
    UPLOAD_URL,
    BASE,
} from "./mocks/mediaHandlers";

const server = setupServer(...mediaHandlers);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function makeFile(name = "photo.jpg", type = "image/jpeg"): File {
    return new File(["dummy content"], name, { type });
}

describe("mediaApi.requestUploadUrl", () => {
    it("returns the presigned upload url response", async () => {
        const result = await mediaApi.requestUploadUrl({
            file_name: "photo.jpg",
            content_type: "image/jpeg",
        });
        expect(result).toEqual(TEST_UPLOAD_RESPONSE);
    });

    it("sends the file name and content type in the request body", async () => {
        let capturedBody: unknown;
        server.use(
            http.post(`${BASE}/media/upload-url`, async ({ request }) => {
                capturedBody = await request.json();
                return HttpResponse.json(TEST_UPLOAD_RESPONSE);
            }),
        );

        await mediaApi.requestUploadUrl({
            file_name: "sighting.png",
            content_type: "image/png",
        });

        expect(capturedBody).toEqual({
            file_name: "sighting.png",
            content_type: "image/png",
        });
    });
});

describe("mediaApi.putFile", () => {
    it("PUTs the file to the presigned url", async () => {
        const file = makeFile();
        await expect(
            mediaApi.putFile(UPLOAD_URL, file),
        ).resolves.toBeUndefined();
    });

    it("sends the file's own content type as the Content-Type header", async () => {
        let capturedContentType: string | null = null;
        server.use(
            http.put(UPLOAD_URL, ({ request }) => {
                capturedContentType = request.headers.get("Content-Type");
                return new HttpResponse(null, { status: 200 });
            }),
        );

        const file = makeFile("sighting.png", "image/png");
        await mediaApi.putFile(UPLOAD_URL, file);

        expect(capturedContentType).toBe("image/png");
    });
});

describe("mediaApi.uploadPhoto", () => {
    it("requests a presigned url, uploads the file, and returns the object url", async () => {
        const file = makeFile();
        const objectUrl = await mediaApi.uploadPhoto(file);
        expect(objectUrl).toBe(TEST_UPLOAD_RESPONSE.object_url);
    });

    it("derives the upload-url request from the given file's name and type", async () => {
        let capturedBody: unknown;
        server.use(
            http.post(`${BASE}/media/upload-url`, async ({ request }) => {
                capturedBody = await request.json();
                return HttpResponse.json(TEST_UPLOAD_RESPONSE);
            }),
        );

        const file = makeFile("incident.jpg", "image/jpeg");
        await mediaApi.uploadPhoto(file);

        expect(capturedBody).toEqual({
            file_name: "incident.jpg",
            content_type: "image/jpeg",
        });
    });
});
