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

// idk if i should even have this here??
function Dashboard() {
    return (
        <Card>
            <CardContent>
                <p className="text-base">The dashboard</p>
            </CardContent>
        </Card>
    );
}

// Do i need to explain the map and the controls? if so i just need to know the controls
function Map() {
    return(
        <Card>
            <CardContent>
                <CardTitle className="text-lg text-brand-primary">Time Range Slider</CardTitle>
                <ul className="text-base">
                    <li>You may drag the slider to increase or decrease the view date</li>
                    <li>The time range slider allows one to see the risk map at past time intervals</li>
                </ul>
            </CardContent>
                
            <CardContent>
                <CardTitle className="text-lg text-brand-primary">Layers</CardTitle>
                <ul className="text-base">
                    <li>You can select and deselect multiple options</li>
                    <li>Risk Heatmap: toggles the risk heatmap overlay</li>
                    <li>Patrol Routes: toggles the patrol routes overlay</li>
                    <li>Incidents: toggles the location of incident reports overlay</li>
                    <li>Water sources??: toggles the location of water sources overlay</li>
                    <li>Fence lines??: toggles the ...?</li>
                </ul>
            </CardContent>

            <CardContent>
                <CardTitle className="text-lg text-brand-primary">Summary</CardTitle>
                <ul className="text-base">
                    <li>Critical cells: Indicates the number of cells marked as high-risk and high-alert</li>
                    <li>High-risk cells: Indicates the number of cells marked as being high-risk areas</li>
                    <li>Incidents(30d): Indicates the number of incidents reported within the past 30 days</li>
                    <li>Last updated: Indicates when the date when last the risk heat map was updated</li>
                </ul>
            </CardContent>

            <CardContent>
                <CardTitle className="text-lg text-brand-primary">Risk Level</CardTitle>
                <p className="text-base">Indicates the colour mapping legend for different risk zone cells</p>
            </CardContent>

            <CardContent>
                <CardTitle className="text-lg text-brand-primary">Model</CardTitle>
                <ul className="text-base">
                    <li>Explains AI model was used to produce the heatmap</li>
                    <li>F1score: ..?</li>
                    <li>Cells: Indicates the amount of cells being evaluted/used</li>
                </ul>
            </CardContent>
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
                    <TabsTrigger className="text-xl" value="faq">FAQ</TabsTrigger>
                    <TabsTrigger className="text-xl" value="dashboard">Dashboard</TabsTrigger>
                    <TabsTrigger className="text-xl" value="map">Map</TabsTrigger>
                    <TabsTrigger className="text-xl" value="reports">Reports</TabsTrigger>
                    <TabsTrigger className="text-xl" value="patrol">Patrol Planner</TabsTrigger>
                    <TabsTrigger className="text-xl" value="profile">User Profile</TabsTrigger>
                    <TabsTrigger className="text-xl" value="link"><Link to="/">User Manual</Link></TabsTrigger>
                </TabsList>

                <TabsContent value="faq">
                    <Faq />
                </TabsContent>

                <TabsContent value="dashboard">
                    <Dashboard />
                </TabsContent>

                <TabsContent value="map">
                    <Map />
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