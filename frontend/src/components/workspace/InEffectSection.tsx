import { Checkbox } from "@/components/ui/checkbox";
import { useWorkspaceStore } from "@/store/workspaceStore";

export function InEffectSection({ featureId }: { featureId: string }) {
    const isInEffect = useWorkspaceStore(
        (s) => s.features.find((f) => f.id === featureId)?.inEffect ?? true,
    );
    const setFeatureInEffect = useWorkspaceStore((s) => s.setFeatureInEffect);

    return (
        <div className="border-t border-color-border p-3">
            <label className="flex items-center gap-2 text-sm text-color-text-primary">
                <Checkbox
                    checked={isInEffect}
                    aria-label="In effect"
                    onChange={(e) =>
                        setFeatureInEffect(featureId, e.target.checked)
                    }
                />
                In effect
            </label>
            {!isInEffect && (
                <p className="mt-1 text-xs text-color-text-secondary">
                    Not in effect. This feature takes no part in terrain rules
                    and starts hidden for people who have not chosen otherwise.
                </p>
            )}
        </div>
    );
}
