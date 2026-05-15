import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "@/pages/LoginPage";
import AuthPage from "@/pages/AdminAuthAccount";
import ProtectedRoute from "@/components/layout/ProtectedRoute";

// Uncomment as other pages are built by the team:
// import RegisterPage from "@/pages/RegisterPage";
// import DashboardPage from "@/pages/DashboardPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        
        {/* Temporarily public so testing can performed, will make protected with admin access late */}
        <Route path="/admin/auth" element={<AuthPage />} />
        {/* <Route path="/register" element={<RegisterPage />} /> */}

        {/* Protected routes (access token required) */}
        <Route element={<ProtectedRoute />}>
          {/* <Route path="/dashboard" element={<DashboardPage />} /> */}
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />

      </Routes>
    </BrowserRouter>
  );
}