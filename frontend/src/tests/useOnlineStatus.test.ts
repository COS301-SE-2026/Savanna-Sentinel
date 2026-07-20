import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";

import { useOnlineStatus } from "@/hooks/useOnlineStatus";

function setNavigatorOnline(value: boolean) {
    Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value,
    });
}

describe("useOnlineStatus", () => {
    afterEach(() => {
        setNavigatorOnline(true);
    });

    it("returns true initially when navigator.onLine is true", () => {
        setNavigatorOnline(true);
        const { result } = renderHook(() => useOnlineStatus());
        expect(result.current).toBe(true);
    });

    it("returns false initially when navigator.onLine is false", () => {
        setNavigatorOnline(false);
        const { result } = renderHook(() => useOnlineStatus());
        expect(result.current).toBe(false);
    });

    it("switches to false when the offline event fires", () => {
        setNavigatorOnline(true);
        const { result } = renderHook(() => useOnlineStatus());
        act(() => {
            window.dispatchEvent(new Event("offline"));
        });
        expect(result.current).toBe(false);
    });

    it("switches to true when the online event fires", () => {
        setNavigatorOnline(false);
        const { result } = renderHook(() => useOnlineStatus());
        act(() => {
            window.dispatchEvent(new Event("online"));
        });
        expect(result.current).toBe(true);
    });
});
