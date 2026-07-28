import { MessageSquare, MapPin, Clock, ShieldCheck, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

const TIPOFFS = [
    {
        id: "TIP-031",
        date: "14 May 2026 · 21:43",
        location: "Near fence line, sector F-1",
        description:
            "Saw two men with headlamps moving along the eastern fence after dark. Had a bakkie parked on the road nearby.",
        anonymous: true,
        contact: null,
        status: "New",
    },
    {
        id: "TIP-030",
        date: "12 May 2026 · 14:12",
        location: "Watering hole, sector C-4",
        description:
            "Noticed fresh wire snares placed around the main watering hole. Estimated 3–4 snares visible from the road.",
        anonymous: false,
        contact: "R. Mokoena",
        status: "Reviewed",
    },
    {
        id: "TIP-029",
        date: "09 May 2026 · 07:55",
        location: "Southern boundary road",
        description:
            "Unfamiliar vehicle without a reserve permit was parked on the boundary road for over two hours.",
        anonymous: true,
        contact: null,
        status: "Actioned",
    },
    {
        id: "TIP-028",
        date: "05 May 2026 · 18:30",
        location: "Sector B-7, dry riverbed",
        description:
            "Found footprints and a discarded wire reel near the dry riverbed. Signs of recent activity overnight.",
        anonymous: false,
        contact: "M. Sithole",
        status: "Actioned",
    },
];

const STATUS_STYLE: Record<string, string> = {
    New: "bg-spot-blue/10 text-spot-blue border border-spot-blue/30",
    Reviewed:
        "bg-spot-yellow/20 text-spot-dark-grey border border-spot-yellow/40",
    Actioned: "bg-spot-green/10 text-spot-green border border-spot-green/30",
};

export default function TipoffPage() {
    return (
        <div className="p-6 max-w-3xl mx-auto space-y-6">
            <div className="rounded-md bg-brand-dark-blue text-white px-4 py-2.5 text-sm flex items-center gap-2">
                <MessageSquare className="size-4 shrink-0" />
                <span>
                    This page is still to come, but here's a little teaser.
                </span>
            </div>

            <h1 className="text-2xl font-semibold text-foreground">Tip-offs</h1>

            <div className="rounded-lg border border-border bg-card p-5 space-y-4 opacity-75 select-none">
                <h2 className="text-sm font-semibold">Submit a Tip-off</h2>

                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                        Location
                    </label>
                    <div className="flex items-center gap-2 border border-border rounded-md px-3 py-2 bg-muted cursor-not-allowed">
                        <MapPin className="size-4 text-muted-foreground shrink-0" />
                        <span className="text-sm text-muted-foreground">
                            Enter grid reference or description…
                        </span>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                        Description
                    </label>
                    <div className="border border-border rounded-md bg-muted h-20 cursor-not-allowed" />
                </div>

                <label className="flex items-center gap-2 cursor-not-allowed text-sm opacity-80">
                    <div className="size-4 rounded border-2 border-border bg-background shrink-0" />
                    Submit anonymously
                </label>

                <Button disabled className="opacity-60">
                    Submit Tip-off
                </Button>
            </div>

            <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Recent Tip-offs
                </h2>

                {TIPOFFS.map((t) => (
                    <div
                        key={t.id}
                        className="rounded-lg border border-border bg-card p-4 space-y-2"
                    >
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-medium text-muted-foreground">
                                    {t.id}
                                </span>
                                <span
                                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[t.status]}`}
                                >
                                    {t.status}
                                </span>
                                {t.anonymous ? (
                                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Eye className="size-3" />
                                        Anonymous
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <ShieldCheck className="size-3" />
                                        {t.contact}
                                    </span>
                                )}
                            </div>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                                <Clock className="size-3" />
                                {t.date}
                            </span>
                        </div>

                        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <MapPin className="size-3 shrink-0" />
                            {t.location}
                        </p>

                        <p className="text-sm">{t.description}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
