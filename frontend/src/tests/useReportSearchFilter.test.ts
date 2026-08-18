import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { getSpeciesOptions } from "@/hooks/useReportSearchFilter";
import { setupServer } from "msw/node";
import { handlers } from "./mocks/speciesMock";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("getSpeciesOptions", () => {
    it("returns the distinct, non-empty species values sorted alphabetically", async () => {
        server.use(...handlers);

        const result = await getSpeciesOptions();
        expect(result).toEqual(["Buffalo", "Elephant", "Rhino"]);
    });
});
