import { MotionCard, MotionModal } from "../ui/motion";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import CallMadeRoundedIcon from "@mui/icons-material/CallMadeRounded";
import CallReceivedRoundedIcon from "@mui/icons-material/CallReceivedRounded";
import SavingsRoundedIcon from "@mui/icons-material/SavingsRounded";
import WalletRoundedIcon from "@mui/icons-material/WalletRounded";
import {
    Alert,
    Box,
    Button,
    CardContent,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    InputLabel,
    Pagination,
    Stack,
    TextField,
    Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { useAuth } from "../auth/AuthContext";
import { AppLoader } from "../components/AppLoader";
import { ConfirmModal } from "../components/ConfirmModal";
import { DataTable, type Column } from "../components/DataTable";
import { SearchableSelect } from "../components/SearchableSelect";
import { useToast } from "../components/Toast";
import { api, getApiErrorMessage } from "../lib/api";
import {
    endpoints,
    type CashRequest,
    type CashResponse,
    type CloseTellerSessionRequest,
    type DailyCashSummaryResponse,
    type MemberAccountsResponse,
    type MembersResponse,
    type OpenTellerSessionRequest,
    type ReceiptInitResponse,
    type ReceiptPolicyResponse,
    type ShareContributionResponse,
    type StatementsResponse,
    type PendingApprovalPayload,
    type TellerSessionResponse
} from "../lib/endpoints";
import { supabase } from "../lib/supabase";
import type { ApiEnvelope, DailyCashSummary, Member, MemberAccount, ReceiptPolicy, StatementRow, TellerSession } from "../types/api";
import { formatCurrency, formatDate } from "../utils/format";

const actionSchema = z.object({
    account_id: z.string().uuid("Select an account."),
    amount: z.coerce.number().positive("Amount must be greater than zero."),
    reference: z.string().max(80).optional().or(z.literal("")),
    description: z.string().max(255).optional().or(z.literal(""))
});

type CashValues = z.infer<typeof actionSchema>;
type ActionType = "deposit" | "withdraw" | "share_contribution";
type PendingAction = { type: ActionType; values: CashValues; receiptFile: File | null } | null;

function MetricCard({
    title,
    value,
    helper,
    icon,
    tone = "neutral"
}: {
    title: string;
    value: string;
    helper: string;
    icon: React.ReactNode;
    tone?: "neutral" | "positive" | "warning" | "negative";
}) {
    const theme = useTheme();
    const neutralAccent = theme.palette.mode === "dark" ? "#D9B273" : theme.palette.primary.main;
    const toneStyles = tone === "positive"
        ? { main: theme.palette.success.main, soft: alpha(theme.palette.success.main, 0.14), border: alpha(theme.palette.success.main, 0.24) }
        : tone === "warning"
            ? { main: theme.palette.warning.main, soft: alpha(theme.palette.warning.main, 0.14), border: alpha(theme.palette.warning.main, 0.24) }
            : tone === "negative"
                ? { main: theme.palette.error.main, soft: alpha(theme.palette.error.main, 0.14), border: alpha(theme.palette.error.main, 0.24) }
                : { main: neutralAccent, soft: alpha(neutralAccent, 0.12), border: alpha(neutralAccent, 0.24) };

    return (
        <MotionCard
            variant="outlined"
            sx={{
                height: "100%",
                borderRadius: 2,
                borderColor: toneStyles.border,
                background: `linear-gradient(180deg, ${toneStyles.soft}, ${theme.palette.background.paper})`
            }}
        >
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
                    <Box
                        sx={{
                            width: 44,
                            height: 44,
                            borderRadius: 2,
                            display: "grid",
                            placeItems: "center",
                            bgcolor: toneStyles.soft,
                            color: toneStyles.main
                        }}
                    >
                        {icon}
                    </Box>
                </Stack>
            </CardContent>
        </MotionCard>
    );
}

export function CashPage() {
    const theme = useTheme();
    const navigate = useNavigate();
    const { pushToast } = useToast();
    const { selectedTenantId, selectedTenantName, selectedBranchId, subscriptionInactive } = useAuth();
    const [members, setMembers] = useState<Member[]>([]);
    const [accounts, setAccounts] = useState<MemberAccount[]>([]);
    const [transactions, setTransactions] = useState<StatementRow[]>([]);
    const [currentSession, setCurrentSession] = useState<TellerSession | null>(null);
    const [receiptPolicy, setReceiptPolicy] = useState<ReceiptPolicy | null>(null);
    const [dailySummary, setDailySummary] = useState<DailyCashSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [pendingAction, setPendingAction] = useState<PendingAction>(null);
    const [actionDialog, setActionDialog] = useState<ActionType | null>(null);
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [openingSession, setOpeningSession] = useState(false);
    const [closingSession, setClosingSession] = useState(false);
    const [openSessionDialog, setOpenSessionDialog] = useState(false);
    const [closeSessionDialog, setCloseSessionDialog] = useState(false);
    const [pendingApprovalNotice, setPendingApprovalNotice] = useState<{
        requestId: string;
        payload: CashRequest;
    } | null>(null);
    const [page, setPage] = useState(1);
    const pageSize = 10;

    const defaultAccountId = localStorage.getItem("saccos:selectedAccountId") || "";

    const depositForm = useForm<CashValues>({
        resolver: zodResolver(actionSchema),
        defaultValues: {
            account_id: defaultAccountId,
            amount: 0,
            reference: "",
            description: ""
        }
    });

    const withdrawForm = useForm<CashValues>({
        resolver: zodResolver(actionSchema),
        defaultValues: {
            account_id: defaultAccountId,
            amount: 0,
            reference: "",
            description: ""
        }
    });

    const shareForm = useForm<CashValues>({
        resolver: zodResolver(actionSchema),
        defaultValues: {
            account_id: "",
            amount: 0,
            reference: "",
            description: ""
        }
    });

    const openSessionForm = useForm<OpenTellerSessionRequest>({
        defaultValues: {
            branch_id: selectedBranchId || "",
            opening_cash: 0,
            notes: ""
        }
    });

    const closeSessionForm = useForm<CloseTellerSessionRequest>({
        defaultValues: {
            closing_cash: 0,
            notes: ""
        }
    });

    const loadCashData = async () => {
        if (!selectedTenantId) {
            setLoading(false);
            return;
        }

        setLoading(true);

        try {
            const [
                { data: membersResponse },
                statementsResponse,
                { data: accountsResponse },
                { data: currentSessionResponse },
                { data: receiptPolicyResponse },
                { data: dailySummaryResponse }
            ] = await Promise.all([
                api.get<MembersResponse>(endpoints.members.list(), {
                    params: { tenant_id: selectedTenantId, page: 1, limit: 100 }
                }),
                api.get<StatementsResponse>(endpoints.finance.statements(), {
                    params: { tenant_id: selectedTenantId, page: 1, limit: 100 }
                }),
                api.get<MemberAccountsResponse>(endpoints.members.accounts(), {
                    params: { tenant_id: selectedTenantId, page: 1, limit: 100 }
                }),
                api.get<TellerSessionResponse>(endpoints.cashControl.currentSession(), {
                    params: selectedBranchId ? { branch_id: selectedBranchId } : {}
                }),
                api.get<ReceiptPolicyResponse>(endpoints.cashControl.receiptPolicy(), {
                    params: selectedBranchId ? { branch_id: selectedBranchId } : {}
                }),
                api.get<DailyCashSummaryResponse>(endpoints.cashControl.dailySummary(), {
                    params: selectedBranchId ? { branch_id: selectedBranchId, page: 1, limit: 100 } : { page: 1, limit: 100 }
                })
            ]);

            setMembers(membersResponse.data);
            setTransactions((statementsResponse.data.data || []).slice(0, 40));
            setAccounts(accountsResponse.data || []);
            setCurrentSession(currentSessionResponse.data || null);
            setReceiptPolicy(receiptPolicyResponse.data || null);
            setDailySummary(dailySummaryResponse.data || []);
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to load cash desk",
                message: getApiErrorMessage(error)
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadCashData();
    }, [selectedTenantId, selectedBranchId]);

    useEffect(() => {
        openSessionForm.setValue("branch_id", selectedBranchId || "");
    }, [selectedBranchId]);

    const accountOptions = useMemo(
        () =>
            accounts.map((account) => {
                const member = members.find((entry) => entry.id === account.member_id);

                return {
                    value: account.id,
                    label: `${account.account_number} - ${member?.full_name || "Unknown member"}`,
                    secondary: `${account.product_type} • Balance ${formatCurrency(account.available_balance)}`
                };
            }),
        [accounts, members]
    );

    const savingsAccountOptions = useMemo(
        () => accountOptions.filter((option) => option.secondary.toLowerCase().includes("savings")),
        [accountOptions]
    );
    const shareAccountOptions = useMemo(
        () => accountOptions.filter((option) => option.secondary.toLowerCase().includes("shares")),
        [accountOptions]
    );

    const todaySummary = dailySummary[0] || null;
    const latestBusinessDate = useMemo(() => {
        if (!transactions.length) {
            return null;
        }

        return [...new Set(transactions.map((entry) => entry.transaction_date))]
            .filter(Boolean)
            .sort((left, right) => left.localeCompare(right))
            .slice(-1)[0] || null;
    }, [transactions]);
    const deskBusinessDate = todaySummary?.business_date || latestBusinessDate;
    const deskTransactions = useMemo(
        () =>
            deskBusinessDate
                ? transactions.filter((entry) => entry.transaction_date === deskBusinessDate)
                : transactions,
        [deskBusinessDate, transactions]
    );
    const todayDepositTotal = useMemo(
        () => deskTransactions
            .filter((entry) => entry.transaction_type === "deposit")
            .reduce((sum, entry) => sum + entry.amount, 0),
        [deskTransactions]
    );
    const todayWithdrawalTotal = useMemo(
        () => deskTransactions
            .filter((entry) => entry.transaction_type === "withdrawal")
            .reduce((sum, entry) => sum + entry.amount, 0),
        [deskTransactions]
    );
    const visibleMembersWithActivity = useMemo(() => new Set(deskTransactions.map((item) => item.member_id)).size, [deskTransactions]);
    const deskDepositTotal = todaySummary?.deposits_total ?? todayDepositTotal;
    const deskWithdrawalTotal = todaySummary?.withdrawals_total ?? todayWithdrawalTotal;
    const deskNetMovement = todaySummary?.net_movement ?? (deskDepositTotal - deskWithdrawalTotal);
    const deskExpectedCash = todaySummary?.expected_cash_total ?? currentSession?.expected_cash ?? 0;
    const highValueThreshold = Math.max(receiptPolicy?.required_threshold || 0, 250000);
    const highValueTransactions = useMemo(
        () => deskTransactions.filter((entry) => entry.amount >= highValueThreshold).length,
        [deskTransactions, highValueThreshold]
    );
    const receiptThresholdText = receiptPolicy ? formatCurrency(receiptPolicy.required_threshold) : "TSh 0";
    const tellerSessionRequired = Boolean(receiptPolicy) && !currentSession;
    const cashDeskAccent = theme.palette.mode === "dark" ? "#D9B273" : theme.palette.primary.main;
    const cashDeskAccentStrong = theme.palette.mode === "dark" ? "#C89B52" : theme.palette.primary.dark;
    const receiptNeededForPendingAction = Boolean(
        pendingAction
        && receiptPolicy?.receipt_required
        && receiptPolicy.enforce_on_types.includes(pendingAction.type)
        && pendingAction.values.amount >= receiptPolicy.required_threshold
    );

    const transactionColumns: Column<StatementRow>[] = [
        { key: "date", header: "Date", render: (row) => formatDate(row.transaction_date) },
        { key: "member", header: "Member", render: (row) => row.member_name },
        { key: "type", header: "Type", render: (row) => row.transaction_type },
        { key: "amount", header: "Amount", render: (row) => formatCurrency(row.amount) },
        { key: "balance", header: "Balance", render: (row) => formatCurrency(row.running_balance) },
        { key: "reference", header: "Reference", render: (row) => row.reference || "N/A" }
    ];

    const totalPages = Math.max(1, Math.ceil(transactions.length / pageSize));
    const paginatedTransactions = useMemo(
        () => transactions.slice((page - 1) * pageSize, page * pageSize),
        [page, transactions]
    );

    const handleSubmit = (type: ActionType, values: CashValues) => {
        setPendingAction({ type, values, receiptFile });
    };

    const uploadReceiptForAction = async (action: PendingAction, branchId: string, memberId?: string | null) => {
        if (!action?.receiptFile) {
            return [];
        }

        const file = action.receiptFile;
        const { data: initResponse } = await api.post<ReceiptInitResponse>(endpoints.cashControl.initReceipt(), {
            branch_id: branchId,
            member_id: memberId || null,
            transaction_type: action.type,
            file_name: file.name,
            mime_type: file.type || "application/octet-stream",
            file_size_bytes: file.size
        });

        const { receipt, upload } = initResponse.data;
        const { error: uploadError } = await supabase.storage
            .from(receipt.storage_bucket)
            .uploadToSignedUrl(upload.path, upload.token, file);

        if (uploadError) {
            throw uploadError;
        }

        await api.post(endpoints.cashControl.confirmReceipt(receipt.id), {});
        return [receipt.id];
    };

    const openSession = openSessionForm.handleSubmit(async (values) => {
        setOpeningSession(true);
        try {
            await api.post<TellerSessionResponse>(endpoints.cashControl.openSession(), values);
            pushToast({
                type: "success",
                title: "Teller session opened",
                message: "You can now post cash transactions for this desk."
            });
            setOpenSessionDialog(false);
            openSessionForm.reset({
                branch_id: selectedBranchId || "",
                opening_cash: 0,
                notes: ""
            });
            await loadCashData();
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to open teller session",
                message: getApiErrorMessage(error)
            });
        } finally {
            setOpeningSession(false);
        }
    });

    const closeSession = closeSessionForm.handleSubmit(async (values) => {
        if (!currentSession) {
            return;
        }

        setClosingSession(true);
        try {
            await api.post<TellerSessionResponse>(endpoints.cashControl.closeSession(currentSession.id), values);
            pushToast({
                type: "success",
                title: "Teller session closed",
                message: "The session is now pending review."
            });
            setCloseSessionDialog(false);
            await loadCashData();
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to close teller session",
                message: getApiErrorMessage(error)
            });
        } finally {
            setClosingSession(false);
        }
    });

    const confirmAction = async () => {
        if (!pendingAction) {
            return;
        }

        setProcessing(true);

        try {
            const account = accounts.find((entry) => entry.id === pendingAction.values.account_id);
            const member = members.find((entry) => entry.id === account?.member_id);
            const receiptIds = account
                ? await uploadReceiptForAction(pendingAction, account.branch_id, member?.id || null)
                : [];

            const payload: CashRequest = {
                tenant_id: selectedTenantId || undefined,
                account_id: pendingAction.values.account_id,
                amount: pendingAction.values.amount,
                reference: pendingAction.values.reference || null,
                description: pendingAction.values.description || null,
                receipt_ids: receiptIds
            };

            const endpoint =
                pendingAction.type === "deposit"
                    ? endpoints.finance.deposit()
                    : pendingAction.type === "withdraw"
                        ? endpoints.finance.withdraw()
                        : endpoints.finance.shareContribution();

            const { data } = await api.post<CashResponse | ShareContributionResponse | ApiEnvelope<PendingApprovalPayload>>(endpoint, payload);
            const maybePending = data.data as Partial<PendingApprovalPayload>;
            if (pendingAction.type === "withdraw" && maybePending.approval_required && maybePending.approval_request_id) {
                pushToast({
                    type: "success",
                    title: "Sent for approval",
                    message: `Withdrawal is waiting checker approval (${maybePending.approval_request_id.slice(0, 8)}...).`
                });
                setPendingApprovalNotice({
                    requestId: maybePending.approval_request_id,
                    payload
                });
            } else {
                const financeData = data.data as { journal_id?: string | null; message?: string | null };
                pushToast({
                    type: "success",
                    title:
                        pendingAction.type === "deposit"
                            ? "Deposit posted"
                            : pendingAction.type === "withdraw"
                                ? "Withdrawal posted"
                                : "Share contribution posted",
                    message: financeData.journal_id
                        ? `Journal ${financeData.journal_id} posted successfully.`
                        : financeData.message || "Transaction completed."
                });
            }

            setPendingAction(null);
            setActionDialog(null);
            setReceiptFile(null);
            depositForm.reset({ account_id: payload.account_id, amount: 0, reference: "", description: "" });
            withdrawForm.reset({ account_id: payload.account_id, amount: 0, reference: "", description: "" });
            shareForm.reset({ account_id: "", amount: 0, reference: "", description: "" });
            await loadCashData();
        } catch (error) {
            pushToast({
                type: "error",
                title: "Cash transaction failed",
                message: getApiErrorMessage(error)
            });
        } finally {
            setProcessing(false);
        }
    };

    const executeApprovedWithdrawal = async () => {
        if (!pendingApprovalNotice) {
            return;
        }

        setProcessing(true);
        try {
            const payload: CashRequest = {
                ...pendingApprovalNotice.payload,
                approval_request_id: pendingApprovalNotice.requestId
            };
            const { data } = await api.post<CashResponse>(endpoints.finance.withdraw(), payload);
            pushToast({
                type: "success",
                title: "Withdrawal posted",
                message: data.data.journal_id
                    ? `Journal ${data.data.journal_id} posted successfully.`
                    : data.data.message || "Approved withdrawal executed."
            });
            setPendingApprovalNotice(null);
            await loadCashData();
        } catch (error) {
            pushToast({
                type: "error",
                title: "Execution not ready",
                message: getApiErrorMessage(error, "Approval may still be pending or was rejected.")
            });
        } finally {
            setProcessing(false);
        }
    };

    const selectedAccount = accounts.find((account) => account.id === pendingAction?.values.account_id);
    const selectedMember = members.find((member) => member.id === selectedAccount?.member_id);

    const currentForm =
        actionDialog === "deposit"
            ? depositForm
            : actionDialog === "withdraw"
                ? withdrawForm
                : shareForm;
    const currentActionOptions = actionDialog === "share_contribution" ? shareAccountOptions : savingsAccountOptions;
    const currentActionValue = currentForm.watch("account_id");
    const currentActionAccount = accounts.find((account) => account.id === currentActionValue);
    const currentActionMember = members.find((member) => member.id === currentActionAccount?.member_id);

    const dialogTitle =
        actionDialog === "deposit"
            ? "Start Deposit"
            : actionDialog === "withdraw"
                ? "Start Withdrawal"
                : "Post Share Contribution";

    return (
        <Stack spacing={3}>
            <MotionCard
                variant="outlined"
                sx={{
                    borderRadius: 2,
                    color: "text.primary",
                    background: theme.palette.mode === "dark"
                        ? `linear-gradient(135deg, ${alpha("#1B2535", 0.92)}, ${alpha("#D9B273", 0.16)})`
                        : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)}, ${alpha(theme.palette.background.paper, 0.97)})`
                }}
            >
                <CardContent>
                    <Stack spacing={2}>
                        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
                            <Box>
                                <Typography variant="overline" color="text.secondary">Teller desk command center</Typography>
                                <Typography variant="h5" sx={{ mt: 0.5 }}>Cash Desk</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 780 }}>
                                    Run day-to-day teller operations faster with clear session status, posting controls, and transaction shortcuts.
                                </Typography>
                            </Box>
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                                <Chip label={selectedTenantName || "Tenant workspace"} variant="outlined" />
                                <Chip
                                    label={currentSession ? "Session open" : "Session not opened"}
                                    color={currentSession ? "success" : "warning"}
                                    variant="outlined"
                                />
                                <Chip
                                    label={deskBusinessDate ? `Business date ${formatDate(deskBusinessDate)}` : "Business date pending"}
                                    variant="outlined"
                                />
                            </Stack>
                        </Stack>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap>
                            <Button
                                variant="contained"
                                startIcon={<CallReceivedRoundedIcon />}
                                onClick={() => {
                                    setReceiptFile(null);
                                    setActionDialog("deposit");
                                }}
                                disabled={subscriptionInactive || tellerSessionRequired}
                                sx={theme.palette.mode === "dark" ? { bgcolor: cashDeskAccent, color: "#1a1a1a", "&:hover": { bgcolor: cashDeskAccentStrong } } : undefined}
                            >
                                Start Deposit
                            </Button>
                            <Button
                                variant="outlined"
                                color="error"
                                startIcon={<CallMadeRoundedIcon />}
                                onClick={() => {
                                    setReceiptFile(null);
                                    setActionDialog("withdraw");
                                }}
                                disabled={subscriptionInactive || tellerSessionRequired}
                                sx={theme.palette.mode === "dark" ? { borderColor: alpha("#FF8A80", 0.44), color: "#FFAB91", "&:hover": { borderColor: alpha("#FF8A80", 0.7), bgcolor: alpha("#FF8A80", 0.08) } } : undefined}
                            >
                                Start Withdrawal
                            </Button>
                            <Button
                                variant="outlined"
                                startIcon={<SavingsRoundedIcon />}
                                onClick={() => {
                                    setReceiptFile(null);
                                    setActionDialog("share_contribution");
                                }}
                                disabled={subscriptionInactive || tellerSessionRequired}
                                sx={theme.palette.mode === "dark" ? { borderColor: alpha(cashDeskAccent, 0.44), color: cashDeskAccent, "&:hover": { borderColor: alpha(cashDeskAccent, 0.78), bgcolor: alpha(cashDeskAccent, 0.1) } } : undefined}
                            >
                                Start Contribution
                            </Button>
                            {!currentSession ? (
                                <Button
                                    variant="outlined"
                                    onClick={() => setOpenSessionDialog(true)}
                                    disabled={subscriptionInactive}
                                    sx={theme.palette.mode === "dark" ? { borderColor: alpha(cashDeskAccent, 0.44), color: cashDeskAccent, "&:hover": { borderColor: alpha(cashDeskAccent, 0.78), bgcolor: alpha(cashDeskAccent, 0.1) } } : undefined}
                                >
                                    Open Session
                                </Button>
                            ) : (
                                <Button
                                    variant="outlined"
                                    color="warning"
                                    onClick={() => setCloseSessionDialog(true)}
                                >
                                    Close Session
                                </Button>
                            )}
                        </Stack>
                    </Stack>
                </CardContent>
            </MotionCard>

            {pendingApprovalNotice ? (
                <Alert
                    severity="info"
                    variant="outlined"
                    action={
                        <Stack direction="row" spacing={1}>
                            <Button size="small" onClick={() => void executeApprovedWithdrawal()} disabled={processing}>
                                Execute Approved
                            </Button>
                            <Button size="small" onClick={() => navigate("/approvals")}>
                                Open Queue
                            </Button>
                            <Button size="small" onClick={() => setPendingApprovalNotice(null)}>
                                Dismiss
                            </Button>
                        </Stack>
                    }
                >
                    Withdrawal submitted for maker-checker approval. Request ID: {pendingApprovalNotice.requestId}
                </Alert>
            ) : null}

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MetricCard
                        title="Desk Throughput"
                        value={String(deskTransactions.length)}
                        helper={`${visibleMembersWithActivity} member(s) served in this business day.`}
                        icon={<WalletRoundedIcon fontSize="small" />}
                        tone={deskTransactions.length >= 20 ? "warning" : "neutral"}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MetricCard
                        title="Deposit Intake"
                        value={formatCurrency(deskDepositTotal)}
                        helper="Total deposit inflow posted for the active desk day."
                        icon={<CallReceivedRoundedIcon fontSize="small" />}
                        tone="positive"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MetricCard
                        title="Withdrawal Outflow"
                        value={formatCurrency(deskWithdrawalTotal)}
                        helper="Total withdrawal amount posted for the active desk day."
                        icon={<CallMadeRoundedIcon fontSize="small" />}
                        tone="negative"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MetricCard
                        title="Net Movement"
                        value={`${deskNetMovement >= 0 ? "+" : "-"} ${formatCurrency(Math.abs(deskNetMovement))}`}
                        helper={deskNetMovement >= 0 ? "Net inflow position on teller desk." : "Net outflow position on teller desk."}
                        icon={<AccountBalanceWalletRoundedIcon fontSize="small" />}
                        tone={deskNetMovement >= 0 ? "positive" : "warning"}
                    />
                </Grid>
            </Grid>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, xl: 7 }}>
                    <MotionCard
                        variant="outlined"
                        sx={{
                            borderRadius: 2,
                            background: theme.palette.mode === "dark"
                                ? `linear-gradient(180deg, ${alpha("#D9B273", 0.08)}, ${alpha(theme.palette.background.paper, 0.92)})`
                                : undefined
                        }}
                    >
                        <CardContent>
                            <Stack spacing={2}>
                                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={2}>
                                    <Box>
                                        <Typography variant="h6">Teller Session</Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                            Open a session before posting. At close, counted cash is matched against expected desk cash from posted transactions.
                                        </Typography>
                                    </Box>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        {currentSession ? (
                                            <Chip color="success" label={`Open · ${formatCurrency(currentSession.opening_cash)}`} />
                                        ) : (
                                            <Chip label="No open session" color="warning" variant="outlined" />
                                        )}
                                        {currentSession ? (
                                            <Chip
                                                label={`Expected ${formatCurrency(deskExpectedCash)}`}
                                                variant="outlined"
                                                sx={theme.palette.mode === "dark" ? { borderColor: alpha(cashDeskAccent, 0.42), color: cashDeskAccent } : undefined}
                                            />
                                        ) : null}
                                    </Stack>
                                </Stack>
                                {currentSession ? (
                                    <Grid container spacing={1.5}>
                                        <Grid size={{ xs: 12, sm: 4 }}>
                                            <Box sx={{ p: 1.5, border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
                                                <Typography variant="caption" color="text.secondary">Opened</Typography>
                                                <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600 }}>{formatDate(currentSession.opened_at)}</Typography>
                                            </Box>
                                        </Grid>
                                        <Grid size={{ xs: 12, sm: 4 }}>
                                            <Box sx={{ p: 1.5, border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
                                                <Typography variant="caption" color="text.secondary">Opening cash</Typography>
                                                <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600 }}>{formatCurrency(currentSession.opening_cash)}</Typography>
                                            </Box>
                                        </Grid>
                                        <Grid size={{ xs: 12, sm: 4 }}>
                                            <Box sx={{ p: 1.5, border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
                                                <Typography variant="caption" color="text.secondary">Expected cash</Typography>
                                                <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600 }}>{formatCurrency(deskExpectedCash)}</Typography>
                                            </Box>
                                        </Grid>
                                    </Grid>
                                ) : (
                                    <Alert severity="warning" variant="outlined">
                                        A teller session is required before you can post cash transactions when cash-control enforcement is active.
                                    </Alert>
                                )}
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>
                <Grid size={{ xs: 12, xl: 5 }}>
                    <MotionCard
                        variant="outlined"
                        sx={{
                            borderRadius: 2,
                            background: theme.palette.mode === "dark"
                                ? `linear-gradient(180deg, ${alpha("#D9B273", 0.07)}, ${alpha(theme.palette.background.paper, 0.92)})`
                                : undefined
                        }}
                    >
                        <CardContent>
                            <Stack spacing={2}>
                                <Typography variant="h6">Receipt & Control Signals</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Policy status: {receiptPolicy?.receipt_required ? `receipt required from ${receiptThresholdText}` : "receipts optional"}.
                                </Typography>
                                <Grid container spacing={1.5}>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <Box sx={{ p: 1.5, border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
                                            <Typography variant="caption" color="text.secondary">High-value checks</Typography>
                                            <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600 }}>{highValueTransactions}</Typography>
                                        </Box>
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <Box sx={{ p: 1.5, border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
                                            <Typography variant="caption" color="text.secondary">High-value threshold</Typography>
                                            <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600 }}>{formatCurrency(highValueThreshold)}</Typography>
                                        </Box>
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <Box sx={{ p: 1.5, border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
                                            <Typography variant="caption" color="text.secondary">Max receipts</Typography>
                                            <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600 }}>{receiptPolicy?.max_receipts_per_tx ?? 0}</Typography>
                                        </Box>
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <Box sx={{ p: 1.5, border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
                                            <Typography variant="caption" color="text.secondary">Max file size</Typography>
                                            <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600 }}>{receiptPolicy?.max_file_size_mb ?? 0} MB</Typography>
                                        </Box>
                                    </Grid>
                                </Grid>
                                {receiptPolicy?.enforce_on_types?.length ? (
                                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                        {receiptPolicy.enforce_on_types.map((type) => (
                                            <Chip key={type} size="small" label={type.replace(/_/g, " ")} />
                                        ))}
                                    </Stack>
                                ) : null}
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>
            </Grid>

            {subscriptionInactive ? (
                <Alert severity="warning" variant="outlined">
                    Subscription inactive. Cash operations are visible for review only until the tenant subscription is renewed.
                </Alert>
            ) : null}

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, xl: 7 }}>
                    <MotionCard
                        variant="outlined"
                        sx={{
                            height: "100%",
                            borderRadius: 2,
                            background: `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.98)}, ${alpha(theme.palette.success.main, 0.04)})`
                        }}
                    >
                        <CardContent>
                            <Stack spacing={2.5}>
                                <Box>
                                    <Typography variant="h6">Quick Transaction Actions</Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                                        Start the required cash action, capture details in the modal, then confirm posting before it is committed to the ledger.
                                    </Typography>
                                </Box>

                                <Grid container spacing={2}>
                                    <Grid size={{ xs: 12, md: 4 }}>
                                        <MotionCard variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
                                            <CardContent>
                                                <Stack spacing={2}>
                                                    <Box>
                                                        <Typography variant="subtitle1">Deposit</Typography>
                                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                            Post member savings deposits with teller confirmation.
                                                        </Typography>
                                                    </Box>
                                                    <Button
                                                        variant="contained"
                                                        startIcon={<CallReceivedRoundedIcon />}
                                                        onClick={() => {
                                                            setReceiptFile(null);
                                                            setActionDialog("deposit");
                                                        }}
                                                        disabled={subscriptionInactive || tellerSessionRequired}
                                                        fullWidth
                                                        sx={theme.palette.mode === "dark" ? { bgcolor: cashDeskAccent, color: "#1a1a1a", "&:hover": { bgcolor: cashDeskAccentStrong } } : undefined}
                                                    >
                                                        Start Deposit
                                                    </Button>
                                                </Stack>
                                            </CardContent>
                                        </MotionCard>
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 4 }}>
                                        <MotionCard variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
                                            <CardContent>
                                                <Stack spacing={2}>
                                                    <Box>
                                                        <Typography variant="subtitle1">Withdraw</Typography>
                                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                            Validate savings balance and post controlled withdrawals.
                                                        </Typography>
                                                    </Box>
                                                    <Button
                                                        variant="contained"
                                                        color="error"
                                                        startIcon={<CallMadeRoundedIcon />}
                                                        onClick={() => {
                                                            setReceiptFile(null);
                                                            setActionDialog("withdraw");
                                                        }}
                                                        disabled={subscriptionInactive || tellerSessionRequired}
                                                        fullWidth
                                                    >
                                                        Start Withdrawal
                                                    </Button>
                                                </Stack>
                                            </CardContent>
                                        </MotionCard>
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 4 }}>
                                        <MotionCard variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
                                            <CardContent>
                                                <Stack spacing={2}>
                                                    <Box>
                                                        <Typography variant="subtitle1">Share Capital</Typography>
                                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                            Record member share contributions into the share ledger.
                                                        </Typography>
                                                    </Box>
                                                    <Button
                                                        variant="outlined"
                                                        startIcon={<SavingsRoundedIcon />}
                                                        onClick={() => {
                                                            setReceiptFile(null);
                                                            setActionDialog("share_contribution");
                                                        }}
                                                        disabled={subscriptionInactive || tellerSessionRequired}
                                                        fullWidth
                                                        sx={theme.palette.mode === "dark" ? { borderColor: alpha(cashDeskAccent, 0.44), color: cashDeskAccent, "&:hover": { borderColor: alpha(cashDeskAccent, 0.78), bgcolor: alpha(cashDeskAccent, 0.1) } } : undefined}
                                                    >
                                                        Start Contribution
                                                    </Button>
                                                </Stack>
                                            </CardContent>
                                        </MotionCard>
                                    </Grid>
                                </Grid>
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>

                <Grid size={{ xs: 12, xl: 5 }}>
                    <MotionCard
                        variant="outlined"
                        sx={{
                            height: "100%",
                            borderRadius: 2,
                            background: `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.98)}, ${alpha(theme.palette.warning.main, 0.04)})`
                        }}
                    >
                        <CardContent>
                            <Stack spacing={2}>
                                <Box>
                                    <Typography variant="h6">Desk Priority Board</Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                                        Keep close-readiness high by resolving session, receipt, and high-value transaction checks before end-of-day sign-off.
                                    </Typography>
                                </Box>

                                <Grid container spacing={1.5}>
                                    {[
                                        ["Session status", currentSession ? "Open and ready for posting" : "Open session before posting"],
                                        ["Receipt threshold", receiptPolicy?.receipt_required ? `Required from ${receiptThresholdText}` : "Receipt optional"],
                                        ["High-value checks", `${highValueTransactions} transaction(s) above ${formatCurrency(highValueThreshold)}`],
                                        ["Expected cash", formatCurrency(deskExpectedCash)]
                                    ].map(([label, value]) => (
                                        <Grid key={label} size={{ xs: 12, sm: 6 }}>
                                            <Box
                                                sx={{
                                                    p: 1.5,
                                                    border: `1px solid ${theme.palette.divider}`,
                                                    borderRadius: 2,
                                                    bgcolor: alpha(theme.palette.background.default, 0.5),
                                                    minHeight: 108
                                                }}
                                            >
                                                <Typography variant="caption" color="text.secondary">
                                                    {label}
                                                </Typography>
                                                <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600 }}>
                                                    {value}
                                                </Typography>
                                            </Box>
                                        </Grid>
                                    ))}
                                </Grid>
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>
            </Grid>

            <MotionCard
                variant="outlined"
                sx={{
                    borderRadius: 2,
                    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)"
                }}
            >
                <CardContent>
                    <Stack
                        direction={{ xs: "column", md: "row" }}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", md: "center" }}
                        spacing={1.5}
                        sx={{ mb: 2 }}
                    >
                        <Box>
                            <Typography variant="h6">Recent Cash Transactions</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                Review the latest posted teller activity across visible accounts.
                            </Typography>
                        </Box>
                    </Stack>

                    {loading ? (
                        <AppLoader fullscreen={false} minHeight={260} message="Loading cash movements..." />
                    ) : (
                        <Stack spacing={2}>
                            <DataTable rows={paginatedTransactions} columns={transactionColumns} emptyMessage="No cash transactions yet." />
                            {transactions.length > pageSize ? (
                                <Stack direction="row" justifyContent="flex-end">
                                    <Pagination
                                        count={totalPages}
                                        page={page}
                                        onChange={(_, value) => setPage(value)}
                                        color="primary"
                                    />
                                </Stack>
                            ) : null}
                        </Stack>
                    )}
                </CardContent>
            </MotionCard>

            <MotionModal
                open={Boolean(actionDialog)}
                onClose={processing ? undefined : () => {
                    setActionDialog(null);
                    setReceiptFile(null);
                }}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>{dialogTitle}</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2.5} sx={{ pt: 0.5 }}>
                        <Typography variant="body2" color="text.secondary">
                            {actionDialog === "deposit"
                                ? "Select the member savings account, enter the amount, and review before posting."
                                : actionDialog === "withdraw"
                                    ? "Choose the member savings account and confirm the withdrawal details before posting."
                                    : "Choose the member share account and capture the contribution details before posting."}
                        </Typography>
                        {receiptPolicy?.receipt_required ? (
                            <Alert severity="info" variant="outlined">
                                Receipts are required from {receiptThresholdText} for configured transaction types. If your amount crosses the threshold, attach the evidence before review.
                            </Alert>
                        ) : null}

                        <Box
                            component="form"
                            id="cash-action-form"
                            onSubmit={
                                actionDialog === "deposit"
                                    ? depositForm.handleSubmit((values) => handleSubmit("deposit", values))
                                    : actionDialog === "withdraw"
                                        ? withdrawForm.handleSubmit((values) => handleSubmit("withdraw", values))
                                        : shareForm.handleSubmit((values) => handleSubmit("share_contribution", values))
                            }
                            sx={{ display: "grid", gap: 2 }}
                        >
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Account
                                </Typography>
                                <Box sx={{ mt: 0.75 }}>
                                    <SearchableSelect
                                        value={currentForm.watch("account_id")}
                                        options={currentActionOptions}
                                        onChange={(value) => currentForm.setValue("account_id", value, { shouldValidate: true })}
                                    />
                                </Box>
                                {currentForm.formState.errors.account_id ? (
                                    <Typography variant="caption" color="error" sx={{ mt: 0.75, display: "block" }}>
                                        {currentForm.formState.errors.account_id.message}
                                    </Typography>
                                ) : null}
                            </Box>

                            {currentActionAccount ? (
                                <Grid container spacing={1.5}>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <Box
                                            sx={{
                                                p: 1.5,
                                                border: `1px solid ${theme.palette.divider}`,
                                                borderRadius: 2,
                                                bgcolor: alpha(theme.palette.background.default, 0.45)
                                            }}
                                        >
                                            <Typography variant="caption" color="text.secondary">
                                                Member
                                            </Typography>
                                            <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600 }}>
                                                {currentActionMember?.full_name || "Unknown member"}
                                            </Typography>
                                        </Box>
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <Box
                                            sx={{
                                                p: 1.5,
                                                border: `1px solid ${theme.palette.divider}`,
                                                borderRadius: 2,
                                                bgcolor: alpha(theme.palette.background.default, 0.45)
                                            }}
                                        >
                                            <Typography variant="caption" color="text.secondary">
                                                Current Balance
                                            </Typography>
                                            <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600 }}>
                                                {formatCurrency(currentActionAccount.available_balance)}
                                            </Typography>
                                        </Box>
                                    </Grid>
                                </Grid>
                            ) : null}

                            <Grid container spacing={2}>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField
                                        label="Amount"
                                        type="number"
                                        fullWidth
                                        inputProps={{ step: "0.01" }}
                                        {...currentForm.register("amount")}
                                        error={Boolean(currentForm.formState.errors.amount)}
                                        helperText={currentForm.formState.errors.amount?.message}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField
                                        label="Reference"
                                        fullWidth
                                        placeholder={
                                            actionDialog === "deposit"
                                                ? "DEP-0001"
                                                : actionDialog === "withdraw"
                                                    ? "WDL-0001"
                                                    : "SHR-0001"
                                        }
                                        {...currentForm.register("reference")}
                                        error={Boolean(currentForm.formState.errors.reference)}
                                        helperText={currentForm.formState.errors.reference?.message}
                                    />
                                </Grid>
                            </Grid>

                            <TextField
                                label="Notes"
                                fullWidth
                                multiline
                                minRows={3}
                                placeholder={
                                    actionDialog === "deposit"
                                        ? "Counter savings deposit"
                                        : actionDialog === "withdraw"
                                            ? "Member withdrawal"
                                            : "Monthly share capital contribution"
                                }
                                {...currentForm.register("description")}
                                error={Boolean(currentForm.formState.errors.description)}
                                helperText={currentForm.formState.errors.description?.message}
                            />

                            <Box>
                                <InputLabel shrink htmlFor="cash-receipt-upload">
                                    Receipt proof
                                </InputLabel>
                                <TextField
                                    id="cash-receipt-upload"
                                    type="file"
                                    fullWidth
                                    inputProps={{
                                        accept: receiptPolicy?.allowed_mime_types?.join(",") || "image/jpeg,image/png,application/pdf"
                                    }}
                                    onChange={(event) => {
                                        const file = (event.target as HTMLInputElement).files?.[0] || null;
                                        setReceiptFile(file);
                                    }}
                                    helperText={
                                        receiptFile
                                            ? `${receiptFile.name} selected`
                                            : `Allowed: ${(receiptPolicy?.allowed_mime_types || []).join(", ") || "image/jpeg, image/png, application/pdf"}`
                                    }
                                />
                            </Box>
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => {
                        setActionDialog(null);
                        setReceiptFile(null);
                    }} disabled={processing} color="inherit">
                        Cancel
                    </Button>
                    <Button form="cash-action-form" type="submit" variant="contained" disabled={processing || subscriptionInactive}>
                        Review
                    </Button>
                </DialogActions>
            </MotionModal>

            <MotionModal open={openSessionDialog} onClose={openingSession ? undefined : () => setOpenSessionDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Open teller session</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2} sx={{ pt: 0.5 }}>
                        <TextField
                            label="Opening cash"
                            type="number"
                            inputProps={{ step: "0.01" }}
                            {...openSessionForm.register("opening_cash", { valueAsNumber: true })}
                        />
                        <TextField
                            label="Opening notes"
                            multiline
                            minRows={3}
                            {...openSessionForm.register("notes")}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenSessionDialog(false)} disabled={openingSession}>Cancel</Button>
                    <Button variant="contained" onClick={() => void openSession()} disabled={openingSession}>
                        {openingSession ? "Opening..." : "Open session"}
                    </Button>
                </DialogActions>
            </MotionModal>

            <MotionModal open={closeSessionDialog} onClose={closingSession ? undefined : () => setCloseSessionDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Close teller session</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2} sx={{ pt: 0.5 }}>
                        <Alert severity="info" variant="outlined">
                            Expected cash currently tracks as {formatCurrency(deskExpectedCash)}.
                        </Alert>
                        <TextField
                            label="Closing cash counted"
                            type="number"
                            inputProps={{ step: "0.01" }}
                            {...closeSessionForm.register("closing_cash", { valueAsNumber: true })}
                        />
                        <TextField
                            label="Closing notes"
                            multiline
                            minRows={3}
                            {...closeSessionForm.register("notes")}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCloseSessionDialog(false)} disabled={closingSession}>Cancel</Button>
                    <Button variant="contained" color="warning" onClick={() => void closeSession()} disabled={closingSession}>
                        {closingSession ? "Closing..." : "Close session"}
                    </Button>
                </DialogActions>
            </MotionModal>

            <ConfirmModal
                open={Boolean(pendingAction)}
                title={
                    pendingAction?.type === "deposit"
                        ? "Confirm Deposit"
                        : pendingAction?.type === "withdraw"
                            ? "Confirm Withdrawal"
                            : "Confirm Share Contribution"
                }
                summary={
                    <Stack spacing={1.25}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                            <Typography variant="body2" color="text.secondary">Member</Typography>
                            <Typography variant="body2" fontWeight={600}>{selectedMember?.full_name || "Unknown"}</Typography>
                        </Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                            <Typography variant="body2" color="text.secondary">Account</Typography>
                            <Typography variant="body2" fontWeight={600}>{selectedAccount?.account_number || "Unknown"}</Typography>
                        </Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                            <Typography variant="body2" color="text.secondary">Amount</Typography>
                            <Typography variant="body2" fontWeight={600}>{formatCurrency(pendingAction?.values.amount)}</Typography>
                        </Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                            <Typography variant="body2" color="text.secondary">Reference</Typography>
                            <Typography variant="body2" fontWeight={600}>{pendingAction?.values.reference || "N/A"}</Typography>
                        </Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                            <Typography variant="body2" color="text.secondary">Receipt</Typography>
                            <Typography variant="body2" fontWeight={600}>{pendingAction?.receiptFile?.name || "No receipt attached"}</Typography>
                        </Box>
                        {receiptNeededForPendingAction && !pendingAction?.receiptFile ? (
                            <Alert severity="warning" variant="outlined">
                                This transaction needs a receipt before it can be posted.
                            </Alert>
                        ) : null}
                    </Stack>
                }
                confirmLabel={
                    pendingAction?.type === "deposit"
                        ? "Post Deposit"
                        : pendingAction?.type === "withdraw"
                            ? "Post Withdrawal"
                            : "Post Share Contribution"
                }
                loading={processing}
                onCancel={() => {
                    setPendingAction(null);
                    setReceiptFile(null);
                }}
                onConfirm={() => void confirmAction()}
            />
        </Stack>
    );
}
