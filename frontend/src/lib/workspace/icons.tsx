import { renderToStaticMarkup } from "react-dom/server";
import type * as maplibregl from "maplibre-gl";
import type { LucideIcon } from "lucide-react";
import {
    MapPin,
    Tent,
    Droplet,
    PawPrint,
    Flag,
    TriangleAlert,
    TreePine,
    Camera,
    Binoculars,
    Tractor,
    Fence,
    Route,
    Anchor,
    Compass,
    Siren,
    Waves,
    Mountain,
    Sun,
    Moon,
    Star,
} from "lucide-react";

export interface WorkspaceIconDef {
    key: string;
    label: string;
    Icon: LucideIcon;
}

export const WORKSPACE_ICONS: WorkspaceIconDef[] = [
    { key: "map-pin", label: "Pin", Icon: MapPin },
    { key: "tent", label: "Camp", Icon: Tent },
    { key: "droplet", label: "Water", Icon: Droplet },
    { key: "paw-print", label: "Wildlife", Icon: PawPrint },
    { key: "flag", label: "Flag", Icon: Flag },
    { key: "triangle-alert", label: "Alert", Icon: TriangleAlert },
    { key: "tree-pine", label: "Tree", Icon: TreePine },
    { key: "camera", label: "Camera trap", Icon: Camera },
    { key: "binoculars", label: "Lookout", Icon: Binoculars },
    { key: "tractor", label: "Vehicle", Icon: Tractor },
    { key: "fence", label: "Fence", Icon: Fence },
    { key: "route", label: "Route", Icon: Route },
    { key: "anchor", label: "Anchor", Icon: Anchor },
    { key: "compass", label: "Compass", Icon: Compass },
    { key: "siren", label: "Incident", Icon: Siren },
    { key: "waves", label: "River", Icon: Waves },
    { key: "mountain", label: "Terrain", Icon: Mountain },
    { key: "sun", label: "Day", Icon: Sun },
    { key: "moon", label: "Night", Icon: Moon },
    { key: "star", label: "Marker", Icon: Star },
];

const ICON_LOGICAL_SIZE = 24;
const ICON_PIXEL_RATIO = 4;
const ICON_PIXEL_SIZE = ICON_LOGICAL_SIZE * ICON_PIXEL_RATIO;

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () =>
            reject(new Error(`Failed to load icon image: ${src}`));
        image.src = src;
    });
}

export async function registerWorkspaceIcons(
    map: Pick<maplibregl.Map, "hasImage" | "addImage">,
): Promise<void> {
    await Promise.all(
        WORKSPACE_ICONS.map(async ({ key, Icon }) => {
            if (map.hasImage(key)) return;

            const canvas = document.createElement("canvas");
            canvas.width = ICON_PIXEL_SIZE;
            canvas.height = ICON_PIXEL_SIZE;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            const svgMarkup = renderToStaticMarkup(
                <Icon size={ICON_PIXEL_SIZE} color="#1f2937" strokeWidth={2} />,
            );
            const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
            const image = await loadImage(svgDataUrl);
            ctx.drawImage(image, 0, 0, ICON_PIXEL_SIZE, ICON_PIXEL_SIZE);
            const imageData = ctx.getImageData(
                0,
                0,
                ICON_PIXEL_SIZE,
                ICON_PIXEL_SIZE,
            );
            map.addImage(
                key,
                {
                    width: ICON_PIXEL_SIZE,
                    height: ICON_PIXEL_SIZE,
                    data: new Uint8Array(imageData.data.buffer),
                },
                { pixelRatio: ICON_PIXEL_RATIO, sdf: true },
            );
        }),
    );
}
