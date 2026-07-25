import * as React from "react";

import { Input } from "@/components/ui/input";
import { currentLocalDatetime } from "@/lib/utils";

type DateTimeInputProps = Omit<React.ComponentProps<"input">, "type" | "max">;

export function DateTimeInput(props: DateTimeInputProps) {
    return (
        <Input type="datetime-local" max={currentLocalDatetime()} {...props} />
    );
}
