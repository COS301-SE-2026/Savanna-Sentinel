import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuthStore } from "@/store/authStore";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Admin from "@/components/help/Admin";
import Dashboard from "@/components/help/Dashboard";
import Heatmap from "@/components/help/Heatmap";
import Ingestion from "@/components/help/Ingestion";
import TipOffs from "@/components/help/TipOffs";
import Workspace from "@/components/help/Workspace";
import Reports from "@/components/help/Reports"
import Profile from "@/components/help/Profile";
import Patrol from "@/components/help/PatrolPlanner";

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

export default function HelpPage() {
    const user = useAuthStore((s) => s.user);
    const canViewAll = user?.role === "admin"
    const canViewRanger = user?.role === "ranger" || canViewAll;
    const canViewAnalyst = user?.role === "analyst" || canViewAll;
    const canViewStaffOnly = canViewAnalyst || canViewRanger || canViewAll;
    
    return (
        <div className="mx-auto max-w-[1120px] px-4 pt-8 pb-10 md:px-6">
            <Tabs defaultValue="faq">
                <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
                    <TabsList className="bg-(--color-color-surface-raised)">
                        <TabsTrigger className="text-sm" value="faq">
                            FAQ
                        </TabsTrigger>
                        <TabsTrigger className="text-sm" value="profile">
                            User Profile
                        </TabsTrigger>
                        <TabsTrigger className="text-sm" value="tipOffs">
                            Tip Offs
                        </TabsTrigger>
                        
                        {
                            canViewStaffOnly && (
                            <>
                                <TabsTrigger className="text-sm" value="dashboard">
                                    Dashboard
                                </TabsTrigger>
                                <TabsTrigger className="text-sm" value="reports">
                                    Reports
                                </TabsTrigger>
                                <TabsTrigger className="text-sm" value="heatmap">
                                    Heatmap
                                </TabsTrigger>
                            </>
                            )
                        }

                        {
                            canViewRanger && (
                                <TabsTrigger className="text-sm" value="patrol">
                                    Patrol Planner
                                </TabsTrigger>
                            )
                        }

                        {
                            canViewAnalyst && (
                            <>
                                <TabsTrigger className="text-sm" value="ingestion">
                                    Ingestion
                                </TabsTrigger>
                                <TabsTrigger className="text-sm" value="workspace">
                                    Workspace
                                </TabsTrigger>
                            </>
                            )
                        }

                        {
                            canViewAll && (
                                <TabsTrigger className="text-sm" value="admin">
                                    Admin Page
                                </TabsTrigger>
                            )
                        }

                        <TabsTrigger className="text-sm" value="download">
                            User Manual
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="faq">
                    <Faq />
                </TabsContent>

                <TabsContent value="profile">
                    <Profile />
                </TabsContent>

                <TabsContent value="tipOffs">
                    <TipOffs />
                </TabsContent>

                <TabsContent value="dashboard">
                    <Dashboard />
                </TabsContent>

                <TabsContent value="reports">
                    <Reports />
                </TabsContent>

                <TabsContent value="heatmap">
                    <Heatmap />
                </TabsContent>

                <TabsContent value="patrol">
                    <Patrol />
                </TabsContent>

                <TabsContent value="ingestion">
                    <Ingestion />
                </TabsContent>

                <TabsContent value="workspace">
                    <Workspace />
                </TabsContent>

                <TabsContent value="admin">
                    <Admin />
                </TabsContent>

                <TabsContent value="download">
                    <Card>
                        <CardContent>
                            <Button asChild>
                                <a
                                    href="https://github.com/COS301-SE-2026/Savanna-Sentinel/blob/main/docs/demo2/PDF/User%20Manual.pdf?raw=true"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download
                                >
                                    Click to Download the User Manual
                                </a>
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
