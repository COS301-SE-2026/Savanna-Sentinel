import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRoleOptions } from "@/hooks/useUserSearchFilter";

describe("useRoleOptions", () => {
    it("does not include admin as a selectable role filter option", () => {
        const { result } = renderHook(() => useRoleOptions());

        expect(result.current.some((option) => option.value === "admin")).toBe(
            false,
        );
    });

    it("exposes the assignable, non-admin roles", () => {
        const { result } = renderHook(() => useRoleOptions());

        expect(result.current.map((option) => option.value)).toEqual([
            "analyst",
            "ranger",
            "community liaison",
        ]);
    });
});
