import {
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
} from "@/components/ui/tabs"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"

// Quick access to VALUABLE RESOURCES such as help center links, tutorials and FAQs

// CHECKLIST
// [] Link to user manual

function Faq() {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Placeholder</CardTitle>
                <CardDescription className="text-base">Placerholder</CardDescription>
            </CardHeader>
        </Card>
    )
}

function Dashboard() {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Placeholder</CardTitle>
            </CardHeader>
        </Card>
    )
}

// Do i need to explain the map and the controls? if so i just need to know the controls
function Map() {
    return(
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Time Range Slider</CardTitle>
                <CardDescription className="text-base">
                    <ul>
                        <li>You may drag the slider to increase or decrease the view date</li>
                        <li>The time range slider allows one to see the risk map at past time intervals</li>
                    </ul>
                </CardDescription>


                <CardTitle className="text-lg">Layers</CardTitle>
                <CardDescription className="text-base">
                    <ul>
                        <li>You can select and deselect multiple options</li>
                        <li>Risk Heatmap: toggles the risk heatmap overlay</li>
                        <li>Patrol Routes: toggles the patrol routes overlay</li>
                        <li>Incidents: toggles the location of incident reports overlay</li>
                        <li>Water sources??: toggles the location of water sources overlay</li>
                        <li>Fence lines??: toggles the ...?</li>
                    </ul>
                </CardDescription>


                <CardTitle className="text-lg">Summary</CardTitle>
                <CardDescription className="text-base">
                    <ul>
                        <li>Critical cells: Indicates the number of cells marked as high-risk and high-alert</li>
                        <li>High-risk cells: Indicates the number of cells marked as being high-risk areas</li>
                        <li>Incidents(30d): Indicates the number of incidents reported within the past 30 days</li>
                        <li>Last updated: Indicates when the date when last the risk heat map was updated</li>
                    </ul>
                </CardDescription>


                <CardTitle className="text-lg">Risk Level</CardTitle>
                <CardDescription className="text-base">
                    <p>Indicates the colour mapping legend for different risk zone cells</p>
                </CardDescription>


                <CardTitle className="text-lg">Model</CardTitle>
                <CardDescription className="text-base">
                    <ul>
                        <li>Explains AI model was used to produce the heatmap</li>
                        <li>F1score: ..?</li>
                        <li>Cells: Indicates the amount of cells being evaluted/used</li>
                    </ul>
                </CardDescription>
            </CardHeader>
        </Card>
    )
}

function Reports() {
    return(
        <Card>
            <CardHeader>
                <CardDescription className="text-base">
                    <p>You may click the new report button to file a new field report</p>
                </CardDescription>
                <CardDescription className="text-base">
                    <p>.. Explaination of the field report needed??</p>
                </CardDescription>
                <CardDescription className="text-base">
                    <p>You may search and filter different reports</p>
                </CardDescription>
            </CardHeader>
        </Card>
    )
}

function Patrol() {
    return(
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Route Parameters</CardTitle>
                <CardDescription className="text-base">
                    <ul>
                        <li>Start location: Set the start location for the patrol route</li>
                        <li>Patrol duration: Set how long you would like your patrol to roughly take in hours</li>
                        <li>Priority: Select what options the algorithm should prioritize when generating the route. are these self explainitory??</li>
                        <li>Suggested route: Give the stats of the generated route</li>
                    </ul>
                </CardDescription>
            </CardHeader>
        </Card>
    )
}

function Profile() {
    return(
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Profile details</CardTitle>
                <CardDescription className="text-base">
                    <p>You may change your first and/or last name</p>
                </CardDescription>

                <CardTitle className="text-lg">Changing your password</CardTitle>
                <CardDescription className="text-base">
                    <ul>
                        <li>You need to enter your current password</li>
                        <li>You must follow the onscreen suggestion to create your new password (must be 8 characters long)</li>
                        <li>You must confirm your password by re-entering your new password</li>
                        <li>The Confirmed and new password fields must match.</li>
                        <li>The new password cannot be the same as the old password.</li>
                    </ul>
                </CardDescription>
            </CardHeader>
        </Card>
    )
}

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
    )
}