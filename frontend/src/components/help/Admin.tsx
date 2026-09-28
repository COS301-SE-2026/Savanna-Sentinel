import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

export default function Admin() {
    return (
        <div className="space-y-5">
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl text-brand-primary">
                        Admin Panel
                    </CardTitle>
                    <CardDescription className="text-base text-color-surface-deep">
                        Administrators can approve registrations, manage active
                        accounts, and review or export audit records here.
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-5 text-base">
                    <div>
                        <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                            Account approvals
                        </CardTitle>
                        <p>
                            Open <strong>Account Approvals</strong> to review
                            pending registrations. Select <strong>Accept</strong>
                            to activate an account or <strong>Reject</strong> to
                            remove the pending registration. Confirm the action
                            when prompted.
                        </p>
                    </div>

                    <div>
                        <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                            Role management
                        </CardTitle>
                        <p>
                            Open <strong>Role Management</strong> to find an
                            active user. Search, filter, sort, or page through
                            the list, then choose a new role for that user and
                            confirm the change.
                        </p>
                    </div>

                    <div>
                        <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                            Deleting accounts
                        </CardTitle>
                        <p>
                            Open <strong>Delete Accounts</strong> to find an
                            active non-admin account. Select <strong>Delete</strong>
                            and confirm to remove it. This action cannot be
                            undone.
                        </p>
                    </div>

                    <div>
                        <CardTitle className="text-base text-brand-primary uppercase tracking-wider">
                            Audit log
                        </CardTitle>
                        <p>
                            Open <strong>Audit Log</strong> to review recorded
                            actions, including the actor, target, details, and
                            time. Select <strong>Export CSV</strong> and confirm
                            to download the audit records as a CSV file. Use the
                            pagination controls to view other pages.
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Button asChild>
                <Link to="/admin">Open the Admin Panel</Link>
            </Button>
        </div>
    );
}
