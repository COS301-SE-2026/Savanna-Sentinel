import { vi } from "vitest";

type FinishHandler = (
    id: string,
    context: { action: string; mode: string },
) => void;

export class FakeTerraDraw {
    private finishHandlers: FinishHandler[] = [];
    private snapshot: GeoJSON.Feature[] = [];
    private mode = "select";

    private upsertSnapshotFeature(feature: GeoJSON.Feature) {
        const index = this.snapshot.findIndex(
            (f) => String(f.id) === String(feature.id),
        );
        if (index === -1) this.snapshot.push(feature);
        else this.snapshot[index] = feature;
    }

    start = vi.fn();
    stop = vi.fn();
    setMode = vi.fn((mode: string) => {
        this.mode = mode;
    });
    getMode = vi.fn(() => this.mode);
    undo = vi.fn();
    addFeatures = vi.fn((features: GeoJSON.Feature[]) => {
        features.forEach((f) => this.upsertSnapshotFeature(f));
    });
    selectFeature = vi.fn();
    deselectFeature = vi.fn();
    removeFeatures = vi.fn((ids: string[]) => {
        this.snapshot = this.snapshot.filter(
            (f) => !ids.includes(String(f.id)),
        );
    });
    getSnapshot = vi.fn(() => this.snapshot);

    on(event: string, handler: FinishHandler) {
        if (event === "finish") this.finishHandlers.push(handler);
    }

    fireFinish(id: string, context: { action: string; mode: string }) {
        this.finishHandlers.forEach((h) => h(id, context));
    }

    setSnapshotFeature(feature: GeoJSON.Feature) {
        this.upsertSnapshotFeature(feature);
    }
}

export function createTerraDrawMock() {
    class TerraDrawPointMode {}
    class TerraDrawLineStringMode {
        static instances: TerraDrawLineStringMode[] = [];
        options?: Record<string, unknown>;
        constructor(options?: Record<string, unknown>) {
            this.options = options;
            TerraDrawLineStringMode.instances.push(this);
        }
    }
    class TerraDrawPolygonMode {
        static instances: TerraDrawPolygonMode[] = [];
        options?: Record<string, unknown>;
        constructor(options?: Record<string, unknown>) {
            this.options = options;
            TerraDrawPolygonMode.instances.push(this);
        }
    }
    class TerraDrawFreehandMode {
        static instances: TerraDrawFreehandMode[] = [];
        options?: Record<string, unknown>;
        constructor(options?: Record<string, unknown>) {
            this.options = options;
            TerraDrawFreehandMode.instances.push(this);
        }
    }
    class TerraDrawFreehandLineStringMode {
        static instances: TerraDrawFreehandLineStringMode[] = [];
        options?: Record<string, unknown>;
        constructor(options?: Record<string, unknown>) {
            this.options = options;
            TerraDrawFreehandLineStringMode.instances.push(this);
        }
    }
    class TerraDrawRectangleMode {}
    class TerraDrawCircleMode {}
    class TerraDrawSelectMode {}
    class TerraDrawModeUndoRedo {}

    return {
        TerraDraw: FakeTerraDraw,
        TerraDrawPointMode,
        TerraDrawLineStringMode,
        TerraDrawPolygonMode,
        TerraDrawFreehandMode,
        TerraDrawFreehandLineStringMode,
        TerraDrawRectangleMode,
        TerraDrawCircleMode,
        TerraDrawSelectMode,
        TerraDrawModeUndoRedo,
    };
}

export function createTerraDrawAdapterMock() {
    class TerraDrawMapLibreGLAdapter {}
    return { TerraDrawMapLibreGLAdapter };
}
