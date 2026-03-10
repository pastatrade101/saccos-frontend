import {
    Alert,
    Box,
    Button,
    CardContent,
    Chip,
    Divider,
    Grid,
    Stack,
    Typography
} from "@mui/material";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import AssignmentTurnedInRoundedIcon from "@mui/icons-material/AssignmentTurnedInRounded";
import BadgeRoundedIcon from "@mui/icons-material/BadgeRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import PieChartRoundedIcon from "@mui/icons-material/PieChartRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import RequestQuoteRoundedIcon from "@mui/icons-material/RequestQuoteRounded";
import RuleRoundedIcon from "@mui/icons-material/RuleRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { alpha, useTheme } from "@mui/material/styles";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { AppLoader } from "../components/AppLoader";
import { ChartPanel } from "../components/ChartPanel";
import { AlertsPanel } from "../components/teller/AlertsPanel";
import { CashFlowChart } from "../components/teller/CashFlowChart";
import { DistributionChart } from "../components/teller/DistributionChart";
import { KpiCard } from "../components/teller/KpiCard";
import { WaterfallCard } from "../components/teller/WaterfallCard";
import { DataTable, type Column } from "../components/DataTable";
import { api, getApiErrorMessage } from "../lib/api";
import {
    endpoints,
    type BranchesListResponse,
    type LoanApplicationsResponse,
    type LoanSchedulesResponse,
    type LoansResponse,
    type MemberApplicationsResponse,
    type MembersResponse,
    type PlatformErrorRow,
    type PlatformErrorsResponse,
    type PlatformInfrastructureMetrics,
    type PlatformInfrastructureMetricsResponse,
    type PlatformSlowEndpointRow,
    type PlatformSlowEndpointsResponse,
    type PlatformSystemMetrics,
    type PlatformSystemMetricsResponse,
    type PlatformTenantTrafficResponse,
    type PlatformTenantTrafficRow,
    type StatementsResponse,
    type TenantsListResponse,
    type UsersListResponse
} from "../lib/endpoints";
import { buildTellerDashboardData } from "../lib/tellerDashboard";
import type { Branch, Loan, LoanApplication, LoanSchedule, Member, MemberApplication, StaffAccessUser, StatementRow, Tenant } from "../types/api";
import { MotionCard, MotionListItem, MotionSection } from "../ui/motion";
import { formatCurrency, formatDate, formatRole } from "../utils/format";

interface DashboardState {
    members: Member[];
    statements: StatementRow[];
    loans: Loan[];
    schedules: LoanSchedule[];
    loanApplications: LoanApplication[];
    memberApplications: MemberApplication[];
    staffUsers: StaffAccessUser[];
}

interface PlatformState {
    tenants: Tenant[];
    branches: Branch[];
    systemMetrics: PlatformSystemMetrics | null;
    tenantTraffic: PlatformTenantTrafficRow[];
    infrastructure: PlatformInfrastructureMetrics | null;
    errors: PlatformErrorRow[];
    slowEndpoints: PlatformSlowEndpointRow[];
}

interface RoleMetric {
    label: string;
    value: string;
    helper?: string;
}

interface BranchAlertItem {
    id: string;
    severity: "success" | "warning" | "error" | "info";
    title: string;
    description: string;
}

interface FollowUpItem {
    id: string;
    loanId: string;
    dueDate: string;
    principalDue: number;
    interestDue: number;
    severity: "critical" | "warning" | "normal";
    statusLabel: string;
}

interface OperationalQueueItem {
    id: string;
    label: string;
    count: number;
    helper: string;
    route: string;
    tone: "success" | "warning" | "error" | "info";
}

interface StaffPerformanceRow {
    userId: string;
    officerName: string;
    loansIssued: number;
    collectionRate: number;
    applicationsProcessed: number;
}

function groupAmountsByDate(statements: StatementRow[], direction?: "in" | "out") {
    const map = new Map<string, number>();

    statements.forEach((entry) => {
        if (direction && entry.direction !== direction) {
            return;
        }

        const key = entry.transaction_date;
        map.set(key, (map.get(key) || 0) + entry.amount);
    });

    return [...map.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-7);
}

function groupLoansByMonth(loans: Loan[]) {
    const map = new Map<string, number>();

    loans.forEach((loan) => {
        const key = loan.created_at.slice(0, 7);
        map.set(key, (map.get(key) || 0) + loan.principal_amount);
    });

    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6);
}

function groupSchedulesByBucket(schedules: LoanSchedule[]) {
    const buckets = new Map<string, number>([
        ["Current", 0],
        ["Overdue", 0],
        ["Partial", 0]
    ]);

    schedules.forEach((schedule) => {
        if (schedule.status === "overdue") {
            buckets.set("Overdue", (buckets.get("Overdue") || 0) + 1);
        } else if (schedule.status === "partial") {
            buckets.set("Partial", (buckets.get("Partial") || 0) + 1);
        } else {
            buckets.set("Current", (buckets.get("Current") || 0) + 1);
        }
    });

    return [...buckets.entries()];
}

function calculateAgingSummary(schedules: LoanSchedule[]) {
    const today = new Date();
    const buckets = {
        current: 0,
        d1_30: 0,
        d31_60: 0,
        d60Plus: 0
    };

    let overdueAmount = 0;
    let totalAmount = 0;

    schedules.forEach((schedule) => {
        const pendingAmount = Math.max(schedule.principal_due - schedule.principal_paid, 0) + Math.max(schedule.interest_due - schedule.interest_paid, 0);
        if (pendingAmount <= 0) {
            return;
        }

        totalAmount += pendingAmount;
        const dueDate = new Date(schedule.due_date);
        const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysPastDue <= 0) {
            buckets.current += 1;
            return;
        }

        overdueAmount += pendingAmount;

        if (daysPastDue <= 30) {
            buckets.d1_30 += 1;
        } else if (daysPastDue <= 60) {
            buckets.d31_60 += 1;
        } else {
            buckets.d60Plus += 1;
        }
    });

    return {
        ...buckets,
        total: buckets.current + buckets.d1_30 + buckets.d31_60 + buckets.d60Plus,
        parPercent: totalAmount ? (overdueAmount / totalAmount) * 100 : 0
    };
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
    return (
        <MotionCard variant="outlined" inView sx={{ height: "100%" }}>
            <CardContent>
                <Typography variant="overline" color="text.secondary">
                    {label}
                </Typography>
                <Typography variant="h5" sx={{ mt: 0.5 }}>
                    {value}
                </Typography>
                {helper ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                        {helper}
                    </Typography>
                ) : null}
            </CardContent>
        </MotionCard>
    );
}

function RiskStripCard({
    label,
    value,
    helper,
    tone
}: {
    label: string;
    value: string;
    helper: string;
    tone: "green" | "yellow" | "red";
}) {
    const theme = useTheme();
    const toneStyles = tone === "red"
        ? { color: theme.palette.error.main, bg: alpha(theme.palette.error.main, 0.1), border: alpha(theme.palette.error.main, 0.22) }
        : tone === "yellow"
            ? { color: theme.palette.warning.main, bg: alpha(theme.palette.warning.main, 0.12), border: alpha(theme.palette.warning.main, 0.22) }
            : { color: theme.palette.success.main, bg: alpha(theme.palette.success.main, 0.1), border: alpha(theme.palette.success.main, 0.22) };

    return (
        <MotionCard variant="outlined" inView sx={{ height: "100%", borderColor: toneStyles.border, bgcolor: toneStyles.bg }}>
            <CardContent sx={{ p: 2 }}>
                <Typography variant="overline" color="text.secondary">
                    {label}
                </Typography>
                <Typography variant="h5" sx={{ mt: 0.25, color: toneStyles.color }}>
                    {value}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                    {helper}
                </Typography>
            </CardContent>
        </MotionCard>
    );
}

function OperationalQueueCard({
    item,
    onOpen
}: {
    item: OperationalQueueItem;
    onOpen: (route: string) => void;
}) {
    const theme = useTheme();
    const color = item.tone === "error"
        ? "error"
        : item.tone === "warning"
            ? "warning"
            : item.tone === "success"
                ? "success"
                : theme.palette.mode === "dark"
                    ? "warning"
                    : "primary";

    return (
        <MotionListItem interactive variant="outlined" inView sx={{ p: 1.5, cursor: "pointer" }} onClick={() => onOpen(item.route)}>
            <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle2">{item.label}</Typography>
                    <Chip label={String(item.count)} size="small" color={color} />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                    {item.helper}
                </Typography>
            </Stack>
        </MotionListItem>
    );
}

