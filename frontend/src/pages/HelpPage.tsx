import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Link } from "react-router-dom";

// Quick access to VALUABLE RESOURCES such as help center links, tutorials and FAQs

function Faq() {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg text-brand-primary">
                    Frequently Asked Questions
                </CardTitle>
                <CardDescription className="text-base text-color-surface-deep">
                    Answers to the most common tasks in the help page.
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5 text-base">
                <div>
                    <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                        What is this app for?
                    </CardTitle>
                    <p>
                        Savanna Sentinel helps rangers and analysts spot risk,
                        plan patrols, and capture field reports for wildlife
                        protection.
                    </p>
                </div>

                <div>
                    <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                        Can I use it offline?
                    </CardTitle>
                    <p>
                        Yes. The platform is designed to support field work even
                        when the connection is unstable. Data syncs when access
                        is available again.
                    </p>
                </div>

                <div>
                    <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                        How do I file a report?
                    </CardTitle>
                    <p>
                        Open Reports and select New Report. Then enter the
                        report details and submit it for review.
                    </p>
                </div>

                <div>
                    <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                        How do I plan a patrol?
                    </CardTitle>
                    <p>
                        Open Patrol Planner, set the start location, duration,
                        and priority, then select Generate Route.
                    </p>
                </div>

                <div>
                    <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                        How do I update my profile?
                    </CardTitle>
                    <p>
                        Open User Profile to change your first name, last name,
                        or password.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

function Reports() {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg text-brand-primary">
                    Field Reports
                </CardTitle>
                <CardDescription className="text-base text-color-surface-deep">
                    Use this page to view submitted reports, create a new
                    report, and narrow the list with search and filters.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 text-base">
                <div>
                    <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                        New Report
                    </CardTitle>
                    <p>Select New Report to file a new field report.</p>
                </div>

                <div>
                    <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                        Search and Filter
                    </CardTitle>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Search reports using the search box.</li>
                        <li>
                            Use Filter to narrow results by report criteria.
                        </li>
                    </ul>
                </div>

                <div>
                    <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                        Report Table
                    </CardTitle>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Report ID: unique reference for each report.</li>
                        <li>Date: when the report was submitted.</li>
                        <li>Ranger: the user who submitted the report.</li>
                        <li>Type: the report category.</li>
                        <li>
                            Location: the grid location linked to the report.
                        </li>
                        <li>
                            Status: current report state, such as Open, Under
                            Review, or Closed.
                        </li>
                    </ul>
                </div>

                <div>
                    <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                        Status
                    </CardTitle>
                    <p>
                        Open reports are active, Under Review reports are being
                        checked, and Closed reports are complete.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

function Patrol() {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg text-brand-primary">
                    Patrol Planner
                </CardTitle>
                <CardDescription className="text-base text-color-surface-deep">
                    Use the route panel to define the patrol constraints and
                    review the suggested route metrics.
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
                <div>
                    <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                        Route Parameters
                    </CardTitle>
                    <ul className="text-base list-disc pl-5 space-y-1">
                        <li>
                            Start location: select the patrol starting point.
                        </li>
                        <li>
                            Patrol duration: set the target duration in hours.
                        </li>
                        <li>
                            Priority: choose what the route should prioritise.
                        </li>
                    </ul>
                </div>

                <div>
                    <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                        Suggested Route
                    </CardTitle>
                    <ul className="text-base list-disc pl-5 space-y-1">
                        <li>
                            Distance shows the total route length in kilometres.
                        </li>
                        <li>Est. time shows the expected patrol time.</li>
                        <li>Waypoints shows how many stops are included.</li>
                        <li>
                            Risk coverage shows the percentage of risk covered
                            by the route.
                        </li>
                    </ul>
                </div>

                <div>
                    <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                        Route Generation
                    </CardTitle>
                    <p className="text-base">
                        Select Generate Route to build the route from the chosen
                        parameters.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

function Profile() {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg text-brand-primary">
                    Profile
                </CardTitle>
                <CardDescription className="text-base text-color-surface-deep">
                    Update your name details or change your password from this
                    page.
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
                <div>
                    <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                        Profile Details
                    </CardTitle>
                    <ul className="text-base list-disc pl-5 space-y-1">
                        <li>First name: update your first name.</li>
                        <li>Last name: update your last name.</li>
                        <li>Save applies the changes to your profile.</li>
                        <li>Reset restores the saved profile values.</li>
                    </ul>
                </div>

                <div>
                    <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                        Change Password
                    </CardTitle>
                    <ul className="text-base list-disc pl-5 space-y-1">
                        <li>Current password: enter your existing password.</li>
                        <li>
                            New password: enter a password with at least 8
                            characters.
                        </li>
                        <li>
                            Confirm password: re-enter the new password exactly.
                        </li>
                        <li>
                            The new password must not match the current
                            password.
                        </li>
                    </ul>
                </div>

                <div>
                    <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                        Password Rules
                    </CardTitle>
                    <p className="text-base">
                        Password changes require all fields to be filled, the
                        new password to meet the length requirement, and the
                        confirmation field to match.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

// Eventually add the link to the user manual and remove the comment ig
export default function HelpPage() {
    return (
        <div className="mx-auto max-w-[1120px] px-4 pt-8 pb-10 md:px-6">
            <Tabs defaultValue="faq">
                <TabsList className="bg-(--color-color-surface-raised)">
                    <TabsTrigger className="text-sm" value="faq">
                        FAQ
                    </TabsTrigger>
                    <TabsTrigger className="text-sm" value="reports">
                        Reports
                    </TabsTrigger>
                    <TabsTrigger className="text-sm" value="patrol">
                        Patrol Planner
                    </TabsTrigger>
                    <TabsTrigger className="text-sm" value="profile">
                        User Profile
                    </TabsTrigger>
                    <TabsTrigger className="text-sm" value="link">
                        <Link to="/">User Manual</Link>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="faq">
                    <Faq />
                </TabsContent>

                <TabsContent value="reports">
                    <Reports />
                </TabsContent>

                <TabsContent value="patrol">
                    <Patrol />
                </TabsContent>

                <TabsContent value="profile">
                    <Profile />
                </TabsContent>
            </Tabs>
        </div>
    );
}
