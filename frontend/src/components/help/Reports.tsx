import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

export default function Reports() {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-xl text-brand-primary">
                    Field Reports
                </CardTitle>
                <CardDescription className="text-base text-color-surface-deep">
                    Use this page to view submitted reports, create a new report
                    or draft and edit reports.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 text-base">
                <div>
                    <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                        New Report Tab
                    </CardTitle>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>
                            Select the report type as either an incident or a
                            sighting.
                        </li>
                        <li>Add a description to your report.</li>
                        <li>
                            Incident Report: Select the incident type and
                            indicate the severity of it.
                        </li>
                        <li>
                            Sighting Report: Select the species and how many
                            were involved in the report.
                        </li>
                        <li>Enter the date when the event happened.</li>
                        <li>
                            You can either manually enter the coordinates where
                            the event happened or click the 'Use current
                            location' button to automatically use you current
                            location.
                        </li>
                        <li>
                            You may optionally upload photos with the report.
                        </li>
                        <p className="text-base">
                            Afterwards you may Submit the report. Then you may
                            use the pagination at the top to see your submitted
                            reports to either edit, draft or delete that
                            previous report.
                        </p>
                    </ul>
                </div>

                <div>
                    <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                        All Reports Tab
                    </CardTitle>
                    <p className="text-base">
                        Shows a table showing all the submitted reports. You may
                        search and filter these reports.
                    </p>
                    <p className="text-base">
                        Each report has a sync status, indicating the status of
                        its sync with the server.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}