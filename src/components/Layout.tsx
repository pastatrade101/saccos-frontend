import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import AccountBalanceRoundedIcon from "@mui/icons-material/AccountBalanceRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import EventRepeatRoundedIcon from "@mui/icons-material/EventRepeatRounded";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import GppGoodRoundedIcon from "@mui/icons-material/GppGoodRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import MonitorHeartRoundedIcon from "@mui/icons-material/MonitorHeartRounded";
import PaidRoundedIcon from "@mui/icons-material/PaidRounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import PieChartRoundedIcon from "@mui/icons-material/PieChartRounded";
import PolicyRoundedIcon from "@mui/icons-material/PolicyRounded";
import SavingsRoundedIcon from "@mui/icons-material/SavingsRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import StoreRoundedIcon from "@mui/icons-material/StoreRounded";
import SummarizeRoundedIcon from "@mui/icons-material/SummarizeRounded";
import PendingActionsRoundedIcon from "@mui/icons-material/PendingActionsRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import RuleFolderRoundedIcon from "@mui/icons-material/RuleFolderRounded";
import {
    Autocomplete,
    AppBar,
    Avatar,
    Box,
    Chip,
    Collapse,
    Drawer,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    IconButton,
    InputAdornment,
    List,
    ListItemButton,
    OutlinedInput,
    Paper,
    Stack,
    TextField,
    Toolbar,
    Typography,
    useTheme
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useEffect, useMemo, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { NotificationBell } from "./notifications/NotificationBell";
import { useUI } from "../ui/UIProvider";
import { brandColors, darkThemeColors } from "../theme/colors";
import { formatPlatformRole, formatRole } from "../utils/format";

interface NavItem {
    to: string;
    label: string;
    roles?: string[];
    allowSetup?: boolean;
    section: "setup" | "workspace" | "finance";
    icon: typeof DashboardRoundedIcon;
}

interface SearchOption {
    label: string;
    to: string;
    helper: string;
    keywords: string[];
}

interface NavGroup {
    key: "workspace" | "products" | "finance" | "operations" | "analytics" | "setup" | "treasury";
    label: string;
    itemTos: string[];
}

const drawerWidth = 280;

const navItems: NavItem[] = [
    { to: "/setup/super-admin", label: "Super Admin", allowSetup: true, section: "setup", icon: SettingsRoundedIcon },
    { to: "/dashboard", label: "Dashboard", roles: ["super_admin", "branch_manager", "treasury_officer", "loan_officer", "teller"], section: "workspace", icon: DashboardRoundedIcon },
    { to: "/dashboard", label: "Auditor Dashboard", roles: ["auditor"], section: "workspace", icon: GppGoodRoundedIcon },
    { to: "/staff-users", label: "Team Access", roles: ["super_admin", "branch_manager"], section: "workspace", icon: PeopleAltRoundedIcon },
    { to: "/products", label: "Products", roles: ["branch_manager"], section: "workspace", icon: TuneRoundedIcon },
    { to: "/member-applications", label: "Applications", roles: ["super_admin", "branch_manager", "auditor"], section: "workspace", icon: DescriptionRoundedIcon },
    { to: "/members", label: "Members", roles: ["super_admin", "branch_manager", "teller"], section: "workspace", icon: GroupRoundedIcon },
    { to: "/members/import", label: "Member Import", roles: ["branch_manager"], section: "workspace", icon: StoreRoundedIcon },
    { to: "/auditor/workbench", label: "Workbench", roles: ["auditor"], section: "workspace", icon: HubRoundedIcon },
    { to: "/auditor/exceptions", label: "Exceptions", roles: ["auditor"], section: "workspace", icon: WarningAmberRoundedIcon },
    { to: "/auditor/journals", label: "Journals", roles: ["auditor"], section: "workspace", icon: RuleFolderRoundedIcon },
    { to: "/auditor/audit-logs", label: "Audit Logs", roles: ["auditor"], section: "workspace", icon: PolicyRoundedIcon },
    { to: "/contributions", label: "Contributions", roles: ["branch_manager"], section: "finance", icon: PieChartRoundedIcon },
    { to: "/savings", label: "Savings", roles: ["branch_manager"], section: "finance", icon: SavingsRoundedIcon },
    { to: "/payments", label: "Payments", roles: ["branch_manager"], section: "finance", icon: PaidRoundedIcon },
    { to: "/revenue", label: "Gross Revenue", roles: ["branch_manager"], section: "finance", icon: PaidRoundedIcon },
    { to: "/dividends", label: "Dividends", roles: ["super_admin", "branch_manager"], section: "finance", icon: EventRepeatRoundedIcon },
    { to: "/approvals", label: "Approvals", roles: ["super_admin", "branch_manager", "treasury_officer", "loan_officer", "teller"], section: "finance", icon: PendingActionsRoundedIcon },
    { to: "/cash", label: "Cash Desk", roles: ["teller"], section: "finance", icon: PaidRoundedIcon },
    { to: "/cash-control", label: "Cash Control", roles: ["branch_manager"], section: "finance", icon: PaidRoundedIcon },
    { to: "/loans", label: "Loans", roles: ["branch_manager", "loan_officer", "teller"], section: "finance", icon: SummarizeRoundedIcon },
    { to: "/treasury", label: "Treasury", roles: ["super_admin", "treasury_officer", "auditor"], section: "finance", icon: AccountBalanceRoundedIcon },
    { to: "/treasury/policy-settings", label: "Treasury Setup", roles: ["branch_manager"], section: "finance", icon: PolicyRoundedIcon },
    { to: "/reports", label: "Reports", roles: ["super_admin", "branch_manager", "treasury_officer", "loan_officer"], section: "finance", icon: DescriptionRoundedIcon },
    { to: "/auditor/reports", label: "Reports", roles: ["auditor"], section: "finance", icon: DescriptionRoundedIcon }
];

const navGroups: NavGroup[] = [
    { key: "workspace", label: "Workspace", itemTos: ["/member-applications", "/members", "/members/import", "/staff-users"] },
    { key: "products", label: "Products", itemTos: ["/products"] },
    { key: "finance", label: "Finance", itemTos: ["/contributions", "/savings", "/loans", "/payments", "/revenue", "/dividends", "/cash-control", "/cash", "/treasury", "/treasury/policy-settings"] },
    { key: "operations", label: "Operations", itemTos: ["/approvals"] },
    { key: "analytics", label: "Analytics", itemTos: ["/reports", "/auditor/reports", "/auditor/workbench", "/auditor/exceptions", "/auditor/journals", "/auditor/audit-logs"] },
    { key: "setup", label: "Setup", itemTos: ["/setup/super-admin"] }
];

const searchKeywords: Partial<Record<NavItem["to"], string[]>> = {
    "/dashboard": ["overview", "home", "kpi", "summary"],
    "/staff-users": ["team", "staff", "users", "roles", "access"],
    "/products": ["savings products", "share products", "charges", "posting rules", "coa mappings"],
    "/member-applications": ["applications", "kyc", "member approval", "onboarding review"],
    "/members": ["customers", "registry", "member onboarding"],
    "/members/import": ["csv import", "bulk members", "credentials", "portal onboarding"],
    "/cash-control": ["receipt policy", "teller balancing", "daily cashbook", "cash summary"],
    "/auditor/exceptions": ["audit", "exceptions", "flags", "compliance"],
    "/auditor/workbench": ["audit workbench", "branch risk", "patterns", "heatmap"],
    "/auditor/journals": ["audit", "journals", "ledger", "entries"],
    "/auditor/audit-logs": ["audit logs", "trail", "changes"],
    "/auditor/reports": ["audit reports", "exports", "compliance"],
    "/contributions": ["shares", "share capital", "dividends", "capital"],
    "/savings": ["savings", "deposits", "withdrawals", "balances"],
    "/payments": ["member payments", "mobile money", "payment gateway", "failed payments", "receipts", "reconcile"],
    "/revenue": ["fees", "penalties", "loan interest", "loan fees", "branch revenue", "income accounts"],
    "/charge-revenue": ["fees", "penalties", "loan interest", "loan fees", "branch revenue", "income accounts"],
    "/dividends": ["dividend cycle", "allocations", "approvals"],
    "/approvals": ["maker checker", "approval queue", "high risk controls", "checker decisions"],
    "/cash": ["deposit", "withdraw", "teller", "cash desk"],
    "/loans": ["disbursement", "repayment", "portfolio"],
    "/treasury": ["investments", "portfolio", "income", "liquidity", "institutional funds", "orders"],
    "/treasury/policy-settings": ["treasury setup", "treasury policy", "guardrails", "liquidity protection", "investment limits"],
    "/reports": ["exports", "trial balance", "par", "aging"],
    "/setup/super-admin": ["bootstrap", "admin profile"]
};

function getPageTitle(pathname: string) {
    const item = [...navItems]
        .sort((left, right) => right.to.length - left.to.length)
        .find((entry) => pathname.startsWith(entry.to));
    return item?.label || "Workspace";
}

function getPageSubtitle(pathname: string) {
    if (pathname.startsWith("/members/import")) {
        return "Bulk onboard members from CSV with secure one-time credentials.";
    }

    if (pathname.startsWith("/products")) {
        return "Configure savings, share, charge, penalty, and posting-rule foundations before money moves.";
    }

    if (pathname.startsWith("/member-applications")) {
        return "Review prospective members, record KYC outcomes, and approve into the member register.";
    }

    if (pathname.startsWith("/dashboard")) {
        return "Track platform or tenant performance, lending health, and member activity.";
    }

    if (pathname.startsWith("/members")) {
        return "Manage member records, access, and relationship progress.";
    }

    if (pathname.startsWith("/auditor/exceptions")) {
        return "Review flagged transactions, timing anomalies, and control exceptions.";
    }

    if (pathname.startsWith("/auditor/workbench")) {
        return "Monitor branch heat, repeated offenders, and case backlog patterns.";
    }

    if (pathname.startsWith("/auditor/journals")) {
        return "Inspect read-only journals, lines, and exception flags.";
    }

    if (pathname.startsWith("/auditor/audit-logs")) {
        return "Trace sensitive actions with before and after evidence.";
    }

    if (pathname.startsWith("/auditor/reports")) {
        return "Download read-only audit evidence and compliance reports.";
    }

    if (pathname.startsWith("/cash")) {
        return "Handle cash transactions with confirmation and traceability.";
    }

    if (pathname.startsWith("/cash-control")) {
        return "Configure receipt evidence and review teller balancing before day-end close.";
    }

    if (pathname.startsWith("/contributions")) {
        return "Review member share capital growth, contribution patterns, and dividend credits.";
    }

    if (pathname.startsWith("/savings")) {
        return "Monitor member savings deposits, withdrawals, and balances per branch.";
    }

    if (pathname.startsWith("/payments")) {
        return "Follow member mobile-money requests, investigate failures, and reconcile paid orders at branch level.";
    }

    if (pathname.startsWith("/revenue") || pathname.startsWith("/charge-revenue")) {
        return "Review posted gross fee, penalty, loan-interest, and loan-fee income for your branch scope with trend and ledger-source visibility.";
    }

    if (pathname.startsWith("/dividends")) {
        return "Run dividend cycles with snapshot, approval, and ledger posting controls.";
    }

    if (pathname.startsWith("/approvals")) {
        return "Review and decide high-risk transactions pending maker-checker approval.";
    }

    if (pathname.startsWith("/loans")) {
        return "Disburse, collect, and monitor loans with accounting controls.";
    }

    if (pathname.startsWith("/treasury/policy-settings")) {
        return "Configure treasury guardrails, liquidity protection, and execution thresholds.";
    }

    if (pathname.startsWith("/treasury")) {
        return "Invest institutional SACCO funds with liquidity guardrails, approvals, and ledger-safe portfolio tracking.";
    }

    if (pathname.startsWith("/reports")) {
        return "Export operational and finance reports for review and audit.";
    }

    if (pathname.startsWith("/staff-users")) {
        return "Provision tenant staff access with cleaner role and branch control.";
    }

    return "Complete setup and operational workflows in a single secure workspace.";
}

export function AppLayout() {
    const theme = useTheme();
    const location = useLocation();
    const navigate = useNavigate();
    const [accountMenuAnchor, setAccountMenuAnchor] = useState<null | HTMLElement>(null);
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [searchQuery, setSearchQuery] = useState("");
    const {
        profile,
        signOut,
        selectedBranchId,
        selectedTenantName,
        selectedBranchName,
        platformRole,
        user,
        lastApiError,
        isInternalOps,
        twoFactorSetupRequired,
        setSelectedBranchId,
        refreshProfile
    } = useAuth();
    const {
        isDesktop,
        sidebarCollapsed,
        mobileSidebarOpen,
        toggleSidebar,
        closeMobileSidebar,
        toggleTheme,
        theme: themeMode
    } = useUI();

    const visibleItems = navItems.filter((item) => {
        if (item.allowSetup) {
            return isInternalOps || !profile;
        }

        if (isInternalOps) {
            return item.to === "/dashboard";
        }

        if (!profile || !item.roles) {
            return false;
        }

        return item.roles.includes(profile.role);
    });

    const isTreasuryWorkspaceRole = profile?.role === "treasury_officer";
    const effectiveNavGroups = useMemo<NavGroup[]>(() => {
        if (!isTreasuryWorkspaceRole) {
            return navGroups;
        }

        return [
            { key: "treasury", label: "Treasury", itemTos: ["/treasury"] },
            { key: "operations", label: "Operations", itemTos: ["/approvals"] },
            { key: "analytics", label: "Analytics", itemTos: ["/reports"] }
        ];
    }, [isTreasuryWorkspaceRole]);

    const topLevelItems = useMemo(
        () => visibleItems.filter((item) => item.to === "/dashboard"),
        [visibleItems]
    );

    const groupedNavItems = useMemo(
        () => effectiveNavGroups
            .map((group) => ({
                ...group,
                items: visibleItems.filter((item) => group.itemTos.includes(item.to))
            }))
            .filter((group) => group.items.length),
        [effectiveNavGroups, visibleItems]
    );

    const shouldRedirectToMemberPortal = profile?.role === "member";

    useEffect(() => {
        if (!isDesktop) {
            closeMobileSidebar();
        }
    }, [closeMobileSidebar, isDesktop, location.pathname]);

    useEffect(() => {
        setExpandedGroups((previous) => {
            const next: Record<string, boolean> = {};
            let changed = Object.keys(previous).length !== groupedNavItems.length;

            groupedNavItems.forEach((group) => {
                const hasActiveChild = group.items.some((item) => location.pathname.startsWith(item.to));
                const nextValue = hasActiveChild ? true : (previous[group.key] ?? false);
                next[group.key] = nextValue;
                if (previous[group.key] !== nextValue) {
                    changed = true;
                }
            });

            return changed ? next : previous;
        });
    }, [groupedNavItems, location.pathname]);

    const displayRole = isInternalOps && !profile ? "Internal Ops" : profile ? formatRole(profile.role) : "Setup pending";
    const displayPlatformRole = formatPlatformRole(platformRole);
    const branchLabel = selectedBranchName || selectedBranchId || "All branches";
    const tenantLabel = selectedTenantName || "SACCOS workspace";
    const pageTitle = getPageTitle(location.pathname);
    const pageSubtitle = getPageSubtitle(location.pathname);
    const searchOptions = useMemo<SearchOption[]>(
        () =>
            visibleItems.map((item) => ({
                label: item.label,
                to: item.to,
                helper: getPageSubtitle(item.to),
                keywords: searchKeywords[item.to] || []
            })),
        [visibleItems]
    );
    const effectiveDrawerWidth = isDesktop && !sidebarCollapsed ? drawerWidth : 0;
    const accountMenuOpen = Boolean(accountMenuAnchor);
    const isDarkMode = theme.palette.mode === "dark";
    const sidebarBg = isDarkMode ? theme.palette.background.paper : "#ffffff";
    const sidebarText = isDarkMode ? theme.palette.text.primary : theme.palette.text.primary;
    const sidebarMuted = isDarkMode ? theme.palette.text.secondary : theme.palette.text.secondary;
    const sidebarPanelBg = isDarkMode ? alpha(theme.palette.common.white, 0.04) : alpha(brandColors.primary[100], 0.45);
    const navHoverBg = isDarkMode ? alpha(theme.palette.common.white, 0.05) : alpha(brandColors.primary[900], 0.04);
    const navActiveBg = isDarkMode ? theme.palette.secondary.main : alpha(brandColors.accent[500], 0.12);
    const navActiveColor = isDarkMode ? "#ffffff" : brandColors.primary[900];
    const topBarBg = isDarkMode
        ? alpha(brandColors.primary[900], 0.92)
        : brandColors.primary[900];
    const topBarMuted = alpha("#ffffff", 0.72);
    const brandLogoSrc = "/SACCOSS-LOGO.png";

    const navigateToSearchOption = (option: SearchOption | null) => {
        if (!option) {
            return;
        }

        navigate(option.to);
        setSearchQuery("");
        if (!isDesktop) {
            closeMobileSidebar();
        }
    };

    if (shouldRedirectToMemberPortal) {
        return <Navigate to="/portal" replace />;
    }

    const sidebar = (
        <Box sx={{ p: 2, height: "100%", display: "flex", flexDirection: "column", gap: 2 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
                <Box
                    sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 1.5,
                        bgcolor: "#ffffff",
                        display: "grid",
                        placeItems: "center",
                        border: `1px solid ${isDarkMode ? alpha(theme.palette.common.white, 0.12) : alpha(brandColors.primary[900], 0.12)}`
                    }}
                >
                    <Box
                        component="img"
                        src={brandLogoSrc}
                        alt="SMART SACCOS logo"
                        sx={{ width: 26, height: 26, objectFit: "contain" }}
                    />
                </Box>
                <Box>
                    <Typography variant="subtitle1" fontWeight={700} sx={{ color: sidebarText }}>
                        SMART SACCOS
                    </Typography>
                    <Typography variant="caption" sx={{ color: sidebarMuted }}>
                        Fintech operations workspace
                    </Typography>
                </Box>
            </Stack>

            <Paper
                variant="outlined"
                sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: sidebarPanelBg,
                    borderColor: isDarkMode ? alpha(theme.palette.common.white, 0.08) : theme.palette.divider,
                    color: sidebarText
                }}
            >
                <Stack direction="row" spacing={1.25} alignItems="center">
                    <Avatar sx={{ bgcolor: alpha(theme.palette.secondary.main, 0.18), color: isDarkMode ? "#fff" : theme.palette.secondary.dark }}>
                        {(tenantLabel || "T").slice(0, 1).toUpperCase()}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" noWrap sx={{ color: sidebarText }}>
                            {tenantLabel}
                        </Typography>
                        <Typography variant="caption" noWrap sx={{ color: sidebarMuted }}>
                            {branchLabel}
                        </Typography>
                    </Box>
                </Stack>
            </Paper>

            {topLevelItems.length ? (
                <List dense disablePadding>
                    {topLevelItems.map((item) => {
                        const active = location.pathname.startsWith(item.to);
                        const Icon = item.icon;

                        return (
                            <ListItemButton
                                key={item.to}
                                selected={active}
                                onClick={() => {
                                    navigate(item.to);
                                    if (!isDesktop) {
                                        closeMobileSidebar();
                                    }
                                }}
                                sx={{
                                    mb: 0.5,
                                    borderRadius: 1.5,
                                    px: 1.5,
                                    py: 1,
                                    color: active ? navActiveColor : sidebarText,
                                    "&.Mui-selected": {
                                        bgcolor: navActiveBg,
                                        color: navActiveColor
                                    },
                                    "&:hover": {
                                        bgcolor: active
                                            ? navActiveBg
                                            : navHoverBg
                                    }
                                }}
                            >
                                <ListItemIcon sx={{ minWidth: 36, color: "inherit" }}>
                                    <Icon fontSize="small" />
                                </ListItemIcon>
                                <ListItemText
                                    primary={item.label}
                                    primaryTypographyProps={{ fontSize: 14, fontWeight: active ? 700 : 500 }}
                                />
                            </ListItemButton>
                        );
                    })}
                </List>
            ) : null}

            {groupedNavItems.map((group) => {
                const isExpanded = expandedGroups[group.key];
                const hasActiveChild = group.items.some((item) => location.pathname.startsWith(item.to));

                return (
                    <Box key={group.key}>
                        <List dense disablePadding>
                            <ListItemButton
                                onClick={() => setExpandedGroups((previous) => ({
                                    ...previous,
                                    [group.key]: !previous[group.key]
                                }))}
                                sx={{
                                    mb: 0.5,
                                    borderRadius: 1.5,
                                    px: 1.5,
                                    py: 0.9,
                                    color: hasActiveChild ? navActiveColor : sidebarMuted,
                                    bgcolor: hasActiveChild ? navActiveBg : "transparent",
                                    "&:hover": {
                                        bgcolor: hasActiveChild ? navActiveBg : navHoverBg
                                    }
                                }}
                            >
                                <ListItemText
                                    primary={group.label}
                                    primaryTypographyProps={{
                                        fontSize: 12,
                                        fontWeight: 700,
                                        letterSpacing: 0.8,
                                        textTransform: "uppercase"
                                    }}
                                />
                                {isExpanded ? <ExpandLessRoundedIcon fontSize="small" /> : <ExpandMoreRoundedIcon fontSize="small" />}
                            </ListItemButton>
                        </List>
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            <List dense disablePadding sx={{ pl: 1 }}>
                                {group.items.map((item) => {
                                    const active = location.pathname.startsWith(item.to);
                                    const Icon = item.icon;

                                    return (
                                        <ListItemButton
                                            key={item.to}
                                            selected={active}
                                            onClick={() => {
                                                navigate(item.to);
                                                if (!isDesktop) {
                                                    closeMobileSidebar();
                                                }
                                            }}
                                            sx={{
                                                mb: 0.5,
                                                borderRadius: 1.5,
                                                px: 1.5,
                                                py: 1,
                                                color: active ? navActiveColor : sidebarText,
                                                "&.Mui-selected": {
                                                    bgcolor: navActiveBg,
                                                    color: navActiveColor
                                                },
                                                "&:hover": {
                                                    bgcolor: active
                                                        ? navActiveBg
                                                        : navHoverBg
                                                }
                                            }}
                                        >
                                            <ListItemIcon sx={{ minWidth: 36, color: "inherit" }}>
                                                <Icon fontSize="small" />
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={item.label}
                                                primaryTypographyProps={{ fontSize: 14, fontWeight: active ? 700 : 500 }}
                                            />
                                        </ListItemButton>
                                    );
                                })}
                            </List>
                        </Collapse>
                    </Box>
                );
            })}

            <Box
                sx={{
                    mt: "auto",
                    pt: 1.5,
                    borderTop: `1px solid ${isDarkMode ? alpha(theme.palette.common.white, 0.08) : alpha(brandColors.primary[900], 0.08)}`
                }}
            >
                <Typography
                    variant="caption"
                    sx={{
                        display: "block",
                        textAlign: "center",
                        color: sidebarMuted,
                        fontSize: 11,
                        letterSpacing: 0.06,
                        textTransform: "uppercase"
                    }}
                >
                    Copyright 2026 All rights reserved
                </Typography>
            </Box>

        </Box>
    );

    return (
        <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
            <AppBar
                position="fixed"
                color="inherit"
                sx={{
                    width: { lg: `calc(100% - ${effectiveDrawerWidth}px)` },
                    ml: { lg: `${effectiveDrawerWidth}px` },
                    bgcolor: topBarBg,
                    color: "#ffffff",
                    backdropFilter: "blur(10px)",
                    borderRadius: 0
                }}
            >
                <Toolbar sx={{ gap: 2, minHeight: "76px !important" }}>
                    <IconButton edge="start" onClick={toggleSidebar} sx={{ color: "#ffffff" }}>
                        <MenuRoundedIcon />
                    </IconButton>

                    <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="h6" noWrap sx={{ color: "#ffffff" }}>
                            {pageTitle}
                        </Typography>
                        <Typography variant="body2" noWrap sx={{ color: topBarMuted }}>
                            {pageSubtitle}
                        </Typography>
                    </Box>

                    <Autocomplete
                        size="small"
                        freeSolo
                        options={searchOptions}
                        getOptionLabel={(option) => typeof option === "string" ? option : option.label}
                        filterOptions={(options, state) => {
                            const value = state.inputValue.trim().toLowerCase();

                            if (!value) {
                                return options;
                            }

                            return options.filter((option) =>
                                option.label.toLowerCase().includes(value) ||
                                option.helper.toLowerCase().includes(value) ||
                                option.keywords.some((keyword) => keyword.toLowerCase().includes(value))
                            );
                        }}
                        inputValue={searchQuery}
                        onInputChange={(_, value) => setSearchQuery(value)}
                        onChange={(_, value) => {
                            if (typeof value === "string") {
                                const match = searchOptions.find((option) =>
                                    option.label.toLowerCase() === value.toLowerCase() ||
                                    option.keywords.some((keyword) => keyword.toLowerCase() === value.toLowerCase())
                                ) || searchOptions.find((option) =>
                                    option.label.toLowerCase().includes(value.toLowerCase()) ||
                                    option.keywords.some((keyword) => keyword.toLowerCase().includes(value.toLowerCase()))
                                );

                                navigateToSearchOption(match || null);
                                return;
                            }

                            navigateToSearchOption(value);
                        }}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                placeholder="Search pages, members, loans, reports"
                                sx={{
                                    "& .MuiOutlinedInput-root": {
                                        bgcolor: alpha("#ffffff", isDarkMode ? 0.08 : 0.12),
                                        color: "#ffffff",
                                        "& fieldset": {
                                            borderColor: alpha("#ffffff", 0.16)
                                        },
                                        "&:hover fieldset": {
                                            borderColor: alpha("#ffffff", 0.28)
                                        }
                                    },
                                    "& .MuiInputBase-input::placeholder": {
                                        color: alpha("#ffffff", 0.7),
                                        opacity: 1
                                    }
                                }}
                                onKeyDown={(event) => {
                                    if (event.key !== "Enter") {
                                        return;
                                    }

                                    const value = searchQuery.trim().toLowerCase();
                                    const match = searchOptions.find((option) =>
                                        option.label.toLowerCase().includes(value) ||
                                        option.helper.toLowerCase().includes(value) ||
                                        option.keywords.some((keyword) => keyword.toLowerCase().includes(value))
                                    );

                                    if (match) {
                                        event.preventDefault();
                                        navigateToSearchOption(match);
                                    }
                                }}
                                InputProps={{
                                    ...params.InputProps,
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchRoundedIcon fontSize="small" sx={{ color: alpha("#ffffff", 0.78) }} />
                                        </InputAdornment>
                                    )
                                }}
                            />
                        )}
                        renderOption={(props, option) => (
                            <Box component="li" {...props}>
                                <Box>
                                    <Typography variant="body2" fontWeight={600}>
                                        {option.label}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {option.helper}
                                    </Typography>
                                </Box>
                            </Box>
                        )}
                        sx={{ width: { xs: "100%", sm: 360 }, display: { xs: "none", md: "flex" } }}
                    />

                    <Chip
                        label={tenantLabel}
                        variant="filled"
                        sx={{
                            maxWidth: 180,
                            bgcolor: alpha("#ffffff", 0.12),
                            color: "#ffffff",
                            border: `1px solid ${alpha("#ffffff", 0.14)}`
                        }}
                    />
                    {profile?.tenant_id && !twoFactorSetupRequired ? (
                        <NotificationBell
                            tenantId={profile.tenant_id}
                            iconColor="#ffffff"
                            buttonSx={{ color: "#ffffff" }}
                            menuPaperSx={{ borderRadius: 2 }}
                        />
                    ) : null}
                    <IconButton onClick={toggleTheme} sx={{ color: "#ffffff" }}>
                        {themeMode === "light" ? <DarkModeIconShim /> : <LightModeIconShim />}
                    </IconButton>
                    <IconButton onClick={(event) => setAccountMenuAnchor(event.currentTarget)} sx={{ color: "#ffffff" }}>
                        <Avatar sx={{ width: 36, height: 36, bgcolor: alpha("#ffffff", 0.18), color: "#ffffff" }}>
                            {(profile?.full_name || user?.email || "U").slice(0, 1).toUpperCase()}
                        </Avatar>
                    </IconButton>
                </Toolbar>
            </AppBar>

            <Box component="nav" sx={{ width: { lg: effectiveDrawerWidth }, flexShrink: { lg: 0 } }}>
                <Drawer
                    variant={isDesktop ? "permanent" : "temporary"}
                    open={isDesktop ? true : mobileSidebarOpen}
                    onClose={closeMobileSidebar}
                    ModalProps={{ keepMounted: true }}
                    sx={{
                        display: "block",
                        "& .MuiDrawer-paper": {
                            width: drawerWidth,
                            boxSizing: "border-box",
                            bgcolor: sidebarBg,
                            color: sidebarText,
                            borderRight: `1px solid ${theme.palette.divider}`,
                            borderRadius: 0,
                            transform: {
                                lg: sidebarCollapsed ? `translateX(-${drawerWidth}px)` : "translateX(0)"
                            },
                            transition: theme.transitions.create("transform", {
                                duration: theme.transitions.duration.enteringScreen
                            })
                        }
                    }}
                >
                    {sidebar}
                </Drawer>
            </Box>

            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: { xs: 2, md: 3 },
                    mt: "76px",
                    minWidth: 0
                }}
            >
                <Outlet />
            </Box>

            <Menu
                anchorEl={accountMenuAnchor}
                open={accountMenuOpen}
                onClose={() => setAccountMenuAnchor(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                PaperProps={{ sx: { width: 280, mt: 1.25, borderRadius: 2 } }}
            >
                <Box sx={{ px: 2, py: 1.5 }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Avatar sx={{ width: 40, height: 40 }}>
                            {(profile?.full_name || user?.email || "U").slice(0, 1).toUpperCase()}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={700} noWrap>
                                {profile?.full_name || user?.email || "Unknown user"}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>
                                {user?.email || displayRole}
                            </Typography>
                        </Box>
                    </Stack>
                </Box>
                <MenuItem disabled sx={{ opacity: "1 !important" }}>
                    <ListItemText
                        primary="Role"
                        secondary={displayRole}
                        primaryTypographyProps={{ variant: "caption", color: "text.secondary" }}
                        secondaryTypographyProps={{ variant: "body2", color: "text.primary" }}
                    />
                </MenuItem>
                {platformRole ? (
                    <MenuItem disabled sx={{ opacity: "1 !important" }}>
                        <ListItemText
                            primary="SaaS Role"
                            secondary={displayPlatformRole}
                            primaryTypographyProps={{ variant: "caption", color: "text.secondary" }}
                            secondaryTypographyProps={{ variant: "body2", color: "text.primary" }}
                        />
                    </MenuItem>
                ) : null}
                <MenuItem disabled sx={{ opacity: "1 !important" }}>
                    <ListItemText
                        primary="Tenant"
                        secondary={tenantLabel}
                        primaryTypographyProps={{ variant: "caption", color: "text.secondary" }}
                        secondaryTypographyProps={{ variant: "body2", color: "text.primary", noWrap: true }}
                    />
                </MenuItem>
                <MenuItem disabled sx={{ opacity: "1 !important" }}>
                    <ListItemText
                        primary="Branch"
                        secondary={branchLabel}
                        primaryTypographyProps={{ variant: "caption", color: "text.secondary" }}
                        secondaryTypographyProps={{ variant: "body2", color: "text.primary", noWrap: true }}
                    />
                </MenuItem>
                <MenuItem disabled sx={{ opacity: "1 !important" }}>
                    <ListItemText
                        primary="Deployment"
                        secondary="Single-tenant workspace"
                        primaryTypographyProps={{ variant: "caption", color: "text.secondary" }}
                        secondaryTypographyProps={{ variant: "body2", color: "text.primary" }}
                    />
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        setAccountMenuAnchor(null);
                        navigate("/security");
                    }}
                >
                    <ListItemIcon>
                        <SettingsRoundedIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="Security" />
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        setAccountMenuAnchor(null);
                        void signOut();
                    }}
                >
                    <ListItemIcon>
                        <LogoutRoundedIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="Logout" />
                </MenuItem>
            </Menu>
        </Box>
    );
}

function DarkModeIconShim() {
    return <span style={{ fontSize: 16, lineHeight: 1 }}>☾</span>;
}

function LightModeIconShim() {
    return <span style={{ fontSize: 16, lineHeight: 1 }}>☼</span>;
}
