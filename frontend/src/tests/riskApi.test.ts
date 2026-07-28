import { setupServer } from "msw/node";
import { beforeAll, afterEach, afterAll, describe, it, expect } from "vitest";

import { riskApi } from "@/services/riskApi";
import { riskHandlers, TEST_GRID } from "./mocks/riskHandlers";

const server = setupServer(...riskHandlers);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("riskApi.getParkGrid", () => {
    it("returns the park grid feature collection", async () => {
        const result = await riskApi.getParkGrid();
        expect(result).toEqual(TEST_GRID);
    });

    it("returns 4 features with cell_id/row/col properties", async () => {
        const result = await riskApi.getParkGrid("klaserie");
        expect(result.features).toHaveLength(4);
        expect(result.features[0].properties).toEqual({
            cell_id: "cell-1",
            row: 0,
            col: 0,
        });
    });
});
