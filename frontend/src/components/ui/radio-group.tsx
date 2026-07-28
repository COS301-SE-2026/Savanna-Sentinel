import { cn } from "@/lib/utils";

export interface RadioOption<T extends string> {
    value: T;
    label: string;
}

export interface RadioGroupProps<T extends string> {
    legend: string;
    name: string;
    options: RadioOption<T>[];
    value: T | null;
    onChange: (value: T) => void;
    className?: string;
}

const radioInputClass =
    "size-5 min-w-5 cursor-pointer appearance-none rounded-full border-[1.5px] border-color-input-border bg-color-surface-raised transition-[border-color,background] checked:border-[5px] checked:border-brand-primary checked:bg-color-text-inverse hover:border-brand-steel checked:hover:border-brand-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary focus-visible:[--tw-outline-style:solid]";

export function RadioGroup<T extends string>({
    legend,
    name,
    options,
    value,
    onChange,
    className,
}: RadioGroupProps<T>) {
    return (
        <fieldset className="m-0 border-0 p-0">
            <legend className="mb-3 text-sm font-medium text-color-text-primary">
                {legend}
            </legend>
            <div
                className={cn(
                    "flex flex-col gap-3 sm:flex-row sm:gap-6",
                    className,
                )}
            >
                {options.map((option) => (
                    <label
                        key={option.value}
                        className="flex cursor-pointer items-center gap-2"
                    >
                        <input
                            type="radio"
                            name={name}
                            value={option.value}
                            checked={value === option.value}
                            onChange={() => onChange(option.value)}
                            aria-label={option.label}
                            className={radioInputClass}
                        />
                        <span className="text-sm text-color-text-primary">
                            {option.label}
                        </span>
                    </label>
                ))}
            </div>
        </fieldset>
    );
}
