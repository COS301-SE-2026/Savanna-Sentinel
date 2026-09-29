import { WORKSPACE_ICONS } from "@/lib/workspace/icons";
import { NO_ICON } from "@/lib/workspace/types";

export interface IconPickerProps {
    value: string | undefined;
    onChange: (icon: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
    const hasNoIcon = value === undefined || value === NO_ICON;
    return (
        <div className="grid grid-cols-5 gap-1">
            <button
                type="button"
                aria-label="No icon"
                aria-pressed={hasNoIcon}
                onClick={() => onChange(NO_ICON)}
                className={`flex size-8 items-center justify-center rounded border text-xs text-color-text-secondary ${
                    hasNoIcon
                        ? "border-brand-primary bg-color-surface-bg"
                        : "border-color-border"
                }`}
            >
                None
            </button>
            {WORKSPACE_ICONS.map(({ key, label, Icon }) => (
                <button
                    key={key}
                    type="button"
                    aria-label={label}
                    aria-pressed={value === key}
                    onClick={() => onChange(key)}
                    className={`flex size-8 items-center justify-center rounded border ${
                        value === key
                            ? "border-brand-primary bg-color-surface-bg"
                            : "border-color-border"
                    }`}
                >
                    <Icon className="size-4" />
                </button>
            ))}
        </div>
    );
}
