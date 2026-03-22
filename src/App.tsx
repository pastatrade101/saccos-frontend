import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";

import { useAuth } from "./auth/AuthProvider";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { AppLayout } from "./components/Layout";
import { AppLoader } from "./components/AppLoader";
import { LandingPage } from "./pages/LandingPage";
import { SignInPage } from "./pages/SignIn";
import { SetupTenantPage } from "./pages/SetupTenant";
import { SetupSuperAdminPage } from "./pages/SetupSuperAdmin";
import { DashboardPage } from "./pages/Dashboard";
import { AuditorDashboardPage } from "./pages/AuditorDashboard";
import { AuditorExceptionsPage } from "./pages/AuditorExceptions";
import { AuditorJournalsPage } from "./pages/AuditorJournals";
import { AuditorAuditLogsPage } from "./pages/AuditorAuditLogs";
import { AuditorReportsPage } from "./pages/AuditorReports";
import { AccessDeniedPage } from "./pages/AccessDenied";
import { PlatformPlansPage } from "./pages/PlatformPlans";
import { PlatformOperationsPage } from "./pages/PlatformOperations";
import { PlatformTenantsPage } from "./pages/PlatformTenants";
import { StaffUsersPage } from "./pages/StaffUsers";
import { MembersPage } from "./pages/Members";
import { MemberApplicationsPage } from "./pages/MemberApplications";
import { CashPage } from "./pages/Cash";
import { CashControlPage } from "./pages/CashControl";
import { ContributionsPage } from "./pages/Contributions";
import { PaymentsPage } from "./pages/Payments";
import { DividendsPage } from "./pages/Dividends";
import { FollowUpsPage } from "./pages/FollowUps";
import { ApprovalsPage } from "./pages/Approvals";
import { LoansPage } from "./pages/Loans";
import { LoanDetailPage } from "./pages/LoanDetail";
import { ProductCatalogPage } from "./pages/ProductCatalog";
import { ReportsPage } from "./pages/Reports";
import { MemberPortalPage } from "./pages/MemberPortal";
import { MemberImportPage } from "./pages/MemberImport";
import { ChangePasswordPage } from "./pages/ChangePassword";
import { ResetPasswordPage } from "./pages/ResetPassword";
import { ServiceUnavailablePage } from "./pages/ServiceUnavailable";
import { PrivacyPolicyPage, TermsAgreementPage } from "./pages/LegalPages";

function WorkspaceRedirect() {
    const { session, profile, selectedTenantId, isInternalOps, backendUnavailable } = useAuth();

    if (backendUnavailable) {
        return <Navigate to="/service-unavailable" replace />;
    }

    if (profile?.must_change_password) {
        return <Navigate to="/change-password" replace />;
    }

    if (profile?.role === "member") {
        return <Navigate to="/portal" replace />;
    }

    if (isInternalOps) {
        return <Navigate to="/dashboard" replace />;
    }

    if (!selectedTenantId) {
        return <Navigate to="/setup/tenant" replace />;
    }

    if (!profile) {
        return <Navigate to="/setup/super-admin" replace />;
    }

    if (profile.role === "auditor") {
        return <Navigate to="/dashboard" replace />;
    }

    return <Navigate to="/dashboard" replace />;
}

function DashboardEntryRoute() {
    const { profile, isInternalOps } = useAuth();

    if (profile?.role === "auditor") {
        return <AuditorDashboardPage />;
    }

    if (
        isInternalOps ||
        profile?.role === "super_admin" ||
        profile?.role === "branch_manager" ||
        profile?.role === "loan_officer" ||
        profile?.role === "teller"
    ) {
        return <DashboardPage />;
    }

    return <Navigate to="/access-denied" replace />;
}

function PublicHomePage() {
    const { session, loading } = useAuth();

    if (loading) {
        return <AppLoader message="Loading workspace..." />;
    }

    if (!session) {
        return <LandingPage />;
    }

    return <WorkspaceRedirect />;
}

function SignInRoute() {
    const { session, loading } = useAuth();

    if (session && loading) {
        return <AppLoader message="Loading workspace..." />;
    }

    if (session) {
        return <WorkspaceRedirect />;
    }

    return <SignInPage />;
}

