import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PasswordVisibilityToggleProps {
    isVisible: boolean;
    onToggle: () => void;
    className?: string;
}

export function PasswordVisibilityToggle({
    isVisible,
    onToggle,
    className,
}: PasswordVisibilityToggleProps) {
    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={isVisible ? "Hide password" : "Show password"}
            onClick={onToggle}
            className={cn(
                "absolute right-1 top-1/2 -translate-y-1/2",
                className,
            )}
        >
            {isVisible ? <EyeOff size={17} /> : <Eye size={17} />}
        </Button>
    );
}
