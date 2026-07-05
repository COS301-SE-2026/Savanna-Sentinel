import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AuthPage from "@/pages/AdminAuthAccount";
import RoleSwap from "@/components/admin/RoleSwap";

export default function AdminPage() {
    return (
        <div className="max-w-7xl mx-auto p-6 md:p-10 space-y-6">
            <h1 className="text-2xl font-bold tracking-tight text-primary">
                Admin Panel
            </h1>

            <Tabs defaultValue="accounts">
                <TabsList className="bg-muted">
                    <TabsTrigger
                        value="accounts"
                        className="data-[state=active]:bg-brand-dark-blue data-[state=active]:text-white"
                    >
                        Account Approvals
                    </TabsTrigger>
                    <TabsTrigger
                        value="roles"
                        className="data-[state=active]:bg-brand-dark-blue data-[state=active]:text-white"
                    >
                        Role Management
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="accounts">
                    <AuthPage />
                </TabsContent>

                <TabsContent value="roles">
                    <RoleSwap />
                </TabsContent>
            </Tabs>
        </div>
    );
}
