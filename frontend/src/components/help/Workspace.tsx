import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

export default function Workspace() {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-xl text-brand-primary">
                    Workspace Content
                </CardTitle>
                <CardDescription className="text-base text-color-surface-deep">

                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
                <CardTitle className="text-base text-brand-primary uppercase tracking-wider">

                </CardTitle>
            </CardContent>
        </Card>
    )
}