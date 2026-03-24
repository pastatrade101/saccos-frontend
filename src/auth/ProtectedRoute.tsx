import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "./AuthContext";
import type { Role } from "../types/api";
import { AppLoader } from "../components/AppLoader";

interface ProtectedRouteProps {
    allowedRoles?: Role[];
    allowWithoutProfile?: boolean;
    allowInternalOps?: boolean;
}

export function ProtectedRoute({
    allowedRoles,
    allowWithoutProfile = false,
    allowInternalOps = true
}: ProtectedRouteProps) {
    const { loading, session, profile, isInternalOps, backendUnavailable } = useAuth();
    const location = useLocation();

    if (loading) {
        return <AppLoader message="Loading session..." />;
    }

    if (!session) {
        return <Navigate to="/signin" replace state={{ from: location }} />;
    }

    if (backendUnavailable && location.pathname !== "/service-unavailable") {
        return <Navigate to="/service-unavailable" replace />;
    }

    if (profile?.must_change_password && location.pathname !== "/change-password") {
        return <Navigate to="/change-password" replace />;
    }

    if (!profile && !isInternalOps && !allowWithoutProfile) {
        return <Navigate to="/setup/super-admin" replace />;
    }

    if (isInternalOps && !allowInternalOps) {
        return <Navigate to="/access-denied" replace />;
    }

    if (isInternalOps && allowInternalOps) {
        return <Outlet />;
    }

    if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
        return <Navigate to="/access-denied" replace />;
    }

    return <Outlet />;
}
