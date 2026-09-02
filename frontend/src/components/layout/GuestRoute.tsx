import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { homePathForRole } from "@/lib/utils";

export default function GuestRoute() {
    const accessToken = useAuthStore((s) => s.accessToken);
    const user = useAuthStore((s) => s.user);

    if (accessToken) {
        return <Navigate to={homePathForRole(user?.role)} replace />;
    }

    return <Outlet />;
}
