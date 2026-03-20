import { MotionCard, MotionModal } from "../ui/motion";
import {
    Alert,
    Box,
    Card,
    CardContent,
    Chip,
    Grid,
    Paper,
    Stack,
    Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../auth/AuthProvider";
import { AppLoader } from "../components/AppLoader";
import { ChartPanel } from "../components/ChartPanel";
import { api, getApiErrorMessage } from "../lib/api";
import { endpoints, type MemberAccountsResponse, type MembersResponse, type StatementsResponse } from "../lib/endpoints";
import type { Member, MemberAccount, StatementRow } from "../types/api";
import { formatCurrency, formatDate } from "../utils/format";

function monthKey(value: string) {
    return value.slice(0, 7);
}

export function ContributionsPage() {
    const theme = useTheme();
    const { selectedTenantId, profile } = useAuth();
    const [members, setMembers] = useState<Member[]>([]);
    const [shareAccounts, setShareAccounts] = useState<MemberAccount[]>([]);
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
                            product_type: "shares",
                            page: 1,
                            limit: 100
                        }
                    })
                ]);

                const visibleMembers = membersResponse.data || [];
                const visibleMemberIds = new Set(visibleMembers.map((member) => member.id));
                const visibleAccounts = (accountsResponse.data || []).filter((account) => visibleMemberIds.has(account.member_id));
                const visibleAccountIds = new Set(visibleAccounts.map((account) => account.id));
                const contributionRows = (statementsResponse.data.data || []).filter((entry: StatementRow) =>
                    visibleMemberIds.has(entry.member_id) &&
                    visibleAccountIds.has(entry.account_id) &&
                    ["share_contribution", "dividend_allocation"].includes(entry.transaction_type)
                );

                setMembers(visibleMembers);
                setShareAccounts(visibleAccounts);
                setTransactions(contributionRows);
            } catch (loadError) {
                setError(getApiErrorMessage(loadError));
            } finally {
                setLoading(false);
            }
        };

        void loadData();
    }, [selectedTenantId]);

    const metrics = useMemo(() => {
        const contributionRows = transactions.filter((entry) => entry.transaction_type === "share_contribution");
        const dividendRows = transactions.filter((entry) => entry.transaction_type === "dividend_allocation");
        const activeContributorIds = new Set(contributionRows.map((entry) => entry.member_id));
        const monthSeries = new Map<string, { contributions: number; dividends: number }>();

        transactions.forEach((entry) => {
            const key = monthKey(entry.transaction_date);
            const point = monthSeries.get(key) || { contributions: 0, dividends: 0 };

            if (entry.transaction_type === "share_contribution") {
                point.contributions += entry.amount;
            }

            if (entry.transaction_type === "dividend_allocation") {
                point.dividends += entry.amount;
            }

            monthSeries.set(key, point);
        });

        const orderedSeries = [...monthSeries.entries()]
            .sort(([left], [right]) => left.localeCompare(right))
            .slice(-6);

        return {
            totalShareCapital: shareAccounts.reduce((sum, account) => sum + Number(account.available_balance || 0), 0),
            totalContributions: contributionRows.reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
            totalDividends: dividendRows.reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
            activeContributors: activeContributorIds.size,
            series: orderedSeries
        };
    }, [shareAccounts, transactions]);
    const memberNameById = useMemo(
        () =>
            new Map(
                members.map((member) => [member.id, member.full_name || "Unknown member"])
            ),
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
                            <Typography variant="overline" color="text.secondary">Share Capital Base</Typography>
                            <Typography variant="h4" sx={{ mt: 1 }}>{formatCurrency(metrics.totalShareCapital)}</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                Total member share balance visible to {profile?.role === "branch_manager" ? "this branch" : "this workspace"}.
                            </Typography>
                        </CardContent>
                    </MotionCard>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                    <MotionCard variant="outlined" sx={{ height: "100%" }}>
                        <CardContent>
                            <Typography variant="overline" color="text.secondary">Contributions Posted</Typography>
                            <Typography variant="h4" sx={{ mt: 1 }}>{formatCurrency(metrics.totalContributions)}</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                Share subscriptions received from active members.
                            </Typography>
                        </CardContent>
                    </MotionCard>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                    <MotionCard variant="outlined" sx={{ height: "100%" }}>
                        <CardContent>
                            <Typography variant="overline" color="text.secondary">Dividends Reinvested</Typography>
                            <Typography variant="h4" sx={{ mt: 1 }}>{formatCurrency(metrics.totalDividends)}</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                Approved dividends credited back into share capital.
                            </Typography>
                        </CardContent>
                    </MotionCard>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                    <MotionCard variant="outlined" sx={{ height: "100%" }}>
                        <CardContent>
                            <Typography variant="overline" color="text.secondary">Active Contributors</Typography>
                            <Typography variant="h4" sx={{ mt: 1 }}>{metrics.activeContributors}</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                Members with recorded share contributions in the visible history.
                            </Typography>
                        </CardContent>
                    </MotionCard>
                </Grid>
            </Grid>

            {error ? <Alert severity="error">{error}</Alert> : null}

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, lg: 8 }}>
                    <ChartPanel
                        title="Share Capital Trend"
                        subtitle="Monthly contributions versus dividend credits."
                        data={{
                            labels: metrics.series.map(([label]) => label),
                            datasets: [
                                {
                                    label: "Contributions",
                                    data: metrics.series.map(([, point]) => point.contributions),
                                    borderColor: theme.palette.primary.main,
                                    backgroundColor: alpha(theme.palette.primary.main, 0.18),
                                    fill: true
                                },
                                {
                                    label: "Dividends",
                                    data: metrics.series.map(([, point]) => point.dividends),
                                    borderColor: theme.palette.success.main,
                                    backgroundColor: alpha(theme.palette.success.main, 0.18),
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
                            <Typography variant="h6" gutterBottom>Contribution Oversight</Typography>
                            <Stack spacing={1.5}>
                                <Alert severity="info" variant="outlined">
                                    Branch managers can review share growth and member contribution behavior here without teller posting access.
                                </Alert>
                                <Alert severity="success" variant="outlined">
                                    Dividend credits are shown separately, so reinvested returns are distinguishable from direct member cash subscriptions.
                                </Alert>
                                <Alert severity="warning" variant="outlined">
                                    Final posting still remains in controlled finance workflows. This page is read-only for operational oversight.
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
                                <Typography variant="h6">Share Accounts</Typography>
                                <Chip label={`${shareAccounts.length} accounts`} size="small" color="primary" variant="outlined" />
                            </Stack>
                            {loading ? (
                                <AppLoader fullscreen={false} minHeight={240} message="Loading share accounts..." />
                            ) : !shareAccounts.length ? (
                                <Alert severity="info" variant="outlined">
                                    No share accounts available.
                                </Alert>
                            ) : (
                                <Box sx={{ maxHeight: 560, overflowY: "auto", pr: 0.5 }}>
                                    <Stack spacing={1.2}>
                                        <Paper elevation={0} sx={listHeaderSx}>
                                            <Grid container spacing={1.5} alignItems="center">
                                                <Grid size={{ xs: 12, md: 4 }}>
                                                    <Typography variant="caption" sx={{ fontWeight: 800, color: theme.palette.primary.main, letterSpacing: 0.5 }}>
                                                        SHARE ACCOUNT
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
                                                <Grid size={{ xs: 6, md: 2 }}>
                                                    <Typography variant="caption" sx={{ fontWeight: 800, color: theme.palette.primary.main, letterSpacing: 0.5 }}>
                                                        SHARE CAPITAL
                                                    </Typography>
                                                </Grid>
                                            </Grid>
                                        </Paper>
                                        {shareAccounts.map((account, index) => (
                                            <Paper key={account.id} elevation={0} sx={alternateRowSx(index)}>
                                                <Grid container spacing={1.5} alignItems="center">
                                                    <Grid size={{ xs: 12, md: 4 }}>
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
                                                    <Grid size={{ xs: 6, md: 2 }}>
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
                                <Typography variant="h6">Contribution Activity</Typography>
                                <Chip label={`${transactions.length} entries`} size="small" color="primary" variant="outlined" />
                            </Stack>
                            {loading ? (
                                <AppLoader fullscreen={false} minHeight={240} message="Loading contribution history..." />
                            ) : !transactions.length ? (
                                <Alert severity="info" variant="outlined">
                                    No share contribution activity available.
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
                                                            label={row.transaction_type === "share_contribution" ? "Contribution" : "Dividend"}
                                                            color={row.transaction_type === "share_contribution" ? "primary" : "success"}
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
