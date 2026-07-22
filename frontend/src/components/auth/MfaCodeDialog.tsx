import {
    useEffect,
    useRef,
    useState,
    type ClipboardEvent,
    type FormEvent,
    type KeyboardEvent,
} from "react";
import { Loader2 } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const RESEND_COOLDOWN_SECONDS = 30;
const CODE_LENGTH = 6;
const BOX_IDS = Array.from({ length: CODE_LENGTH }, () => crypto.randomUUID());

const boxClassName =
    "h-14 w-12 rounded-md border-[1.5px] border-color-input-border bg-color-surface-raised text-center text-2xl font-semibold text-color-text-primary shadow-xs outline-none transition-[color,box-shadow,border-color] focus:border-brand-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:opacity-50";

interface MfaCodeBoxesProps {
    value: string;
    onChange: (value: string) => void;
    autoFocus?: boolean;
    disabled?: boolean;
}

function MfaCodeBoxes({
    value,
    onChange,
    autoFocus = false,
    disabled = false,
}: Readonly<MfaCodeBoxesProps>) {
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    function setDigit(index: number, digit: string) {
        const chars = value.padEnd(CODE_LENGTH, " ").split("");
        chars[index] = digit || " ";
        onChange(chars.join("").trimEnd());
    }

    function handleChange(index: number, raw: string) {
        const digit = raw.replace(/\D/g, "").slice(-1);
        setDigit(index, digit);
        if (digit && index < CODE_LENGTH - 1) {
            inputRefs.current[index + 1]?.focus();
        }
    }

    function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Backspace" && !value[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        } else if (e.key === "ArrowLeft" && index > 0) {
            inputRefs.current[index - 1]?.focus();
        } else if (e.key === "ArrowRight" && index < CODE_LENGTH - 1) {
            inputRefs.current[index + 1]?.focus();
        }
    }

    function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
        if (!pasted) return;
        e.preventDefault();
        onChange(pasted.slice(0, CODE_LENGTH));
        const nextIndex = Math.min(pasted.length, CODE_LENGTH) - 1;
        inputRefs.current[nextIndex]?.focus();
    }

    return (
        <>
            {BOX_IDS.map((id, index) => (
                <input
                    key={id}
                    ref={(el) => {
                        inputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    autoFocus={autoFocus && index === 0}
                    disabled={disabled}
                    aria-label={`Digit ${index + 1} of ${CODE_LENGTH}`}
                    value={value[index] ?? ""}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    className={boxClassName}
                />
            ))}
        </>
    );
}

interface MfaCodeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (code: string) => void | Promise<void>;
    onResend: () => void | Promise<void>;
    isSubmitting?: boolean;
}

export function MfaCodeDialog({
    open,
    onOpenChange,
    onSubmit,
    onResend,
    isSubmitting = false,
}: Readonly<MfaCodeDialogProps>) {
    const [code, setCode] = useState("");
    const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setInterval(() => {
            setCooldown((c) => Math.max(0, c - 1));
        }, 1000);
        return () => clearInterval(timer);
    }, [cooldown]);

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        onSubmit(code.replace(/\s/g, ""));
    }

    async function handleResend() {
        setCooldown(RESEND_COOLDOWN_SECONDS);
        await onResend();
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent preventBackdropClose>
                <DialogHeader>
                    <DialogTitle>MFA Code</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="flex flex-col items-center gap-4 px-6 py-5">
                        <p
                            id="mfa-code-label"
                            className="text-base leading-relaxed text-color-text-primary"
                        >
                            Enter the code sent to your email:
                        </p>

                        <fieldset
                            aria-labelledby="mfa-code-label"
                            className="m-0 flex gap-2 border-0 p-0"
                        >
                            <MfaCodeBoxes
                                value={code}
                                onChange={setCode}
                                autoFocus
                                disabled={isSubmitting}
                            />
                        </fieldset>

                        <Button
                            type="button"
                            variant="link"
                            size="sm"
                            onClick={handleResend}
                            disabled={cooldown > 0 || isSubmitting}
                        >
                            {cooldown > 0
                                ? `Resend code (${cooldown}s)`
                                : "Resend code"}
                        </Button>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Verifying...
                                </>
                            ) : (
                                "Verify"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export default MfaCodeDialog;
