import { WORKSPACE_ICONS } from "@/lib/workspace/icons";

export interface IconPickerProps {
    value: string | undefined;
    onChange: (icon: string | undefined) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
    return (
        <div className="grid grid-cols-5 gap-1">
            <button
                type="button"
                aria-label="No icon"
                aria-pressed={value === undefined}
                onClick={() => onChange(undefined)}
                className={`flex size-8 items-center justify-center rounded border text-xs text-color-text-secondary ${
                    value === undefined
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
