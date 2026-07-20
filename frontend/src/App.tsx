import { BrowserRouter, Routes, Route } from "react-router-dom";

import { Toaster } from "@/components/ui/sonner";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";

import DashboardPage from "@/pages/DashboardPage";
import MapPage from "@/pages/MapPage";
import ReportsPage from "@/pages/ReportsPage";
import PatrolPlannerPage from "@/pages/PatrolPlannerPage";
import IngestionPage from "@/pages/IngestionPage";
import TipoffPage from "@/pages/TipoffPage";
import AdminPage from "@/pages/AdminPage";
import ProfilePage from "@/pages/ProfilePage";
import NotFoundPage from "@/pages/NotFoundPage";
import HelpPage from "@/pages/HelpPage";

const App = () => {
    return (
        <BrowserRouter>
            <Toaster />
            <Routes>
                {/* Public routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />

                {/* Protected routes - AppLayout renders TopBar + BurgerMenu for all children */}
                <Route element={<ProtectedRoute />}>
                    <Route element={<AppLayout />}>
                        <Route path="/dashboard" element={<DashboardPage />} />
                        <Route path="/admin" element={<AdminPage />} />
                        <Route path="/map" element={<MapPage />} />
                        <Route path="/reports" element={<ReportsPage />} />
                        <Route path="/patrol" element={<PatrolPlannerPage />} />
                        <Route path="/ingestion" element={<IngestionPage />} />
                        <Route path="/tipoffs" element={<TipoffPage />} />
                        <Route path="/profile" element={<ProfilePage />} />
                        <Route path="/help" element={<HelpPage />} />
                    </Route>
                </Route>

                {/* authed users see 404, non logged in are redirected to login page */}
                <Route element={<ProtectedRoute />}>
                    <Route path="*" element={<NotFoundPage />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
};

export default App;
