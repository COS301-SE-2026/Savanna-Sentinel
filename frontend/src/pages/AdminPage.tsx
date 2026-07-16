import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AuthPage from "@/pages/AdminAuthAccount";
import RoleSwap from "@/components/admin/RoleSwap";

export default function AdminPage() {
    return (
        <div className="mx-auto max-w-[1120px] px-4 pt-8 pb-10 md:px-6">
            <h1 className="mb-6 font-heading text-3xl leading-[1.1] font-bold text-brand-primary">
                Admin Panel
            </h1>

            <Tabs defaultValue="accounts">
                <TabsList>
                    <TabsTrigger value="accounts">
                        Account Approvals
                    </TabsTrigger>
                    <TabsTrigger value="roles">Role Management</TabsTrigger>
                </TabsList>

                <TabsContent value="accounts" className="mt-6">
                    <AuthPage />
                </TabsContent>

                <TabsContent value="roles" className="mt-6">
                    <RoleSwap />
                </TabsContent>
            </Tabs>
        </div>
    );
}
