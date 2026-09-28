import { useWorkspaceStore } from "@/store/workspaceStore";
import type { Poi } from "@/components/map/SelectReferenceModal";

export function useWorkspacePois(): Poi[] {
    const features = useWorkspaceStore((s) => s.features);

    return features
        .filter((f) => f.geometry.type === "Point")
        .map((f) => {
            const point = f.geometry as GeoJSON.Point;
            return{
                id: f.id,
                name: f.name || "Unnamed",
                lat: point.coordinates[1],
                lon: point.coordinates[0]
            }
        })
}