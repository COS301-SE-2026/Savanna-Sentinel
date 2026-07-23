import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
    return (
        <Sonner
            position="top-right"
            offset="20px"
            gap={8}
            closeButton
            icons={{ success: null, warning: null, error: null, info: null }}
            style={
                {
                    "--normal-bg": "var(--color-color-surface-raised)",
                    "--normal-border": "var(--color-color-border)",
                    "--normal-text": "var(--color-color-text-primary)",
                    "--border-radius": "var(--radius-md)",
                } as React.CSSProperties
            }
            {...props}
        />
    );
};

export { Toaster };
