import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AuthPage from "@/pages/AdminAuthAccount";
import RoleSwap from "@/components/admin/RoleSwap";
import DeleteAccounts from "@/components/admin/DeleteAccounts";
import AuditLog from "@/components/admin/AuditLog";
import DemoReset from "@/components/admin/DemoReset";
import KlaserieWorkspace from "@/components/admin/KlaserieWorkspace";
import { useAuthStore } from "@/store/authStore";

// Mirrors DEMO_ADMIN_USERNAME in the backend demo service.
const DEMO_ADMIN_USERNAME = "admin1";

export default function AdminPage() {
    const isDemoAdmin = useAuthStore(
        (s) => s.user?.username === DEMO_ADMIN_USERNAME,
    );

    return (
        <div className="mx-auto max-w-[1120px] px-4 pt-8 pb-10 md:px-6">
            <h1 className="mb-6 font-heading text-3xl leading-[1.1] font-bold text-brand-primary">
                Admin Panel
            </h1>

            <Tabs defaultValue="accounts">
                <TabsList className="max-w-full flex-wrap">
                    <TabsTrigger value="accounts">
                        Account Approvals
                    </TabsTrigger>
                    <TabsTrigger value="roles">Role Management</TabsTrigger>
                    <TabsTrigger value="delete">Delete Accounts</TabsTrigger>
                    <TabsTrigger value="audit">Audit Log</TabsTrigger>
                    {isDemoAdmin && (
                        <TabsTrigger value="demo">Demo</TabsTrigger>
                    )}
                </TabsList>

                <TabsContent value="accounts" className="mt-6">
                    <AuthPage />
                </TabsContent>

                <TabsContent value="roles" className="mt-6">
                    <RoleSwap />
                </TabsContent>

                <TabsContent value="delete" className="mt-6">
                    <DeleteAccounts />
                </TabsContent>

                <TabsContent value="audit" className="mt-6">
                    <AuditLog />
                </TabsContent>

                {isDemoAdmin && (
                    <TabsContent value="demo" className="mt-6 space-y-4">
                        <div className="font-heading text-2xl leading-[1.15] font-bold text-brand-primary">
                            Demo
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <DemoReset />
                            <KlaserieWorkspace />
                        </div>
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}
