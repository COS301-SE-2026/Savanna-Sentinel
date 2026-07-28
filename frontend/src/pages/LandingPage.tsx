import { Link } from "react-router-dom";
import {
    Map as MapIcon,
    RouteIcon,
    FileText,
    MessageSquare,
    UploadCloud,
    BarChart3,
    type LucideIcon,
} from "lucide-react";

interface InfoCard {
    icon: LucideIcon;
    title: string;
    body: string;
}

const FEATURES: InfoCard[] = [
    {
        icon: MapIcon,
        title: "Risk Heatmap",
        body: "See where incidents cluster on a live, PostGIS-backed heatmap.",
    },
    {
        icon: RouteIcon,
        title: "Patrol Routes",
        body: "Get optimal routes generated from current risk data.",
    },
    {
        icon: FileText,
        title: "Field Reports",
        body: "Sightings get logged offline in the field, no signal required. Reports sync automatically the moment connection is restored.",
    },
    {
        icon: MessageSquare,
        title: "Tip-offs",
        body: "Community liaisons provide reports from local contacts, weighed into the next patrol's route.",
    },
    {
        icon: UploadCloud,
        title: "Data Ingestion",
        body: "Upload historic CSV incident data, which is validated on the way in and consider in the next model run.",
    },
    {
        icon: BarChart3,
        title: "Model Insights",
        body: "See which factors are driving a given risk score.",
    },
];

function TerrainBackground() {
    return (
        <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 1200 340"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
        >
            <defs>
                <linearGradient id="hero-fade" x1="0" x2="1" y1="0" y2="0">
                    <stop
                        offset="0%"
                        style={{
                            stopColor: "var(--color-brand-primary)",
                            stopOpacity: 1,
                        }}
                    />
                    <stop
                        offset="40%"
                        style={{
                            stopColor: "var(--color-brand-primary)",
                            stopOpacity: 1,
                        }}
                    />
                    <stop
                        offset="70%"
                        style={{
                            stopColor: "var(--color-brand-primary)",
                            stopOpacity: 0,
                        }}
                    />
                </linearGradient>
            </defs>
            <path
                className="fill-none stroke-brand-steel"
                strokeWidth="1"
                d="M0,300 Q150,260 300,230 Q450,200 600,180 Q720,164 850,170 Q970,178 1060,202 Q1130,218 1200,248"
            />
            <path
                className="fill-none stroke-brand-steel"
                strokeWidth="0.9"
                d="M0,278 Q140,238 290,210 Q440,182 590,162 Q712,148 838,154 Q956,162 1048,188 Q1118,204 1200,228"
            />
            <path
                className="fill-none stroke-brand-steel"
                strokeWidth="0.8"
                d="M0,256 Q130,218 280,192 Q430,164 578,146 Q700,132 828,138 Q946,146 1038,172 Q1110,188 1200,210"
            />
            <path
                className="fill-none stroke-brand-steel"
                strokeWidth="0.7"
                d="M0,234 Q120,198 268,174 Q416,148 564,132 Q688,118 818,124 Q936,132 1030,158 Q1104,174 1200,194"
            />
            <path
                className="fill-none stroke-brand-steel"
                strokeWidth="0.6"
                d="M0,212 Q110,178 258,156 Q406,132 552,118 Q676,106 808,112 Q926,120 1022,146 Q1098,162 1200,178"
            />
            <path
                className="fill-none stroke-brand-steel"
                strokeWidth="0.5"
                d="M0,190 Q100,160 246,140 Q392,118 540,106 Q664,96 796,102 Q914,110 1012,136 Q1090,152 1200,164"
            />
            <rect
                x="0"
                y="0"
                width="1200"
                height="340"
                fill="url(#hero-fade)"
            />
        </svg>
    );
}

function FeatureTile({ icon: Icon, title, body }: InfoCard) {
    return (
        <li className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-brand-mid">
                <Icon
                    className="size-5 text-color-text-inverse"
                    aria-hidden="true"
                />
            </div>
            <div>
                <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-color-text-primary">
                    {title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-color-text-secondary">
                    {body}
                </p>
            </div>
        </li>
    );
}

export default function LandingPage() {
    return (
        <div className="min-h-screen">
            <section className="relative overflow-hidden bg-brand-primary px-6 py-16 sm:px-10 sm:py-20">
                <TerrainBackground />
                <div className="relative mx-auto max-w-5xl">
                    <nav
                        aria-label="Account"
                        className="flex items-center justify-end gap-5 text-xs font-semibold uppercase tracking-wider"
                    >
                        <Link
                            to="/login"
                            className="text-color-text-inverse hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-color-text-inverse focus-visible:[--tw-outline-style:solid]"
                        >
                            Log In
                        </Link>
                        <Link
                            to="/register"
                            className="text-color-text-inverse/70 hover:text-color-text-inverse focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-color-text-inverse focus-visible:[--tw-outline-style:solid]"
                        >
                            Register
                        </Link>
                    </nav>
                    <div className="mt-10 max-w-xl sm:mt-16">
                        <h1 className="font-heading text-4xl font-extrabold leading-tight tracking-tight text-color-text-inverse sm:text-5xl">
                            Savanna
                            <br />
                            Sentinel
                        </h1>
                        <p className="mt-4 max-w-md text-base leading-relaxed text-color-text-inverse/90 sm:text-lg">
                            Anti-poaching intelligence for your reserve: risk
                            heatmaps, patrol planning, and field reporting in
                            one platform.
                        </p>
                    </div>
                </div>
            </section>

            <section className="bg-color-surface-bg px-6 py-12 sm:px-10 sm:py-16">
                <div className="mx-auto max-w-5xl">
                    <h2 className="border-b-2 border-color-border pb-4 font-heading text-2xl font-extrabold text-brand-primary sm:text-3xl">
                        What Savanna Sentinel does
                    </h2>
                    <ul className="mt-8 grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2">
                        {FEATURES.map((feature) => (
                            <FeatureTile key={feature.title} {...feature} />
                        ))}
                    </ul>
                </div>
            </section>

            <footer className="bg-color-surface-deep px-6 py-8 text-center">
                <p className="text-xs uppercase tracking-[0.22em] text-color-text-inverse/70">
                    Savanna Sentinel, a COS 301 Capstone project at the
                    University of Pretoria, in partnership with EPI-USE
                </p>
            </footer>
        </div>
    );
}
