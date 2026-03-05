import { MotionCard, MotionModal } from "../ui/motion";
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
    Card,
    CardContent,
    Chip,
    Grid,
    Stack,
    Typography
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
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
    icon
}: {
    title: string;
    value: string;
    helper: string;
    icon: React.ReactNode;
}) {
    return (
        <MotionCard variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                    <Box>
                        <Typography variant="overline" color="text.secondary">
                            {title}
                        </Typography>
                        <Typography variant="h5" sx={{ mt: 0.5 }}>
                            {value}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                            {helper}
                        </Typography>
                    </Box>
                    <Avatar
                        variant="rounded"
                        sx={{
                            width: 42,
                            height: 42,
                            borderRadius: 2,
                            bgcolor: "action.hover",
                            color: "text.primary"
                        }}
                    >
                        {icon}
                    </Avatar>
                </Stack>
            </CardContent>
        </MotionCard>
    );
}

export function LoanDetailPage() {
    const theme = useTheme();
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
                    api.get<MembersResponse>(endpoints.members.list()),
                    api.get<LoansResponse>(endpoints.finance.loanPortfolio(), {
                        params: { tenant_id: selectedTenantId }
                    }),
                    api.get<LoanSchedulesResponse>(endpoints.finance.loanSchedules(), {
                        params: { tenant_id: selectedTenantId, loan_id: loanId }
                    }),
                    api.get<LoanTransactionsResponse>(endpoints.finance.loanTransactions(), {
                        params: { tenant_id: selectedTenantId, loan_id: loanId }
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
                key: "status",
                header: "Status",
                render: (row) => (
                    <Chip
                        size="small"
                        label={row.status}
                        color={row.status === "paid" ? "success" : row.status === "overdue" ? "warning" : "default"}
                        variant={row.status === "paid" ? "filled" : "outlined"}
                    />
                )
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
                    background: `linear-gradient(135deg, ${theme.palette.background.paper}, ${theme.palette.action.hover})`
                }}
            >
                <CardContent>
                    <Stack spacing={2}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
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
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                                    Full loan account profile for {member?.full_name || "the selected member"} in {selectedTenantName || "the current tenant"} workspace.
                                </Typography>
                            </Box>
                            <Chip
                                label={loan.status}
                                color={loan.status === "active" ? "success" : loan.status === "in_arrears" ? "warning" : "default"}
                                variant={loan.status === "active" ? "filled" : "outlined"}
                            />
                        </Stack>

                        <Grid container spacing={2}>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <Box
                                    sx={{
                                        p: 2,
                                        border: `1px solid ${theme.palette.divider}`,
                                        borderRadius: 2
                                    }}
                                >
                                    <Typography variant="overline" color="text.secondary">
                                        Borrower
                                    </Typography>
                                    <Typography variant="h6" sx={{ mt: 0.5 }}>
                                        {member?.full_name || "Unknown member"}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                        {member?.phone || "No phone recorded"}
                                    </Typography>
                                </Box>
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <Box
                                    sx={{
                                        p: 2,
                                        border: `1px solid ${theme.palette.divider}`,
                                        borderRadius: 2
                                    }}
                                >
                                    <Typography variant="overline" color="text.secondary">
                                        Terms
                                    </Typography>
                                    <Typography variant="h6" sx={{ mt: 0.5 }}>
                                        {loan.term_count} {loan.repayment_frequency}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                        Interest {loan.annual_interest_rate}% per annum
                                    </Typography>
                                </Box>
                            </Grid>
                        </Grid>
                    </Stack>
                </CardContent>
            </MotionCard>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MetricCard
                        title="Principal"
                        value={formatCurrency(loan.principal_amount)}
                        helper="Original loan amount disbursed."
                        icon={<CreditScoreRoundedIcon fontSize="small" />}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MetricCard
                        title="Outstanding"
                        value={formatCurrency(loan.outstanding_principal)}
                        helper="Principal still outstanding."
                        icon={<PaymentsRoundedIcon fontSize="small" />}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MetricCard
                        title="Accrued Interest"
                        value={formatCurrency(loan.accrued_interest)}
                        helper="Interest accrued and not yet cleared."
                        icon={<PriceCheckRoundedIcon fontSize="small" />}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MetricCard
                        title="Disbursed At"
                        value={formatDate(loan.disbursed_at)}
                        helper="Recorded disbursement date."
                        icon={<CalendarMonthRoundedIcon fontSize="small" />}
                    />
                </Grid>
            </Grid>

            <MotionCard variant="outlined">
                <CardContent>
                    <Stack spacing={1.5} sx={{ mb: 2 }}>
                        <Typography variant="h6">Repayment and Activity History</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Every disbursement, repayment, and accrual posted against this loan account.
                        </Typography>
                    </Stack>
                    <DataTable rows={transactions} columns={transactionColumns} emptyMessage="No loan activity recorded yet." />
                </CardContent>
            </MotionCard>

            <MotionCard variant="outlined">
                <CardContent>
                    <Stack spacing={1.5} sx={{ mb: 2 }}>
                        <Typography variant="h6">Amortization Schedule</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Scheduled dues, paid amounts, and repayment status for each installment.
                        </Typography>
                    </Stack>
                    <DataTable rows={schedules} columns={scheduleColumns} emptyMessage="No amortization schedule found for this loan." />
                </CardContent>
            </MotionCard>
        </Stack>
    );
}
