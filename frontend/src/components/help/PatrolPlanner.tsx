import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

export default function Patrol() {
    return (
        <div className="space-y-5">
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl text-brand-primary">
                        Patrol Planner
                    </CardTitle>
                    <CardDescription className="text-base text-color-surface-deep">
                        Use the Plan route panel to define the patrol constraints
                        and review the suggested route.
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-5">
                    <div>
                        <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                            Creating your patrol route
                        </CardTitle>
                       <p className="text-base">
                            To create your route, click the location icon and then click a point on the map.
                            Continue to do this, adding stops if needed, until you have finished the route.
                            You would then <strong>Generate route</strong> and will then recieve your suggested route(s).
                       </p>
                    </div>

                    <div>
                        <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                            Suggested, and Alternate Routes
                        </CardTitle>
                        <p className="text-base space-y-2">
                            The selected route is emphasized on the map, while the
                            alternate routes are overlayed. This is done so you may
                            compare your currently selected route to the
                            alternatives. You may change the current selected route
                            by clicking the 'Select' button in the top right of the
                            route's card.
                        </p>
                    </div>

                    <div>
                        <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                            Navigating Your route
                        </CardTitle>
                        <p className="text-base">
                            You can check the <strong>My location</strong> checkbox
                            to toggle your location to help you navigate along your route.
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Button>
                <Link to="/heatmap">
                    Click me to go Plan your patrol route
                </Link>
            </Button>
        </div>
    );
}