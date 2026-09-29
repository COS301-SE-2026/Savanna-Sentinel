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
                            shape, rectangle, or circle. Choose{" "}
                            <strong>Select</strong> to select an existing
                            feature. The style panel lets you adjust its
                            appearance and behaviour; when available, use its
                            geometry controls to edit the feature's shape.
                        </p>
                    </div>

                    <div>
                        <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                            How layer changes reach features
                        </CardTitle>
                        <p>
                            A feature takes its style and rules from its layer
                            and that layer's parent layers. Anything you set on
                            the feature itself wins over the layer. Settings a
                            feature has changed show a <strong>Reset</strong>{" "}
                            button; select it to follow the layer again.
                        </p>
                        <p className="mt-3">Styles:</p>
                        <ul className="list-inside list-disc pl-6 text-base">
                            <li>
                                Changing a layer's style updates every feature
                                in it, except the properties a feature has
                                changed itself.
                            </li>
                            <li>
                                A feature in several layers is styled separately
                                in each, so each copy follows its own layer.
                            </li>
                            <li>
                                Moving or duplicating a feature copies its
                                current look onto the new copy. That copy stops
                                following the layer's style until you reset its
                                properties.
                            </li>
                        </ul>
                        <p className="mt-3">
                            Rules (under <strong>Behaviour</strong>):
                        </p>
                        <ul className="list-inside list-disc pl-6 text-base">
                            <li>
                                A layer's rule applies setting by setting. If a
                                feature only sets a rule's strength, the layer
                                still controls the rest.
                            </li>
                            <li>
                                A feature in several layers follows the rules of
                                the highest of those layers in the Layers panel.
                                The same rule on a lower layer has no effect on
                                it.
                            </li>
                            <li>
                                If a move or duplicate would change how a
                                feature behaves, the feature keeps its previous
                                rule as its own. It then stops following the
                                layer's version of that rule until you reset it.
                            </li>
                            <li>
                                Features that are not <strong>In effect</strong>{" "}
                                ignore all rules.
                            </li>
                        </ul>
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
