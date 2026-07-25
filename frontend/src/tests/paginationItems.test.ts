import { describe, it, expect } from "vitest";
import { getPaginationItems } from "@/lib/paginationItems";

describe("getPaginationItems", () => {
    it("matches page 4 of 7", () => {
        expect(getPaginationItems(4, 7)).toEqual([
            1,
            "ellipsis",
            3,
            4,
            5,
            "ellipsis",
            7,
        ]);
    });

    it("matches page 1 of 7", () => {
        expect(getPaginationItems(1, 7)).toEqual([1, 2, 3, "ellipsis", 7]);
    });

    it("matches page 7 of 7", () => {
        expect(getPaginationItems(7, 7)).toEqual([1, "ellipsis", 5, 6, 7]);
    });

    it("shows every page with no ellipsis when totalPages is small", () => {
        expect(getPaginationItems(2, 3)).toEqual([1, 2, 3]);
    });

    it("returns a single chip when totalPages is 1", () => {
        expect(getPaginationItems(1, 1)).toEqual([1]);
    });

    it("returns an empty array when totalPages is 0", () => {
        expect(getPaginationItems(1, 0)).toEqual([]);
    });
});
