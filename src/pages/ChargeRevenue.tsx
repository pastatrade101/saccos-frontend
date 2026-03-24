import PaidRoundedIcon from "@mui/icons-material/PaidRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import {
    Alert,
    Box,
    CardContent,
    Chip,
    Grid,
    Paper,
    Stack,
    TextField,
    Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../auth/AuthContext";
import { AppLoader } from "../components/AppLoader";
import { ChartPanel } from "../components/ChartPanel";
import { DataTable, type Column } from "../components/DataTable";
import { api, getApiErrorMessage } from "../lib/api";
import {
    endpoints,
    type ChargeRevenueSummaryResponse
} from "../lib/endpoints";
import type {
    ChargeRevenueAccountRow,
    ChargeRevenueBranchRow,
    ChargeRevenueSummary
} from "../types/api";
import { brandColors } from "../theme/colors";
import { MotionCard } from "../ui/motion";
import { formatCurrency, formatDate } from "../utils/format";

function monthStartIsoDate() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
}

interface RevenueMetricCardProps {
    label: string;
    value: string;
    helper: string;
    icon: typeof PaidRoundedIcon;
    tone: "primary" | "success" | "warning" | "danger";
}

function RevenueMetricCard({ label, value, helper, icon: Icon, tone }: RevenueMetricCardProps) {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === "dark";
    const toneColor = tone === "success"
        ? brandColors.success
        : tone === "warning"
            ? brandColors.warning
            : tone === "danger"
                ? brandColors.danger
                : theme.palette.primary.main;

    return (
        <MotionCard variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
                <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.2 }}>
                    <Box
                        sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 2,
                            display: "grid",
                            placeItems: "center",
                            bgcolor: alpha(toneColor, isDarkMode ? 0.2 : 0.12),
                            color: toneColor
                        }}
                    >
                        <Icon fontSize="small" />
                    </Box>
                    <Typography variant="overline" color="text.secondary">
                        {label}
                    </Typography>
                </Stack>
                <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.75 }}>
                    {value}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {helper}
                </Typography>
            </CardContent>
        </MotionCard>
    );
}

