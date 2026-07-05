import { Outlet } from "react-router-dom";
import TopBar from "./TopBar";

export default function AppLayout() {
    return (
        <div className="min-h-screen bg-background">
            <TopBar />
            <main className="pt-14">
                <Outlet />
            </main>
        </div>
    );
}
