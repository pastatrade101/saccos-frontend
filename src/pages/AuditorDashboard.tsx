import { MotionCard } from "../ui/motion";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import BalanceRoundedIcon from "@mui/icons-material/BalanceRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import {
    Alert,
    Avatar,
    Box,
    Button,
    CardContent,
    Chip,
    Divider,
    Grid,
    List,
    ListItem,
    ListItemText,
    Stack,
    Typography
} from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useToast } from "../components/Toast";
import { AppLoader } from "../components/AppLoader";
import { getAuditorReasonMeta, getSeverityScore } from "../components/auditor/auditorUtils";
import { api, getApiErrorMessage } from "../lib/api";
import { endpoints, type AuditorExceptionTrendsResponse, type AuditorExceptionsResponse, type AuditorRiskSummaryResponse, type AuditorSummaryResponse, type AuditorWorkstationOverviewResponse } from "../lib/endpoints";
import type { AuditorException, AuditorExceptionTrends, AuditorRiskSummary, AuditorSummary, AuditorWorkstationOverview } from "../types/api";

function MetricCard({
    label,
    value,
    helper,
    icon
}: {
    label: string;
    value: string;
    helper: string;
    icon: React.ReactNode;
}) {
    return (
        <MotionCard variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
                <Stack direction="row" justifyContent="space-between" spacing={2}>
                    <Stack spacing={0.75}>
                        <Typography variant="overline" color="text.secondary">
                            {label}
                        </Typography>
                        <Typography variant="h5">{value}</Typography>
                        <Typography variant="body2" color="text.secondary">
                            {helper}
                        </Typography>
                    </Stack>
                    <Avatar variant="rounded" sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: "action.hover", color: "text.primary" }}>
                        {icon}
                    </Avatar>
                </Stack>
            </CardContent>
        </MotionCard>
    );
}