function SetupRouteGuard({
    step,
    children
}: {
    step: "tenant" | "super-admin";
    children: ReactNode;
}) {
    const { profile, isInternalOps, selectedTenantId, backendUnavailable } = useAuth();

    if (backendUnavailable) {
        return <Navigate to="/service-unavailable" replace />;
    }

    if (profile?.role === "member") {
        return <Navigate to="/portal" replace />;
    }

    if (isInternalOps && step === "tenant") {
        return <>{children}</>;
    }

    if (isInternalOps && step === "super-admin") {
        if (!selectedTenantId) {
            return <Navigate to="/setup/tenant" replace />;
        }

        return <>{children}</>;
    }

    if (profile) {
        return <Navigate to="/dashboard" replace />;
    }

    if (step === "tenant") {
        if (!isInternalOps) {
            return <Navigate to="/" replace />;
        }

        return <>{children}</>;
    }

    if (!selectedTenantId) {
        return <Navigate to="/setup/tenant" replace />;
    }

    return <>{children}</>;
}

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<PublicHomePage />} />
            <Route path="/signin" element={<SignInRoute />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/terms-and-agreement" element={<TermsAgreementPage />} />
            <Route path="/access-denied" element={<AccessDeniedPage />} />
            <Route path="/service-unavailable" element={<ServiceUnavailablePage />} />
            <Route
                element={
                    <ProtectedRoute
                        allowedRoles={["platform_admin", "platform_owner", "super_admin", "branch_manager", "loan_officer", "teller", "auditor", "member"]}
                    />
                }
            >
                <Route path="/change-password" element={<ChangePasswordPage />} />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={["member"]} />}>
                <Route path="/portal" element={<MemberPortalPage />} />
            </Route>

            <Route element={<ProtectedRoute allowWithoutProfile />}>
                    <Route element={<AppLayout />}>
                        <Route path="/setup/tenant" element={<SetupRouteGuard step="tenant"><SetupTenantPage /></SetupRouteGuard>} />
                        <Route path="/setup/super-admin" element={<SetupRouteGuard step="super-admin"><SetupSuperAdminPage /></SetupRouteGuard>} />
                    <Route
                        element={
                            <ProtectedRoute
                                allowedRoles={["platform_admin", "platform_owner", "super_admin", "branch_manager", "loan_officer", "teller", "auditor"]}
                            />
                        }
                    >
                        <Route path="/dashboard" element={<DashboardEntryRoute />} />
                    </Route>
                    <Route
                        element={
                            <ProtectedRoute allowedRoles={["auditor"]} allowInternalOps={false} />
                        }
                    >
                        <Route path="/auditor/exceptions" element={<AuditorExceptionsPage />} />
                        <Route path="/auditor/journals" element={<AuditorJournalsPage />} />
                        <Route path="/auditor/journals/:id" element={<AuditorJournalsPage />} />
                        <Route path="/auditor/audit-logs" element={<AuditorAuditLogsPage />} />
                        <Route path="/auditor/reports" element={<AuditorReportsPage />} />
                    </Route>
                    <Route
                        element={
                            <ProtectedRoute
                                allowedRoles={["super_admin", "branch_manager", "loan_officer", "teller"]}
                            />
                        }
                    >
                        <Route path="/follow-ups" element={<FollowUpsPage />} />
                        <Route path="/approvals" element={<ApprovalsPage />} />
                    </Route>
                    <Route
                        element={
                            <ProtectedRoute allowedRoles={["platform_admin", "platform_owner"]} />
                        }
                    >
                        <Route path="/platform/tenants" element={<PlatformTenantsPage />} />
                        <Route path="/platform/plans" element={<PlatformPlansPage />} />
                        <Route path="/platform/operations" element={<PlatformOperationsPage />} />
                    </Route>
                    <Route
                        element={
                            <ProtectedRoute allowedRoles={["super_admin", "branch_manager"]} allowInternalOps={false} />
                        }
                    >
                        <Route path="/staff-users" element={<StaffUsersPage />} />
                    </Route>
                    <Route
                        element={
                            <ProtectedRoute allowedRoles={["branch_manager"]} allowInternalOps={false} />
                        }
                    >
                        <Route path="/products" element={<ProductCatalogPage />} />
                    </Route>
                    <Route
                        element={
                            <ProtectedRoute
                                allowedRoles={["super_admin", "branch_manager", "teller"]}
                                allowInternalOps={false}
                            />
                        }
                    >
                        <Route path="/members" element={<MembersPage />} />
                    </Route>
                    <Route
                        element={
                            <ProtectedRoute
                                allowedRoles={["super_admin", "branch_manager", "auditor"]}
                                allowInternalOps={false}
                            />
                        }
                    >
                        <Route path="/member-applications" element={<MemberApplicationsPage />} />
                    </Route>
                    <Route
                        element={
                            <ProtectedRoute
                                allowedRoles={["branch_manager"]}
                                allowInternalOps={false}
                            />
                        }
                    >
                        <Route path="/members/import" element={<MemberImportPage />} />
                    </Route>
                    <Route
                        element={
                            <ProtectedRoute allowedRoles={["branch_manager"]} allowInternalOps={false} />
                        }
                    >
                        <Route path="/contributions" element={<ContributionsPage />} />
                        <Route path="/payments" element={<PaymentsPage />} />
                    </Route>
                    <Route
                        element={
                            <ProtectedRoute allowedRoles={["super_admin", "branch_manager"]} allowInternalOps={false} />
                        }
                    >
                        <Route path="/dividends" element={<DividendsPage />} />
                    </Route>
                    <Route
                        element={
                            <ProtectedRoute allowedRoles={["teller"]} allowInternalOps={false} />
                        }
                    >
                        <Route path="/cash" element={<CashPage />} />
                    </Route>
                    <Route
                        element={
                            <ProtectedRoute allowedRoles={["branch_manager"]} allowInternalOps={false} />
                        }
                    >
                        <Route path="/cash-control" element={<CashControlPage />} />
                    </Route>
                    <Route
                        element={
                            <ProtectedRoute allowedRoles={["branch_manager", "loan_officer", "teller"]} allowInternalOps={false} />
                        }
                    >
                        <Route path="/loans" element={<LoansPage />} />
                        <Route path="/loans/:loanId" element={<LoanDetailPage />} />
                    </Route>
                    <Route
                        element={
                            <ProtectedRoute
                                allowedRoles={["super_admin", "branch_manager", "loan_officer"]}
                                allowInternalOps={false}
                            />
                        }
                    >
                        <Route path="/reports" element={<ReportsPage />} />
                    </Route>
                </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
