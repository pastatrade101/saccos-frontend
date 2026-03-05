import {
    Alert,
    Box,
    CardContent,
    Chip,
    Divider,
    Grid,
    Stack,
    Typography
} from "@mui/material";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import PieChartRoundedIcon from "@mui/icons-material/PieChartRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
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
import { endpoints, type BranchesListResponse, type LoanSchedulesResponse, type LoansResponse, type MembersResponse, type StatementsResponse, type TenantsListResponse } from "../lib/endpoints";
import { buildTellerDashboardData } from "../lib/tellerDashboard";
import type { Branch, Loan, LoanSchedule, Member, StatementRow, Tenant } from "../types/api";
import { MotionCard, MotionListItem, MotionSection } from "../ui/motion";
import { formatCurrency, formatDate, formatRole } from "../utils/format";

interface DashboardState {
    members: Member[];
    statements: StatementRow[];
    loans: Loan[];
    schedules: LoanSchedule[];
}

interface PlatformState {
    tenants: Tenant[];
    branches: Branch[];
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
            main: theme.palette.primary.main,
            soft: alpha(theme.palette.primary.main, 0.08)
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
        schedules: []
    });
    const [platformState, setPlatformState] = useState<PlatformState>({
        tenants: [],
        branches: []
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadDashboard = async () => {
            if (isInternalOps) {
                setLoading(true);
                setError(null);

                try {
                    const [{ data: tenantsResponse }, { data: branchesResponse }] = await Promise.all([
                        api.get<TenantsListResponse>(endpoints.tenants.list()),
                        api.get<BranchesListResponse>(endpoints.branches.list())
                    ]);

                    setPlatformState({
                        tenants: tenantsResponse.data || [],
                        branches: branchesResponse.data || []
                    });
                } catch (loadError) {
                    setError(getApiErrorMessage(loadError));
                } finally {
                    setLoading(false);
                }

                return;
            }

            if (!selectedTenantId) {
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const [{ data: membersResponse }, statementsResponse, { data: loansResponse }, { data: schedulesResponse }] = await Promise.all([
                    api.get<MembersResponse>(endpoints.members.list()),
                    api.get<StatementsResponse>(endpoints.finance.statements(), {
                        params: { tenant_id: selectedTenantId }
                    }),
                    api.get<LoansResponse>(endpoints.finance.loanPortfolio(), {
                        params: { tenant_id: selectedTenantId }
                    }),
                    api.get<LoanSchedulesResponse>(endpoints.finance.loanSchedules(), {
                        params: { tenant_id: selectedTenantId }
                    })
                ]);

                setState({
                    members: membersResponse.data || [],
                    statements: statementsResponse.data.data || [],
                    loans: loansResponse.data || [],
                    schedules: (schedulesResponse.data || []).filter((schedule) => ["pending", "partial", "overdue"].includes(schedule.status))
                });
            } catch (loadError) {
                setError(getApiErrorMessage(loadError));
            } finally {
                setLoading(false);
            }
        };

        void loadDashboard();
    }, [isInternalOps, selectedTenantId]);

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
    const tellerDepositAverage = tellerDashboard.timeseries_7d.length
        ? tellerDashboard.kpis.deposit_intake_7d / tellerDashboard.timeseries_7d.length
        : 0;
    const tellerWithdrawalAverage = tellerDashboard.timeseries_7d.length
        ? tellerDashboard.kpis.withdrawal_outflow_7d / tellerDashboard.timeseries_7d.length
        : 0;
    const tellerDailyTicketBaseline = tellerAverageTicketSparkline.length > 1
        ? tellerAverageTicketSparkline.slice(0, -1).reduce((sum, value) => sum + value, 0) / (tellerAverageTicketSparkline.length - 1)
        : 0;

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
            planBreakdown: ["starter", "growth", "enterprise"].map((plan) => ({
                plan,
                count: latestSubscriptions.filter((subscription) => (subscription?.plan || "starter") === plan).length
            })),
            growthTrend: [...platformState.tenants.reduce((accumulator, tenant) => {
                const key = tenant.created_at.slice(0, 7);
                accumulator.set(key, (accumulator.get(key) || 0) + 1);
                return accumulator;
            }, new Map<string, number>()).entries()].sort(([left], [right]) => left.localeCompare(right)).slice(-6)
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
                        <Chip label={showPlatformDashboard ? "Platform Owner" : role ? formatRole(role) : "Internal Ops"} color="primary" variant="outlined" />
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
                            <Typography variant="h6" gutterBottom>Tenant Inventory</Typography>
                            <DataTable
                                rows={platformState.tenants.slice(0, 8)}
                                columns={platformColumns}
                                emptyMessage="No tenants available on the platform."
                            />
                        </CardContent>
                    </MotionCard>
                </>
            ) : null}

            {!showPlatformDashboard && role === "teller" ? (
                <MotionSection inView>
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
                </MotionSection>
            ) : role === "branch_manager" ? (
                <MotionSection inView>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, xl: 5 }}>
                        <BranchManagerTopCard
                            label="Branch Savings Position"
                            value={formatCurrency(metrics.branchSavings)}
                            helper="Current branch-controlled savings position based on posted member savings movements and cash-side activity."
                            status={branchNetMovement >= 0 ? "Net movement positive" : "Outflow pressure"}
                            icon={<AccountBalanceWalletRoundedIcon fontSize="small" />}
                            tone={branchNetMovement >= 0 ? "positive" : "negative"}
                            featured
                            footer={
                                <Grid container spacing={1.25}>
                                    <Grid size={{ xs: 6 }}>
                                        <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: alpha(theme.palette.success.main, 0.08) }}>
                                            <Typography variant="caption" color="text.secondary">Active members</Typography>
                                            <Typography variant="subtitle1" fontWeight={700}>{metrics.branchActiveMembers}</Typography>
                                        </Box>
                                    </Grid>
                                    <Grid size={{ xs: 6 }}>
                                        <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: alpha(theme.palette.warning.main, 0.1) }}>
                                            <Typography variant="caption" color="text.secondary">Overdue loans</Typography>
                                            <Typography variant="subtitle1" fontWeight={700}>{metrics.branchOverdueLoans}</Typography>
                                        </Box>
                                    </Grid>
                                </Grid>
                            }
                        />
                    </Grid>
                    <Grid size={{ xs: 12, xl: 7 }}>
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 12, md: 4 }}>
                                <BranchManagerTopCard
                                    label="Deposit Intake"
                                    value={formatCurrency(metrics.branchDepositIntake)}
                                    helper={buildDeltaLabel(metrics.branchDepositIntake, branchDepositAverage, "vs recent branch average")}
                                    status={metrics.branchDepositIntake >= branchDepositAverage ? "Funding pace healthy" : "Below recent pace"}
                                    icon={<PaymentsRoundedIcon fontSize="small" />}
                                    tone={getDeltaTone(metrics.branchDepositIntake, branchDepositAverage)}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, md: 4 }}>
                                <BranchManagerTopCard
                                    label="Share Contributions"
                                    value={formatCurrency(metrics.branchContributionTotal)}
                                    helper={buildDeltaLabel(metrics.branchContributionTotal, branchContributionAverage, "vs recent branch average")}
                                    status={metrics.branchContributionTotal >= branchContributionAverage ? "Capital build-up healthy" : "Contribution pace softer"}
                                    icon={<PieChartRoundedIcon fontSize="small" />}
                                    tone={getDeltaTone(metrics.branchContributionTotal, branchContributionAverage)}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, md: 4 }}>
                                <BranchManagerTopCard
                                    label="Loan Portfolio"
                                    value={formatCurrency(metrics.branchOutstanding)}
                                    helper={`${metrics.branchLoans.length} active branch loans under supervision.`}
                                    status={metrics.branchOverdueLoans > 0 ? "Collection action needed" : "Portfolio quality stable"}
                                    icon={<ReceiptLongRoundedIcon fontSize="small" />}
                                    tone={metrics.branchOverdueLoans > 0 ? "negative" : "positive"}
                                />
                            </Grid>
                        </Grid>
                    </Grid>
                </Grid>
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
                        <Grid size={{ xs: 12, lg: 8 }}>
                            <CashFlowChart points={tellerDashboard.timeseries_7d} />
                        </Grid>
                        <Grid size={{ xs: 12, lg: 4 }}>
                            <WaterfallCard
                                openingCash={tellerDashboard.opening_cash}
                                deposits={tellerDashboard.kpis.deposits_today}
                                withdrawals={tellerDashboard.kpis.withdrawals_today}
                                closingCash={tellerDashboard.closing_cash}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, lg: 5 }}>
                            <DistributionChart points={tellerDashboard.distribution_today} />
                        </Grid>
                        <Grid size={{ xs: 12, lg: 7 }}>
                            <AlertsPanel
                                alerts={tellerDashboard.alerts}
                                hourlyActivity={tellerDashboard.hourly_activity}
                            />
                        </Grid>
                    </>
                ) : role === "loan_officer" ? (
                    <>
                        <Grid size={{ xs: 12, lg: 8 }}>
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
                        <Grid size={{ xs: 12, lg: 4 }}>
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
                    </>
                ) : role === "branch_manager" ? (
                    <>
                        <Grid size={{ xs: 12, lg: 8 }}>
                            <ChartPanel
                                title="Branch Savings Flow"
                                subtitle="Deposit and withdrawal direction across the visible branch member base."
                                data={{
                                    labels: branchCashTrend.map(([label]) => label),
                                    datasets: [
                                        {
                                            label: "Deposits",
                                            data: branchCashTrend.map(([label]) => branchDepositTrend.find(([date]) => date === label)?.[1] || 0),
                                            borderColor: theme.palette.primary.main,
                                            backgroundColor: alpha(theme.palette.primary.main, 0.16),
                                            fill: true
                                        },
                                        {
                                            label: "Withdrawals",
                                            data: branchCashTrend.map(([label]) => branchWithdrawalTrend.find(([date]) => date === label)?.[1] || 0),
                                            borderColor: theme.palette.error.main,
                                            backgroundColor: alpha(theme.palette.error.main, 0.08),
                                            fill: true
                                        }
                                    ]
                                }}
                                options={commonLineOptions}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, lg: 4 }}>
                            <ChartPanel
                                title="Branch Portfolio Mix"
                                type="doughnut"
                                subtitle="Savings, share capital, and loan exposure under supervision."
                                data={{
                                    labels: ["Savings Position", "Share Capital Inflow", "Loan Portfolio"],
                                    datasets: [{
                                        data: [
                                            Math.max(metrics.branchSavings, 0),
                                            metrics.branchContributionTotal,
                                            metrics.branchOutstanding
                                        ],
                                        backgroundColor: [
                                            theme.palette.primary.main,
                                            theme.palette.success.main,
                                            theme.palette.warning.main
                                        ]
                                    }]
                                }}
                                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, lg: 5 }}>
                            <ChartPanel
                                title="Loan Quality Watch"
                                subtitle="Schedule aging across the supervised branch portfolio."
                                type="bar"
                                data={{
                                    labels: ["Current", "Partial", "Overdue"],
                                    datasets: [{
                                        label: "Schedules",
                                        data: [
                                            metrics.branchSchedules.filter((schedule) => schedule.status === "pending").length,
                                            metrics.branchSchedules.filter((schedule) => schedule.status === "partial").length,
                                            metrics.branchSchedules.filter((schedule) => schedule.status === "overdue").length
                                        ],
                                        backgroundColor: [
                                            alpha(theme.palette.success.main, 0.72),
                                            alpha(theme.palette.warning.main, 0.72),
                                            alpha(theme.palette.error.main, 0.72)
                                        ]
                                    }]
                                }}
                                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, lg: 7 }}>
                            <MotionCard variant="outlined" inView sx={{ height: "100%" }}>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        Branch Manager Signals
                                    </Typography>
                                    <Stack spacing={1.5}>
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
                        No posted teller cash activity is available yet. Once deposits and withdrawals are posted, this dashboard will populate automatically.
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
