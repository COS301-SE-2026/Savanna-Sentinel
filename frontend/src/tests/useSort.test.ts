import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSort } from "@/hooks/useSort";

interface Item {
    name: string;
    age: number;
}

const items: Item[] = [
    { name: "Charlie", age: 25 },
    { name: "Alice", age: 40 },
    { name: "Bob", age: 40 },
];

const accessors = {
    name: (item: Item) => item.name,
    age: (item: Item) => item.age,
};

describe("useSort", () => {
    it("returns items unsorted when no sort key is set", () => {
        const { result } = renderHook(() => useSort(items, accessors));

        expect(result.current.sorted).toEqual(items);
        expect(result.current.sortKey).toBeNull();
        expect(result.current.direction).toBe("asc");
    });

    it("honors an initial sort key and direction", () => {
        const { result } = renderHook(() =>
            useSort(items, accessors, { key: "age", direction: "desc" }),
        );

        expect(result.current.sortKey).toBe("age");
        expect(result.current.direction).toBe("desc");
        expect(result.current.sorted.map((i) => i.name)).toEqual([
            "Alice",
            "Bob",
            "Charlie",
        ]);
    });

    it("sorts ascending on the first request for a key", () => {
        const { result } = renderHook(() => useSort(items, accessors));

        act(() => result.current.requestSort("name"));

        expect(result.current.sortKey).toBe("name");
        expect(result.current.direction).toBe("asc");
        expect(result.current.sorted.map((i) => i.name)).toEqual([
            "Alice",
            "Bob",
            "Charlie",
        ]);
    });

    it("toggles direction when the same key is requested again", () => {
        const { result } = renderHook(() => useSort(items, accessors));

        act(() => result.current.requestSort("name"));
        act(() => result.current.requestSort("name"));

        expect(result.current.direction).toBe("desc");
        expect(result.current.sorted.map((i) => i.name)).toEqual([
            "Charlie",
            "Bob",
            "Alice",
        ]);

        act(() => result.current.requestSort("name"));
        expect(result.current.direction).toBe("asc");
    });

    it("resets direction to asc when switching to a different key", () => {
        const { result } = renderHook(() => useSort(items, accessors));

        act(() => result.current.requestSort("name"));
        act(() => result.current.requestSort("name"));
        expect(result.current.direction).toBe("desc");

        act(() => result.current.requestSort("age"));

        expect(result.current.sortKey).toBe("age");
        expect(result.current.direction).toBe("asc");
    });

    it("preserves relative order for equal values (stable sort)", () => {
        const { result } = renderHook(() => useSort(items, accessors));

        act(() => result.current.requestSort("age"));

        const ages = result.current.sorted.map((i) => i.name);
        expect(ages.indexOf("Alice")).toBeLessThan(ages.indexOf("Bob"));
    });
});