function BranchManagerTopCard({
    label,
    value,
    helper,
    status,
    tone,
    icon,
    featured = false,
    footer
}: {
    label: string;
    value: string;
    helper: string;
    status: string;
    tone: "positive" | "negative" | "neutral";
    icon: ReactNode;
    featured?: boolean;
    footer?: ReactNode;
}) {
    const theme = useTheme();
    const neutralAccent = theme.palette.mode === "dark" ? "#D9B273" : theme.palette.primary.main;
    const toneMap = {
        positive: {
            main: theme.palette.success.main,
            soft: alpha(theme.palette.success.main, 0.12)
        },
        negative: {
            main: theme.palette.error.main,
            soft: alpha(theme.palette.error.main, 0.12)
        },
        neutral: {
            main: neutralAccent,
            soft: alpha(neutralAccent, 0.12)
        }
    }[tone];

    return (
        <MotionCard
            variant="outlined"
            inView
            sx={{
                height: "100%",
                borderColor: alpha(toneMap.main, featured ? 0.28 : 0.18),
                background: featured
                    ? `linear-gradient(135deg, ${alpha(toneMap.main, 0.08)}, ${theme.palette.background.paper})`
                    : theme.palette.background.paper,
                boxShadow: featured ? `0 16px 34px ${alpha(toneMap.main, 0.08)}` : "none"
            }}
        >
            <CardContent sx={{ height: "100%", p: featured ? 3 : 2.5 }}>
                <Stack spacing={featured ? 2.25 : 1.75} sx={{ height: "100%" }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                        <Stack spacing={0.75}>
                            <Typography variant="overline" color="text.secondary">
                                {label}
                            </Typography>
                            <Typography variant={featured ? "h4" : "h5"} sx={{ lineHeight: 1 }}>
                                {value}
                            </Typography>
                        </Stack>
                        <Box
                            sx={{
                                width: featured ? 46 : 40,
                                height: featured ? 46 : 40,
                                borderRadius: 2,
                                bgcolor: toneMap.soft,
                                color: toneMap.main,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0
                            }}
                        >
                            {icon}
                        </Box>
                    </Stack>

                    <Typography variant="body2" color="text.secondary" sx={{ minHeight: featured ? 44 : 40 }}>
                        {helper}
                    </Typography>

                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
                        <Chip
                            label={status}
                            size="small"
                            variant="outlined"
                            sx={{
                                fontWeight: 700,
                                color: toneMap.main,
                                borderColor: alpha(toneMap.main, 0.2),
                                bgcolor: toneMap.soft
                            }}
                        />
                    </Stack>

                    {footer ? (
                        <Box sx={{ pt: 0.5 }}>
                            {footer}
                        </Box>
                    ) : null}
                </Stack>
            </CardContent>
        </MotionCard>
    );
}

function buildFollowUpItems(schedules: LoanSchedule[]) {
    return schedules.slice(0, 6).map((schedule) => {
        const principalDue = Math.max(schedule.principal_due - schedule.principal_paid, 0);
        const interestDue = Math.max(schedule.interest_due - schedule.interest_paid, 0);

        return {
            id: schedule.id,
            loanId: schedule.loan_id,
            dueDate: schedule.due_date,
            principalDue,
            interestDue,
            severity:
                schedule.status === "overdue"
                    ? "critical"
                    : schedule.status === "partial"
                        ? "warning"
                        : "normal",
            statusLabel:
                schedule.status === "overdue"
                    ? "Immediate action"
                    : schedule.status === "partial"
                        ? "Partially settled"
                        : "Upcoming due"
        } satisfies FollowUpItem;
    });
}

function FollowUpPanel({
    title,
    subtitle,
    items,
    onViewAll
}: {
    title: string;
    subtitle: string;
    items: FollowUpItem[];
    onViewAll: () => void;
}) {
    const criticalCount = items.filter((item) => item.severity === "critical").length;
    const warningCount = items.filter((item) => item.severity === "warning").length;
    const totalExposure = items.reduce((sum, item) => sum + item.principalDue + item.interestDue, 0);

    return (
        <MotionCard variant="outlined" inView sx={{ height: "100%" }}>
            <CardContent sx={{ height: "100%" }}>
                <Stack spacing={2.5} sx={{ height: "100%" }}>
                    <Box>
                        <Typography variant="h6">{title}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {subtitle}
                        </Typography>
                    </Box>

                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <Chip label={`${criticalCount} critical`} color={criticalCount ? "error" : "default"} variant="outlined" />
                            <Chip label={`${warningCount} watchlist`} color={warningCount ? "warning" : "default"} variant="outlined" />
                            <Chip label={`${formatCurrency(totalExposure)} exposed`} color="primary" variant="outlined" />
                        </Stack>
                        <Chip
                            label="View all"
                            color="primary"
                            variant="filled"
                            onClick={onViewAll}
                            sx={{ fontWeight: 700, cursor: "pointer" }}
                        />
                    </Stack>

                    {items.length ? (
                        <Stack spacing={1.25} divider={<Divider flexItem />}>
                            {items.map((item, index) => (
                                <MotionListItem
                                    key={item.id}
                                    index={index}
                                    interactive
                                    variant="outlined"
                                    sx={{
                                        p: 1.25,
                                        borderColor: "divider"
                                    }}
                                >
                                    <Stack
                                        direction={{ xs: "column", sm: "row" }}
                                        justifyContent="space-between"
                                        spacing={1.5}
                                    >
                                        <Stack spacing={0.5}>
                                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                                    {item.loanId}
                                                </Typography>
                                                <Chip
                                                    size="small"
                                                    label={item.statusLabel}
                                                    color={
                                                        item.severity === "critical"
                                                            ? "error"
                                                            : item.severity === "warning"
                                                                ? "warning"
                                                                : "success"
                                                    }
                                                    variant={item.severity === "normal" ? "outlined" : "filled"}
                                                />
                                            </Stack>
                                            <Typography variant="body2" color="text.secondary">
                                                Due {formatDate(item.dueDate)} with principal {formatCurrency(item.principalDue)} and interest {formatCurrency(item.interestDue)} pending.
                                            </Typography>
                                        </Stack>
                                        <Stack spacing={0.35} alignItems={{ xs: "flex-start", sm: "flex-end" }}>
                                            <Typography variant="subtitle2">{formatCurrency(item.principalDue + item.interestDue)}</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                Total outstanding
                                            </Typography>
                                        </Stack>
                                    </Stack>
                                </MotionListItem>
                            ))}
                        </Stack>
                    ) : (
                        <Box
                            sx={{
                                flex: 1,
                                display: "grid",
                                placeItems: "center",
                                minHeight: 220,
                                border: `1px dashed`,
                                borderColor: "divider",
                                borderRadius: 2
                            }}
                        >
                            <Stack spacing={0.75} alignItems="center">
                                <Typography variant="subtitle2">No follow-up pressure right now</Typography>
                                <Typography variant="body2" color="text.secondary" align="center">
                                    All visible schedules are current or there are no due loan items in scope.
                                </Typography>
                            </Stack>
                        </Box>
                    )}
                </Stack>
            </CardContent>
        </MotionCard>
    );
}

function StaffPerformancePanel({
    rows
}: {
    rows: StaffPerformanceRow[];
}) {
    return (
        <MotionCard variant="outlined" inView sx={{ height: "100%" }}>
            <CardContent>
                <Stack spacing={1.5}>
                    <Box>
                        <Typography variant="h6">Staff Performance</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Loan officer output and collection quality snapshot for branch supervision.
                        </Typography>
                    </Box>
                    {rows.length ? (
                        <Stack spacing={1} divider={<Divider flexItem />}>
                            {rows.map((row, index) => (
                                <Stack key={row.userId} direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
                                    <Stack spacing={0.2}>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                            {index + 1}. {row.officerName}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {row.applicationsProcessed} applications processed
                                        </Typography>
                                    </Stack>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <Chip size="small" label={`${row.loansIssued} issued`} color="primary" />
                                        <Chip
                                            size="small"
                                            label={`${row.collectionRate.toFixed(0)}% collection`}
                                            color={row.collectionRate >= 85 ? "success" : row.collectionRate >= 65 ? "warning" : "error"}
                                        />
                                    </Stack>
                                </Stack>
                            ))}
                        </Stack>
                    ) : (
                        <Alert severity="info" variant="outlined">
                            No loan officer performance data is available yet.
                        </Alert>
                    )}
                </Stack>
            </CardContent>
        </MotionCard>
    );
}

function DashboardLoadingState() {
    return <AppLoader fullscreen={false} minHeight="72vh" message="Loading dashboard..." />;
}

function buildDeltaLabel(current: number, baseline: number, prefix = "vs baseline") {
    if (!baseline && !current) {
        return `Flat ${prefix}`;
    }

    if (!baseline) {
        return `New activity ${prefix}`;
    }

    const deltaPercent = ((current - baseline) / baseline) * 100;

    if (Math.abs(deltaPercent) < 1) {
        return `Flat ${prefix}`;
    }

    const direction = deltaPercent > 0 ? "+" : "";
    return `${direction}${deltaPercent.toFixed(0)}% ${prefix}`;
}

function getDeltaTone(current: number, baseline: number, higherIsGood = true) {
    if (Math.abs(current - baseline) < 1) {
        return "neutral" as const;
    }

    const isPositive = higherIsGood ? current >= baseline : current <= baseline;
    return isPositive ? "positive" as const : "negative" as const;
}

function buildTellerAverageTicketSparkline(statements: StatementRow[]) {
    const allDates = [...new Set(
        statements
            .map((entry) => entry.transaction_date)
            .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));
    const dates = allDates.length
        ? allDates.slice(-7)
        : Array.from({ length: 7 }, (_, index) => {
            const date = new Date();
            date.setDate(date.getDate() - (6 - index));
            return date.toISOString().slice(0, 10);
        });

    return dates.map((date) => {
        const dailyStatements = statements.filter((entry) => entry.transaction_date === date);

        if (!dailyStatements.length) {
            return 0;
        }

        return dailyStatements.reduce((sum, entry) => sum + entry.amount, 0) / dailyStatements.length;
    });
}

function averageSeries(values: number[]) {
    if (!values.length) {
        return 0;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function DashboardPage() {
    const theme = useTheme();
    const navigate = useNavigate();
    const { profile, selectedTenantId, branchIds, selectedTenantName, isInternalOps } = useAuth();
    const [state, setState] = useState<DashboardState>({
        members: [],
        statements: [],
        loans: [],
        schedules: [],
        loanApplications: [],
        memberApplications: [],
        staffUsers: []
    });
    const [platformState, setPlatformState] = useState<PlatformState>({
        tenants: [],
        branches: [],
        systemMetrics: null,
        tenantTraffic: [],
        infrastructure: null,
        errors: [],
        slowEndpoints: []
    });
    const [loading, setLoading] = useState(true);
    const [supplementalLoading, setSupplementalLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isActive = true;

        const loadSupplementalData = async (role: string, tenantId: string) => {
            if (!["branch_manager", "loan_officer"].includes(role)) {
                if (isActive) {
                    setState((current) => ({
                        ...current,
                        loanApplications: [],
                        memberApplications: [],
                        staffUsers: []
                    }));
                }
                return;
            }

            if (isActive) {
                setSupplementalLoading(true);
            }

            try {
                if (role === "loan_officer") {
                    const [loanApplicationsResponse] = await Promise.all([
                        api.get<LoanApplicationsResponse>(endpoints.loanApplications.list(), {
                            params: { tenant_id: tenantId, page: 1, limit: 50 }
                        })
                    ]);

                    if (isActive) {
                        setState((current) => ({
                            ...current,
                            loanApplications: loanApplicationsResponse.data.data || [],
                            memberApplications: [],
                            staffUsers: []
                        }));
                    }
                    return;
                }

                const supplemental = await Promise.allSettled([
                    api.get<LoanApplicationsResponse>(endpoints.loanApplications.list(), {
                        params: { tenant_id: tenantId, page: 1, limit: 50 }
                    }),
                    api.get<MemberApplicationsResponse>(endpoints.memberApplications.list(), {
                        params: { tenant_id: tenantId, page: 1, limit: 50 }
                    }),
                    api.get<UsersListResponse>(endpoints.users.list(), {
                        params: { tenant_id: tenantId, page: 1, limit: 50 }
                    })
                ]);

                if (!isActive) {
                    return;
                }

                setState((current) => ({
                    ...current,
                    loanApplications: supplemental[0].status === "fulfilled" ? supplemental[0].value.data.data || [] : [],
                    memberApplications: supplemental[1].status === "fulfilled" ? supplemental[1].value.data.data || [] : [],
                    staffUsers: supplemental[2].status === "fulfilled" ? supplemental[2].value.data.data.users || [] : []
                }));
            } finally {
                if (isActive) {
                    setSupplementalLoading(false);
                }
            }
        };

        const loadDashboard = async () => {
            if (isInternalOps) {
                setLoading(true);
                setError(null);

                try {
                    const [
                        tenantsResult,
                        branchesResult,
                        systemResult,
                        tenantTrafficResult,
                        infrastructureResult,
                        errorsResult,
                        slowEndpointsResult
                    ] = await Promise.allSettled([
                        api.get<TenantsListResponse>(endpoints.tenants.list(), { params: { page: 1, limit: 100 } }),
                        api.get<BranchesListResponse>(endpoints.branches.list(), { params: { page: 1, limit: 100 } }),
                        api.get<PlatformSystemMetricsResponse>(endpoints.platform.metricsSystem(), {
                            params: { window_minutes: 60 }
                        }),
                        api.get<PlatformTenantTrafficResponse>(endpoints.platform.metricsTenants(), {
                            params: { window_minutes: 60, sort_by: "traffic", sort_dir: "desc" }
                        }),
                        api.get<PlatformInfrastructureMetricsResponse>(endpoints.platform.metricsInfrastructure(), {
                            params: { window_minutes: 1 }
                        }),
                        api.get<PlatformErrorsResponse>(endpoints.platform.errors(), {
                            params: { page: 1, limit: 20 }
                        }),
                        api.get<PlatformSlowEndpointsResponse>(endpoints.platform.metricsSlowEndpoints(), {
                            params: { window_minutes: 60, limit: 10 }
                        })
                    ]);

                    if (isActive) {
                        setPlatformState({
                            tenants: tenantsResult.status === "fulfilled" ? tenantsResult.value.data.data || [] : [],
                            branches: branchesResult.status === "fulfilled" ? branchesResult.value.data.data || [] : [],
                            systemMetrics: systemResult.status === "fulfilled" ? systemResult.value.data.data : null,
                            tenantTraffic: tenantTrafficResult.status === "fulfilled" ? tenantTrafficResult.value.data.data || [] : [],
                            infrastructure: infrastructureResult.status === "fulfilled" ? infrastructureResult.value.data.data : null,
                            errors: errorsResult.status === "fulfilled" ? errorsResult.value.data.data || [] : [],
                            slowEndpoints: slowEndpointsResult.status === "fulfilled" ? slowEndpointsResult.value.data.data || [] : []
                        });
                    }

                    const criticalFailure =
                        tenantsResult.status === "rejected"
                        && branchesResult.status === "rejected"
                        && systemResult.status === "rejected";

                    if (criticalFailure && isActive) {
                        setError(getApiErrorMessage(tenantsResult.reason));
                    }
                } catch (loadError) {
                    if (isActive) {
                        setError(getApiErrorMessage(loadError));
                    }
                } finally {
                    if (isActive) {
                        setLoading(false);
                    }
                }

                return;
            }

            if (!selectedTenantId) {
                if (isActive) {
                    setState({
                        members: [],
                        statements: [],
                        loans: [],
                        schedules: [],
                        loanApplications: [],
                        memberApplications: [],
                        staffUsers: []
                    });
                    setLoading(false);
                    setSupplementalLoading(false);
                }
                return;
            }

            setLoading(true);
            setSupplementalLoading(false);
            setError(null);

            try {
                const [{ data: membersResponse }, statementsResponse, { data: loansResponse }, { data: schedulesResponse }] = await Promise.all([
                    api.get<MembersResponse>(endpoints.members.list(), {
                        params: { tenant_id: selectedTenantId, page: 1, limit: 100 }
                    }),
                    api.get<StatementsResponse>(endpoints.finance.statements(), {
                        params: { tenant_id: selectedTenantId, page: 1, limit: 100 }
                    }),
                    api.get<LoansResponse>(endpoints.finance.loanPortfolio(), {
                        params: { tenant_id: selectedTenantId, page: 1, limit: 100 }
                    }),
                    api.get<LoanSchedulesResponse>(endpoints.finance.loanSchedules(), {
                        params: { tenant_id: selectedTenantId, page: 1, limit: 100 }
                    })
                ]);

                if (!isActive) {
                    return;
                }

                setState({
                    members: membersResponse.data || [],
                    statements: statementsResponse.data.data || [],
                    loans: loansResponse.data || [],
                    schedules: (schedulesResponse.data || []).filter((schedule) => ["pending", "partial", "overdue"].includes(schedule.status)),
                    loanApplications: [],
                    memberApplications: [],
                    staffUsers: []
                });

                void loadSupplementalData(profile?.role || "", selectedTenantId);
            } catch (loadError) {
                if (isActive) {
                    setError(getApiErrorMessage(loadError));
                }
            } finally {
                if (isActive) {
                    setLoading(false);
                }
            }
        };

        void loadDashboard();

        return () => {
            isActive = false;
        };
    }, [isInternalOps, profile?.role, selectedTenantId]);

    const metrics = useMemo(() => {
        const branchMembers = branchIds.length
            ? state.members.filter((member) => branchIds.includes(member.branch_id))
            : state.members;
        const branchMemberIds = new Set(branchMembers.map((member) => member.id));
        const totalDeposits = state.statements
            .filter((entry) => entry.direction === "in")
            .reduce((sum, entry) => sum + entry.amount, 0);
        const totalWithdrawals = state.statements
            .filter((entry) => entry.direction === "out")
            .reduce((sum, entry) => sum + entry.amount, 0);
        const activeLoans = state.loans.filter((loan) => ["active", "in_arrears"].includes(loan.status));
        const overdueLoans = state.loans.filter((loan) => loan.status === "in_arrears");
        const overdueSchedules = state.schedules.filter((schedule) => schedule.status === "overdue");
        const branchLoans = branchIds.length
            ? activeLoans.filter((loan) => branchIds.includes(loan.branch_id))
            : activeLoans;
        const branchLoanIds = new Set(branchLoans.map((loan) => loan.id));
        const branchSchedules = state.schedules.filter((schedule) => branchLoanIds.has(schedule.loan_id));
        const branchStatements = state.statements.filter((entry) => !branchIds.length || branchMemberIds.has(entry.member_id));
        const branchDepositIntake = branchStatements
            .filter((entry) => entry.direction === "in")
            .reduce((sum, entry) => sum + entry.amount, 0);
        const branchWithdrawalOutflow = branchStatements
            .filter((entry) => entry.direction === "out")
            .reduce((sum, entry) => sum + entry.amount, 0);
        const branchContributionTotal = branchStatements
            .filter((entry) => entry.transaction_type === "share_contribution")
            .reduce((sum, entry) => sum + entry.amount, 0);
        const branchOverdueOutstanding = branchLoans
            .filter((loan) => loan.status === "in_arrears")
            .reduce((sum, loan) => sum + loan.outstanding_principal + loan.accrued_interest, 0);
        const today = new Date().toISOString().slice(0, 10);
        const branchInflowsToday = branchStatements
            .filter((entry) => entry.transaction_date === today && entry.direction === "in")
            .reduce((sum, entry) => sum + entry.amount, 0);
        const branchOutflowsToday = branchStatements
            .filter((entry) => entry.transaction_date === today && entry.direction === "out")
            .reduce((sum, entry) => sum + entry.amount, 0);
        const branchNetToday = branchInflowsToday - branchOutflowsToday;
        const branchOpeningBalance = (branchDepositIntake - branchWithdrawalOutflow) - branchNetToday;

        return {
            totalMembers: state.members.length,
            activeMembers: state.members.filter((member) => member.status === "active").length,
            totalDeposits,
            totalWithdrawals,
            activeLoans: activeLoans.length,
            outstandingLoans: activeLoans.reduce((sum, loan) => sum + loan.outstanding_principal, 0),
            accruedInterest: activeLoans.reduce((sum, loan) => sum + loan.accrued_interest, 0),
            overdueLoans: overdueLoans.length,
            overdueSchedules: overdueSchedules.length,
            branchMembers: branchMembers.length,
            branchActiveMembers: branchMembers.filter((member) => member.status === "active").length,
            branchSavings: branchDepositIntake - branchWithdrawalOutflow,
            branchDepositIntake,
            branchWithdrawalOutflow,
            branchContributionTotal,
            branchOutstanding: branchLoans.reduce((sum, loan) => sum + loan.outstanding_principal, 0),
            branchAccruedInterest: branchLoans.reduce((sum, loan) => sum + loan.accrued_interest, 0),
            branchOverdueLoans: branchLoans.filter((loan) => loan.status === "in_arrears").length,
            branchOverdueSchedules: branchSchedules.filter((schedule) => schedule.status === "overdue").length,
            branchOverdueOutstanding,
            branchInflowsToday,
            branchOutflowsToday,
            branchNetToday,
            branchOpeningBalance,
            branchStatements,
            branchLoans,
            branchSchedules
        };
    }, [branchIds, state]);

    const cashTrend = groupAmountsByDate(state.statements);
    const depositTrend = groupAmountsByDate(state.statements, "in");
    const withdrawalTrend = groupAmountsByDate(state.statements, "out");
    const loanTrend = groupLoansByMonth(state.loans);
    const branchLoanTrend = useMemo(() => groupLoansByMonth(metrics.branchLoans), [metrics.branchLoans]);
    const agingBuckets = groupSchedulesByBucket(state.schedules);
    const branchAgingBuckets = useMemo(() => groupSchedulesByBucket(metrics.branchSchedules), [metrics.branchSchedules]);
    const tellerDashboard = useMemo(() => buildTellerDashboardData(state.statements), [state.statements]);
    const tellerAverageTicketSparkline = useMemo(
        () => buildTellerAverageTicketSparkline(state.statements),
        [state.statements]
    );
    const branchCashTrend = useMemo(() => groupAmountsByDate(metrics.branchStatements), [metrics.branchStatements]);
    const branchDepositTrend = useMemo(() => groupAmountsByDate(metrics.branchStatements, "in"), [metrics.branchStatements]);
    const branchWithdrawalTrend = useMemo(() => groupAmountsByDate(metrics.branchStatements, "out"), [metrics.branchStatements]);
    const branchContributionTrend = useMemo(() => {
        const map = new Map<string, number>();

        metrics.branchStatements
            .filter((entry) => entry.transaction_type === "share_contribution")
            .forEach((entry) => {
                map.set(entry.transaction_date, (map.get(entry.transaction_date) || 0) + entry.amount);
            });

        return [...map.entries()].sort(([left], [right]) => left.localeCompare(right)).slice(-7);
    }, [metrics.branchStatements]);
    const branchDepositSeries = branchDepositTrend.map(([, value]) => value);
    const branchWithdrawalSeries = branchWithdrawalTrend.map(([, value]) => value);
    const branchContributionSeries = branchContributionTrend.map(([, value]) => value);
    const branchDepositAverage = averageSeries(branchDepositSeries);
    const branchWithdrawalAverage = averageSeries(branchWithdrawalSeries);
    const branchContributionAverage = averageSeries(branchContributionSeries);
    const branchNetMovement = metrics.branchDepositIntake - metrics.branchWithdrawalOutflow;
    const branchAlerts = useMemo(() => {
        const alerts: BranchAlertItem[] = [];

        if (metrics.branchOverdueLoans > 0) {
            alerts.push({
                id: "branch-overdue",
                severity: "warning",
                title: "Overdue portfolio requires follow-up",
                description: `${metrics.branchOverdueLoans} loans and ${metrics.branchOverdueSchedules} schedules need immediate branch collection follow-up.`
            });
        }

        if (metrics.branchContributionTotal > branchContributionAverage * 1.25 && metrics.branchContributionTotal > 0) {
            alerts.push({
                id: "branch-contribution-growth",
                severity: "success",
                title: "Share capital momentum improved",
                description: "Member share subscriptions are above the recent branch contribution pace."
            });
        }

        if (metrics.branchWithdrawalOutflow > branchWithdrawalAverage * 1.2 && metrics.branchWithdrawalOutflow > 0) {
            alerts.push({
                id: "branch-withdrawal-pressure",
                severity: "warning",
                title: "Withdrawal pressure rising",
                description: "Savings outflows are above the recent branch operating pattern and should be reviewed."
            });
        }

        if (!alerts.length) {
            alerts.push({
                id: "branch-stable",
                severity: "info",
                title: "Branch operating within range",
                description: "No material branch-side savings or loan exceptions are visible in the current activity window."
            });
        }

        return alerts.slice(0, 3);
    }, [
        branchContributionAverage,
        branchWithdrawalAverage,
        metrics.branchContributionTotal,
        metrics.branchOverdueLoans,
        metrics.branchOverdueSchedules,
        metrics.branchWithdrawalOutflow
    ]);
    const branchFollowUps = useMemo(() => buildFollowUpItems(metrics.branchSchedules), [metrics.branchSchedules]);
    const generalFollowUps = useMemo(() => buildFollowUpItems(state.schedules), [state.schedules]);
    const branchLoanAging = useMemo(() => calculateAgingSummary(metrics.branchSchedules), [metrics.branchSchedules]);
    const branchScopedLoanApplications = useMemo(
        () =>
            branchIds.length
                ? state.loanApplications.filter((application) => branchIds.includes(application.branch_id))
                : state.loanApplications,
        [branchIds, state.loanApplications]
    );
    const branchScopedMemberApplications = useMemo(
        () =>
            branchIds.length
                ? state.memberApplications.filter((application) => branchIds.includes(application.branch_id))
                : state.memberApplications,
        [branchIds, state.memberApplications]
    );
    const pendingLoanApprovals = useMemo(
        () => branchScopedLoanApplications.filter((application) => application.status === "appraised").length,
        [branchScopedLoanApplications]
    );
    const pendingLoanApplications = useMemo(
        () =>
            branchScopedLoanApplications.filter((application) =>
                ["submitted", "appraised"].includes(application.status)
            ).length,
        [branchScopedLoanApplications]
    );
    const pendingMemberApprovals = useMemo(
        () =>
            branchScopedMemberApplications.filter((application) =>
                ["submitted", "under_review"].includes(application.status)
            ).length,
        [branchScopedMemberApplications]
    );
    const pendingWithdrawalRequests = 0;
    const hasCashImbalance = metrics.branchNetToday < 0;
    const signOffTasks = pendingLoanApprovals + pendingMemberApprovals + (hasCashImbalance ? 1 : 0);
    const par30Percent = Number.isFinite(branchLoanAging.parPercent) ? branchLoanAging.parPercent : 0;
    const branchRiskStrip = [
        {
            id: "par30",
            label: "Portfolio at Risk (PAR 30)",
            value: `${par30Percent.toFixed(1)}%`,
            helper: `${branchLoanAging.d1_30 + branchLoanAging.d31_60 + branchLoanAging.d60Plus} overdue schedule items.`,
            tone: par30Percent >= 15 ? "red" : par30Percent >= 8 ? "yellow" : "green"
        },
        {
            id: "overdue-loans",
            label: "Overdue Loans",
            value: String(metrics.branchOverdueLoans),
            helper: `${formatCurrency(metrics.branchOverdueOutstanding)} exposed in arrears.`,
            tone: metrics.branchOverdueLoans >= 5 ? "red" : metrics.branchOverdueLoans >= 2 ? "yellow" : "green"
        },
        {
            id: "pending-approvals",
            label: "Pending Approvals",
            value: String(pendingLoanApprovals),
            helper: "Appraised facilities waiting branch approval.",
            tone: pendingLoanApprovals >= 8 ? "red" : pendingLoanApprovals >= 3 ? "yellow" : "green"
        },
        {
            id: "cash-imbalance",
            label: "Cash Imbalance Warning",
            value: hasCashImbalance ? "Warning" : "Balanced",
            helper: hasCashImbalance
                ? `Today net change ${formatCurrency(metrics.branchNetToday)} requires branch cash review.`
                : "Branch cash flow is currently within expected operating range.",
            tone: hasCashImbalance ? "red" : "green"
        }
    ] as const;
    const overdueScheduleCount = branchLoanAging.d1_30 + branchLoanAging.d31_60 + branchLoanAging.d60Plus;
    const loanOfficerRiskStrip = [
        {
            id: "officer-par30",
            label: "Portfolio at Risk (PAR 30)",
            value: `${par30Percent.toFixed(1)}%`,
            helper: `${overdueScheduleCount} delinquent schedule item(s) in your book.`,
            tone: par30Percent >= 15 ? "red" : par30Percent >= 8 ? "yellow" : "green"
        },
        {
            id: "officer-overdue-value",
            label: "Overdue Exposure",
            value: formatCurrency(metrics.branchOverdueOutstanding),
            helper: `${metrics.branchOverdueLoans} loan(s) currently in arrears.`,
            tone: metrics.branchOverdueOutstanding > 0 ? "yellow" : "green"
        },
        {
            id: "officer-approvals",
            label: "Pipeline Awaiting Decision",
            value: String(pendingLoanApplications),
            helper: "Submitted and appraised applications waiting your movement.",
            tone: pendingLoanApplications >= 10 ? "red" : pendingLoanApplications >= 4 ? "yellow" : "green"
        },
        {
            id: "officer-followups",
            label: "Collections Follow-up",
            value: String(branchFollowUps.length),
            helper: "Borrowers requiring calls, reminders, or repayment alignment.",
            tone: branchFollowUps.length >= 8 ? "red" : branchFollowUps.length >= 3 ? "yellow" : "green"
        }
    ] as const;
    const loanOfficerQueue: OperationalQueueItem[] = [
        {
            id: "officer-queue-pipeline",
            label: "Loan Application Pipeline",
            count: pendingLoanApplications,
            helper: "New and appraised applications pending officer action.",
            route: "/loans",
            tone: pendingLoanApplications > 0 ? "warning" : "success"
        },
        {
            id: "officer-queue-overdue",
            label: "Overdue Schedules",
            count: overdueScheduleCount,
            helper: "Repayments that have crossed due date and need engagement.",
            route: "/follow-ups",
            tone: overdueScheduleCount > 0 ? "error" : "success"
        },
        {
            id: "officer-queue-contact",
            label: "Member Contact Queue",
            count: branchFollowUps.length,
            helper: "Prioritized borrower follow-up list from active schedules.",
            route: "/follow-ups",
            tone: branchFollowUps.length > 0 ? "warning" : "success"
        },
        {
            id: "officer-queue-book",
            label: "Loans Under Supervision",
            count: metrics.branchLoans.length,
            helper: "Active and recently disbursed facilities in your branch scope.",
            route: "/loans",
            tone: metrics.branchLoans.length > 0 ? "info" : "success"
        }
    ];
    const operationalQueue: OperationalQueueItem[] = [
        {
            id: "queue-loans",
            label: "Pending Loan Applications",
            count: pendingLoanApplications,
            helper: "Submitted/appraised loan requests in branch workflow queue.",
            route: "/loans",
            tone: pendingLoanApplications > 0 ? "warning" : "success"
        },
        {
            id: "queue-withdrawals",
            label: "Pending Withdrawals",
            count: pendingWithdrawalRequests,
            helper: "No pending withdrawal approvals are currently visible.",
            route: "/cash",
            tone: "info"
        },
        {
            id: "queue-members",
            label: "Pending Member Approvals",
            count: pendingMemberApprovals,
            helper: "Member applications requiring branch management decisions.",
            route: "/member-applications",
            tone: pendingMemberApprovals > 0 ? "warning" : "success"
        },
        {
            id: "queue-signoff",
            label: "Tasks Requiring Branch Sign-off",
            count: signOffTasks,
            helper: "Combined approvals and control exceptions needing branch sign-off.",
            route: "/follow-ups",
            tone: signOffTasks > 0 ? "error" : "success"
        }
    ];
    const staffPerformance = useMemo<StaffPerformanceRow[]>(() => {
        const officers = state.staffUsers.filter((user) => user.role === "loan_officer" && user.is_active);

        return officers
            .map((officer) => {
                const officerApplications = branchScopedLoanApplications.filter((application) => application.appraised_by === officer.user_id);
                const issued = officerApplications.filter((application) => ["approved", "disbursed"].includes(application.status)).length;
                const linkedLoanIds = new Set(officerApplications.map((application) => application.loan_id).filter(Boolean) as string[]);
                const linkedLoans = metrics.branchLoans.filter((loan) => linkedLoanIds.has(loan.id));
                const performingLoans = linkedLoans.filter((loan) => loan.status !== "in_arrears").length;
                const collectionRate = linkedLoans.length ? (performingLoans / linkedLoans.length) * 100 : 0;

                return {
                    userId: officer.user_id,
                    officerName: officer.full_name,
                    loansIssued: issued,
                    collectionRate,
                    applicationsProcessed: officerApplications.length
                };
            })
            .sort((left, right) => right.loansIssued - left.loansIssued || right.collectionRate - left.collectionRate)
            .slice(0, 6);
    }, [branchScopedLoanApplications, metrics.branchLoans, state.staffUsers]);
    const tellerDepositAverage = tellerDashboard.timeseries_7d.length
        ? tellerDashboard.kpis.deposit_intake_7d / tellerDashboard.timeseries_7d.length
        : 0;
    const tellerWithdrawalAverage = tellerDashboard.timeseries_7d.length
        ? tellerDashboard.kpis.withdrawal_outflow_7d / tellerDashboard.timeseries_7d.length
        : 0;
    const tellerDailyTicketBaseline = tellerAverageTicketSparkline.length > 1
        ? tellerAverageTicketSparkline.slice(0, -1).reduce((sum, value) => sum + value, 0) / (tellerAverageTicketSparkline.length - 1)
        : 0;
    const tellerNetMovement = tellerDashboard.closing_cash - tellerDashboard.opening_cash;
    const tellerPeakHour = tellerDashboard.hourly_activity.length
        ? tellerDashboard.hourly_activity.slice().sort((left, right) => right.txCount - left.txCount)[0]
        : null;
    const tellerHighTicketCount = tellerDashboard.distribution_today.find((entry) => entry.bucketLabel === "250k+")?.count || 0;
    const tellerAlertCount = tellerDashboard.alerts.filter((alert) => alert.id !== "normal-day").length;
    const tellerCloseChecks =
        (tellerNetMovement < 0 ? 1 : 0)
        + (tellerAlertCount > 0 ? 1 : 0)
        + (tellerHighTicketCount > 0 ? 1 : 0);
    const tellerQueue: OperationalQueueItem[] = [
        {
            id: "teller-queue-high-ticket",
            label: "High Ticket Review",
            count: tellerHighTicketCount,
            helper: "Transactions above TSh 250,000 to validate before end-of-day sign-off.",
            route: "/cash-control",
            tone: tellerHighTicketCount > 0 ? "warning" : "success"
        },
        {
            id: "teller-queue-alerts",
            label: "Operational Alerts",
            count: tellerAlertCount,
            helper: "Risk and movement alerts generated from today's visible activity.",
            route: "/cash-control",
            tone: tellerAlertCount > 0 ? "error" : "success"
        },
        {
            id: "teller-queue-counter-pace",
            label: "Counter Throughput",
            count: tellerDashboard.kpis.tx_count_today,
            helper: "Total posted teller transactions today across savings and cash operations.",
            route: "/cash",
            tone: tellerDashboard.kpis.tx_count_today >= 20 ? "warning" : "info"
        },
        {
            id: "teller-queue-close-readiness",
            label: "Close Readiness Checks",
            count: tellerCloseChecks,
            helper: "Outstanding checks from cash movement, high-ticket items, and alert flags.",
            route: "/cash-control",
            tone: tellerCloseChecks > 0 ? "warning" : "success"
        }
    ];

    const commonLineOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: "bottom" as const
            }
        },
        scales: {
            x: {
                grid: { display: false }
            },
            y: {
                grid: { color: alpha(theme.palette.text.primary, 0.08) }
            }
        }
    };
    const dashboardAccent = theme.palette.mode === "dark" ? "#D9B273" : theme.palette.primary.main;
    const dashboardAccentStrong = theme.palette.mode === "dark" ? "#C89B52" : theme.palette.primary.dark;

    const role = profile?.role;
    const showPlatformDashboard = isInternalOps;
    const platformMetrics = useMemo(() => {
        const latestSubscriptions = platformState.tenants.map((tenant) =>
            tenant.subscriptions?.slice().sort((left, right) =>
                new Date(right.start_at || 0).getTime() - new Date(left.start_at || 0).getTime()
            )[0] || null
        );

        return {
            totalTenants: platformState.tenants.length,
            activeSubscriptions: latestSubscriptions.filter((subscription) => subscription?.status === "active").length,
            pastDueSubscriptions: latestSubscriptions.filter((subscription) => subscription?.status === "past_due").length,
            totalBranches: platformState.branches.length,
            requestsPerSec: Number(platformState.systemMetrics?.requests_per_sec || 0),
            p95LatencyMs: Number(platformState.systemMetrics?.p95_latency_ms || 0),
            errorRatePct: Number(platformState.systemMetrics?.error_rate_pct || 0),
            activeUsers: Number(platformState.systemMetrics?.active_users || 0),
            activeTenants: Number(platformState.systemMetrics?.active_tenants || 0),
            cpuPct: Number(platformState.infrastructure?.cpu_pct || 0),
            memoryPct: Number(platformState.infrastructure?.memory_pct || 0),
            diskPct: Number(platformState.infrastructure?.disk_pct || 0),
            networkMbps: Number(platformState.infrastructure?.network_mbps || 0),
            planBreakdown: ["starter", "growth", "enterprise"].map((plan) => ({
                plan,
                count: latestSubscriptions.filter((subscription) => (subscription?.plan || "starter") === plan).length
            })),
            growthTrend: [...platformState.tenants.reduce((accumulator, tenant) => {
                const key = tenant.created_at.slice(0, 7);
                accumulator.set(key, (accumulator.get(key) || 0) + 1);
                return accumulator;
            }, new Map<string, number>()).entries()].sort(([left], [right]) => left.localeCompare(right)).slice(-6),
            topTrafficTenants: platformState.tenantTraffic.slice(0, 6),
            recentErrors: platformState.errors.slice(0, 8),
            slowEndpoints: platformState.slowEndpoints.slice(0, 8)
        };
    }, [platformState]);
    const platformColumns: Column<Tenant>[] = [
        {
            key: "tenant",
            header: "Tenant",
            render: (row) => (
                <Box>
                    <Typography variant="body2" fontWeight={700}>{row.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{row.registration_number}</Typography>
                </Box>
            )
        },
        {
            key: "plan",
            header: "Plan",
            render: (row) => {
                const subscription = row.subscriptions?.[0];
                return (subscription?.plan || "starter").toUpperCase();
            }
        },
        {
            key: "status",
            header: "Subscription",
            render: (row) => row.subscriptions?.[0]?.status || "missing"
        },
        {
            key: "branches",
            header: "Branches",
            render: (row) => String(platformState.branches.filter((branch) => branch.tenant_id === row.id).length)
        },
        { key: "created", header: "Created", render: (row) => formatDate(row.created_at) }
    ];
    const platformTrafficColumns: Column<PlatformTenantTrafficRow>[] = [
        {
            key: "tenant_name",
            header: "Tenant",
            render: (row) => (
                <Stack spacing={0.25}>
                    <Typography variant="body2" fontWeight={700}>{row.tenant_name}</Typography>
                    <Typography variant="caption" color="text.secondary">{row.tenant_id}</Typography>
                </Stack>
            )
        },
        { key: "request_count", header: "Requests", render: (row) => row.request_count.toLocaleString() },
        { key: "error_count", header: "Errors", render: (row) => row.error_count.toLocaleString() },
        { key: "avg_latency_ms", header: "Avg Latency", render: (row) => `${row.avg_latency_ms.toFixed(1)} ms` },
        { key: "active_users", header: "Active Users", render: (row) => row.active_users.toLocaleString() }
    ];
    const platformErrorColumns: Column<PlatformErrorRow>[] = [
        { key: "timestamp", header: "Time", render: (row) => formatDate(row.timestamp) },
        { key: "endpoint", header: "Endpoint", render: (row) => row.endpoint },
        {
            key: "status_code",
            header: "Status",
            render: (row) => (
                <Chip
                    size="small"
                    label={String(row.status_code)}
                    color={row.status_code >= 500 ? "error" : "warning"}
                    variant="outlined"
                />
            )
        },
        {
            key: "tenant_id",
            header: "Tenant",
            render: (row) => row.tenant_name || row.tenant_id || "System"
        },
        { key: "message", header: "Error", render: (row) => row.message }
    ];
    const platformSlowColumns: Column<PlatformSlowEndpointRow>[] = [
        { key: "endpoint", header: "Endpoint", render: (row) => row.endpoint },
        { key: "avg_latency_ms", header: "Avg Latency", render: (row) => `${row.avg_latency_ms.toFixed(1)} ms` },
        { key: "calls", header: "Calls", render: (row) => row.calls.toLocaleString() }
    ];

    const roleMetrics: RoleMetric[] = role === "loan_officer"
            ? [
                { label: "Active Loans", value: String(metrics.branchLoans.length) },
                { label: "Overdue Loans", value: String(metrics.branchOverdueLoans) },
                { label: "Outstanding Portfolio", value: formatCurrency(metrics.branchOutstanding) }
            ]
            : role === "branch_manager"
                ? [
                    { label: "Branch Savings", value: formatCurrency(metrics.branchSavings) },
                    { label: "Branch Loan Portfolio", value: formatCurrency(metrics.branchOutstanding) },
                    { label: "Active Members", value: String(metrics.branchActiveMembers) }
                ]
                : role === "auditor"
                    ? [
                        { label: "Members Reviewed", value: String(metrics.totalMembers) },
                        { label: "Overdue Schedules", value: String(metrics.overdueSchedules) },
                        { label: "Accrued Interest", value: formatCurrency(metrics.accruedInterest) }
                    ]
                    : [
                        { label: "Total Members", value: String(metrics.totalMembers) },
                        { label: "Savings Balance", value: formatCurrency(metrics.totalDeposits - metrics.totalWithdrawals) },
                        { label: "Loan Portfolio", value: formatCurrency(metrics.outstandingLoans) },
                        { label: "PAR Signals", value: `${metrics.overdueLoans} overdue loans` }
                    ];

    if (loading) {
        return <DashboardLoadingState />;
    }

    if (error) {
        return <Alert severity="error" variant="outlined">{error}</Alert>;
    }

    return (
        <Stack spacing={3}>
            <MotionCard variant="outlined" inView>
                <CardContent>
                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
                        <div>
                            <Typography variant="h5">
                                {showPlatformDashboard ? "Platform Owner" : formatRole(role || "staff")} Dashboard
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {showPlatformDashboard
                                    ? "Cross-tenant SaaS oversight with deliberate tenant workspace switching."
                                    : `${selectedTenantName || selectedTenantId} operations summary with branch scope ${branchIds.length || "all"}.`}
                            </Typography>
                        </div>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <Chip label={showPlatformDashboard ? "Platform Owner" : role ? formatRole(role) : "Internal Ops"} color="primary" variant="outlined" />
                            {supplementalLoading ? <Chip label="Refreshing workflow data..." size="small" variant="outlined" /> : null}
                        </Stack>
                    </Stack>
                </CardContent>
            </MotionCard>

            {showPlatformDashboard ? (
                <>
                    <MotionSection inView>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                            <MetricCard label="Total Tenants" value={String(platformMetrics.totalTenants)} helper="All SACCOS tenants on the platform." />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                            <MetricCard label="Active Subscriptions" value={String(platformMetrics.activeSubscriptions)} helper="Tenants currently in a usable billing window." />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                            <MetricCard label="Past Due" value={String(platformMetrics.pastDueSubscriptions)} helper="Tenants requiring revenue follow-up." />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                            <MetricCard label="Network Branches" value={String(platformMetrics.totalBranches)} helper="Operational branches across the full platform." />
                        </Grid>
                    </Grid>
                    </MotionSection>

                    <MotionSection inView>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                            <MetricCard
                                label="API Throughput"
                                value={`${platformMetrics.requestsPerSec.toFixed(2)} req/s`}
                                helper="Current system-wide request rate."
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                            <MetricCard
                                label="API p95 Latency"
                                value={`${platformMetrics.p95LatencyMs.toFixed(1)} ms`}
                                helper="Current p95 latency from platform telemetry."
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                            <MetricCard
                                label="Error Rate"
                                value={`${platformMetrics.errorRatePct.toFixed(2)}%`}
                                helper="Server-side API error ratio."
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                            <MetricCard
                                label="Active Users / Tenants"
                                value={`${platformMetrics.activeUsers} / ${platformMetrics.activeTenants}`}
                                helper="Real active load in the current metrics window."
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                            <MetricCard
                                label="CPU Usage"
                                value={`${platformMetrics.cpuPct.toFixed(2)}%`}
                                helper="Host compute utilization."
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                            <MetricCard
                                label="RAM Usage"
                                value={`${platformMetrics.memoryPct.toFixed(2)}%`}
                                helper="Current memory pressure."
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                            <MetricCard
                                label="Disk Usage"
                                value={`${platformMetrics.diskPct.toFixed(2)}%`}
                                helper="Persistent storage consumption."
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                            <MetricCard
                                label="Network Throughput"
                                value={`${platformMetrics.networkMbps.toFixed(2)} Mbps`}
                                helper="Approximate network throughput."
                            />
                        </Grid>
                    </Grid>
                    </MotionSection>

                    <MotionSection inView>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, lg: 7 }}>
                            <ChartPanel
                                title="Tenant Growth"
                                subtitle="Recent onboarding volume across the platform."
                                type="bar"
                                data={{
                                    labels: platformMetrics.growthTrend.map(([label]) => label),
                                    datasets: [{
                                        label: "Tenants",
                                        data: platformMetrics.growthTrend.map(([, value]) => value),
                                        backgroundColor: alpha(theme.palette.primary.main, 0.72)
                                    }]
                                }}
                                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, lg: 5 }}>
                            <ChartPanel
                                title="Plan Breakdown"
                                subtitle="Billing mix across all onboarded SACCOS."
                                type="doughnut"
                                data={{
                                    labels: platformMetrics.planBreakdown.map((entry) => entry.plan.toUpperCase()),
                                    datasets: [{
                                        data: platformMetrics.planBreakdown.map((entry) => entry.count),
                                        backgroundColor: [
                                            alpha(theme.palette.grey[500], 0.85),
                                            theme.palette.primary.main,
                                            theme.palette.secondary.main
                                        ]
                                    }]
                                }}
                                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }}
                            />
                        </Grid>
                    </Grid>
                    </MotionSection>

                    <MotionCard variant="outlined" inView>
                        <CardContent>
                            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.5} sx={{ mb: 1 }}>
                                <Typography variant="h6">Tenant Inventory</Typography>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => navigate("/platform/operations")}
                                >
                                    Open Operations Control Room
                                </Button>
                            </Stack>
                            <DataTable
                                rows={platformState.tenants.slice(0, 8)}
                                columns={platformColumns}
                                emptyMessage="No tenants available on the platform."
                            />
                        </CardContent>
                    </MotionCard>

                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, xl: 6 }}>
                            <MotionCard variant="outlined" inView>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>Top Tenant Traffic</Typography>
                                    <DataTable
                                        rows={platformMetrics.topTrafficTenants}
                                        columns={platformTrafficColumns}
                                        emptyMessage="No tenant traffic metrics available yet."
                                    />
                                </CardContent>
                            </MotionCard>
                        </Grid>
                        <Grid size={{ xs: 12, xl: 6 }}>
                            <MotionCard variant="outlined" inView>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>Slow Endpoints</Typography>
                                    <DataTable
                                        rows={platformMetrics.slowEndpoints}
                                        columns={platformSlowColumns}
                                        emptyMessage="No slow endpoint telemetry available."
                                    />
                                </CardContent>
                            </MotionCard>
                        </Grid>
                    </Grid>

                    <MotionCard variant="outlined" inView>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>Recent API Errors</Typography>
                            <DataTable
                                rows={platformMetrics.recentErrors}
                                columns={platformErrorColumns}
                                emptyMessage="No recent API errors detected."
                            />
                        </CardContent>
                    </MotionCard>
                </>
            ) : null}

            {!showPlatformDashboard && role === "teller" ? (
                <MotionSection inView>
                <Stack spacing={2}>
                    <MotionCard
                        variant="outlined"
                        inView
                        sx={{
                            borderRadius: 2,
                            color: "text.primary",
                            background: theme.palette.mode === "dark"
                                ? `linear-gradient(135deg, ${alpha("#1B2535", 0.92)}, ${alpha("#D9B273", 0.16)})`
                                : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)}, ${alpha(theme.palette.background.paper, 0.97)})`
                        }}
                    >
                        <CardContent sx={{ p: { xs: 2.25, md: 2.75 } }}>
                            <Stack spacing={2}>
                                <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5}>
                                    <Box>
                                        <Typography variant="overline" color="text.secondary">
                                            Teller command center
                                        </Typography>
                                        <Typography variant="h5" sx={{ mt: 0.5 }}>
                                            Counter performance, cash position, and close readiness
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 760 }}>
                                            Monitor today's teller activity, resolve high-risk transaction patterns quickly, and complete close checks with confidence.
                                        </Typography>
                                    </Box>
                                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="flex-start">
                                        <Chip
                                            label={`${tellerDashboard.kpis.tx_count_today} transaction(s) today`}
                                            color={tellerDashboard.kpis.tx_count_today >= 20 ? "warning" : "success"}
                                            variant="outlined"
                                        />
                                        <Chip
                                            label={tellerPeakHour ? `Peak ${tellerPeakHour.hour}` : "No peak hour yet"}
                                            color={tellerPeakHour && tellerPeakHour.txCount >= 5 ? "warning" : "default"}
                                            variant="outlined"
                                        />
                                        <Chip
                                            label={tellerNetMovement >= 0 ? `Net +${formatCurrency(tellerNetMovement)}` : `Net ${formatCurrency(tellerNetMovement)}`}
                                            color={tellerNetMovement >= 0 ? "success" : "error"}
                                            variant="outlined"
                                        />
                                    </Stack>
                                </Stack>
                                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap flexWrap="wrap">
                                    <Button
                                        variant="contained"
                                        onClick={() => navigate("/cash")}
                                        startIcon={<PaymentsRoundedIcon />}
                                        sx={theme.palette.mode === "dark" ? { bgcolor: dashboardAccent, color: "#1a1a1a", "&:hover": { bgcolor: dashboardAccentStrong } } : undefined}
                                    >
                                        Post Transaction
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        onClick={() => navigate("/cash-control")}
                                        startIcon={<ReceiptLongRoundedIcon />}
                                        sx={theme.palette.mode === "dark" ? { borderColor: alpha(dashboardAccent, 0.44), color: dashboardAccent, "&:hover": { borderColor: alpha(dashboardAccent, 0.78), bgcolor: alpha(dashboardAccent, 0.1) } } : undefined}
                                    >
                                        Cash Controls
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        onClick={() => navigate("/members")}
                                        startIcon={<BadgeRoundedIcon />}
                                        sx={theme.palette.mode === "dark" ? { borderColor: alpha(dashboardAccent, 0.44), color: dashboardAccent, "&:hover": { borderColor: alpha(dashboardAccent, 0.78), bgcolor: alpha(dashboardAccent, 0.1) } } : undefined}
                                    >
                                        Member Lookup
                                    </Button>
                                </Stack>
                            </Stack>
                        </CardContent>
                    </MotionCard>

                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                            <KpiCard
                                label="Teller Position"
                                value={tellerDashboard.kpis.teller_position}
                                deltaLabel={buildDeltaLabel(
                                    tellerDashboard.closing_cash,
                                    tellerDashboard.opening_cash,
                                    "vs opening"
                                )}
                                statusLabel={tellerDashboard.closing_cash >= tellerDashboard.opening_cash ? "Positive cash movement" : "Net outflow watch"}
                                sparkline={tellerDashboard.timeseries_7d.map((entry) => entry.deposits - entry.withdrawals)}
                                tone={getDeltaTone(tellerDashboard.closing_cash, tellerDashboard.opening_cash)}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                            <KpiCard
                                label="Deposits Today"
                                value={tellerDashboard.kpis.deposits_today}
                                deltaLabel={buildDeltaLabel(
                                    tellerDashboard.kpis.deposits_today,
                                    tellerDepositAverage,
                                    "vs 7-day avg"
                                )}
                                statusLabel={tellerDashboard.kpis.deposits_today >= tellerDepositAverage ? "Strong intake" : "Below intake run-rate"}
                                sparkline={tellerDashboard.timeseries_7d.map((entry) => entry.deposits)}
                                tone={getDeltaTone(tellerDashboard.kpis.deposits_today, tellerDepositAverage)}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                            <KpiCard
                                label="Withdrawals Today"
                                value={tellerDashboard.kpis.withdrawals_today}
                                deltaLabel={buildDeltaLabel(
                                    tellerDashboard.kpis.withdrawals_today,
                                    tellerWithdrawalAverage,
                                    "vs 7-day avg"
                                )}
                                statusLabel={tellerDashboard.kpis.withdrawals_today <= tellerWithdrawalAverage ? "Managed outflow" : "High withdrawal spike"}
                                sparkline={tellerDashboard.timeseries_7d.map((entry) => entry.withdrawals)}
                                tone={getDeltaTone(
                                    tellerDashboard.kpis.withdrawals_today,
                                    tellerWithdrawalAverage,
                                    false
                                )}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                            <KpiCard
                                label="Avg Ticket Today"
                                value={tellerDashboard.kpis.avg_ticket_today}
                                deltaLabel={buildDeltaLabel(
                                    tellerDashboard.kpis.avg_ticket_today,
                                    tellerDailyTicketBaseline,
                                    "vs recent avg"
                                )}
                                statusLabel={tellerDashboard.kpis.tx_count_today >= 12 ? "Active counter day" : "Moderate transaction pace"}
                                sparkline={tellerAverageTicketSparkline}
                                tone={getDeltaTone(tellerDashboard.kpis.avg_ticket_today, tellerDailyTicketBaseline)}
                            />
                        </Grid>
                    </Grid>
                </Stack>
                </MotionSection>
            ) : role === "loan_officer" ? (
                <MotionSection inView>
                <Stack spacing={2}>
                    <MotionCard
                        variant="outlined"
                        inView
                        sx={{
                            borderRadius: 2,
                            color: "text.primary",
                            background: theme.palette.mode === "dark"
                                ? `linear-gradient(135deg, ${alpha("#1B2535", 0.92)}, ${alpha("#D9B273", 0.16)})`
                                : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)}, ${alpha(theme.palette.background.paper, 0.97)})`
                        }}
                    >
                        <CardContent sx={{ p: { xs: 2.25, md: 2.75 } }}>
                            <Stack spacing={2}>
                                <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5}>
                                    <Box>
                                        <Typography variant="overline" color="text.secondary">
                                            Loan officer workspace
                                        </Typography>
                                        <Typography variant="h5" sx={{ mt: 0.5 }}>
                                            Portfolio control, collections, and disbursement execution
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 760 }}>
                                            Focus your day on appraisal pipeline decisions, overdue collection priorities, and timely disbursement follow-through.
                                        </Typography>
                                    </Box>
                                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="flex-start">
                                        <Chip
                                            label={`PAR ${par30Percent.toFixed(1)}%`}
                                            color={par30Percent >= 15 ? "error" : par30Percent >= 8 ? "warning" : "success"}
                                            variant="outlined"
                                        />
                                        <Chip
                                            label={`${branchFollowUps.length} follow-up item(s)`}
                                            color={branchFollowUps.length > 0 ? "warning" : "success"}
                                            variant="outlined"
                                        />
                                    </Stack>
                                </Stack>
                                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap flexWrap="wrap">
                                    <Button
                                        variant="contained"
                                        onClick={() => navigate("/loans")}
                                        startIcon={<RequestQuoteRoundedIcon />}
                                        sx={theme.palette.mode === "dark" ? { bgcolor: dashboardAccent, color: "#1a1a1a", "&:hover": { bgcolor: dashboardAccentStrong } } : undefined}
                                    >
                                        Open Loan Pipeline
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        onClick={() => navigate("/follow-ups")}
                                        startIcon={<AssignmentTurnedInRoundedIcon />}
                                        sx={theme.palette.mode === "dark" ? { borderColor: alpha(dashboardAccent, 0.44), color: dashboardAccent, "&:hover": { borderColor: alpha(dashboardAccent, 0.78), bgcolor: alpha(dashboardAccent, 0.1) } } : undefined}
                                    >
                                        Collections Queue
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        onClick={() => navigate("/member-applications")}
                                        startIcon={<BadgeRoundedIcon />}
                                        sx={theme.palette.mode === "dark" ? { borderColor: alpha(dashboardAccent, 0.44), color: dashboardAccent, "&:hover": { borderColor: alpha(dashboardAccent, 0.78), bgcolor: alpha(dashboardAccent, 0.1) } } : undefined}
                                    >
                                        Member Applications
                                    </Button>
                                </Stack>
                            </Stack>
                        </CardContent>
                    </MotionCard>

                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                            <BranchManagerTopCard
                                label="Loans Under Management"
                                value={String(metrics.branchLoans.length)}
                                helper="Active and disbursed facilities assigned to your operational scope."
                                status={`${metrics.branchOverdueLoans} overdue loan(s)`}
                                tone={metrics.branchOverdueLoans > 0 ? "negative" : "positive"}
                                icon={<RequestQuoteRoundedIcon fontSize="small" />}
                                featured
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                            <BranchManagerTopCard
                                label="Outstanding Book"
                                value={formatCurrency(metrics.branchOutstanding)}
                                helper="Total principal and accrued value currently supervised by loan operations."
                                status={metrics.branchOutstanding > 0 ? "Live portfolio" : "No active exposure"}
                                tone="neutral"
                                icon={<PaymentsRoundedIcon fontSize="small" />}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                            <BranchManagerTopCard
                                label="Repayment Pressure"
                                value={formatCurrency(metrics.branchOverdueOutstanding)}
                                helper="Aggregate overdue amount requiring borrower repayment alignment."
                                status={`${overdueScheduleCount} overdue schedule(s)`}
                                tone={overdueScheduleCount > 0 ? "negative" : "positive"}
                                icon={<PieChartRoundedIcon fontSize="small" />}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                            <BranchManagerTopCard
                                label="Pending Appraisals"
                                value={String(pendingLoanApplications)}
                                helper="Submitted and appraised applications still waiting officer movement."
                                status={pendingLoanApplications > 0 ? "Action required" : "Pipeline clear"}
                                tone={pendingLoanApplications > 0 ? "neutral" : "positive"}
                                icon={<BadgeRoundedIcon fontSize="small" />}
                            />
                        </Grid>
                    </Grid>

                    <Grid container spacing={2}>
                        {loanOfficerRiskStrip.map((item) => (
                            <Grid key={item.id} size={{ xs: 12, sm: 6, xl: 3 }}>
                                <RiskStripCard
                                    label={item.label}
                                    value={item.value}
                                    helper={item.helper}
                                    tone={item.tone}
                                />
                            </Grid>
                        ))}
                    </Grid>
                </Stack>
                </MotionSection>
            ) : role === "branch_manager" ? (
                <MotionSection inView>
                <Stack spacing={2}>
                    <MotionCard
                        variant="outlined"
                        inView
                        sx={{
                            borderRadius: 2,
                            color: "text.primary",
                            background: theme.palette.mode === "dark"
                                ? `linear-gradient(135deg, ${alpha("#1B2535", 0.92)}, ${alpha("#D9B273", 0.14)})`
                                : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)}, ${alpha(theme.palette.background.paper, 0.95)})`
                        }}
                    >
                        <CardContent sx={{ p: { xs: 2.25, md: 2.75 } }}>
                            <Stack spacing={2}>
                                <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5}>
                                    <Box>
                                        <Typography variant="overline" color="text.secondary">
                                            Branch command center
                                        </Typography>
                                        <Typography variant="h5" sx={{ mt: 0.5 }}>
                                            Daily branch control, approvals, and risk visibility
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 760 }}>
                                            Monitor branch portfolio quality, supervise approval queues, and act quickly on cash, loan, and member workflow exceptions.
                                        </Typography>
                                    </Box>
                                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="flex-start">
                                        <Chip
                                            label={`PAR ${par30Percent.toFixed(1)}%`}
                                            color={par30Percent >= 15 ? "error" : par30Percent >= 8 ? "warning" : "success"}
                                            variant="outlined"
                                        />
                                        <Chip
                                            label={hasCashImbalance ? "Cash check required" : "Cash status healthy"}
                                            color={hasCashImbalance ? "error" : "success"}
                                            variant="outlined"
                                        />
                                    </Stack>
                                </Stack>
                                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap flexWrap="wrap">
                                    <Button
                                        variant="contained"
                                        onClick={() => navigate("/loans")}
                                        startIcon={<RequestQuoteRoundedIcon />}
                                        sx={theme.palette.mode === "dark" ? { bgcolor: dashboardAccent, color: "#1a1a1a", "&:hover": { bgcolor: dashboardAccentStrong } } : undefined}
                                    >
                                        Review Loan Queue
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        onClick={() => navigate("/member-applications")}
                                        startIcon={<BadgeRoundedIcon />}
                                        sx={theme.palette.mode === "dark" ? { borderColor: alpha(dashboardAccent, 0.44), color: dashboardAccent, "&:hover": { borderColor: alpha(dashboardAccent, 0.78), bgcolor: alpha(dashboardAccent, 0.1) } } : undefined}
                                    >
                                        Member Approvals
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        onClick={() => navigate("/follow-ups")}
                                        startIcon={<AssignmentTurnedInRoundedIcon />}
                                        sx={theme.palette.mode === "dark" ? { borderColor: alpha(dashboardAccent, 0.44), color: dashboardAccent, "&:hover": { borderColor: alpha(dashboardAccent, 0.78), bgcolor: alpha(dashboardAccent, 0.1) } } : undefined}
                                    >
                                        Follow-up Tasks
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        onClick={() => navigate("/cash-control")}
                                        startIcon={<ReceiptLongRoundedIcon />}
                                        sx={theme.palette.mode === "dark" ? { borderColor: alpha(dashboardAccent, 0.44), color: dashboardAccent, "&:hover": { borderColor: alpha(dashboardAccent, 0.78), bgcolor: alpha(dashboardAccent, 0.1) } } : undefined}
                                    >
                                        Cash Controls
                                    </Button>
                                </Stack>
                            </Stack>
                        </CardContent>
                    </MotionCard>

                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                            <BranchManagerTopCard
                                label="Branch Savings"
                                value={formatCurrency(metrics.branchSavings)}
                                helper="Visible savings balances across active branch members."
                                status="Live balance"
                                tone="positive"
                                icon={<AccountBalanceWalletRoundedIcon fontSize="small" />}
                                featured
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                            <BranchManagerTopCard
                                label="Loan Portfolio"
                                value={formatCurrency(metrics.branchOutstanding)}
                                helper="Outstanding principal and accrued interest under branch supervision."
                                status={`${metrics.branchOverdueLoans} overdue loan(s)`}
                                tone={metrics.branchOverdueLoans > 0 ? "negative" : "neutral"}
                                icon={<RequestQuoteRoundedIcon fontSize="small" />}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                            <BranchManagerTopCard
                                label="Member Operations"
                                value={String(metrics.branchActiveMembers)}
                                helper="Active branch members currently available for operations."
                                status={`${pendingMemberApprovals} pending member approval(s)`}
                                tone={pendingMemberApprovals > 0 ? "neutral" : "positive"}
                                icon={<BadgeRoundedIcon fontSize="small" />}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                            <BranchManagerTopCard
                                label="Branch Sign-off Tasks"
                                value={String(signOffTasks)}
                                helper="Combined approvals and control exceptions needing branch manager sign-off."
                                status={signOffTasks > 0 ? "Action required" : "No blockers"}
                                tone={signOffTasks > 0 ? "negative" : "positive"}
                                icon={<RuleRoundedIcon fontSize="small" />}
                            />
                        </Grid>
                    </Grid>

                    <Grid container spacing={2}>
                        {branchRiskStrip.map((item) => (
                            <Grid key={item.id} size={{ xs: 12, sm: 6, xl: 3 }}>
                                <RiskStripCard
                                    label={item.label}
                                    value={item.value}
                                    helper={item.helper}
                                    tone={item.tone}
                                />
                            </Grid>
                        ))}
                    </Grid>
                </Stack>
                </MotionSection>
            ) : (
                <MotionSection inView>
                <Grid container spacing={2}>
                    {roleMetrics.map((metric) => (
                        <Grid key={metric.label} size={{ xs: 12, sm: 6, md: 3 }}>
                            <MetricCard label={metric.label} value={metric.value} helper={metric.helper} />
                        </Grid>
                    ))}
                </Grid>
                </MotionSection>
            )}

            {!showPlatformDashboard ? (
            <MotionSection inView>
            <Grid container spacing={2}>
                {role === "teller" ? (
                    <>
                        <Grid size={{ xs: 12, lg: 7 }}>
                            <CashFlowChart points={tellerDashboard.timeseries_7d} />
                        </Grid>
                        <Grid size={{ xs: 12, lg: 5 }}>
                            <MotionCard variant="outlined" inView sx={{ height: "100%" }}>
                                <CardContent sx={{ height: "100%" }}>
                                    <Stack spacing={2.25} sx={{ height: "100%" }}>
                                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                                            <Box>
                                                <Typography variant="h6">Teller Action Queue</Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    Priority checks and operational tasks to clear before close.
                                                </Typography>
                                            </Box>
                                            <Button size="small" variant="outlined" onClick={() => navigate("/cash-control")}>
                                                Open controls
                                            </Button>
                                        </Stack>
                                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                            <Chip
                                                icon={<WarningAmberRoundedIcon />}
                                                label={tellerCloseChecks > 0 ? `${tellerCloseChecks} close check(s) open` : "Close checks clear"}
                                                color={tellerCloseChecks > 0 ? "warning" : "success"}
                                                variant="outlined"
                                            />
                                            <Chip
                                                label={tellerPeakHour ? `Peak load ${tellerPeakHour.hour}` : "No peak load detected"}
                                                color={tellerPeakHour && tellerPeakHour.txCount >= 5 ? "warning" : "default"}
                                                variant="outlined"
                                            />
                                        </Stack>
                                        <Grid container spacing={1.25}>
                                            {tellerQueue.map((item) => (
                                                <Grid key={item.id} size={{ xs: 12, sm: 6 }}>
                                                    <OperationalQueueCard item={item} onOpen={(route) => navigate(route)} />
                                                </Grid>
                                            ))}
                                        </Grid>
                                    </Stack>
                                </CardContent>
                            </MotionCard>
                        </Grid>
                        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
                            <WaterfallCard
                                openingCash={tellerDashboard.opening_cash}
                                deposits={tellerDashboard.kpis.deposits_today}
                                withdrawals={tellerDashboard.kpis.withdrawals_today}
                                closingCash={tellerDashboard.closing_cash}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
                            <DistributionChart points={tellerDashboard.distribution_today} />
                        </Grid>
                        <Grid size={{ xs: 12, lg: 4 }}>
                            <AlertsPanel
                                alerts={tellerDashboard.alerts}
                                hourlyActivity={tellerDashboard.hourly_activity}
                            />
                        </Grid>
                    </>
                ) : role === "loan_officer" ? (
                    <>
                        <Grid size={{ xs: 12, lg: 7 }}>
                            <ChartPanel
                                title="Loan Disbursement Trend"
                                subtitle="Monthly disbursement volume across the branch portfolio you supervise."
                                data={{
                                    labels: branchLoanTrend.map(([label]) => label),
                                    datasets: [
                                        {
                                            label: "Loan principal",
                                            data: branchLoanTrend.map(([, value]) => value),
                                            borderColor: theme.palette.primary.main,
                                            backgroundColor: alpha(theme.palette.primary.main, 0.18)
                                        }
                                    ]
                                }}
                                options={commonLineOptions}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, lg: 5 }}>
                            <ChartPanel
                                title="Overdue Mix"
                                type="doughnut"
                                data={{
                                    labels: branchAgingBuckets.map(([label]) => label),
                                    datasets: [{
                                        data: branchAgingBuckets.map(([, value]) => value),
                                        backgroundColor: [
                                            theme.palette.success.main,
                                            theme.palette.error.main,
                                            theme.palette.warning.main
                                        ]
                                    }]
                                }}
                                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, lg: 7 }}>
                            <MotionCard variant="outlined" inView sx={{ height: "100%" }}>
                                <CardContent sx={{ height: "100%" }}>
                                    <Stack spacing={2.25} sx={{ height: "100%" }}>
                                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                                            <Box>
                                                <Typography variant="h6">Officer Action Queue</Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    Prioritized workflow items to clear pipeline and protect portfolio quality.
                                                </Typography>
                                            </Box>
                                            <Button size="small" variant="outlined" onClick={() => navigate("/loans")}>
                                                View loans
                                            </Button>
                                        </Stack>
                                        <Grid container spacing={1.25}>
                                            {loanOfficerQueue.map((item) => (
                                                <Grid key={item.id} size={{ xs: 12, sm: 6 }}>
                                                    <OperationalQueueCard item={item} onOpen={(route) => navigate(route)} />
                                                </Grid>
                                            ))}
                                        </Grid>
                                    </Stack>
                                </CardContent>
                            </MotionCard>
                        </Grid>
                        <Grid size={{ xs: 12, lg: 5 }}>
                            <MotionCard variant="outlined" inView sx={{ height: "100%" }}>
                                <CardContent sx={{ height: "100%" }}>
                                    <Stack spacing={2} sx={{ height: "100%" }}>
                                        <Box>
                                            <Typography variant="h6">Collections Pressure</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Focus immediate borrower engagement on overdue schedules and repayment risk.
                                            </Typography>
                                        </Box>
                                        <Chip
                                            icon={<WarningAmberRoundedIcon />}
                                            label={overdueScheduleCount > 0 ? `${overdueScheduleCount} overdue schedule(s)` : "No overdue schedules"}
                                            color={overdueScheduleCount > 0 ? "warning" : "success"}
                                            variant="outlined"
                                            sx={{ width: "fit-content" }}
                                        />
                                        <Stack spacing={1.1}>
                                            <Stack direction="row" justifyContent="space-between">
                                                <Typography variant="body2" color="text.secondary">Overdue exposure</Typography>
                                                <Typography variant="subtitle2">{formatCurrency(metrics.branchOverdueOutstanding)}</Typography>
                                            </Stack>
                                            <Stack direction="row" justifyContent="space-between">
                                                <Typography variant="body2" color="text.secondary">Pending appraisals</Typography>
                                                <Typography variant="subtitle2">{pendingLoanApplications}</Typography>
                                            </Stack>
                                            <Stack direction="row" justifyContent="space-between">
                                                <Typography variant="body2" color="text.secondary">PAR 30</Typography>
                                                <Typography variant="subtitle2">{par30Percent.toFixed(1)}%</Typography>
                                            </Stack>
                                        </Stack>
                                        <Divider />
                                        <Button
                                            variant="contained"
                                            startIcon={<AssignmentTurnedInRoundedIcon />}
                                            onClick={() => navigate("/follow-ups")}
                                            sx={theme.palette.mode === "dark" ? { bgcolor: dashboardAccent, color: "#1a1a1a", "&:hover": { bgcolor: dashboardAccentStrong } } : undefined}
                                        >
                                            Open Follow-up List
                                        </Button>
                                    </Stack>
                                </CardContent>
                            </MotionCard>
                        </Grid>
                    </>
                ) : role === "branch_manager" ? (
                    <>
                        <Grid size={{ xs: 12, lg: 7 }}>
                            <ChartPanel
                                title="Loan Aging Summary"
                                subtitle="Current portfolio quality by overdue days and PAR percentage."
                                data={{
                                    labels: ["Current", "1-30 days", "31-60 days", "60+ days"],
                                    datasets: [
                                        {
                                            label: "Schedules",
                                            data: [
                                                branchLoanAging.current,
                                                branchLoanAging.d1_30,
                                                branchLoanAging.d31_60,
                                                branchLoanAging.d60Plus
                                            ],
                                            backgroundColor: [
                                                alpha(theme.palette.success.main, 0.74),
                                                alpha(theme.palette.warning.main, 0.74),
                                                alpha(theme.palette.warning.main, 0.58),
                                                alpha(theme.palette.error.main, 0.74)
                                            ]
                                        }
                                    ]
                                }}
                                type="bar"
                                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, lg: 5 }}>
                            <MotionCard variant="outlined" inView sx={{ height: "100%" }}>
                                <CardContent sx={{ height: "100%" }}>
                                    <Stack spacing={2} sx={{ height: "100%" }}>
                                        <Box>
                                            <Typography variant="h6">Cash Position</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Opening balance, today inflows/outflows, and current net cash direction.
                                            </Typography>
                                        </Box>
                                        <Stack spacing={1.25}>
                                            <Stack direction="row" justifyContent="space-between">
                                                <Typography variant="body2" color="text.secondary">Opening balance</Typography>
                                                <Typography variant="subtitle2">{formatCurrency(metrics.branchOpeningBalance)}</Typography>
                                            </Stack>
                                            <Stack direction="row" justifyContent="space-between">
                                                <Typography variant="body2" color="text.secondary">Inflows today</Typography>
                                                <Typography variant="subtitle2" color="success.main">{formatCurrency(metrics.branchInflowsToday)}</Typography>
                                            </Stack>
                                            <Stack direction="row" justifyContent="space-between">
                                                <Typography variant="body2" color="text.secondary">Outflows today</Typography>
                                                <Typography variant="subtitle2" color="error.main">{formatCurrency(metrics.branchOutflowsToday)}</Typography>
                                            </Stack>
                                            <Divider />
                                            <Stack direction="row" justifyContent="space-between">
                                                <Typography variant="subtitle2">Net change</Typography>
                                                <Typography variant="subtitle2" color={metrics.branchNetToday >= 0 ? "success.main" : "error.main"}>
                                                    {formatCurrency(metrics.branchNetToday)}
                                                </Typography>
                                            </Stack>
                                            <Chip
                                                icon={<WarningAmberRoundedIcon />}
                                                label={metrics.branchNetToday < 0 ? "Cash imbalance requires review" : "Cash movement within tolerance"}
                                                color={metrics.branchNetToday < 0 ? "error" : "success"}
                                                variant="outlined"
                                            />
                                        </Stack>
                                    </Stack>
                                </CardContent>
                            </MotionCard>
                        </Grid>
                        <Grid size={{ xs: 12, lg: 7 }}>
                            <MotionCard variant="outlined" inView sx={{ height: "100%" }}>
                                <CardContent sx={{ height: "100%" }}>
                                    <Stack spacing={2.25} sx={{ height: "100%" }}>
                                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                                            <Box>
                                                <Typography variant="h6">Operational Queue</Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    Work items requiring immediate branch action.
                                                </Typography>
                                            </Box>
                                            <Button size="small" variant="outlined" onClick={() => navigate("/follow-ups")}>
                                                View all
                                            </Button>
                                        </Stack>
                                        <Grid container spacing={1.25}>
                                            {operationalQueue.map((item) => (
                                                <Grid key={item.id} size={{ xs: 12, sm: 6 }}>
                                                    <OperationalQueueCard item={item} onOpen={(route) => navigate(route)} />
                                                </Grid>
                                            ))}
                                        </Grid>
                                    </Stack>
                                </CardContent>
                            </MotionCard>
                        </Grid>
                        <Grid size={{ xs: 12, lg: 7 }}>
                            <StaffPerformancePanel rows={staffPerformance} />
                        </Grid>
                        <Grid size={{ xs: 12, lg: 5 }}>
                            <MotionCard variant="outlined" inView sx={{ height: "100%" }}>
                                <CardContent>
                                    <Stack spacing={1.5}>
                                        <Box>
                                            <Typography variant="h6">Branch Risk & Governance</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Exception view for overdue assets, approval pressure, and operational controls.
                                            </Typography>
                                        </Box>
                                        <Chip
                                            color={par30Percent >= 15 ? "error" : par30Percent >= 8 ? "warning" : "success"}
                                            variant="outlined"
                                            label={`PAR ${par30Percent.toFixed(1)}%`}
                                            icon={<RuleRoundedIcon />}
                                            sx={{ width: "fit-content" }}
                                        />
                                        {branchAlerts.map((alert) => (
                                            <Alert key={alert.id} severity={alert.severity} variant="outlined">
                                                <Typography variant="subtitle2">{alert.title}</Typography>
                                                <Typography variant="body2">{alert.description}</Typography>
                                            </Alert>
                                        ))}
                                    </Stack>
                                </CardContent>
                            </MotionCard>
                        </Grid>
                    </>
                ) : role === "auditor" ? (
                    <>
                        <Grid size={{ xs: 12, lg: 8 }}>
                            <ChartPanel
                                title="Deposit vs Withdrawal Trend"
                                subtitle="Monitor the direction of posted member cash movements."
                                data={{
                                    labels: cashTrend.map(([label]) => label),
                                    datasets: [
                                        {
                                            label: "Deposits",
                                            data: cashTrend.map(([label]) => depositTrend.find(([date]) => date === label)?.[1] || 0),
                                            backgroundColor: alpha(theme.palette.success.main, 0.65)
                                        },
                                        {
                                            label: "Withdrawals",
                                            data: cashTrend.map(([label]) => withdrawalTrend.find(([date]) => date === label)?.[1] || 0),
                                            backgroundColor: alpha(theme.palette.error.main, 0.65)
                                        }
                                    ]
                                }}
                                type="bar"
                            />
                        </Grid>
                        <Grid size={{ xs: 12, lg: 4 }}>
                            <ChartPanel
                                title="Schedule Status"
                                type="doughnut"
                                data={{
                                    labels: agingBuckets.map(([label]) => label),
                                    datasets: [{
                                        data: agingBuckets.map(([, value]) => value),
                                        backgroundColor: [
                                            theme.palette.success.main,
                                            theme.palette.error.main,
                                            theme.palette.warning.main
                                        ]
                                    }]
                                }}
                            />
                        </Grid>
                    </>
                ) : (
                    <>
                        <Grid size={{ xs: 12, lg: 8 }}>
                            <ChartPanel
                                title={role === "super_admin" ? "Savings Growth" : "Deposit vs Withdrawal Trend"}
                                subtitle="Recent movement trend across visible member accounts."
                                data={{
                                    labels: cashTrend.map(([label]) => label),
                                    datasets: [
                                        {
                                            label: "Deposits",
                                            data: cashTrend.map(([label]) => depositTrend.find(([date]) => date === label)?.[1] || 0),
                                            borderColor: theme.palette.primary.main,
                                            backgroundColor: alpha(theme.palette.primary.main, 0.14),
                                            fill: true
                                        },
                                        {
                                            label: "Withdrawals",
                                            data: cashTrend.map(([label]) => withdrawalTrend.find(([date]) => date === label)?.[1] || 0),
                                            borderColor: theme.palette.secondary.main,
                                            backgroundColor: alpha(theme.palette.secondary.main, 0.08),
                                            fill: true
                                        }
                                    ]
                                }}
                                options={commonLineOptions}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, lg: 4 }}>
                            <ChartPanel
                                title="Loan Portfolio Mix"
                                type="doughnut"
                                subtitle="Schedule status and portfolio attention areas."
                                data={{
                                    labels: agingBuckets.map(([label]) => label),
                                    datasets: [{
                                        data: agingBuckets.map(([, value]) => value),
                                        backgroundColor: [
                                            theme.palette.success.main,
                                            theme.palette.error.main,
                                            theme.palette.warning.main
                                        ]
                                    }]
                                }}
                            />
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                            <ChartPanel
                                title="Loan Portfolio Trend"
                                subtitle="Recent loan origination volume by month."
                                type="bar"
                                data={{
                                    labels: loanTrend.map(([label]) => label),
                                    datasets: [{
                                        label: "Principal amount",
                                        data: loanTrend.map(([, value]) => value),
                                        backgroundColor: alpha(theme.palette.primary.main, 0.72)
                                    }]
                                }}
                                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                            />
                        </Grid>
                    </>
                )}
            </Grid>
            </MotionSection>
            ) : null}

            {!showPlatformDashboard ? (role === "teller" ? (
                state.statements.length ? null : (
                    <Alert severity="info" variant="outlined">
                        No posted teller cash activity is available yet. Use Post Transaction to start counter operations and this dashboard will populate automatically.
                    </Alert>
                )
            ) : role === "branch_manager" ? (
                <MotionSection inView>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, lg: 7 }}>
                        <ChartPanel
                            title="Recent Branch Activity"
                            subtitle="Latest visible savings and contribution postings for the supervised branch."
                            type="bar"
                            data={{
                                labels: metrics.branchStatements.slice(0, 8).map((entry) => entry.member_name),
                                datasets: [{
                                    label: "Amount",
                                    data: metrics.branchStatements.slice(0, 8).map((entry) => entry.amount),
                                    backgroundColor: metrics.branchStatements.slice(0, 8).map((entry) => {
                                        if (entry.transaction_type === "share_contribution") {
                                            return alpha(theme.palette.success.main, 0.72);
                                        }

                                        return entry.direction === "in"
                                            ? alpha(theme.palette.primary.main, 0.72)
                                            : alpha(theme.palette.error.main, 0.72);
                                    })
                                }]
                            }}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false } }
                            }}
                            height={250}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, lg: 5 }}>
                        <FollowUpPanel
                            title="Priority Follow-up"
                            subtitle="Branch loan items that need collections, review, or immediate member contact."
                            items={branchFollowUps}
                            onViewAll={() => navigate("/follow-ups")}
                        />
                    </Grid>
                </Grid>
                </MotionSection>
            ) : role === "loan_officer" ? (
                <MotionSection inView>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, lg: 7 }}>
                        <ChartPanel
                            title="Recent Borrower Activity"
                            subtitle="Latest member postings tied to your supervised branch loan and savings movement."
                            type="bar"
                            data={{
                                labels: metrics.branchStatements.slice(0, 8).map((entry) => entry.member_name),
                                datasets: [{
                                    label: "Amount",
                                    data: metrics.branchStatements.slice(0, 8).map((entry) => entry.amount),
                                    backgroundColor: metrics.branchStatements.slice(0, 8).map((entry) => {
                                        if (entry.transaction_type === "share_contribution") {
                                            return alpha(theme.palette.success.main, 0.72);
                                        }

                                        return entry.direction === "in"
                                            ? alpha(theme.palette.primary.main, 0.72)
                                            : alpha(theme.palette.error.main, 0.72);
                                    })
                                }]
                            }}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false } }
                            }}
                            height={250}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, lg: 5 }}>
                        <FollowUpPanel
                            title="Collections Priority Board"
                            subtitle="Loans at highest repayment risk so you can drive daily borrower follow-up."
                            items={branchFollowUps}
                            onViewAll={() => navigate("/follow-ups")}
                        />
                    </Grid>
                </Grid>
                </MotionSection>
            ) : (
                <MotionSection inView>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, lg: 7 }}>
                        <ChartPanel
                            title="Recent Activity"
                            subtitle="Latest savings movements visible to your role."
                            type="bar"
                            data={{
                                labels: state.statements.slice(0, 8).map((entry) => entry.member_name),
                                datasets: [{
                                    label: "Amount",
                                    data: state.statements.slice(0, 8).map((entry) => entry.amount),
                                    backgroundColor: state.statements.slice(0, 8).map((entry) =>
                                        entry.direction === "in"
                                            ? alpha(theme.palette.primary.main, 0.7)
                                            : alpha(theme.palette.error.main, 0.7)
                                    )
                                }]
                            }}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false } }
                            }}
                            height={250}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, lg: 5 }}>
                        <FollowUpPanel
                            title="Alerts and Follow-up"
                            subtitle="Visible due items grouped for immediate operational attention."
                            items={generalFollowUps}
                            onViewAll={() => navigate("/follow-ups")}
                        />
                    </Grid>
                </Grid>
                </MotionSection>
            )) : null}
        </Stack>
    );
}