export function ChargeRevenuePage() {
    const theme = useTheme();
    const { selectedTenantId, selectedBranchId, selectedBranchName, profile } = useAuth();
    const [fromDate, setFromDate] = useState(monthStartIsoDate());
    const [toDate, setToDate] = useState(todayIsoDate());
    const [summary, setSummary] = useState<ChargeRevenueSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadSummary = async () => {
            if (!selectedTenantId) {
                setSummary(null);
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const { data } = await api.get<ChargeRevenueSummaryResponse>(endpoints.reports.chargeRevenueSummary(), {
                    params: {
                        tenant_id: selectedTenantId,
                        branch_id: selectedBranchId || undefined,
                        from_date: fromDate,
                        to_date: toDate
                    }
                });
                setSummary(data.data);
            } catch (loadError) {
                setSummary(null);
                setError(getApiErrorMessage(loadError));
            } finally {
                setLoading(false);
            }
        };

        void loadSummary();
    }, [fromDate, selectedBranchId, selectedTenantId, toDate]);

    const totals = summary?.totals || {
        fee_revenue: 0,
        penalty_revenue: 0,
        loan_interest_revenue: 0,
        loan_fee_revenue: 0,
        mixed_revenue: 0,
        charge_revenue: 0,
        loan_revenue: 0,
        total_revenue: 0,
        posted_lines: 0,
        configured_fee_rules: 0,
        configured_penalty_rules: 0,
        configured_loan_products: 0
    };

    const trendLabels = useMemo(
        () => (summary?.trend || []).map((point) => point.entry_date),
        [summary?.trend]
    );

    const accountColumns: Column<ChargeRevenueAccountRow>[] = [
        {
            key: "source",
            header: "Income Source",
            render: (row) => (
                <Stack spacing={0.35}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {row.account_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {row.account_code}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {(row.configured_rule_names || []).join(", ") || "No mapped source"}
                    </Typography>
                </Stack>
            )
        },
        {
            key: "type",
            header: "Type",
            render: (row) => (
                <Chip
                    size="small"
                    label={
                        row.revenue_type === "mixed"
                            ? "Shared account"
                            : row.revenue_type === "penalty"
                                ? "Penalty"
                                : row.revenue_type === "loan_interest"
                                    ? "Loan interest"
                                    : row.revenue_type === "loan_fee"
                                        ? "Loan fees"
                                        : "Fee"
                    }
                    color={
                        row.revenue_type === "mixed"
                            ? "warning"
                            : row.revenue_type === "penalty"
                                ? "secondary"
                                : row.revenue_type === "loan_interest" || row.revenue_type === "loan_fee"
                                    ? "success"
                                    : "primary"
                    }
                    variant="outlined"
                />
            )
        },
        {
            key: "amount",
            header: "Gross Income",
            render: (row) => formatCurrency(row.amount)
        },
        {
            key: "posted_lines",
            header: "Posted Lines",
            render: (row) => row.posted_lines
        },
        {
            key: "last_entry_date",
            header: "Last Posted",
            render: (row) => formatDate(row.last_entry_date)
        }
    ];

    const branchColumns: Column<ChargeRevenueBranchRow>[] = [
        {
            key: "branch",
            header: "Branch",
            render: (row) => (
                <Stack spacing={0.25}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {row.branch_name || "Unassigned"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {row.branch_code || row.branch_id || "No branch code"}
                    </Typography>
                </Stack>
            )
        },
        {
            key: "charge_revenue",
            header: "Gross Charge",
            render: (row) => formatCurrency(row.charge_revenue)
        },
        {
            key: "loan_revenue",
            header: "Loan Gross",
            render: (row) => formatCurrency(row.loan_revenue)
        },
        {
            key: "loan_interest_revenue",
            header: "Loan Interest",
            render: (row) => formatCurrency(row.loan_interest_revenue)
        },
        {
            key: "loan_fee_revenue",
            header: "Loan Fees",
            render: (row) => formatCurrency(row.loan_fee_revenue)
        },
        {
            key: "penalty_revenue",
            header: "Penalty Income",
            render: (row) => formatCurrency(row.penalty_revenue)
        },
        {
            key: "total",
            header: "Total Gross",
            render: (row) => formatCurrency(row.total_revenue)
        }
    ];

    return (
        <Stack spacing={3}>
            <MotionCard
                variant="outlined"
                sx={{
                    background: theme.palette.mode === "dark"
                        ? `linear-gradient(135deg, ${alpha("#1B2535", 0.92)}, ${alpha("#D9B273", 0.14)})`
                        : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)}, ${alpha(theme.palette.background.paper, 0.95)})`
                }}
            >
                <CardContent>
                    <Stack spacing={2}>
                        <Stack direction={{ xs: "column", lg: "row" }} justifyContent="space-between" spacing={2}>
                            <Box>
                                <Typography variant="overline" color="text.secondary">
                                    Branch gross revenue
                                </Typography>
                                <Typography variant="h5" sx={{ mt: 0.5 }}>
                                    Fees, penalties, loan interest income, and loan fee income in one branch view
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 780 }}>
                                    Track posted operating gross revenue by branch scope, watch the trend through the selected period,
                                    and catch configuration problems where fee, penalty, and loan income are sharing the same ledger accounts.
                                </Typography>
                            </Box>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} useFlexGap>
                                <TextField
                                    label="From"
                                    type="date"
                                    size="small"
                                    value={fromDate}
                                    onChange={(event) => setFromDate(event.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                />
                                <TextField
                                    label="To"
                                    type="date"
                                    size="small"
                                    value={toDate}
                                    onChange={(event) => setToDate(event.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                />
                            </Stack>
                        </Stack>
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                            <Chip
                                icon={<ReceiptLongRoundedIcon />}
                                label={selectedBranchName || (summary?.scope.branch_count ? `${summary.scope.branch_count} branch scope` : "Tenant scope")}
                                variant="outlined"
                            />
                            <Chip
                                icon={<AccountTreeRoundedIcon />}
                                label={`${totals.configured_fee_rules} fee rule(s) · ${totals.configured_penalty_rules} penalty rule(s) · ${totals.configured_loan_products} loan product(s)`}
                                variant="outlined"
                            />
                            <Chip
                                icon={<WarningAmberRoundedIcon />}
                                label={summary?.configuration_warnings.length ? `${summary.configuration_warnings.length} shared-account warning(s)` : "Mappings clean"}
                                color={summary?.configuration_warnings.length ? "warning" : "success"}
                                variant="outlined"
                            />
                        </Stack>
                    </Stack>
                </CardContent>
            </MotionCard>

            {error ? <Alert severity="error">{error}</Alert> : null}

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6, xl: 2 }}>
                    <RevenueMetricCard
                        label="Total Gross Revenue"
                        value={formatCurrency(totals.total_revenue)}
                        helper="All posted fee, penalty, loan-interest, and loan-fee income in scope."
                        icon={PaidRoundedIcon}
                        tone="primary"
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 6, xl: 2 }}>
                    <RevenueMetricCard
                        label="Gross Charge Revenue"
                        value={formatCurrency(totals.charge_revenue)}
                        helper="Fee and penalty income from dedicated charge accounts only."
                        icon={ReceiptLongRoundedIcon}
                        tone="success"
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 6, xl: 2 }}>
                    <RevenueMetricCard
                        label="Loan Gross Revenue"
                        value={formatCurrency(totals.loan_revenue)}
                        helper="Loan interest and loan-fee income from dedicated lending accounts."
                        icon={AccountTreeRoundedIcon}
                        tone="primary"
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 6, xl: 2 }}>
                    <RevenueMetricCard
                        label="Unclassified Revenue"
                        value={formatCurrency(totals.mixed_revenue)}
                        helper="Posted into shared income accounts and excluded from charge or loan subtotals."
                        icon={WarningAmberRoundedIcon}
                        tone={totals.mixed_revenue > 0 ? "danger" : "warning"}
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 6, xl: 2 }}>
                    <RevenueMetricCard
                        label="Fee Income"
                        value={formatCurrency(totals.fee_revenue)}
                        helper="Standalone fee income from mapped fee-ledger accounts."
                        icon={ReceiptLongRoundedIcon}
                        tone="success"
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 6, xl: 2 }}>
                    <RevenueMetricCard
                        label="Penalty Income"
                        value={formatCurrency(totals.penalty_revenue)}
                        helper="Posted penalty income separated from regular charges."
                        icon={WarningAmberRoundedIcon}
                        tone="warning"
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 6, xl: 2 }}>
                    <RevenueMetricCard
                        label="Loan Interest Income"
                        value={formatCurrency(totals.loan_interest_revenue)}
                        helper="Interest recognized from posted loan repayments and lending accrual-linked income."
                        icon={AccountTreeRoundedIcon}
                        tone="primary"
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 6, xl: 2 }}>
                    <RevenueMetricCard
                        label="Loan Fee Income"
                        value={formatCurrency(totals.loan_fee_revenue)}
                        helper="Loan processing and lending fee income posted into configured loan-fee accounts."
                        icon={PaidRoundedIcon}
                        tone="success"
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 6, xl: 2 }}>
                    <RevenueMetricCard
                        label="Posted Revenue Lines"
                        value={String(totals.posted_lines)}
                        helper="Accounting lines contributing to this revenue view."
                        icon={AccountTreeRoundedIcon}
                        tone={summary?.configuration_warnings.length ? "danger" : "primary"}
                    />
                </Grid>
            </Grid>

            {summary?.configuration_warnings.length ? (
                <Stack spacing={1.25}>
                    <Alert severity="warning" variant="outlined">
                        Some revenue is posted into shared income accounts, so it cannot be split accurately by source. Review the affected accounts below.
                    </Alert>
                    {totals.mixed_revenue > 0 ? (
                        <Alert severity="info" variant="outlined">
                            {formatCurrency(totals.mixed_revenue)} is currently unclassified. It is excluded from both gross charge revenue and loan gross revenue until those mappings are separated.
                        </Alert>
                    ) : null}
                </Stack>
            ) : null}

            {!loading && !summary?.account_breakdown.length ? (
                <Alert severity="info" variant="outlined">
                    No posted fee, penalty, loan-interest, or loan-fee revenue is visible for the selected period and branch scope yet.
                </Alert>
            ) : null}

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, lg: 8 }}>
                    <ChartPanel
                        title="Revenue Trend"
                        subtitle="Posted gross charge and loan income over the selected period."
                        type="bar"
                        data={{
                            labels: trendLabels,
                            datasets: [
                                {
                                    label: "Fees",
                                    data: (summary?.trend || []).map((point) => point.fee_revenue),
                                    backgroundColor: alpha(theme.palette.success.main, 0.55),
                                    borderColor: theme.palette.success.main
                                },
                                {
                                    label: "Penalties",
                                    data: (summary?.trend || []).map((point) => point.penalty_revenue),
                                    backgroundColor: alpha(theme.palette.warning.main, 0.55),
                                    borderColor: theme.palette.warning.main
                                },
                                {
                                    label: "Loan Interest",
                                    data: (summary?.trend || []).map((point) => point.loan_interest_revenue),
                                    backgroundColor: alpha(theme.palette.info.main, 0.55),
                                    borderColor: theme.palette.info.main
                                },
                                {
                                    label: "Loan Fees",
                                    data: (summary?.trend || []).map((point) => point.loan_fee_revenue),
                                    backgroundColor: alpha(theme.palette.primary.main, 0.45),
                                    borderColor: theme.palette.primary.main
                                },
                                {
                                    label: "Unclassified",
                                    data: (summary?.trend || []).map((point) => point.mixed_revenue),
                                    backgroundColor: alpha(theme.palette.error.main, 0.45),
                                    borderColor: theme.palette.error.main
                                }
                            ]
                        }}
                        options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { position: "bottom" } }
                        }}
                    />
                </Grid>
                <Grid size={{ xs: 12, lg: 4 }}>
                    <MotionCard variant="outlined" sx={{ height: "100%" }}>
                        <CardContent>
                            <Stack spacing={1.5}>
                                <Typography variant="h6">Operational Readout</Typography>
                                <Alert severity="info" variant="outlined">
                                    Branch managers can now review posted gross operating and lending income without waiting for PDF packs or auditor-only reports.
                                </Alert>
                                <Alert severity="success" variant="outlined">
                                    The numbers on this page come from posted ledger lines, not configured product settings, so they reflect recognized gross income rather than expected charges.
                                </Alert>
                                {totals.loan_revenue > 0 ? (
                                    <Alert severity="info" variant="outlined">
                                        Loan gross revenue is currently {formatCurrency(totals.loan_revenue)}, made up of {formatCurrency(totals.loan_interest_revenue)} loan interest income and {formatCurrency(totals.loan_fee_revenue)} loan fee income.
                                    </Alert>
                                ) : null}
                                {totals.penalty_revenue > 0 ? (
                                    <Alert severity="warning" variant="outlined">
                                        Penalty income currently stands at {formatCurrency(totals.penalty_revenue)}. If loan products use penalty income accounts, that amount is included here.
                                    </Alert>
                                ) : null}
                                {totals.mixed_revenue > 0 ? (
                                    <Alert severity="warning" variant="outlined">
                                        {formatCurrency(totals.mixed_revenue)} is sitting in shared income accounts. Create separate income accounts for fee rules, penalty rules, and loan products to restore clean gross-revenue reporting.
                                    </Alert>
                                ) : null}
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>
            </Grid>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, lg: 7 }}>
                    <MotionCard variant="outlined">
                        <CardContent sx={{ display: "grid", gap: 2 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                                <Typography variant="h6">Gross Revenue Sources</Typography>
                                <Chip label={`${summary?.account_breakdown.length || 0} income account(s)`} size="small" color="primary" variant="outlined" />
                            </Stack>
                            {loading ? (
                                <AppLoader fullscreen={false} minHeight={260} message="Loading revenue sources..." />
                            ) : (
                                <DataTable
                                    rows={summary?.account_breakdown || []}
                                    columns={accountColumns}
                                    emptyMessage="No posted revenue is visible for this scope."
                                />
                            )}
                        </CardContent>
                    </MotionCard>
                </Grid>
                <Grid size={{ xs: 12, lg: 5 }}>
                    <MotionCard variant="outlined" sx={{ height: "100%" }}>
                        <CardContent sx={{ display: "grid", gap: 2 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                                <Typography variant="h6">Branch Breakdown</Typography>
                                <Chip label={`${summary?.branch_breakdown.length || 0} branch row(s)`} size="small" color="secondary" variant="outlined" />
                            </Stack>
                            {loading ? (
                                <AppLoader fullscreen={false} minHeight={240} message="Loading branch split..." />
                            ) : summary?.branch_breakdown.length ? (
                                <DataTable
                                    rows={summary.branch_breakdown}
                                    columns={branchColumns}
                                    emptyMessage="No branch revenue rows available."
                                />
                            ) : (
                                <Paper
                                    variant="outlined"
                                    sx={{
                                        p: 2,
                                        borderRadius: 2,
                                        bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.08 : 0.04)
                                    }}
                                >
                                    <Typography variant="body2" color="text.secondary">
                                        Revenue is currently scoped to {selectedBranchName || profile?.full_name || "the active branch selection"}, so there is no cross-branch comparison to show.
                                    </Typography>
                                </Paper>
                            )}
                        </CardContent>
                    </MotionCard>
                </Grid>
            </Grid>

            {summary?.configuration_warnings.length ? (
                <MotionCard variant="outlined">
                    <CardContent sx={{ display: "grid", gap: 1.5 }}>
                        <Typography variant="h6">Configuration Warnings</Typography>
                        <Alert severity="info" variant="outlined">
                            Each revenue source should post into its own income account. Shared accounts make branch profitability and product reporting unreliable.
                        </Alert>
                        {summary.configuration_warnings.map((warning) => (
                            <Paper
                                key={warning.account_id}
                                variant="outlined"
                                sx={{
                                    p: 1.5,
                                    borderRadius: 2,
                                    borderColor: alpha(theme.palette.warning.main, 0.4),
                                    bgcolor: alpha(theme.palette.warning.main, theme.palette.mode === "dark" ? 0.12 : 0.06)
                                }}
                            >
                                <Stack spacing={0.4}>
                                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                        {warning.account_name || "Income account"} {warning.account_code ? `(${warning.account_code})` : warning.account_id}
                                    </Typography>
                                    {warning.fee_rule_names.length ? (
                                        <Typography variant="body2" color="text.secondary">
                                            Fee rules: {warning.fee_rule_names.join(", ")}
                                        </Typography>
                                    ) : null}
                                    {warning.penalty_rule_names.length ? (
                                        <Typography variant="body2" color="text.secondary">
                                            Penalty rules: {warning.penalty_rule_names.join(", ")}
                                        </Typography>
                                    ) : null}
                                    {warning.loan_interest_product_names?.length ? (
                                        <Typography variant="body2" color="text.secondary">
                                            Loan interest products: {warning.loan_interest_product_names.join(", ")}
                                        </Typography>
                                    ) : null}
                                    {warning.loan_fee_product_names?.length ? (
                                        <Typography variant="body2" color="text.secondary">
                                            Loan fee products: {warning.loan_fee_product_names.join(", ")}
                                        </Typography>
                                    ) : null}
                                    {warning.loan_penalty_product_names?.length ? (
                                        <Typography variant="body2" color="text.secondary">
                                            Loan penalty products: {warning.loan_penalty_product_names.join(", ")}
                                        </Typography>
                                    ) : null}
                                </Stack>
                            </Paper>
                        ))}
                    </CardContent>
                </MotionCard>
            ) : null}
        </Stack>
    );
}
