import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
	return (
		<div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
			<div className="text-center max-w-sm space-y-6">
				<div>
					<p className="text-9xl font-black text-primary leading-none tracking-tighter select-none">
						404
					</p>
					<p className="text-xl font-semibold text-foreground mt-3">
						Page not found
					</p>
					<p className="text-sm text-muted-foreground mt-2">
						This trail doesn't exist on the reserve. You may have strayed off
						the patrol route.
					</p>
				</div>

				<Button asChild>
					<Link to="/dashboard">Return</Link>
				</Button>
			</div>
		</div>
	);
}
