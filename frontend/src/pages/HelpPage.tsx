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
                <CardTitle className="text-xl text-brand-primary">
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
                        and amount of fuel to estimate, then select Generate Route.
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
                <CardTitle className="text-xl text-brand-primary">
                    Field Reports
                </CardTitle>
                <CardDescription className="text-base text-color-surface-deep">
                    Use this page to view submitted reports, create a new
                    report or draft and edit reports.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 text-base">
                <div>
                    <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                        New Report Tab
                    </CardTitle>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>
                            Select the report type as either an incident or a sighting.
                        </li>
                        <li>
                            Add a description to your report.
                        </li>
                        <li>
                            Incident Report: Select the incident type and indicate the severity of it.
                        </li>
                        <li>
                            Sighting Report: Select the species and how many were involved in the report.
                        </li>
                        <li>
                            Enter the date when the event happened.
                        </li>
                        <li>
                            You can either manually enter the coordinates where the event happened or click the 'Use current location'
                            button to automatically use you current location.
                        </li>
                        <li>
                            You may optionally upload photos with the report.
                        </li>
                        <p className="text-base">
                            Afterwards you may Submit the report. Then you may use the pagination at the top to see your submitted reports
                            to either edit, draft or delete that previous report.
                        </p>
                    </ul>
                </div>

                <div>
                    <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                        All Reports Tab
                    </CardTitle>
                    <p className="text-base">
                        Shows a table showing all the submitted reports. You may search and filter these reports.
                    </p>
                    <p className="text-base">
                        Each report has a sync status, indicating the status of its sync with the server.
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
                <CardTitle className="text-xl text-brand-primary">
                    Patrol Planner
                </CardTitle>
                <CardDescription className="text-base text-color-surface-deep">
                    Use the Plan route panel to define the patrol constraints and
                    review the suggested route.
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
                <div>
                    <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                        Route Parameters
                    </CardTitle>
                    <ul className="text-base list-disc pl-5 space-y-1">
                        <li>
                            Start and End location: Enter the coordinates, 
                            or click the location icon and click on the map to select a starting point.
                        </li>
                        <li>
                            Max Time: An optional constraint to help generate a path that will conform to the restraint.
                        </li>
                        <li>
                            Max Fuel: An optional constraint to help generate a path that will not consume more fuel than inputed.
                        </li>
                    </ul>
                    <p className="text-base space-y-2">
                        Afterwards, click the generate routes button to generate routes. 
                        If you need to, you may also click Clear routes to clear
                        the currently generated routes.
                    </p>
                </div>

                <div>
                    <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                        Suggested, and Alternate Routes
                    </CardTitle>
                    <p className="text-base space-y-2">
                        The selected route is emphasized on the map, while the alternate routes are overlayed.
                        This is done so you may compare your currently selected route to the alternatives.
                        You may change the current selected route by clicking the 'Select' button in the top right of the route's card.
                    </p>
                    <p className="text-base space-y-2">
                        The metrics for each route are as follows:
                    </p>
                    <ul className="text-base list-disc pl-5 space-y-1">
                        <li>
                            Est. Time: The estimated time it will take to complete the route.
                        </li>
                        <li>
                            Est. Fuel: The estimated fuel consumption the route will take.
                        </li>
                        <li>
                            Risk Coverage: The percentage of risk areas covered by the route.
                        </li>
                    </ul>
                </div>

                <div>
                    <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                        The Map
                    </CardTitle>
                    <ul className="text-base list-disc pl-5 space-y-1">
                        <li>
                            The Map controls are in the top right. You may also use your mouse wheel to scroll in and out to zoom in and out.
                        </li>
                        <li>
                            In the bottom right is a legend describing how the colours in the heatmap corelate to risk values.
                        </li>
                        <li>
                            Click on a cell to view information about that cell.
                        </li>
                        <li>
                            Clicking on 'View Analysis' will open a panel with more information about that cell.
                        </li>
                    </ul>
                </div>
            </CardContent>
        </Card>
    );
}

function Profile() {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-xl text-brand-primary">
                    Profile Page
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
                        <Link to="/*">User Manual</Link>
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
