import { vi } from "vitest";

type Handler = (event?: unknown) => void;

export class FakeMap {
    options: Record<string, unknown>;
    private listeners: Record<string, Handler[]> = {};
    private layerListeners: Record<string, Record<string, Handler[]>> = {};
    sources: Record<string, { data: unknown; setData: (d: unknown) => void }> =
        {};
    layers: Record<string, unknown> = {};
    markers: Set<FakeMarker> = new Set();
    private removed = false;

    constructor(options: Record<string, unknown>) {
        this.options = options;
    }

    private assertNotRemoved() {
        if (this.removed) {
            throw new TypeError(
                "Cannot read properties of undefined (reading 'getLayer')",
            );
        }
    }

    on(event: string, layerIdOrHandler: unknown, maybeHandler?: unknown) {
        this.assertNotRemoved();
        if (typeof maybeHandler === "function") {
            const layerId = layerIdOrHandler as string;
            this.layerListeners[event] ??= {};
            (this.layerListeners[event][layerId] ??= []).push(
                maybeHandler as Handler,
            );
        } else {
            const handler = layerIdOrHandler as Handler;
            (this.listeners[event] ??= []).push(handler);
            if (event === "load") {
                Promise.resolve().then(() => handler());
            }
        }
        return this;
    }

    off(event: string, layerIdOrHandler: unknown, maybeHandler?: unknown) {
        this.assertNotRemoved();
        if (typeof maybeHandler === "function") {
            const layerId = layerIdOrHandler as string;
            const handlers = this.layerListeners[event]?.[layerId];
            if (handlers) {
                this.layerListeners[event][layerId] = handlers.filter(
                    (h) => h !== maybeHandler,
                );
            }
        } else {
            this.listeners[event] = (this.listeners[event] ?? []).filter(
                (h) => h !== layerIdOrHandler,
            );
        }
        return this;
    }

    remove() {
        this.removed = true;
    }

    addSource(id: string, source: { data: unknown }) {
        this.assertNotRemoved();
        this.sources[id] = {
            data: source.data,
            setData: vi.fn((d: unknown) => {
                this.sources[id].data = d;
            }),
        };
    }

    removeSource(id: string) {
        this.assertNotRemoved();
        delete this.sources[id];
    }

    getSource(id: string) {
        this.assertNotRemoved();
        return this.sources[id];
    }

    addLayer(layer: { id: string }) {
        this.assertNotRemoved();
        this.layers[layer.id] = layer;
    }

    removeLayer(id: string) {
        this.assertNotRemoved();
        delete this.layers[id];
    }

    getLayer(id: string) {
        this.assertNotRemoved();
        return this.layers[id];
    }

    setLayoutProperty = vi.fn();
    setPaintProperty = vi.fn();
    zoomIn = vi.fn();
    zoomOut = vi.fn();
    resetNorthPitch = vi.fn();
    fitBounds = vi.fn();

    queryRenderedFeaturesResult: unknown[] = [];
    queryRenderedFeatures = vi.fn(() => this.queryRenderedFeaturesResult);

    private container: HTMLElement = document.createElement("div");
    getContainer() {
        return this.container;
    }

    fireClick(lngLat: { lng: number; lat: number }) {
        this.listeners.click?.forEach((h) =>
            h({ lngLat, point: { x: 0, y: 0 } }),
        );
    }

    fireError(error: unknown) {
        this.listeners.error?.forEach((h) => h({ error }));
    }

    fireLayerClick(layerId: string, event: unknown) {
        this.layerListeners.click?.[layerId]?.forEach((h) => h(event));
    }
}

export class FakeMarker {
    private lngLat = { lng: 0, lat: 0 };
    private map: FakeMap | null = null;
    private handlers: Record<string, Handler[]> = {};
    element: HTMLElement;
    constructor(options: { element: HTMLElement }) {
        this.element = options.element;
    }
    setLngLat(coords: [number, number]) {
        this.lngLat = { lng: coords[0], lat: coords[1] };
        return this;
    }
    on(event: string, handler: Handler) {
        (this.handlers[event] ??= []).push(handler);
        return this;
    }
    fire(event: string) {
        this.handlers[event]?.forEach((h) => h());
    }
    getLngLat() {
        return this.lngLat;
    }
    addTo(map: FakeMap) {
        this.map = map;
        map.markers.add(this);
        return this;
    }
    remove = vi.fn(() => {
        this.map?.markers.delete(this);
        this.map = null;
    });
}

export class FakePopup {
    setLngLat() {
        return this;
    }
    setHTML() {
        return this;
    }
    setDOMContent() {
        return this;
    }
    addTo() {
        return this;
    }
    remove() {}
}

export function createMapLibreMock() {
    const mod = { Map: FakeMap, Marker: FakeMarker, Popup: FakePopup };
    return { ...mod, default: mod };
}
