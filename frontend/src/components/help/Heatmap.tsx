import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

export default function Heatmap() {
    return (
        <div className="space-y-5">
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl text-brand-primary">
                        Heatmap & Risk Engine Guide
                    </CardTitle>
                    <CardDescription className="text-base text-color-surface-deep">
                        Everything to do with the risk engine, layers, and
                        predictive zones would be found on this page.
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-5">
                    <div>
                        <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                            Left Sidebar Controls
                        </CardTitle>
                        <p className="text-base">
                            In this section you manage your core configurations
                            and data views where you would:
                        </p>
                        <ul className="text-base pl-6 list-disc list-inside">
                            <li>
                                Filter historical snapshots using the Time Range
                                selector
                            </li>
                            <li>
                                Toggle the Risk Heatmap, your location, and
                                adjust the Heatmap Opacity
                            </li>
                            <li>View operational summaries</li>
                        </ul>
                    </div>

                    <div>
                        <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                            Right Sidebar Controls
                        </CardTitle>
                        <p className="text-base">
                            In this section you can turn on or off the current
                            layers your system analyst/admin may have created
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Button>
                <Link to="/map">Click me to go to the Heatmap view</Link>
            </Button>
        </div>
    );
}
