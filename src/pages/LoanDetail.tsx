import { MotionCard } from "../ui/motion";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import CreditScoreRoundedIcon from "@mui/icons-material/CreditScoreRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import PriceCheckRoundedIcon from "@mui/icons-material/PriceCheckRounded";
import {
    Alert,
    Avatar,
    Box,
    Button,
    CardContent,
    Chip,
    Divider,
    Grid,
    Stack,
    Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { AppLoader } from "../components/AppLoader";
import { DataTable, type Column } from "../components/DataTable";
import { useToast } from "../components/Toast";
import { api, getApiErrorMessage } from "../lib/api";
import {
    endpoints,
    type LoanSchedulesResponse,
    type LoanTransactionsResponse,
    type LoansResponse,
    type MembersResponse
} from "../lib/endpoints";
import type { Loan, LoanSchedule, LoanTransaction, Member } from "../types/api";
import { formatCurrency, formatDate } from "../utils/format";

function MetricCard({
    title,
    value,
    helper,
    icon,
    status,
    tone = "neutral"
}: {
    title: string;
    value: string;
    helper: string;
    icon: React.ReactNode;
    status?: string;
    tone?: "positive" | "negative" | "neutral";
}) {
    const theme = useTheme();
    const neutralAccent = theme.palette.mode === "dark" ? "#D9B273" : theme.palette.primary.main;
    const toneColor =
        tone === "positive"
            ? theme.palette.success.main
            : tone === "negative"
                ? theme.palette.error.main
                : neutralAccent;

    return (
        <MotionCard
            variant="outlined"
            sx={{
                height: "100%",
                minHeight: 220,
                borderColor: alpha(toneColor, 0.2),
                background: `linear-gradient(140deg, ${alpha(toneColor, 0.08)}, ${theme.palette.background.paper})`
            }}
        >
            <CardContent sx={{ height: "100%" }}>
                <Stack spacing={1.5} sx={{ height: "100%", justifyContent: "space-between" }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                        <Box>
                            <Typography variant="overline" color="text.secondary">
                                {title}
                            </Typography>
                            <Typography variant="h5" sx={{ mt: 0.5 }}>
                                {value}
                            </Typography>
                        </Box>
                        <Avatar
                            variant="rounded"
                            sx={{
                                width: 42,
                                height: 42,
                                borderRadius: 2,
                                bgcolor: alpha(toneColor, 0.12),
                                color: toneColor
                            }}
                        >
                            {icon}
                        </Avatar>
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ minHeight: 40 }}>
                        {helper}
                    </Typography>
                    {status ? (
                        <Chip
                            label={status}
                            size="small"
                            variant="outlined"
                            sx={{
                                width: "fit-content",
                                color: toneColor,
                                borderColor: alpha(toneColor, 0.32),
                                bgcolor: alpha(toneColor, 0.1),
                                fontWeight: 700
                            }}
                        />
                    ) : null}
                </Stack>
            </CardContent>
        </MotionCard>
    );
}

