import { Outlet } from "react-router-dom";
import { useNotificationsPoll } from "@/hooks/useNotificationsPoll";
import TopBar from "./TopBar";

export default function AppLayout() {
    useNotificationsPoll();

    return (
        <div className="min-h-screen bg-background">
            <TopBar />
            <main className="pt-14">
                <Outlet />
            </main>
        </div>
    );
}
