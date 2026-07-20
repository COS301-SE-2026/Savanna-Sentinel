import {
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
    tabsListVariants
} from "@/components/ui/tabs"

// Quick access to VALUABLE RESOURCES such as help center links, tutorials and FAQs

// CHECKLIST
// [] FAQ (first or nah?)
// [] Dashboard
// [] Map
// [] Reports
// [] Patrol Planner
// [] Profile
// [] Link to user manual

// Only bullet points, need to still read tone of brand style guide

/* Dashboard

*/

/* Map
    - Time range slider
        > You may drag the slider to increase or decrease the view date
        > The time range slider allows one to see the risk map at past time intervals

    - Layers
        > You can select and deselect multiple options
        > Risk Heatmap: toggles the risk heatmap overlay
        > Patrol Routes: toggles the patrol routes overlay
        > Incidents: toggles the location of incident reports overlay
        > Water sources??: toggles the location of water sources overlay
        > Fence lines??: toggles the ...?

    - Summary
        > Critical cells: Indicates the number of cells marked as high-risk and high-alert
        > High-risk cells: Indicates the number of cells marked as being high-risk areas
        > Incidents(30d): Indicates the number of incidents reported within the past 30 days
        > Last updated: Indicates when the date when last the risk heat map was updated

    - Risk level
        > Indicates the colour mapping legend for different risk zone cells

    - Model
        > Explains AI model was used to produce the heatmap
        > F1score: ..?
        > Cells: Indicates the amount of cells being evaluted/used

    * Do i need to explain the map and the controls? if so i just need to know the controls
    
*/

/* Reports
    You may click the new report button to file a new field report

    - .. Explaination of the field report needed??

    - You may search and filter different reports
*/

/* Patrol
    - Route Parameters
        > Start location: Set the start location for the patrol route
        > Patrol duration: Set how long you would like your patrol to roughly take in hours
        > Priority: Select what options the algorithm should prioritize when generating the route. are these self explainitory??
        > Suggested route: Give the stats of the generated route
*/

/* Profile
    - Profile details
        > You may change your first and/or last name
    
    - Change Password
        > You need to enter your current password
        > You must follow the onscreen suggestion to create your new password (must be 8 characters long)
        > You must confirm your password by re-entering your new password
        > The Confirmed and new password fields must match.
        > The new password cannot be the same as the old password.
*/

export default function HelpPage() {
    return (
        <>
            <Tabs >
                <TabsList>
                    <TabsTrigger value="placeholder1">placeholder one</TabsTrigger>
                    <TabsTrigger value="placeholder2">placeholder two</TabsTrigger>
                </TabsList>

                <TabsContent value="placeholder1">
                    <p>this is a placeholder</p>
                </TabsContent>
                <TabsContent value="placeholder2">
                    <p>this is also a placeholder</p>
                </TabsContent>
            </Tabs>
        </>
    )
}