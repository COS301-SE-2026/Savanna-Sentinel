import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
            <div className="text-center max-w-sm space-y-6">
                <div>
                    <p className="font-heading text-5xl leading-[0.95] font-extrabold tracking-[-0.02em] text-primary select-none">
                        404
                    </p>
                    <p className="font-heading text-2xl leading-[1.15] font-bold text-foreground mt-3">
                        Page not found
                    </p>
                </div>

                <Button asChild>
                    <Link to="/dashboard">Return</Link>
                </Button>
            </div>
        </div>
    );
}
