interface BrandPanelProps {
    logoAlt: string;
    logoAriaHidden?: boolean;
}

export function BrandPanel({ logoAlt, logoAriaHidden }: BrandPanelProps) {
    return (
        <div className="hidden md:flex md:w-1/2 bg-color-surface-deep flex-col items-center justify-center gap-6 px-12">
            <img
                src="/icons/SavannaSentinelLogo.png"
                alt={logoAlt}
                aria-hidden={logoAriaHidden}
                className="w-64 h-auto"
            />
            <p className="text-color-text-inverse/50 text-xs tracking-[0.22em] uppercase text-center">
                Wildlife Conservation Monitoring
            </p>
        </div>
    );
}
