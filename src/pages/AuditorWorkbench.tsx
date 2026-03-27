import { MotionCard } from "../ui/motion";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
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
import { alpha } from "@mui/material/styles";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { AppLoader } from "../components/AppLoader";
import { getAuditorReasonMeta, getSeverityScore } from "../components/auditor/auditorUtils";
import { useToast } from "../components/Toast";
import { api, getApiErrorMessage } from "../lib/api";
import {
    endpoints,
    type AuditorExceptionTrendsResponse,
    type AuditorExceptionsResponse,
    type AuditorRiskSummaryResponse,
    type AuditorWorkstationOverviewResponse
} from "../lib/endpoints";
import type { AuditorException, AuditorExceptionTrends, AuditorRiskSummary, AuditorWorkstationOverview } from "../types/api";
import { formatCurrency, formatDate } from "../utils/format";

function heatColor(critical: number, total: number) {
    if (critical >= 3 || total >= 8) {
        return "error";
    }
    if (critical >= 1 || total >= 4) {
        return "warning";
    }
    return "success";
}

export function AuditorWorkbenchPage() {
    const navigate = useNavigate();
    const { pushToast } = useToast();
    const [riskSummary, setRiskSummary] = useState<AuditorRiskSummary | null>(null);
    const [workstationOverview, setWorkstationOverview] = useState<AuditorWorkstationOverview | null>(null);
    const [exceptionTrends, setExceptionTrends] = useState<AuditorExceptionTrends | null>(null);
    const [topExceptions, setTopExceptions] = useState<AuditorException[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        void Promise.all([
            api.get<AuditorRiskSummaryResponse>(endpoints.auditor.riskSummary(), { params: { limit: 10 } }),
            api.get<AuditorWorkstationOverviewResponse>(endpoints.auditor.workstationOverview(), { params: { limit: 10 } }),
            api.get<AuditorExceptionTrendsResponse>(endpoints.auditor.exceptionTrends(), { params: { days: 30 } }),
            api.get<AuditorExceptionsResponse>(endpoints.auditor.exceptions(), { params: { page: 1, limit: 12 } })
        ])
            .then(([riskResponse, workstationResponse, trendsResponse, exceptionsResponse]) => {
                setRiskSummary(riskResponse.data.data);
                setWorkstationOverview(workstationResponse.data.data);
                setExceptionTrends(trendsResponse.data.data);
                setTopExceptions(
                    [...(exceptionsResponse.data.data.data || [])].sort(
                        (left, right) => getSeverityScore(right.reason_code) - getSeverityScore(left.reason_code)
                    )
                );
            })
            .catch((error) =>
                pushToast({
                    type: "error",
                    title: "Unable to load auditor workbench",
                    message: getApiErrorMessage(error)
                })
            )
            .finally(() => setLoading(false));
    }, [pushToast]);

    const trendPeak = useMemo(() => {
        if (!exceptionTrends?.points.length) {
            return null;
        }
        return [...exceptionTrends.points].sort((left, right) => right.total - left.total)[0];
    }, [exceptionTrends]);

    if (loading) {
        return <AppLoader message="Loading auditor workbench..." />;
    }

    if (!riskSummary || !workstationOverview || !exceptionTrends) {
        return <Alert severity="warning" variant="outlined">Auditor workbench data is not available.</Alert>;
    }

    return (
        <Stack spacing={3}>
            <MotionCard variant="outlined">
                <CardContent>
                    <Stack direction={{ xs: "column", lg: "row" }} justifyContent="space-between" spacing={3}>
                        <Stack spacing={1}>
                            <Typography variant="overline" color="primary.main" sx={{ letterSpacing: "0.16em" }}>
                                INVESTIGATION WORKBENCH
                            </Typography>
                            <Typography variant="h4" fontWeight={800}>
                                Branch risk and recurring-control patterns
                            </Typography>
                            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 760 }}>
                                Use this workspace to identify which branches, users, and control reasons keep reappearing, then jump straight into the cases driving that pressure.
                            </Typography>
                        </Stack>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                            <Button variant="contained" onClick={() => navigate("/auditor/exceptions")}>
                                Open cases
                            </Button>
                            <Button variant="outlined" onClick={() => navigate("/auditor/audit-logs")}>
                                Review audit trail
                            </Button>
                        </Stack>
                    </Stack>
                </CardContent>
            </MotionCard>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, lg: 7 }}>
                    <MotionCard variant="outlined" sx={{ height: "100%" }}>
                        <CardContent>
                            <Stack spacing={2}>
                                <Stack direction="row" spacing={1.25} alignItems="center">
                                    <Avatar variant="rounded" sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: "warning.50", color: "warning.main" }}>
                                        <WarningAmberRoundedIcon fontSize="small" />
                                    </Avatar>
                                    <Box>
                                        <Typography variant="h6" fontWeight={800}>
                                            Branch heatmap
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Branches with the highest unresolved control concentration.
                                        </Typography>
                                    </Box>
                                </Stack>
                                <Grid container spacing={1.5}>
                                    {riskSummary.branches.map((branch) => {
                                        const tone = heatColor(branch.critical_exceptions, branch.total_exceptions);
                                        return (
                                            <Grid key={branch.branch_id || branch.branch_name} size={{ xs: 12, md: 6 }}>
                                                <Box
                                                    sx={{
                                                        p: 2,
                                                        borderRadius: 3,
                                                        border: (theme) => `1px solid ${theme.palette.divider}`,
                                                        bgcolor: (theme) =>
                                                            tone === "error"
                                                                ? alpha(theme.palette.error.main, 0.08)
                                                                : tone === "warning"
                                                                    ? alpha(theme.palette.warning.main, 0.1)
                                                                    : alpha(theme.palette.success.main, 0.1)
                                                    }}
                                                >
                                                    <Stack spacing={1.25}>
                                                        <Stack direction="row" justifyContent="space-between" spacing={1}>
                                                            <Typography variant="subtitle1" fontWeight={800}>
                                                                {branch.branch_name}
                                                            </Typography>
                                                            <Chip size="small" color={tone} label={tone === "error" ? "High heat" : tone === "warning" ? "Watch" : "Stable"} />
                                                        </Stack>
                                                        <Typography variant="body2" color="text.secondary">
                                                            {branch.total_exceptions} exception(s) • {branch.open_cases} open case(s)
                                                        </Typography>
                                                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                                            <Chip size="small" color="error" variant="outlined" label={`${branch.critical_exceptions} critical`} />
                                                            <Chip size="small" color="warning" variant="outlined" label={`${branch.warning_exceptions} warning`} />
                                                            <Chip size="small" variant="outlined" label={`Last signal ${branch.last_exception_at ? formatDate(branch.last_exception_at) : "N/A"}`} />
                                                        </Stack>
                                                    </Stack>
                                                </Box>
                                            </Grid>
                                        );
                                    })}
                                </Grid>
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>

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
                                            Trend pressure
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            How exception volume has accumulated over the last 30 days.
                                        </Typography>
                                    </Box>
                                </Stack>
                                {trendPeak ? (
                                    <Alert severity={trendPeak.critical > 0 ? "warning" : "info"} variant="outlined">
                                        Peak day: {trendPeak.day} with {trendPeak.total} flagged item(s).
                                    </Alert>
                                ) : null}
                                <Stack spacing={1.25}>
                                    {exceptionTrends.points.slice(-10).map((point) => (
                                        <Box key={point.day}>
                                            <Stack direction="row" justifyContent="space-between" spacing={1}>
                                                <Typography variant="body2" fontWeight={700}>
                                                    {point.day}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {point.total} total
                                                </Typography>
                                            </Stack>
                                            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.75 }}>
                                                <Box sx={{ flex: 1, height: 10, borderRadius: 999, bgcolor: "action.hover", overflow: "hidden" }}>
                                                    <Box
                                                        sx={{
                                                            width: `${Math.max(6, trendPeak?.total ? (point.total / trendPeak.total) * 100 : 0)}%`,
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
                <Grid size={{ xs: 12, lg: 6 }}>
                    <MotionCard variant="outlined" sx={{ height: "100%" }}>
                        <CardContent>
                            <Stack spacing={2}>
                                <Stack direction="row" spacing={1.25} alignItems="center">
                                    <Avatar variant="rounded" sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: "info.50", color: "info.main" }}>
                                        <HubRoundedIcon fontSize="small" />
                                    </Avatar>
                                    <Box>
                                        <Typography variant="h6" fontWeight={800}>
                                            Repeated user patterns
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Which actors keep appearing in flagged events.
                                        </Typography>
                                    </Box>
                                </Stack>
                                <Stack spacing={1.25}>
                                    {workstationOverview.repeat_patterns.users.map((user) => (
                                        <Stack
                                            key={user.user_id}
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
                                                    {user.user_name}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {user.exception_count} exception(s) linked to this user.
                                                </Typography>
                                            </Box>
                                            <Chip size="small" color={user.critical_count > 0 ? "error" : "warning"} label={`${user.critical_count} critical`} />
                                        </Stack>
                                    ))}
                                </Stack>
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>

                <Grid size={{ xs: 12, lg: 6 }}>
                    <MotionCard variant="outlined" sx={{ height: "100%" }}>
                        <CardContent>
                            <Stack spacing={2}>
                                <Typography variant="h6" fontWeight={800}>
                                    Recurring control reasons
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Which exception types are trending repeatedly across the workspace.
                                </Typography>
                                <List disablePadding>
                                    {workstationOverview.repeat_patterns.reasons.map((reason, index) => {
                                        const meta = getAuditorReasonMeta(reason.reason_code);
                                        return (
                                            <ListItem
                                                key={reason.reason_code}
                                                disablePadding
                                                sx={{
                                                    py: 1.25,
                                                    borderBottom: index < workstationOverview.repeat_patterns.reasons.length - 1 ? (theme) => `1px solid ${theme.palette.divider}` : undefined
                                                }}
                                            >
                                                <ListItemText
                                                    primary={
                                                        <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                                                            <Typography variant="subtitle2" fontWeight={700}>
                                                                {meta.label}
                                                            </Typography>
                                                            <Chip size="small" color={meta.chipColor} label={meta.severity} />
                                                        </Stack>
                                                    }
                                                    secondary={
                                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                            {reason.exception_count} recurring occurrence(s) are visible in the current window.
                                                        </Typography>
                                                    }
                                                />
                                            </ListItem>
                                        );
                                    })}
                                </List>
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
                                <Typography variant="h6" fontWeight={800}>
                                    Oldest open cases
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Investigation backlog that should be pushed forward first.
                                </Typography>
                                {!workstationOverview.oldest_open_cases.length ? (
                                    <Alert severity="success" variant="outlined">No open cases are currently aging.</Alert>
                                ) : (
                                    <Stack spacing={1.25}>
                                        {workstationOverview.oldest_open_cases.map((item) => (
                                            <Stack
                                                key={item.case_id}
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
                                                    <Typography variant="subtitle2" fontWeight={700}>
                                                        {getAuditorReasonMeta(item.reason_code).label}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {item.branch_name} • {item.assignee_name || "Unassigned"} • {item.reference || "No reference"}
                                                    </Typography>
                                                </Box>
                                                <Chip size="small" color={item.age_days >= 7 ? "error" : "warning"} label={`${item.age_days}d open`} />
                                            </Stack>
                                        ))}
                                    </Stack>
                                )}
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>

                <Grid size={{ xs: 12, lg: 7 }}>
                    <MotionCard variant="outlined" sx={{ height: "100%" }}>
                        <CardContent>
                            <Stack spacing={2}>
                                <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1}>
                                    <Box>
                                        <Typography variant="h6" fontWeight={800}>
                                            Recent high-priority items
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            The latest items worth triaging or linking into a formal audit case.
                                        </Typography>
                                    </Box>
                                    <Button endIcon={<ArrowForwardRoundedIcon />} onClick={() => navigate("/auditor/exceptions")}>
                                        Open exception feed
                                    </Button>
                                </Stack>
                                {!topExceptions.length ? (
                                    <Alert severity="info" variant="outlined">No recent exception items are available.</Alert>
                                ) : (
                                    <List disablePadding>
                                        {topExceptions.slice(0, 6).map((item, index) => {
                                            const meta = getAuditorReasonMeta(item.reason_code);
                                            return (
                                                <ListItem
                                                    key={`${item.case_key}-${index}`}
                                                    disablePadding
                                                    sx={{
                                                        py: 1.25,
                                                        borderBottom: index < Math.min(topExceptions.length, 6) - 1 ? (theme) => `1px solid ${theme.palette.divider}` : undefined
                                                    }}
                                                    secondaryAction={
                                                        <Button
                                                            size="small"
                                                            variant="outlined"
                                                            endIcon={<ArrowForwardRoundedIcon fontSize="small" />}
                                                            onClick={() => navigate(item.journal_id ? `/auditor/journals/${item.journal_id}` : "/auditor/exceptions")}
                                                        >
                                                            Inspect
                                                        </Button>
                                                    }
                                                >
                                                    <ListItemText
                                                        primary={
                                                            <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                                                                <Typography variant="subtitle2" fontWeight={700}>
                                                                    {meta.label}
                                                                </Typography>
                                                                <Chip size="small" color={meta.chipColor} label={meta.severity} />
                                                            </Stack>
                                                        }
                                                        secondary={
                                                            <Stack spacing={0.35} sx={{ mt: 0.5 }}>
                                                                <Typography variant="body2" color="text.secondary">
                                                                    {item.reference || "No reference"} • {item.branch_id ? item.branch_id.slice(0, 8).toUpperCase() : "N/A"}
                                                                </Typography>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    Amount {formatCurrency(Number(item.amount || 0))} • Logged {formatDate(item.created_at)}
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
                </Grid>
            </Grid>
        </Stack>
    );
}
