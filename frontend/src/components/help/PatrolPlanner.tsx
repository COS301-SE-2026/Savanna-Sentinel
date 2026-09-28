import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

export default function Patrol() {
    return (
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
                        Route Parameters
                    </CardTitle>
                    <ul className="text-base list-disc pl-5 space-y-1">
                        <li>
                            Start and End location: Enter the coordinates, or
                            click the location icon and click on the map to
                            select a starting point.
                        </li>
                    </ul>
                    <p className="text-base space-y-2">
                        Afterwards, click the generate routes button to generate
                        routes. If you need to, you may also click Clear routes
                        to clear the currently generated routes.
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
                    <p className="text-base space-y-2">
                        The metrics for each route are as follows:
                    </p>
                    <ul className="text-base list-disc pl-5 space-y-1">
                        <li>
                            Distance: The length of the route in kilometres.
                        </li>
                        <li>
                            Risk Coverage: The share of the risk in Medium, High
                            and Critical cells that the route passes through or
                            next to. Higher-risk cells count for more.
                        </li>
                    </ul>
                    <p className="text-base space-y-2">
                        The shortest route is listed first. Alternatives cover a
                        similar amount of risk along a different path, and are
                        only shown when they are at most 15% longer.
                    </p>
                </div>

                <div>
                    <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                        The Map
                    </CardTitle>
                    <ul className="text-base list-disc pl-5 space-y-1">
                        <li>
                            The Map controls are in the top right. You may also
                            use your mouse wheel to scroll in and out to zoom in
                            and out.
                        </li>
                        <li>
                            In the bottom right is a legend describing how the
                            colours in the heatmap corelate to risk values.
                        </li>
                        <li>
                            Click on a cell to view information about that cell.
                        </li>
                        <li>
                            Clicking on 'View Analysis' will open a panel with
                            more information about that cell.
                        </li>
                    </ul>
                </div>
            </CardContent>
        </Card>
    );
}