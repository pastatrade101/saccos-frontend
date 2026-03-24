import { MotionCard } from "../ui/motion";
import {
    Alert,
    Box,
    CardContent,
    Chip,
    Grid,
    Paper,
    Stack,
    Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../auth/AuthContext";
import { AppLoader } from "../components/AppLoader";
import { ChartPanel } from "../components/ChartPanel";
import { api, getApiErrorMessage } from "../lib/api";
import {
    endpoints,
    type MemberAccountsResponse,
    type MembersResponse,
    type StatementsResponse
} from "../lib/endpoints";
import type { Member, MemberAccount, StatementRow } from "../types/api";
import { formatCurrency, formatDate } from "../utils/format";

function monthKey(value: string) {
    return value.slice(0, 7);
}

export function SavingsPage() {
    const theme = useTheme();
    const { selectedTenantId, profile } = useAuth();
    const [members, setMembers] = useState<Member[]>([]);
    const [savingsAccounts, setSavingsAccounts] = useState<MemberAccount[]>([]);
    const [transactions, setTransactions] = useState<StatementRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadData = async () => {
            if (!selectedTenantId) {
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const [{ data: membersResponse }, statementsResponse, { data: accountsResponse }] = await Promise.all([
                    api.get<MembersResponse>(endpoints.members.list(), {
                        params: { tenant_id: selectedTenantId, page: 1, limit: 100 }
                    }),
                    api.get<StatementsResponse>(endpoints.finance.statements(), {
                        params: { tenant_id: selectedTenantId, page: 1, limit: 100 }
                    }),
                    api.get<MemberAccountsResponse>(endpoints.members.accounts(), {
                        params: {
                            tenant_id: selectedTenantId,
                            product_type: "savings",
                            page: 1,
                            limit: 100
                        }
                    })
                ]);

                const visibleMembers = membersResponse.data || [];
                const visibleMemberIds = new Set(visibleMembers.map((member) => member.id));
                const visibleAccounts = (accountsResponse.data || []).filter((account) => visibleMemberIds.has(account.member_id));
                const visibleAccountIds = new Set(visibleAccounts.map((account) => account.id));
                const savingsRows = (statementsResponse.data.data || []).filter(
                    (entry) =>
                        visibleMemberIds.has(entry.member_id) &&
                        visibleAccountIds.has(entry.account_id) &&
                        ["deposit", "withdrawal"].includes(entry.transaction_type)
                );

                setMembers(visibleMembers);
                setSavingsAccounts(visibleAccounts);
                setTransactions(savingsRows);
            } catch (loadError) {
                setError(getApiErrorMessage(loadError));
            } finally {
                setLoading(false);
            }
        };

        void loadData();
    }, [selectedTenantId]);

    const metrics = useMemo(() => {
        const depositRows = transactions.filter((entry) => entry.transaction_type === "deposit");
        const withdrawalRows = transactions.filter((entry) => entry.transaction_type === "withdrawal");
        const activeSaverIds = new Set(depositRows.map((entry) => entry.member_id));
        const monthSeries = new Map<string, { deposits: number; withdrawals: number }>();

        transactions.forEach((entry) => {
            const key = monthKey(entry.transaction_date);
            const point = monthSeries.get(key) || { deposits: 0, withdrawals: 0 };

            if (entry.transaction_type === "deposit") {
                point.deposits += entry.amount;
            } else {
                point.withdrawals += entry.amount;
            }

            monthSeries.set(key, point);
        });

        const orderedSeries = [...monthSeries.entries()]
            .sort(([left], [right]) => left.localeCompare(right))
            .slice(-6);

        return {
            totalSavingsBalance: savingsAccounts.reduce((sum, account) => sum + Number(account.available_balance || 0), 0),
            totalDeposits: depositRows.reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
            totalWithdrawals: withdrawalRows.reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
            activeSavers: activeSaverIds.size,
            series: orderedSeries
        };
    }, [savingsAccounts, transactions]);

    const memberNameById = useMemo(
        () => new Map(members.map((member) => [member.id, member.full_name || "Unknown member"])),
        [members]
    );

    const alternateRowSx = (index: number) => ({
        p: 1.6,
        borderRadius: 2,
        border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
        bgcolor:
            index % 2 === 0
                ? alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.12 : 0.05)
                : alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.86 : 0.92)
    });
    const listHeaderSx = {
        px: 1.6,
        py: 1.1,
        borderRadius: 2,
        border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
        bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.2 : 0.09)
    };

    return (
        <Stack spacing={3}>
            <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 3 }}>
                    <MotionCard variant="outlined" sx={{ height: "100%" }}>
                        <CardContent>
                            <Typography variant="overline" color="text.secondary">Savings Balance</Typography>
                            <Typography variant="h4" sx={{ mt: 1 }}>{formatCurrency(metrics.totalSavingsBalance)}</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                Available balances across savings accounts visible to {profile?.role === "branch_manager" ? "this branch" : "this workspace"}.
                            </Typography>
                        </CardContent>
                    </MotionCard>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                    <MotionCard variant="outlined" sx={{ height: "100%" }}>
                        <CardContent>
                            <Typography variant="overline" color="text.secondary">Deposits Posted</Typography>
                            <Typography variant="h4" sx={{ mt: 1 }}>{formatCurrency(metrics.totalDeposits)}</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                Member cash deposited into savings accounts during the visible period.
                            </Typography>
                        </CardContent>
                    </MotionCard>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                    <MotionCard variant="outlined" sx={{ height: "100%" }}>
                        <CardContent>
                            <Typography variant="overline" color="text.secondary">Withdrawals Paid</Typography>
                            <Typography variant="h4" sx={{ mt: 1 }}>{formatCurrency(metrics.totalWithdrawals)}</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                Cash released from savings accounts during the visible period.
                            </Typography>
                        </CardContent>
                    </MotionCard>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                    <MotionCard variant="outlined" sx={{ height: "100%" }}>
                        <CardContent>
                            <Typography variant="overline" color="text.secondary">Active Savers</Typography>
                            <Typography variant="h4" sx={{ mt: 1 }}>{metrics.activeSavers}</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                Members with savings deposits on record.
                            </Typography>
                        </CardContent>
                    </MotionCard>
                </Grid>
            </Grid>

            {error ? <Alert severity="error">{error}</Alert> : null}

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, lg: 8 }}>
                    <ChartPanel
                        title="Savings Movement Trend"
                        subtitle="Monthly deposits versus withdrawals."
                        data={{
                            labels: metrics.series.map(([label]) => label),
                            datasets: [
                                {
                                    label: "Deposits",
                                    data: metrics.series.map(([, point]) => point.deposits),
                                    borderColor: theme.palette.success.main,
                                    backgroundColor: alpha(theme.palette.success.main, 0.18),
                                    fill: true
                                },
                                {
                                    label: "Withdrawals",
                                    data: metrics.series.map(([, point]) => point.withdrawals),
                                    borderColor: theme.palette.error.main,
                                    backgroundColor: alpha(theme.palette.error.main, 0.18),
                                    fill: true
                                }
                            ]
                        }}
                        options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }}
                    />
                </Grid>
                <Grid size={{ xs: 12, lg: 4 }}>
                    <MotionCard variant="outlined" sx={{ height: "100%" }}>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>Savings Oversight</Typography>
                            <Stack spacing={1.5}>
                                <Alert severity="info" variant="outlined">
                                    Branch managers can monitor savings deposits and withdrawals per branch without teller posting rights.
                                </Alert>
                                <Alert severity="success" variant="outlined">
                                    Available balances stay aligned with ledger controls; use this page to verify member cash flows before posting.
                                </Alert>
                                <Alert severity="warning" variant="outlined">
                                    This view is read-only; teller and finance teams continue to post savings movements through cash control workflows.
                                </Alert>
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>
            </Grid>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                    <MotionCard variant="outlined" sx={{ height: "100%" }}>
                        <CardContent sx={{ display: "grid", gap: 2 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                                <Typography variant="h6">Savings Accounts</Typography>
                                <Chip label={`${savingsAccounts.length} accounts`} size="small" color="primary" variant="outlined" />
                            </Stack>
                            {loading ? (
                                <AppLoader fullscreen={false} minHeight={240} message="Loading savings accounts..." />
                            ) : !savingsAccounts.length ? (
                                <Alert severity="info" variant="outlined">
                                    No savings accounts available.
                                </Alert>
                            ) : (
                                <Box sx={{ maxHeight: 560, overflowY: "auto", pr: 0.5 }}>
                                    <Stack spacing={1.2}>
                                        <Paper elevation={0} sx={listHeaderSx}>
                                            <Grid container spacing={1.5} alignItems="center">
                                                <Grid size={{ xs: 12, md: 3 }}>
                                                    <Typography variant="caption" sx={{ fontWeight: 800, color: theme.palette.primary.main, letterSpacing: 0.5 }}>
                                                        SAVINGS ACCOUNT
                                                    </Typography>
                                                </Grid>
                                                <Grid size={{ xs: 12, md: 4 }}>
                                                    <Typography variant="caption" sx={{ fontWeight: 800, color: theme.palette.primary.main, letterSpacing: 0.5 }}>
                                                        MEMBER
                                                    </Typography>
                                                </Grid>
                                                <Grid size={{ xs: 6, md: 2 }}>
                                                    <Typography variant="caption" sx={{ fontWeight: 800, color: theme.palette.primary.main, letterSpacing: 0.5 }}>
                                                        STATUS
                                                    </Typography>
                                                </Grid>
                                                <Grid size={{ xs: 6, md: 3 }}>
                                                    <Typography variant="caption" sx={{ fontWeight: 800, color: theme.palette.primary.main, letterSpacing: 0.5 }}>
                                                        AVAILABLE BALANCE
                                                    </Typography>
                                                </Grid>
                                            </Grid>
                                        </Paper>
                                        {savingsAccounts.map((account, index) => (
                                            <Paper key={account.id} elevation={0} sx={alternateRowSx(index)}>
                                                <Grid container spacing={1.5} alignItems="center">
                                                    <Grid size={{ xs: 12, md: 3 }}>
                                                        <Typography variant="subtitle1" sx={{ fontWeight: 800 }} noWrap>
                                                            {account.account_number}
                                                        </Typography>
                                                    </Grid>
                                                    <Grid size={{ xs: 12, md: 4 }}>
                                                        <Typography variant="body1" sx={{ fontWeight: 700 }} noWrap>
                                                            {memberNameById.get(account.member_id) || "Unknown member"}
                                                        </Typography>
                                                    </Grid>
                                                    <Grid size={{ xs: 6, md: 2 }}>
                                                        <Chip
                                                            size="small"
                                                            label={account.status}
                                                            color={account.status === "active" ? "success" : "default"}
                                                            variant="outlined"
                                                        />
                                                    </Grid>
                                                    <Grid size={{ xs: 6, md: 3 }}>
                                                        <Typography variant="subtitle1" sx={{ fontWeight: 900, color: theme.palette.primary.main }}>
                                                            {formatCurrency(account.available_balance)}
                                                        </Typography>
                                                    </Grid>
                                                </Grid>
                                            </Paper>
                                        ))}
                                    </Stack>
                                </Box>
                            )}
                        </CardContent>
                    </MotionCard>
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <MotionCard variant="outlined" sx={{ height: "100%" }}>
                        <CardContent sx={{ display: "grid", gap: 2 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                                <Typography variant="h6">Savings Activity</Typography>
                                <Chip label={`${transactions.length} entries`} size="small" color="primary" variant="outlined" />
                            </Stack>
                            {loading ? (
                                <AppLoader fullscreen={false} minHeight={240} message="Loading savings activity..." />
                            ) : !transactions.length ? (
                                <Alert severity="info" variant="outlined">
                                    No savings activity available.
                                </Alert>
                            ) : (
                                <Box sx={{ maxHeight: 560, overflowY: "auto", pr: 0.5 }}>
                                    <Stack spacing={1.2}>
                                        <Paper elevation={0} sx={listHeaderSx}>
                                            <Grid container spacing={1.5} alignItems="center">
                                                <Grid size={{ xs: 12, md: 2 }}>
                                                    <Typography variant="caption" sx={{ fontWeight: 800, color: theme.palette.primary.main, letterSpacing: 0.5 }}>
                                                        DATE
                                                    </Typography>
                                                </Grid>
                                                <Grid size={{ xs: 12, md: 3 }}>
                                                    <Typography variant="caption" sx={{ fontWeight: 800, color: theme.palette.primary.main, letterSpacing: 0.5 }}>
                                                        MEMBER
                                                    </Typography>
                                                </Grid>
                                                <Grid size={{ xs: 6, md: 2 }}>
                                                    <Typography variant="caption" sx={{ fontWeight: 800, color: theme.palette.primary.main, letterSpacing: 0.5 }}>
                                                        TYPE
                                                    </Typography>
                                                </Grid>
                                                <Grid size={{ xs: 6, md: 2 }}>
                                                    <Typography variant="caption" sx={{ fontWeight: 800, color: theme.palette.primary.main, letterSpacing: 0.5 }}>
                                                        AMOUNT
                                                    </Typography>
                                                </Grid>
                                                <Grid size={{ xs: 12, md: 2 }}>
                                                    <Typography variant="caption" sx={{ fontWeight: 800, color: theme.palette.primary.main, letterSpacing: 0.5 }}>
                                                        BALANCE
                                                    </Typography>
                                                </Grid>
                                                <Grid size={{ xs: 12, md: 1 }}>
                                                    <Typography variant="caption" sx={{ fontWeight: 800, color: theme.palette.primary.main, letterSpacing: 0.5 }}>
                                                        REF
                                                    </Typography>
                                                </Grid>
                                            </Grid>
                                        </Paper>
                                        {transactions.map((row, index) => (
                                            <Paper key={`${row.transaction_id}-${index}`} elevation={0} sx={alternateRowSx(index)}>
                                                <Grid container spacing={1.5} alignItems="center">
                                                    <Grid size={{ xs: 12, md: 2 }}>
                                                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                                            {formatDate(row.transaction_date)}
                                                        </Typography>
                                                    </Grid>
                                                    <Grid size={{ xs: 12, md: 3 }}>
                                                        <Typography variant="body1" sx={{ fontWeight: 700 }} noWrap>
                                                            {row.member_name}
                                                        </Typography>
                                                    </Grid>
                                                    <Grid size={{ xs: 6, md: 2 }}>
                                                        <Chip
                                                            size="small"
                                                            label={row.transaction_type === "deposit" ? "Deposit" : "Withdrawal"}
                                                            color={row.transaction_type === "deposit" ? "success" : "error"}
                                                            variant="outlined"
                                                        />
                                                    </Grid>
                                                    <Grid size={{ xs: 6, md: 2 }}>
                                                        <Typography variant="subtitle1" sx={{ fontWeight: 900, color: theme.palette.primary.main }}>
                                                            {formatCurrency(row.amount)}
                                                        </Typography>
                                                    </Grid>
                                                    <Grid size={{ xs: 12, md: 2 }}>
                                                        <Typography variant="body1" sx={{ fontWeight: 700 }}>
                                                            {formatCurrency(row.running_balance)}
                                                        </Typography>
                                                    </Grid>
                                                    <Grid size={{ xs: 12, md: 1 }}>
                                                        <Typography variant="body2" color="text.secondary" noWrap>
                                                            {row.reference || "N/A"}
                                                        </Typography>
                                                    </Grid>
                                                </Grid>
                                            </Paper>
                                        ))}
                                    </Stack>
                                </Box>
                            )}
                        </CardContent>
                    </MotionCard>
                </Grid>
            </Grid>
        </Stack>
    );
}
