import { act, render, waitFor } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";

const mapRegistry = vi.hoisted(() => ({ instances: [] as unknown[] }));

vi.mock("maplibre-gl", async () => {
    const maplibre = await import("./mocks/maplibreMock");
    class CapturingMap extends maplibre.FakeMap {
        constructor(options: Record<string, unknown>) {
            super(options);
            mapRegistry.instances.push(this);
        }
    }
    const mod = { ...maplibre.createMapLibreMock(), Map: CapturingMap };
    return { ...mod, default: mod };
});

import { LocationPickerMap } from "@/components/map/LocationPickerMap";
import type { FakeMap, FakeMarker } from "./mocks/maplibreMock";
import type { LatLon } from "@/types/patrol";

const CENTER: [number, number] = [31.18, -24.2];

afterEach(() => {
    mapRegistry.instances.length = 0;
});

function renderPicker(value: LatLon | null, onChange = vi.fn()) {
    const result = render(
        <LocationPickerMap
            value={value}
            onChange={onChange}
            center={CENTER}
            zoom={10}
        />,
    );
    return { ...result, onChange };
}

async function readyMap() {
    await waitFor(() =>
        expect(mapRegistry.instances.length).toBeGreaterThan(0),
    );
    const map = mapRegistry.instances[0] as FakeMap;
    // MapView only hands the map up on "load", which the fake fires async.
    await waitFor(() => expect(map.markers).toBeDefined());
    return map;
}

describe("LocationPickerMap", () => {
    it("reports the clicked coordinates", async () => {
        const { onChange } = renderPicker(null);
        const map = await readyMap();

        await act(async () => {
            map.fireClick({ lng: 31.05, lat: -24.3 });
        });

        expect(onChange).toHaveBeenCalledWith({ lat: -24.3, lon: 31.05 });
    });

    it("drops a marker once a value is set", async () => {
        const { rerender } = renderPicker(null);
        const map = await readyMap();
        expect(map.markers.size).toBe(0);

        rerender(
            <LocationPickerMap
                value={{ lat: -24.3, lon: 31.05 }}
                onChange={vi.fn()}
                center={CENTER}
                zoom={10}
            />,
        );

        await waitFor(() => expect(map.markers.size).toBe(1));
        const marker = [...map.markers][0] as unknown as FakeMarker;
        expect(marker.getLngLat()).toEqual({ lng: 31.05, lat: -24.3 });
    });

    it("moves the existing marker instead of adding another", async () => {
        const onChange = vi.fn();
        const { rerender } = renderPicker({ lat: -24.3, lon: 31.05 }, onChange);
        const map = await readyMap();
        await waitFor(() => expect(map.markers.size).toBe(1));
        const first = [...map.markers][0] as unknown as FakeMarker;

        rerender(
            <LocationPickerMap
                value={{ lat: -24.4, lon: 31.09 }}
                onChange={onChange}
                center={CENTER}
                zoom={10}
            />,
        );

        await waitFor(() =>
            expect(first.getLngLat()).toEqual({ lng: 31.09, lat: -24.4 }),
        );
        expect(map.markers.size).toBe(1);
    });

    it("reports the new position after the marker is dragged", async () => {
        const { onChange } = renderPicker({ lat: -24.3, lon: 31.05 });
        const map = await readyMap();
        await waitFor(() => expect(map.markers.size).toBe(1));
        const marker = [...map.markers][0] as unknown as FakeMarker;

        marker.setLngLat([31.2, -24.5]);
        await act(async () => {
            marker.fire("dragend");
        });

        expect(onChange).toHaveBeenCalledWith({ lat: -24.5, lon: 31.2 });
    });

    it("removes the marker when the value is cleared", async () => {
        const { rerender } = renderPicker({ lat: -24.3, lon: 31.05 });
        const map = await readyMap();
        await waitFor(() => expect(map.markers.size).toBe(1));

        rerender(
            <LocationPickerMap
                value={null}
                onChange={vi.fn()}
                center={CENTER}
                zoom={10}
            />,
        );

        await waitFor(() => expect(map.markers.size).toBe(0));
    });

    it("drops the marker on unmount", async () => {
        const { unmount } = renderPicker({ lat: -24.3, lon: 31.05 });
        const map = await readyMap();
        await waitFor(() => expect(map.markers.size).toBe(1));

        unmount();

        expect(map.markers.size).toBe(0);
    });
});
