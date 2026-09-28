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
import Heatmap from "@/components/help/Heatmap";
import Workspace from "@/components/help/Workspace";
import Reports from "@/components/help/Reports"
import Profile from "@/components/help/Profile";
import Patrol from "@/components/help/PatrolPlanner";

interface FaqProps {
    canViewStaff: boolean;
    canViewAnalyst: boolean;
    canViewRanger: boolean;
}

function Faq({ canViewStaff, canViewAnalyst, canViewRanger }: FaqProps) {
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

                {canViewRanger &&
                     <div>
                        <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                            How do I plan a patrol?
                        </CardTitle>
                        <p>
                            Open Patrol Planner, set the start location, duration,
                            and priority, then select Generate Route.
                        </p>
                    </div>
                }

                <div>
                    <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                        How do I update my profile?
                    </CardTitle>
                    <p>
                        Open User Profile to change your first name, last name,
                        or password.
                    </p>
                </div>

                <div>
                    <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                        How do I submit a tip-off?
                    </CardTitle>
                    <p>
                        Open Tip-offs, choose a report type, add its details, date, and location,
                        then submit it. You can add photos as well. A location
                        is required; select a point on the map or use your
                        current location.
                    </p>
                </div>

                {canViewStaff && (
                    <>
                        <div>
                            <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                                What can I find on the dashboard?
                            </CardTitle>
                            <p>
                                Open the Dashboard to review reserve statistics, recent field reports,
                                risk zones, report trends, and model performance.
                                The dashboard refreshes its data periodically.
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
                    </>
                )}

                {canViewAnalyst && (
                    <div>
                        <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                            How do I upload data for ingestion?
                        </CardTitle>
                        <p>
                            Open Ingestion and choose a CSV file that matches the required
                            format. Review the parsed rows, correct any
                            validation errors, then submit and confirm the
                            upload.
                        </p>
                    </div>
                )}

                <div className="rounded-lg border border-brand-steel bg-color-surface-bg p-5 md:flex md:items-center md:justify-between md:gap-6">
                    <div className="space-y-1">
                        <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                            Still stuck?
                        </CardTitle>
                        <p className="text-color-text-primary">
                            Try reading the User Manual for more guidance.
                        </p>
                    </div>
                    <Button asChild className="mt-4 shrink-0 md:mt-0">
                        <a
                            href="https://github.com/COS301-SE-2026/Savanna-Sentinel/blob/main/docs/demo4/PDF/User%20Manual.pdf?raw=true"
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                        >
                            Download the User Manual
                        </a>
                    </Button>
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
                        
                        {
                            canViewStaffOnly && (
                            <>
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
                    </TabsList>
                </div>

                <TabsContent value="faq">
                    <Faq
                        canViewStaff={canViewStaffOnly}
                        canViewAnalyst={canViewAnalyst}
                        canViewRanger={canViewRanger}
                    />
                </TabsContent>

                <TabsContent value="profile">
                    <Profile />
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

                <TabsContent value="workspace">
                    <Workspace />
                </TabsContent>

                <TabsContent value="admin">
                    <Admin />
                </TabsContent>
            </Tabs>
        </div>
    );
}
