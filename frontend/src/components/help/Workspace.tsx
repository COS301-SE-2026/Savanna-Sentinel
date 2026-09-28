import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

export default function Workspace() {
    return (
        <div className="space-y-5">
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl text-brand-primary">
                        Workspace
                    </CardTitle>
                    <CardDescription className="text-base text-color-surface-deep">
                        Use the Workspace to build and manage map layers and
                        features for your team.
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-5 text-base">
                    <div>
                        <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                            Organising layers
                        </CardTitle>
                        <p>
                            Use the Layers panel to select a layer or feature.
                            Select <strong>New layer</strong> to add a layer.
                            Drag layers and features to change their order. Use
                            a feature's actions to move or duplicate it to
                            another layer, or toggle its visibility on the map.
                        </p>
                    </div>

                    <div>
                        <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                            Drawing and editing map features
                        </CardTitle>
                        <p>
                            Select a layer, then choose a drawing tool from the
                            toolbar to add a point, line, polygon, freehand
                            shape, rectangle, or circle. Choose <strong>Select</strong> to
                            select an existing feature. The style panel lets
                            you adjust its appearance and behaviour; when
                            available, use its geometry controls to edit the
                            feature's shape.
                        </p>
                    </div>

                    <div>
                        <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                            Saving your changes
                        </CardTitle>
                        <p>
                            Select <strong>Save</strong> in the map toolbar to
                            save workspace changes. Unsaved edits are kept
                            locally until saved, and the page warns you before
                            you leave. If another person saves changes first,
                            reload the latest workspace to continue from their
                            version.
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Button>
                <Link to="/workspace">Open the Workspace</Link>
            </Button>
        </div>
    );
}