export function LoanDetailPage() {
    const theme = useTheme();
    const dashboardAccent = theme.palette.mode === "dark" ? "#D9B273" : theme.palette.primary.main;
    const dashboardAccentStrong = theme.palette.mode === "dark" ? "#C89B52" : theme.palette.primary.dark;
    const darkAccentOutlinedSx = theme.palette.mode === "dark"
        ? {
            borderColor: alpha(dashboardAccent, 0.44),
            color: dashboardAccent,
            "&:hover": { borderColor: alpha(dashboardAccent, 0.78), bgcolor: alpha(dashboardAccent, 0.1) }
        }
        : undefined;
    const darkAccentChipSx = theme.palette.mode === "dark"
        ? {
            borderColor: alpha(dashboardAccent, 0.44),
            color: dashboardAccent,
            bgcolor: alpha(dashboardAccent, 0.1)
        }
        : undefined;
    const darkAccentContainedSx = theme.palette.mode === "dark"
        ? { bgcolor: dashboardAccent, color: "#1a1a1a", "&:hover": { bgcolor: dashboardAccentStrong } }
        : undefined;
    const navigate = useNavigate();
    const { loanId } = useParams<{ loanId: string }>();
    const { pushToast } = useToast();
    const { selectedTenantId, selectedTenantName } = useAuth();
    const [loan, setLoan] = useState<Loan | null>(null);
    const [member, setMember] = useState<Member | null>(null);
    const [schedules, setSchedules] = useState<LoanSchedule[]>([]);
    const [transactions, setTransactions] = useState<LoanTransaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadLoanDetails = async () => {
            if (!selectedTenantId || !loanId) {
                setLoading(false);
                return;
            }

            setLoading(true);

            try {
                const [{ data: membersResponse }, { data: loansResponse }, { data: schedulesResponse }, { data: transactionsResponse }] = await Promise.all([
                    api.get<MembersResponse>(endpoints.members.list(), {
                        params: { tenant_id: selectedTenantId, page: 1, limit: 100 }
                    }),
                    api.get<LoansResponse>(endpoints.finance.loanPortfolio(), {
                        params: { tenant_id: selectedTenantId, loan_id: loanId, page: 1, limit: 100 }
                    }),
                    api.get<LoanSchedulesResponse>(endpoints.finance.loanSchedules(), {
                        params: { tenant_id: selectedTenantId, loan_id: loanId, page: 1, limit: 100 }
                    }),
                    api.get<LoanTransactionsResponse>(endpoints.finance.loanTransactions(), {
                        params: { tenant_id: selectedTenantId, loan_id: loanId, page: 1, limit: 100 }
                    })
                ]);

                const resolvedLoan = (loansResponse.data || []).find((entry) => entry.id === loanId) || null;
                const resolvedMember = resolvedLoan
                    ? (membersResponse.data || []).find((entry) => entry.id === resolvedLoan.member_id) || null
                    : null;

                setLoan(resolvedLoan);
                setMember(resolvedMember);
                setSchedules(schedulesResponse.data || []);
                setTransactions(transactionsResponse.data || []);
            } catch (error) {
                pushToast({
                    type: "error",
                    title: "Unable to load loan details",
                    message: getApiErrorMessage(error)
                });
            } finally {
                setLoading(false);
            }
        };

        void loadLoanDetails();
    }, [loanId, pushToast, selectedTenantId]);
    const pendingAmount = (schedule: LoanSchedule) =>
        Math.max(schedule.principal_due - schedule.principal_paid, 0) + Math.max(schedule.interest_due - schedule.interest_paid, 0);

    const sortedSchedules = useMemo(
        () =>
            [...schedules].sort((left, right) => {
                if (left.installment_number !== right.installment_number) {
                    return left.installment_number - right.installment_number;
                }
                return new Date(left.due_date).getTime() - new Date(right.due_date).getTime();
            }),
        [schedules]
    );
    const openSchedules = useMemo(
        () => sortedSchedules.filter((schedule) => ["pending", "partial", "overdue"].includes(schedule.status)),
        [sortedSchedules]
    );
    const overdueSchedules = useMemo(
        () => openSchedules.filter((schedule) => schedule.status === "overdue"),
        [openSchedules]
    );
    const overdueExposure = useMemo(
        () => overdueSchedules.reduce((sum, schedule) => sum + pendingAmount(schedule), 0),
        [overdueSchedules]
    );
    const dueWithin7Days = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return openSchedules.filter((schedule) => {
            const dueDate = new Date(schedule.due_date);
            const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
            const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            return diffDays >= 0 && diffDays <= 7;
        }).length;
    }, [openSchedules]);
    const nextDueSchedule = useMemo(() => {
        return [...openSchedules].sort(
            (left, right) => new Date(left.due_date).getTime() - new Date(right.due_date).getTime()
        )[0] || null;
    }, [openSchedules]);
    const oldestOverdueDays = useMemo(() => {
        if (!overdueSchedules.length) {
            return 0;
        }

        const today = new Date();
        return Math.max(
            ...overdueSchedules.map((schedule) =>
                Math.max(
                    Math.floor((today.getTime() - new Date(schedule.due_date).getTime()) / (1000 * 60 * 60 * 24)),
                    0
                )
            )
        );
    }, [overdueSchedules]);
    const paidInstallments = useMemo(
        () => sortedSchedules.filter((schedule) => schedule.status === "paid").length,
        [sortedSchedules]
    );
    const progressPercent = sortedSchedules.length ? (paidInstallments / sortedSchedules.length) * 100 : 0;
    const totalRepaidAmount = useMemo(
        () =>
            transactions
                .filter((entry) => entry.transaction_type === "loan_repayment")
                .reduce((sum, entry) => sum + entry.amount, 0),
        [transactions]
    );
    const orderedTransactions = useMemo(
        () =>
            [...transactions].sort(
                (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
            ),
        [transactions]
    );
    const prioritySchedules = useMemo(
        () =>
            openSchedules
                .map((schedule) => ({
                    ...schedule,
                    pending: pendingAmount(schedule)
                }))
                .sort((left, right) => {
                    const leftPriority = left.status === "overdue" ? 0 : left.status === "partial" ? 1 : 2;
                    const rightPriority = right.status === "overdue" ? 0 : right.status === "partial" ? 1 : 2;
                    if (leftPriority !== rightPriority) {
                        return leftPriority - rightPriority;
                    }

                    return new Date(left.due_date).getTime() - new Date(right.due_date).getTime();
                })
                .slice(0, 6),
        [openSchedules]
    );

    const transactionColumns: Column<LoanTransaction>[] = useMemo(
        () => [
            { key: "created", header: "Date", render: (row) => formatDate(row.created_at) },
            {
                key: "type",
                header: "Type",
                render: (row) =>
                    row.transaction_type === "loan_repayment"
                        ? "Repayment"
                        : row.transaction_type === "loan_disbursement"
                            ? "Disbursement"
                            : "Interest Accrual"
            },
            { key: "amount", header: "Amount", render: (row) => formatCurrency(row.amount) },
            { key: "principal", header: "Principal", render: (row) => formatCurrency(row.principal_component) },
            { key: "interest", header: "Interest", render: (row) => formatCurrency(row.interest_component) },
            { key: "reference", header: "Reference", render: (row) => row.reference || "N/A" }
        ],
        []
    );

    const scheduleColumns: Column<LoanSchedule>[] = useMemo(
        () => [
            { key: "installment", header: "Installment", render: (row) => String(row.installment_number) },
            { key: "due", header: "Due Date", render: (row) => formatDate(row.due_date) },
            { key: "principal", header: "Principal Due", render: (row) => formatCurrency(row.principal_due) },
            { key: "interest", header: "Interest Due", render: (row) => formatCurrency(row.interest_due) },
            {
                key: "paid",
                header: "Paid",
                render: (row) => formatCurrency(row.principal_paid + row.interest_paid)
            },
            {
                key: "pending",
                header: "Pending Due",
                render: (row) => {
                    const pending = Math.max(row.principal_due - row.principal_paid, 0) + Math.max(row.interest_due - row.interest_paid, 0);
                    return formatCurrency(pending);
                }
            },
            {
                key: "status",
                header: "Status",
                render: (row) => {
                    const daysFromToday = Math.floor((new Date(row.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    const label = row.status === "overdue"
                        ? `${Math.abs(daysFromToday)}d overdue`
                        : row.status === "pending" || row.status === "partial"
                            ? daysFromToday >= 0
                                ? `due in ${daysFromToday}d`
                                : `${Math.abs(daysFromToday)}d late`
                            : row.status;

                    return (
                        <Chip
                            size="small"
                            label={label}
                            color={row.status === "paid" ? "success" : row.status === "overdue" ? "error" : row.status === "partial" ? "warning" : "default"}
                            variant={row.status === "paid" ? "filled" : "outlined"}
                        />
                    );
                }
            }
        ],
        []
    );

    if (loading) {
        return <AppLoader message="Loading loan details..." />;
    }

    if (!loan) {
        return (
            <Stack spacing={3}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Button
                        variant="text"
                        color="inherit"
                        startIcon={<ArrowBackRoundedIcon />}
                        onClick={() => navigate("/loans")}
                    >
                        Back to Loans
                    </Button>
                </Stack>
                <Alert severity="warning" variant="outlined">
                    The selected loan could not be found in your current workspace.
                </Alert>
            </Stack>
        );
    }

    return (
        <Stack spacing={3}>
            <MotionCard
                variant="outlined"
                sx={{
                    borderRadius: 2,
                    background: theme.palette.mode === "dark"
                        ? `linear-gradient(135deg, ${alpha("#1B2535", 0.92)}, ${alpha("#D9B273", 0.16)})`
                        : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)}, ${alpha(theme.palette.background.paper, 0.95)})`
                }}
            >
                <CardContent sx={{ p: { xs: 2.25, md: 2.75 } }}>
                    <Stack spacing={2.25}>
                        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
                            <Box>
                                <Button
                                    variant="text"
                                    color="inherit"
                                    startIcon={<ArrowBackRoundedIcon />}
                                    onClick={() => navigate("/loans")}
                                    sx={{ mb: 1, ml: -1 }}
                                >
                                    Back to Loans
                                </Button>
                                <Typography variant="h5">{loan.loan_number}</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 780 }}>
                                    Collection-ready loan profile for {member?.full_name || "the selected member"} in {selectedTenantName || "your workspace"} with priority dues, exposure, and repayment signals.
                                </Typography>
                            </Box>
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="flex-start">
                                <Chip
                                    label={loan.status}
                                    color={loan.status === "active" ? "success" : loan.status === "in_arrears" ? "warning" : "default"}
                                    variant={loan.status === "active" ? "filled" : "outlined"}
                                />
                                <Chip
                                    label={nextDueSchedule ? `Next due ${formatDate(nextDueSchedule.due_date)}` : "No open schedule"}
                                    color={nextDueSchedule ? "primary" : "default"}
                                    variant="outlined"
                                    sx={nextDueSchedule ? darkAccentChipSx : undefined}
                                />
                                <Chip
                                    label={overdueSchedules.length ? `${overdueSchedules.length} overdue` : "No overdue"}
                                    color={overdueSchedules.length ? "error" : "success"}
                                    variant="outlined"
                                />
                            </Stack>
                        </Stack>

                        <Grid container spacing={2}>
                            <Grid size={{ xs: 12, md: 4 }}>
                                <Box sx={{ p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
                                    <Typography variant="overline" color="text.secondary">Borrower</Typography>
                                    <Typography variant="h6" sx={{ mt: 0.5 }}>
                                        {member?.full_name || "Unknown member"}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                        {member?.phone || "No phone recorded"}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {member?.email || "No email recorded"}
                                    </Typography>
                                </Box>
                            </Grid>
                            <Grid size={{ xs: 12, md: 4 }}>
                                <Box sx={{ p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
                                    <Typography variant="overline" color="text.secondary">Loan Terms</Typography>
                                    <Typography variant="h6" sx={{ mt: 0.5 }}>
                                        {loan.term_count} {loan.repayment_frequency}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                        Interest {loan.annual_interest_rate}% per annum
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Disbursed {formatDate(loan.disbursed_at)}
                                    </Typography>
                                </Box>
                            </Grid>
                            <Grid size={{ xs: 12, md: 4 }}>
                                <Box sx={{ p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
                                    <Typography variant="overline" color="text.secondary">Collections Health</Typography>
                                    <Typography variant="h6" sx={{ mt: 0.5 }}>
                                        {progressPercent.toFixed(1)}% repaid
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                        {paidInstallments}/{sortedSchedules.length || 0} installments settled
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {oldestOverdueDays > 0 ? `Oldest overdue ${oldestOverdueDays} day(s)` : "No delinquency aging"}
                                    </Typography>
                                </Box>
                            </Grid>
                        </Grid>
                    </Stack>
                </CardContent>
            </MotionCard>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                    <MetricCard
                        title="Principal"
                        value={formatCurrency(loan.principal_amount)}
                        helper="Original loan amount disbursed."
                        status="Booked value"
                        tone="neutral"
                        icon={<CreditScoreRoundedIcon fontSize="small" />}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                    <MetricCard
                        title="Outstanding"
                        value={formatCurrency(loan.outstanding_principal)}
                        helper="Principal balance still to be settled."
                        status={loan.outstanding_principal > 0 ? "Open balance" : "Fully cleared"}
                        tone={loan.outstanding_principal > 0 ? "neutral" : "positive"}
                        icon={<PaymentsRoundedIcon fontSize="small" />}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                    <MetricCard
                        title="Overdue Exposure"
                        value={formatCurrency(overdueExposure)}
                        helper={`${overdueSchedules.length} overdue installment(s) with pending repayment.`}
                        status={overdueSchedules.length > 0 ? "Action required" : "No overdue exposure"}
                        tone={overdueSchedules.length > 0 ? "negative" : "positive"}
                        icon={<PriceCheckRoundedIcon fontSize="small" />}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                    <MetricCard
                        title="Total Repaid"
                        value={formatCurrency(totalRepaidAmount)}
                        helper="Cumulative repayments posted against this account."
                        status={`${dueWithin7Days} installment(s) due in 7 days`}
                        tone={dueWithin7Days > 0 ? "neutral" : "positive"}
                        icon={<CalendarMonthRoundedIcon fontSize="small" />}
                    />
                </Grid>
            </Grid>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, lg: 7 }}>
                    <MotionCard variant="outlined" sx={{ height: "100%" }}>
                        <CardContent sx={{ height: "100%" }}>
                            <Stack spacing={2} sx={{ height: "100%" }}>
                                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.25}>
                                    <Box>
                                        <Typography variant="h6">Collections Priority Board</Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                            Most urgent installments for immediate borrower follow-up and repayment action.
                                        </Typography>
                                    </Box>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={() => navigate("/follow-ups")}
                                        sx={darkAccentOutlinedSx}
                                    >
                                        Open Follow-ups
                                    </Button>
                                </Stack>
                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                    <Chip
                                        label={`${overdueSchedules.length} overdue`}
                                        color={overdueSchedules.length > 0 ? "error" : "success"}
                                        variant="outlined"
                                    />
                                    <Chip
                                        label={`${dueWithin7Days} due this week`}
                                        color={dueWithin7Days > 0 ? "warning" : "success"}
                                        variant="outlined"
                                    />
                                    <Chip
                                        label={`${formatCurrency(overdueExposure)} exposed`}
                                        color="primary"
                                        variant="outlined"
                                        sx={darkAccentChipSx}
                                    />
                                </Stack>
                                <Divider />
                                {prioritySchedules.length ? (
                                    <Stack spacing={1.1}>
                                        {prioritySchedules.map((schedule) => (
                                            <Button
                                                key={schedule.id}
                                                variant="text"
                                                color="inherit"
                                                onClick={() => navigate("/loans")}
                                                sx={{ px: 0, py: 0.75, justifyContent: "space-between", textTransform: "none" }}
                                            >
                                                <Stack spacing={0.2} sx={{ textAlign: "left", flex: 1 }}>
                                                    <Typography variant="subtitle2">
                                                        Installment {schedule.installment_number} · Due {formatDate(schedule.due_date)}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Pending {formatCurrency(schedule.pending)}
                                                    </Typography>
                                                </Stack>
                                                <Chip
                                                    size="small"
                                                    label={schedule.status}
                                                    color={schedule.status === "overdue" ? "error" : schedule.status === "partial" ? "warning" : "default"}
                                                    variant={schedule.status === "overdue" ? "filled" : "outlined"}
                                                />
                                            </Button>
                                        ))}
                                    </Stack>
                                ) : (
                                    <Alert severity="success" variant="outlined">
                                        No pending installment action is currently required for this loan.
                                    </Alert>
                                )}
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>
                <Grid size={{ xs: 12, lg: 5 }}>
                    <MotionCard variant="outlined" sx={{ height: "100%" }}>
                        <CardContent sx={{ height: "100%" }}>
                            <Stack spacing={2}>
                                <Typography variant="h6">Repayment Snapshot</Typography>
                                <Stack spacing={1.25}>
                                    <Stack direction="row" justifyContent="space-between">
                                        <Typography variant="body2" color="text.secondary">Open installments</Typography>
                                        <Typography variant="subtitle2">{openSchedules.length}</Typography>
                                    </Stack>
                                    <Stack direction="row" justifyContent="space-between">
                                        <Typography variant="body2" color="text.secondary">Paid installments</Typography>
                                        <Typography variant="subtitle2">{paidInstallments}</Typography>
                                    </Stack>
                                    <Stack direction="row" justifyContent="space-between">
                                        <Typography variant="body2" color="text.secondary">Total transactions</Typography>
                                        <Typography variant="subtitle2">{orderedTransactions.length}</Typography>
                                    </Stack>
                                    <Stack direction="row" justifyContent="space-between">
                                        <Typography variant="body2" color="text.secondary">Accrued interest</Typography>
                                        <Typography variant="subtitle2">{formatCurrency(loan.accrued_interest)}</Typography>
                                    </Stack>
                                </Stack>
                                <Divider />
                                {overdueSchedules.length > 0 ? (
                                    <Alert severity="warning" variant="outlined">
                                        {overdueSchedules.length} installment(s) are delinquent. Collections outreach should be prioritized.
                                    </Alert>
                                ) : (
                                    <Alert severity="success" variant="outlined">
                                        No installment is currently overdue for this account.
                                    </Alert>
                                )}
                                <Button
                                    variant="contained"
                                    onClick={() => navigate("/loans")}
                                    sx={darkAccentContainedSx}
                                >
                                    Back to Loan Portfolio
                                </Button>
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>
            </Grid>

            <MotionCard variant="outlined">
                <CardContent>
                    <Stack spacing={1.5} sx={{ mb: 2 }}>
                        <Typography variant="h6">Amortization Schedule</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Installment-level dues, settlement progress, and real-time repayment status for this loan.
                        </Typography>
                    </Stack>
                    <DataTable rows={sortedSchedules} columns={scheduleColumns} emptyMessage="No amortization schedule found for this loan." />
                </CardContent>
            </MotionCard>

            <MotionCard variant="outlined">
                <CardContent>
                    <Stack spacing={1.5} sx={{ mb: 2 }}>
                        <Typography variant="h6">Repayment and Activity History</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Every disbursement, repayment, and interest accrual posted to this loan account.
                        </Typography>
                    </Stack>
                    <DataTable rows={orderedTransactions} columns={transactionColumns} emptyMessage="No loan activity recorded yet." />
                </CardContent>
            </MotionCard>
        </Stack>
    );
}
