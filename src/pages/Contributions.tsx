import { MotionCard, MotionModal } from "../ui/motion";
import {
    Alert,
    Card,
    CardContent,
    Chip,
    Grid,
    Stack,
    Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../auth/AuthProvider";
import { AppLoader } from "../components/AppLoader";
import { ChartPanel } from "../components/ChartPanel";
import { DataTable, type Column } from "../components/DataTable";
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

    const transactionColumns: Column<StatementRow>[] = [
        { key: "date", header: "Date", render: (row) => formatDate(row.transaction_date) },
        { key: "member", header: "Member", render: (row) => row.member_name },
        {
            key: "type",
            header: "Type",
            render: (row) => (
                <Chip
                    size="small"
                    label={row.transaction_type === "share_contribution" ? "Contribution" : "Dividend"}
                    color={row.transaction_type === "share_contribution" ? "primary" : "success"}
                    variant="outlined"
                />
            )
        },
        { key: "amount", header: "Amount", render: (row) => formatCurrency(row.amount) },
        { key: "balance", header: "Running Balance", render: (row) => formatCurrency(row.running_balance) },
        { key: "reference", header: "Reference", render: (row) => row.reference || "N/A" }
    ];

    const accountColumns: Column<MemberAccount>[] = [
        { key: "account", header: "Share Account", render: (row) => row.account_number },
        {
            key: "member",
            header: "Member",
            render: (row) => members.find((member) => member.id === row.member_id)?.full_name || "Unknown member"
        },
        { key: "status", header: "Status", render: (row) => row.status },
        { key: "balance", header: "Share Capital", render: (row) => formatCurrency(row.available_balance) }
    ];

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
                <Grid size={{ xs: 12, lg: 5 }}>
                    <MotionCard variant="outlined">
                        <CardContent>
                            <Typography variant="h6" gutterBottom>Share Accounts</Typography>
                            {loading ? (
                                <AppLoader fullscreen={false} minHeight={240} message="Loading share accounts..." />
                            ) : (
                                <DataTable rows={shareAccounts} columns={accountColumns} emptyMessage="No share accounts available." />
                            )}
                        </CardContent>
                    </MotionCard>
                </Grid>
                <Grid size={{ xs: 12, lg: 7 }}>
                    <MotionCard variant="outlined">
                        <CardContent>
                            <Typography variant="h6" gutterBottom>Contribution Activity</Typography>
                            {loading ? (
                                <AppLoader fullscreen={false} minHeight={240} message="Loading contribution history..." />
                            ) : (
                                <DataTable rows={transactions} columns={transactionColumns} emptyMessage="No share contribution activity available." />
                            )}
                        </CardContent>
                    </MotionCard>
                </Grid>
            </Grid>
        </Stack>
    );
}
