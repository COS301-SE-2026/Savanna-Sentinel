import {
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
} from "@/components/ui/tabs";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Link } from "react-router-dom";

// Quick access to VALUABLE RESOURCES such as help center links, tutorials and FAQs

// CHECKLIST
// [] Link to user manual

function Faq() {
    return (
        <Card>

        </Card>
    );
}

function Reports() {
    return(
        <Card>
            <CardContent className="text-base">
                <p>You may click the new report button to file a new field report</p>
            </CardContent>

            <CardContent className="text-base">
                <p>.. Explaination of the field report needed??</p>
            </CardContent>

            <CardContent className="text-base">
                <p>You may search and filter different reports</p>
            </CardContent>
        </Card>
    )
}

function Patrol() {
    return(
        <Card>
            <CardContent>
                <CardTitle className="text-lg text-brand-primary">Route Parameters</CardTitle>
                <ul className="text-base">
                    <li>Start location: Set the start location for the patrol route</li>
                    <li>Patrol duration: Set how long you would like your patrol to roughly take in hours</li>
                    <li>Priority: Select what options the algorithm should prioritize when generating the route. are these self explainitory??</li>
                    <li>Suggested route: Give the stats of the generated route</li>
                </ul>
            </CardContent>
        </Card>
    );
}

function Profile() {
    return(
        <Card>
            <CardContent>
                 <CardTitle className="text-lg text-brand-primary">Profile details</CardTitle>
                 <p className="text-base">You may change your first and/or last name</p>
            </CardContent>

            <CardContent>
                <CardTitle className="text-lg text-brand-primary">Changing your password</CardTitle>
                <ul className="text-base">
                    <li>You need to enter your current password</li>
                    <li>You must follow the onscreen suggestion to create your new password (must be 8 characters long)</li>
                    <li>You must confirm your password by re-entering your new password</li>
                    <li>The Confirmed and new password fields must match.</li>
                    <li>The new password cannot be the same as the old password.</li>
                </ul>
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
                    <TabsTrigger className="text-lg" value="faq">FAQ</TabsTrigger>
                    <TabsTrigger className="text-lg" value="reports">Reports</TabsTrigger>
                    <TabsTrigger className="text-lg" value="patrol">Patrol Planner</TabsTrigger>
                    <TabsTrigger className="text-lg" value="profile">User Profile</TabsTrigger>
                    <TabsTrigger className="text-lg" value="link"><Link to="/">User Manual</Link></TabsTrigger>
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