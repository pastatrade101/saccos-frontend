import {
    Alert,
    Box,
    Card,
    CardContent,
    CircularProgress,
    Grid,
    Paper,
    Stack,
    Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import type { LoanCapacitySummary } from "../../types/api";
import { formatCurrency } from "../../utils/format";

interface LoanEligibilitySummaryProps {
    summary?: LoanCapacitySummary | null;
    loading?: boolean;
    error?: string | null;
    title?: string;
    helperText?: string;
    compact?: boolean;
}

function MetricCard({
    label,
    value,
    emphasize = false,
    compact = false
}: {
    label: string;
    value: string;
    emphasize?: boolean;
    compact?: boolean;
}) {
    return (
        <Box
            sx={(theme) => ({
                p: compact ? 1.15 : 1.5,
                borderRadius: 1,
                border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                backgroundColor: emphasize ? alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.18 : 0.08) : "background.paper"
            })}
        >
            <Typography variant="caption" color="text.secondary">
                {label}
            </Typography>
            <Typography variant={compact ? "body2" : "body1"} sx={{ fontWeight: emphasize ? 800 : 700, mt: 0.35 }}>
                {value}
            </Typography>
        </Box>
    );
}

export function LoanEligibilitySummary({
    summary,
    loading = false,
    error = null,
    title = "Loan Eligibility",
    helperText = "These indicators are calculated from your contributions, the selected product rules, and current SACCO branch liquidity.",
    compact = false
}: LoanEligibilitySummaryProps) {
    const theme = useTheme();

    return (
        <Card
            variant="outlined"
            sx={{
                borderRadius: 1.1,
                borderColor: alpha(theme.palette.primary.main, 0.18)
            }}
        >
            <CardContent sx={{ display: "grid", gap: compact ? 1.15 : 1.5 }}>
                <Box>
                    <Typography variant={compact ? "subtitle1" : "h6"} sx={{ fontWeight: 800 }}>
                        {title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {helperText}
                    </Typography>
                </Box>

                {loading ? (
                    <Stack direction="row" spacing={1.25} alignItems="center">
                        <CircularProgress size={18} />
                        <Typography variant="body2" color="text.secondary">
                            Calculating current borrowing capacity...
                        </Typography>
                    </Stack>
                ) : null}

                {!loading && error ? (
                    <Alert severity="warning" variant="outlined">
                        {error}
                    </Alert>
                ) : null}

                {!loading && !error && summary ? (
                    <>
                        {summary.loan_pool_frozen ? (
                            <Alert severity="warning" variant="outlined">
                                SACCO loan pool temporarily exhausted. Please try again later.
                            </Alert>
                        ) : null}
                        <Grid container spacing={1.5}>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <MetricCard label="Member Contributions" value={formatCurrency(summary.total_contributions)} compact={compact} />
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <MetricCard label="Contribution Borrow Limit" value={formatCurrency(summary.contribution_limit)} compact={compact} />
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <MetricCard label="Loan Product Limit" value={formatCurrency(summary.product_limit)} compact={compact} />
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <MetricCard label="SACCO Liquidity Limit" value={formatCurrency(summary.liquidity_limit)} compact={compact} />
                            </Grid>
                            <Grid size={{ xs: 12 }}>
                                <Box
                                    sx={{
                                        p: compact ? { xs: 1.5, md: 1.75 } : { xs: 2, md: 2.3 },
                                        borderRadius: 1.1,
                                        border: `1px solid ${alpha(theme.palette.success.main, theme.palette.mode === "dark" ? 0.34 : 0.22)}`,
                                        background: theme.palette.mode === "dark"
                                            ? `linear-gradient(180deg, ${alpha(theme.palette.success.main, 0.18)} 0%, ${alpha(theme.palette.success.main, 0.1)} 100%)`
                                            : `linear-gradient(180deg, ${alpha(theme.palette.success.main, 0.12)} 0%, ${alpha(theme.palette.success.light, 0.18)} 100%)`,
                                        textAlign: "center"
                                    }}
                                >
                                    <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: "0.14em" }}>
                                        Maximum You Can Borrow
                                    </Typography>
                                    <Typography
                                        variant={compact ? "h5" : "h4"}
                                        sx={{
                                            mt: compact ? 0.55 : 0.9,
                                            fontWeight: 900,
                                            letterSpacing: "-0.03em",
                                            color: theme.palette.mode === "dark" ? "#F0FFF4" : theme.palette.success.dark
                                        }}
                                    >
                                        {formatCurrency(summary.borrow_limit)}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                        Based on your contributions, product rules, and current SACCO liquidity.
                                    </Typography>
                                </Box>
                            </Grid>
                        </Grid>
                        <Paper
                            variant="outlined"
                            sx={{
                                p: compact ? 1.3 : 1.7,
                                borderRadius: 1,
                                bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.08 : 0.03)
                            }}
                        >
                            <Typography variant="caption" color="text.secondary">
                                SACCO Loan Pool Available
                            </Typography>
                            <Typography variant="h6" sx={{ mt: 0.4, fontWeight: 800 }}>
                                {formatCurrency(summary.available_for_loans)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.6 }}>
                                Current funds available for issuing new loans.
                            </Typography>
                        </Paper>
                        <Stack direction="row" spacing={1} alignItems="flex-start">
                            <Box
                                sx={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: "50%",
                                    display: "grid",
                                    placeItems: "center",
                                    fontSize: 12,
                                    fontWeight: 800,
                                    bgcolor: alpha(theme.palette.info.main, theme.palette.mode === "dark" ? 0.18 : 0.1),
                                    color: theme.palette.info.main,
                                    mt: 0.15
                                }}
                            >
                                i
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                                Applying within your borrowing capacity improves approval chances.
                            </Typography>
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                            Minimum loan size for this product: {formatCurrency(summary.minimum_loan_amount)}.
                        </Typography>
                    </>
                ) : null}
            </CardContent>
        </Card>
    );
}
