import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

export default function Profile() {
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