export function AuditorDashboardPage() {
    const navigate = useNavigate();
    const { pushToast } = useToast();
    const [summary, setSummary] = useState<AuditorSummary | null>(null);
    const [riskSummary, setRiskSummary] = useState<AuditorRiskSummary | null>(null);
    const [exceptionTrends, setExceptionTrends] = useState<AuditorExceptionTrends | null>(null);
    const [workstationOverview, setWorkstationOverview] = useState<AuditorWorkstationOverview | null>(null);
    const [topExceptions, setTopExceptions] = useState<AuditorException[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        void Promise.all([
            api.get<AuditorSummaryResponse>(endpoints.auditor.summary()),
            api.get<AuditorRiskSummaryResponse>(endpoints.auditor.riskSummary()),
            api.get<AuditorExceptionTrendsResponse>(endpoints.auditor.exceptionTrends(), {
                params: { days: 14 }
            }),
            api.get<AuditorWorkstationOverviewResponse>(endpoints.auditor.workstationOverview()),
            api.get<AuditorExceptionsResponse>(endpoints.auditor.exceptions(), {
                params: { page: 1, limit: 6 }
            })
        ])
            .then(([summaryResponse, riskSummaryResponse, trendsResponse, workstationResponse, exceptionsResponse]) => {
                setSummary(summaryResponse.data.data);
                setRiskSummary(riskSummaryResponse.data.data);
                setExceptionTrends(trendsResponse.data.data);
                setWorkstationOverview(workstationResponse.data.data);
                setTopExceptions(
                    [...(exceptionsResponse.data.data.data || [])].sort(
                        (left, right) => getSeverityScore(right.reason_code) - getSeverityScore(left.reason_code)
                    )
                );
            })
            .catch((error) =>
                pushToast({
                    type: "error",
                    title: "Unable to load auditor dashboard",
                    message: getApiErrorMessage(error)
                })
            )
            .finally(() => setLoading(false));
    }, [pushToast]);

    if (loading) {
        return <AppLoader message="Loading auditor dashboard..." />;
    }

    if (!summary || !riskSummary || !exceptionTrends || !workstationOverview) {
        return <Alert severity="warning" variant="outlined">No auditor summary is available.</Alert>;
    }

    const busiestTrendPoint = [...exceptionTrends.points].sort((left, right) => right.total - left.total)[0];
    const recentTrendPoints = exceptionTrends.points.slice(-7);
    const caseBoardItems = [
        { label: "Open", value: workstationOverview.case_board.open, color: "default" as const },
        { label: "Under review", value: workstationOverview.case_board.under_review, color: "warning" as const },
        { label: "Resolved", value: workstationOverview.case_board.resolved, color: "success" as const },
        { label: "Waived", value: workstationOverview.case_board.waived, color: "default" as const }
    ];

    const controlItems = [
        {
            label: "Trial balance",
            value: summary.trial_balance_balanced ? "Balanced" : "Mismatch",
            tone: summary.trial_balance_balanced ? "success" : "error"
        },
        {
            label: "Open journal backlog",
            value: `${summary.unposted_journals_count} unposted`,
            tone: summary.unposted_journals_count > 0 ? "warning" : "success"
        },
        {
            label: "Manual intervention",
            value: `${summary.manual_journals_count} manual / ${summary.reversals_count} reversals`,
            tone: summary.manual_journals_count + summary.reversals_count > 0 ? "warning" : "success"
        }
    ] as const;

    const priorityActions = [
        {
            title: "Critical control flags",
            helper: `${riskSummary.totals.critical_exceptions} critical exceptions are active across the current window.`,
            action: "Review exceptions",
            target: "/auditor/exceptions"
        },
        {
            title: "Branch concentration",
            helper: riskSummary.branches[0]
                ? `${riskSummary.branches[0].branch_name} currently leads the risk queue with ${riskSummary.branches[0].critical_exceptions} critical items.`
                : "No branch has accumulated risk concentration in the selected window.",
            action: "View dashboard",
            target: "/auditor"
        },
        {
            title: "Trend pressure",
            helper: busiestTrendPoint
                ? `${busiestTrendPoint.total} exceptions were recorded on ${busiestTrendPoint.day}.`
                : "Exception trend is currently flat.",
            action: "Open audit logs",
            target: "/auditor/audit-logs"
        }
    ];

    return (
        <Stack spacing={3}>
            <MotionCard variant="outlined">
                <CardContent>
                    <Stack
                        direction={{ xs: "column", lg: "row" }}
                        justifyContent="space-between"
                        spacing={3}
                        alignItems={{ xs: "flex-start", lg: "center" }}
                    >
                        <Stack spacing={1}>
                            <Typography variant="overline" color="primary.main" sx={{ letterSpacing: "0.16em" }}>
                                CONTROL POSTURE
                            </Typography>
                            <Typography variant="h4" fontWeight={800}>
                                Auditor Dashboard
                            </Typography>
                            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 760 }}>
                                Investigate control breaches, posting quality, and audit traceability from one risk-first workspace.
                            </Typography>
                        </Stack>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                            <Button variant="contained" onClick={() => navigate("/auditor/exceptions")}>
                                Review exceptions
                            </Button>
                            <Button variant="outlined" onClick={() => navigate("/auditor/workbench")}>
                                Open workbench
                            </Button>
                            <Button variant="outlined" onClick={() => navigate("/auditor/reports")}>
                                Export evidence
                            </Button>
                        </Stack>
                    </Stack>
                </CardContent>
            </MotionCard>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                    <MetricCard
                        label="Trial Balance Integrity"
                        value={summary.trial_balance_balanced ? "Balanced" : "Mismatch"}
                        helper="Checks net debit versus credit across visible journals."
                        icon={<BalanceRoundedIcon fontSize="small" />}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                    <MetricCard
                        label="Unposted Journals"
                        value={String(summary.unposted_journals_count)}
                        helper="Entries still not fully posted."
                        icon={<ReceiptLongRoundedIcon fontSize="small" />}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                    <MetricCard
                        label="Backdated Entries"
                        value={String(summary.backdated_entries_count)}
                        helper="Entry date before actual creation date."
                        icon={<HistoryRoundedIcon fontSize="small" />}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                    <MetricCard
                        label="Reversals"
                        value={String(summary.reversals_count)}
                        helper="Journals marked as reversals."
                        icon={<WarningAmberRoundedIcon fontSize="small" />}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                    <MetricCard
                        label="High Value Flags"
                        value={String(summary.high_value_tx_count)}
                        helper="Transactions above the configured threshold."
                        icon={<WarningAmberRoundedIcon fontSize="small" />}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                    <MetricCard
                        label="Out of Hours"
                        value={String(summary.out_of_hours_count)}
                        helper="Entries posted outside allowed operating hours."
                        icon={<HistoryRoundedIcon fontSize="small" />}
                    />
                </Grid>
            </Grid>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, lg: 5 }}>
                    <MotionCard variant="outlined" sx={{ height: "100%" }}>
                        <CardContent>
                            <Stack spacing={2}>
                                <Stack direction="row" spacing={1.25} alignItems="center">
                                    <Avatar variant="rounded" sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: "primary.50", color: "primary.main" }}>
                                        <InsightsRoundedIcon fontSize="small" />
                                    </Avatar>
                                    <Box>
                                        <Typography variant="h6" fontWeight={800}>
                                            Control posture
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Quick read of integrity and operational pressure.
                                        </Typography>
                                    </Box>
                                </Stack>
                                <Stack spacing={1.25}>
                                    {controlItems.map((item) => (
                                        <Stack
                                            key={item.label}
                                            direction={{ xs: "column", sm: "row" }}
                                            justifyContent="space-between"
                                            spacing={1}
                                            sx={{
                                                p: 1.5,
                                                border: (theme) => `1px solid ${theme.palette.divider}`,
                                                borderRadius: 2
                                            }}
                                        >
                                            <Box>
                                                <Typography variant="subtitle2" fontWeight={700}>
                                                    {item.label}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {item.value}
                                                </Typography>
                                            </Box>
                                            <Chip
                                                label={item.tone === "success" ? "Healthy" : item.tone === "warning" ? "Watch" : "Critical"}
                                                color={item.tone}
                                                size="small"
                                            />
                                        </Stack>
                                    ))}
                                </Stack>
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>

                <Grid size={{ xs: 12, lg: 7 }}>
                    <MotionCard variant="outlined" sx={{ height: "100%" }}>
                        <CardContent>
                            <Stack spacing={2}>
                                <Typography variant="h6" fontWeight={800}>
                                    Priority actions
                                </Typography>
                                <Stack divider={<Divider flexItem />}>
                                    {priorityActions.map((item) => (
                                        <Stack
                                            key={item.title}
                                            direction={{ xs: "column", md: "row" }}
                                            justifyContent="space-between"
                                            alignItems={{ xs: "flex-start", md: "center" }}
                                            spacing={1.5}
                                            sx={{ py: 1.5 }}
                                        >
                                            <Box>
                                                <Typography variant="subtitle1" fontWeight={700}>
                                                    {item.title}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {item.helper}
                                                </Typography>
                                            </Box>
                                            <Button
                                                endIcon={<ArrowForwardRoundedIcon />}
                                                onClick={() => navigate(item.target)}
                                                sx={{ flexShrink: 0 }}
                                            >
                                                {item.action}
                                            </Button>
                                        </Stack>
                                    ))}
                                </Stack>
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>
            </Grid>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, lg: 7 }}>
                    <MotionCard variant="outlined" sx={{ height: "100%" }}>
                        <CardContent>
                            <Stack spacing={2}>
                                <Box>
                                    <Typography variant="h6" fontWeight={800}>
                                        Branch risk concentration
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Where unresolved exception pressure is building fastest.
                                    </Typography>
                                </Box>
                                <Stack spacing={1.25}>
                                    {riskSummary.branches.map((branch) => (
                                        <Stack
                                            key={branch.branch_id || branch.branch_name}
                                            direction={{ xs: "column", sm: "row" }}
                                            justifyContent="space-between"
                                            spacing={1}
                                            sx={{
                                                p: 1.5,
                                                border: (theme) => `1px solid ${theme.palette.divider}`,
                                                borderRadius: 2
                                            }}
                                        >
                                            <Box>
                                                <Typography variant="subtitle1" fontWeight={700}>
                                                    {branch.branch_name}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {branch.total_exceptions} exceptions • {branch.open_cases} open cases • Last signal {branch.last_exception_at ? branch.last_exception_at.slice(0, 10) : "N/A"}
                                                </Typography>
                                            </Box>
                                            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                                <Chip size="small" color="error" label={`${branch.critical_exceptions} critical`} />
                                                <Chip size="small" color="warning" label={`${branch.warning_exceptions} warning`} />
                                            </Stack>
                                        </Stack>
                                    ))}
                                </Stack>
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>
                <Grid size={{ xs: 12, lg: 5 }}>
                    <MotionCard variant="outlined" sx={{ height: "100%" }}>
                        <CardContent>
                            <Stack spacing={2}>
                                <Box>
                                    <Typography variant="h6" fontWeight={800}>
                                        Exception trend
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Recent flow of flagged items by day.
                                    </Typography>
                                </Box>
                                <Stack spacing={1.25}>
                                    {recentTrendPoints.map((point) => (
                                        <Box key={point.day}>
                                            <Stack direction="row" justifyContent="space-between" spacing={1}>
                                                <Typography variant="body2" fontWeight={600}>
                                                    {point.day}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {point.total} total
                                                </Typography>
                                            </Stack>
                                            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.75 }}>
                                                <Box sx={{ flex: 1, height: 8, borderRadius: 999, bgcolor: "action.hover", overflow: "hidden" }}>
                                                    <Box
                                                        sx={{
                                                            width: `${Math.max(8, busiestTrendPoint?.total ? (point.total / busiestTrendPoint.total) * 100 : 0)}%`,
                                                            height: "100%",
                                                            bgcolor: point.critical > 0 ? "error.main" : point.warning > 0 ? "warning.main" : "primary.main"
                                                        }}
                                                    />
                                                </Box>
                                                <Stack direction="row" spacing={0.5}>
                                                    <Chip size="small" label={`C ${point.critical}`} color="error" variant="outlined" />
                                                    <Chip size="small" label={`W ${point.warning}`} color="warning" variant="outlined" />
                                                </Stack>
                                            </Stack>
                                        </Box>
                                    ))}
                                </Stack>
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>
            </Grid>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, lg: 5 }}>
                    <MotionCard variant="outlined" sx={{ height: "100%" }}>
                        <CardContent>
                            <Stack spacing={2}>
                                <Box>
                                    <Typography variant="h6" fontWeight={800}>
                                        Case board
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Investigation workload by status, plus the oldest items still open.
                                    </Typography>
                                </Box>
                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                    {caseBoardItems.map((item) => (
                                        <Chip
                                            key={item.label}
                                            label={`${item.label}: ${item.value}`}
                                            color={item.color}
                                            variant={item.color === "default" ? "outlined" : "filled"}
                                        />
                                    ))}
                                </Stack>
                                <Stack spacing={1.25}>
                                    {workstationOverview.oldest_open_cases.length ? workstationOverview.oldest_open_cases.map((caseItem) => (
                                        <Stack
                                            key={caseItem.case_id}
                                            direction={{ xs: "column", sm: "row" }}
                                            justifyContent="space-between"
                                            spacing={1.25}
                                            sx={{
                                                p: 1.5,
                                                border: (theme) => `1px solid ${theme.palette.divider}`,
                                                borderRadius: 2
                                            }}
                                        >
                                            <Box>
                                                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                                    <Typography variant="subtitle2" fontWeight={700}>
                                                        {getAuditorReasonMeta(caseItem.reason_code).label}
                                                    </Typography>
                                                    <Chip
                                                        size="small"
                                                        label={`${caseItem.age_days}d open`}
                                                        color={caseItem.age_days >= 7 ? "error" : "warning"}
                                                        variant="outlined"
                                                    />
                                                </Stack>
                                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                    {caseItem.branch_name} • {caseItem.reference || "No reference"} • {caseItem.assignee_name || "Unassigned"}
                                                </Typography>
                                            </Box>
                                            <Button
                                                size="small"
                                                endIcon={<ArrowForwardRoundedIcon fontSize="small" />}
                                                onClick={() => navigate("/auditor/exceptions")}
                                            >
                                                Open cases
                                            </Button>
                                        </Stack>
                                    )) : (
                                        <Alert severity="success" variant="outlined">
                                            No open investigation cases are currently aging.
                                        </Alert>
                                    )}
                                </Stack>
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>
                <Grid size={{ xs: 12, lg: 7 }}>
                    <MotionCard variant="outlined" sx={{ height: "100%" }}>
                        <CardContent>
                            <Stack spacing={2}>
                                <Box>
                                    <Typography variant="h6" fontWeight={800}>
                                        Repeated offender patterns
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Branches, users, and control reasons with the highest recurrence.
                                    </Typography>
                                </Box>
                                <Grid container spacing={2}>
                                    <Grid size={{ xs: 12, md: 6 }}>
                                        <Stack spacing={1.25}>
                                            <Typography variant="subtitle2" fontWeight={700}>
                                                Branches
                                            </Typography>
                                            {workstationOverview.repeat_patterns.branches.map((branch) => (
                                                <Stack
                                                    key={branch.branch_id || branch.branch_name}
                                                    direction="row"
                                                    justifyContent="space-between"
                                                    spacing={1}
                                                    sx={{
                                                        p: 1.25,
                                                        border: (theme) => `1px solid ${theme.palette.divider}`,
                                                        borderRadius: 2
                                                    }}
                                                >
                                                    <Box>
                                                        <Typography variant="body2" fontWeight={700}>
                                                            {branch.branch_name}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {branch.exception_count} exception(s)
                                                        </Typography>
                                                    </Box>
                                                    <Chip size="small" color={branch.critical_count > 0 ? "error" : "warning"} label={`${branch.critical_count} critical`} />
                                                </Stack>
                                            ))}
                                        </Stack>
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 6 }}>
                                        <Stack spacing={1.25}>
                                            <Typography variant="subtitle2" fontWeight={700}>
                                                Users
                                            </Typography>
                                            {workstationOverview.repeat_patterns.users.slice(0, 3).map((user) => (
                                                <Stack
                                                    key={user.user_id}
                                                    direction="row"
                                                    justifyContent="space-between"
                                                    spacing={1}
                                                    sx={{
                                                        p: 1.25,
                                                        border: (theme) => `1px solid ${theme.palette.divider}`,
                                                        borderRadius: 2
                                                    }}
                                                >
                                                    <Box>
                                                        <Typography variant="body2" fontWeight={700}>
                                                            {user.user_name}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {user.exception_count} exception(s)
                                                        </Typography>
                                                    </Box>
                                                    <Chip size="small" color={user.critical_count > 0 ? "error" : "warning"} label={`${user.critical_count} critical`} />
                                                </Stack>
                                            ))}
                                            <Divider />
                                            {workstationOverview.repeat_patterns.reasons.slice(0, 3).map((reason) => {
                                                const meta = getAuditorReasonMeta(reason.reason_code);
                                                return (
                                                    <Stack key={reason.reason_code} direction="row" justifyContent="space-between" spacing={1}>
                                                        <Box>
                                                            <Typography variant="body2" fontWeight={700}>
                                                                {meta.label}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {reason.exception_count} recurring occurrence(s)
                                                            </Typography>
                                                        </Box>
                                                        <Chip size="small" color={meta.chipColor} label={meta.severity} />
                                                    </Stack>
                                                );
                                            })}
                                        </Stack>
                                    </Grid>
                                </Grid>
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>
            </Grid>

            <MotionCard variant="outlined">
                <CardContent>
                    <Stack spacing={2}>
                        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1}>
                            <Box>
                                <Typography variant="h6" fontWeight={800}>
                                    Top flagged items
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Highest-priority exceptions from the latest feed.
                                </Typography>
                            </Box>
                            <Button onClick={() => navigate("/auditor/exceptions")}>
                                View full exception feed
                            </Button>
                        </Stack>

                        {!topExceptions.length ? (
                            <Alert severity="info" variant="outlined">
                                No recent exception items were returned by the current auditor feed.
                            </Alert>
                        ) : (
                            <List disablePadding>
                                {topExceptions.map((item, index) => {
                                    const meta = getAuditorReasonMeta(item.reason_code);
                                    return (
                                        <ListItem
                                            key={`${item.journal_id || item.reference || index}`}
                                            disablePadding
                                            sx={{
                                                px: 0,
                                                py: 1.25,
                                                borderBottom: index < topExceptions.length - 1 ? (theme) => `1px solid ${theme.palette.divider}` : undefined
                                            }}
                                            secondaryAction={
                                                <Button
                                                    size="small"
                                                    endIcon={<ArrowForwardRoundedIcon fontSize="small" />}
                                                    onClick={() => navigate(item.journal_id ? `/auditor/journals/${item.journal_id}` : "/auditor/exceptions")}
                                                >
                                                    Investigate
                                                </Button>
                                            }
                                        >
                                            <ListItemText
                                                primary={
                                                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                                        <Typography variant="subtitle2" fontWeight={700}>
                                                            {meta.label}
                                                        </Typography>
                                                        <Chip size="small" color={meta.chipColor} label={meta.severity} sx={{ textTransform: "capitalize" }} />
                                                        <Typography variant="caption" color="text.secondary">
                                                            {item.reference || "No reference"}
                                                        </Typography>
                                                    </Stack>
                                                }
                                                secondary={
                                                    <Stack spacing={0.35} sx={{ mt: 0.5 }}>
                                                        <Typography variant="body2" color="text.secondary">
                                                            {meta.summary}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Branch {item.branch_id ? item.branch_id.slice(0, 8).toUpperCase() : "N/A"} • Amount {Number(item.amount || 0).toLocaleString("en-TZ")}
                                                        </Typography>
                                                    </Stack>
                                                }
                                            />
                                        </ListItem>
                                    );
                                })}
                            </List>
                        )}
                    </Stack>
                </CardContent>
            </MotionCard>
        </Stack>
    );
}
