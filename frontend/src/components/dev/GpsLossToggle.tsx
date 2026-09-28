import { SatelliteDish } from "lucide-react";

import { Button } from "@/components/ui/button";

interface GpsLossToggleProps {
    active: boolean;
    onToggle: (active: boolean) => void;
}

export function GpsLossToggle({ active, onToggle }: GpsLossToggleProps) {
    return (
        <Button
            type="button"
            variant={active ? "default" : "outline"}
            size="icon"
            className={
                active
                    ? "mt-1 shadow-sm"
                    : "mt-1 bg-color-surface-raised shadow-sm"
            }
            aria-label="Simulate GPS loss"
            aria-pressed={active}
            title={
                active
                    ? "GPS ignored, using accelerometer"
                    : "Simulate GPS loss"
            }
            onClick={() => onToggle(!active)}
        >
            <SatelliteDish />
        </Button>
    );
}
