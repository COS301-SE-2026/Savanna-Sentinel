import { describe, it, expect } from "vitest";

import { getCellFactors } from "@/lib/cellFactors";

describe("getCellFactors", () => {
    it("returns a single 'Randomly given' reason", () => {
        const factors = getCellFactors("cell-1");
        expect(factors).toHaveLength(1);
        expect(factors[0].label).toBe("Randomly given");
    });

    it("is deterministic for the same cell id", () => {
        expect(getCellFactors("cell-42")).toEqual(getCellFactors("cell-42"));
    });

    it("keeps the percentage within the 45-89 range", () => {
        const pct = getCellFactors("cell-7")[0].pct;
        expect(pct).toBeGreaterThanOrEqual(45);
        expect(pct).toBeLessThan(90);
    });
});
