import { describe, it, expect, vi, beforeEach } from "vitest";
import { WORKSPACE_ICONS, registerWorkspaceIcons } from "./icons";

class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    private _src = "";
    set src(value: string) {
        this._src = value;
        Promise.resolve().then(() => this.onload?.());
    }
    get src() {
        return this._src;
    }
}

beforeEach(() => {
    vi.stubGlobal("Image", FakeImage as unknown as typeof Image);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
        drawImage: vi.fn(),
        getImageData: vi.fn(() => ({
            data: new Uint8ClampedArray(24 * 24 * 4),
        })),
    } as unknown as CanvasRenderingContext2D);
});

describe("WORKSPACE_ICONS", () => {
    it("is a non-empty curated set with unique keys", () => {
        expect(WORKSPACE_ICONS.length).toBeGreaterThan(0);
        const keys = WORKSPACE_ICONS.map((i) => i.key);
        expect(new Set(keys).size).toBe(keys.length);
    });
});

describe("registerWorkspaceIcons", () => {
    it("registers every curated icon not already on the map", async () => {
        const addImage = vi.fn();
        const hasImage = vi.fn(() => false);
        await registerWorkspaceIcons({ hasImage, addImage } as never);
        expect(addImage).toHaveBeenCalledTimes(WORKSPACE_ICONS.length);
    });

    it("skips icons already registered on the map", async () => {
        const addImage = vi.fn();
        const hasImage = vi.fn(() => true);
        await registerWorkspaceIcons({ hasImage, addImage } as never);
        expect(addImage).not.toHaveBeenCalled();
    });

    it("rasterizes icons at higher resolution than their logical display size, declared via pixelRatio, so they stay crisp when zoom scales icon-size above 1", async () => {
        const addImage = vi.fn();
        const hasImage = vi.fn(() => false);
        await registerWorkspaceIcons({ hasImage, addImage } as never);

        const [, image, options] = addImage.mock.calls[0] as [
            string,
            { width: number; height: number },
            { pixelRatio?: number },
        ];
        expect(options.pixelRatio).toBeGreaterThan(1);
        expect(image.width).toBe(24 * options.pixelRatio!);
        expect(image.height).toBe(24 * options.pixelRatio!);
    });

    it("registers icons as sdf images so icon-color can recolour them per feature", async () => {
        const addImage = vi.fn();
        const hasImage = vi.fn(() => false);
        await registerWorkspaceIcons({ hasImage, addImage } as never);

        const [, , options] = addImage.mock.calls[0] as [
            string,
            unknown,
            { sdf?: boolean },
        ];
        expect(options.sdf).toBe(true);
    });
});
