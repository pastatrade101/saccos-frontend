import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { Alert, Box, Button, Chip, CircularProgress, Grid, IconButton, LinearProgress, Stack, TextField, Tooltip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useEffect, useMemo, useState } from "react";

import type { UpdateBranchLiquidityPolicyRequest } from "../../lib/endpoints";
import type { BranchFundPool, BranchLiquidityPolicy } from "../../types/api";
import { formatCurrency } from "../../utils/format";

interface BranchLiquidityPolicyManagerProps {
    branchId?: string | null;
    branchName?: string | null;
    policy: BranchLiquidityPolicy | null;
    fundPool: BranchFundPool | null;
    loading?: boolean;
    saving?: boolean;
    error?: string | null;
    onRefresh: () => void;
    onSave: (payload: UpdateBranchLiquidityPolicyRequest) => void;
    onPreviewChange?: (payload: UpdateBranchLiquidityPolicyRequest | null) => void;
}

interface BranchLiquidityFormState {
    max_lending_ratio: string;
    minimum_liquidity_reserve: string;
    auto_loan_freeze_threshold: string;
}

function MetricCard({
    label,
    value,
    emphasize = false,
    description
}: {
    label: string;
    value: string;
    emphasize?: boolean;
    description?: string;
}) {
    return (
        <Box
            sx={(theme) => ({
                p: 1.5,
                height: "100%",
                borderRadius: 2.5,
                border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                backgroundColor: emphasize ? alpha(theme.palette.warning.main, theme.palette.mode === "dark" ? 0.18 : 0.08) : alpha(theme.palette.success.main, theme.palette.mode === "dark" ? 0.14 : 0.05)
            })}
        >
            <Typography variant="caption" color="text.secondary">
                {label}
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 700, mt: 0.35 }}>
                {value}
            </Typography>
            {description ? (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.65 }}>
                    {description}
                </Typography>
            ) : null}
        </Box>
    );
}

function toInputValue(value: number | null | undefined) {
    if (typeof value !== "number" || Number.isNaN(value)) {
        return "";
    }

    return String(value);
}

function labelWithHelp(label: string, helpText?: string) {
    if (!helpText) {
        return label;
    }

    return (
        <Stack direction="row" spacing={0.75} alignItems="center">
            <span>{label}</span>
            <Tooltip title={helpText} placement="top" arrow>
                <InfoOutlinedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
            </Tooltip>
        </Stack>
    );
}

function buildPreview(
    form: BranchLiquidityFormState,
    policy: BranchLiquidityPolicy | null
): UpdateBranchLiquidityPolicyRequest | null {
    if (!policy) {
        return null;
    }

    const maxLendingRatio = Number(form.max_lending_ratio);
    const minimumLiquidityReserve = Number(form.minimum_liquidity_reserve);
    const autoLoanFreezeThreshold = Number(form.auto_loan_freeze_threshold);

    return {
        max_lending_ratio: Number.isFinite(maxLendingRatio) ? maxLendingRatio : policy.max_lending_ratio,
        minimum_liquidity_reserve: Number.isFinite(minimumLiquidityReserve) ? minimumLiquidityReserve : policy.minimum_liquidity_reserve,
        auto_loan_freeze_threshold: Number.isFinite(autoLoanFreezeThreshold) ? autoLoanFreezeThreshold : policy.auto_loan_freeze_threshold
    };
}

export function BranchLiquidityPolicyManager({
    branchId,
    branchName,
    policy,
    fundPool,
    loading = false,
    saving = false,
    error = null,
    onRefresh,
    onSave,
    onPreviewChange
}: BranchLiquidityPolicyManagerProps) {
    const [form, setForm] = useState<BranchLiquidityFormState>({
        max_lending_ratio: "",
        minimum_liquidity_reserve: "",
        auto_loan_freeze_threshold: ""
    });
    const [validationError, setValidationError] = useState<string | null>(null);

    useEffect(() => {
        if (!policy) {
            setForm({
                max_lending_ratio: "",
                minimum_liquidity_reserve: "",
                auto_loan_freeze_threshold: ""
            });
            onPreviewChange?.(null);
            return;
        }

        setForm({
            max_lending_ratio: toInputValue(policy.max_lending_ratio),
            minimum_liquidity_reserve: toInputValue(policy.minimum_liquidity_reserve),
            auto_loan_freeze_threshold: toInputValue(policy.auto_loan_freeze_threshold)
        });
        setValidationError(null);
        onPreviewChange?.({
            max_lending_ratio: policy.max_lending_ratio,
            minimum_liquidity_reserve: policy.minimum_liquidity_reserve,
            auto_loan_freeze_threshold: policy.auto_loan_freeze_threshold
        });
    }, [onPreviewChange, policy]);

    const previewPolicy = useMemo(() => {
        return buildPreview(form, policy);
    }, [form, policy]);

    const poolIsFrozen = useMemo(() => {
        if (!fundPool || !previewPolicy) {
            return false;
        }

        return fundPool.available_for_loans <= (previewPolicy.auto_loan_freeze_threshold || 0);
    }, [fundPool, previewPolicy]);
    const totalDeposits = fundPool?.total_deposits || 0;
    const availableForLoans = fundPool?.available_for_loans || 0;
    const activeLoansTotal = fundPool?.active_loans_total || 0;
    const lowLiquidityWarning = totalDeposits > 0 && availableForLoans < (totalDeposits * 0.2);

    const liquidityHealth = useMemo(() => {
        const ratio = totalDeposits > 0 ? availableForLoans / totalDeposits : 0;

        if (ratio > 0.4) {
            return { label: "Healthy", color: "success" as const, percent: Math.round(ratio * 100) };
        }

        if (ratio >= 0.2) {
            return { label: "Warning", color: "warning" as const, percent: Math.round(ratio * 100) };
        }

        return { label: "Risk", color: "error" as const, percent: Math.round(ratio * 100) };
    }, [availableForLoans, totalDeposits]);

    const loanUtilizationPercent = useMemo(() => {
        return totalDeposits > 0 ? Math.min(100, Math.round((activeLoansTotal / totalDeposits) * 100)) : 0;
    }, [activeLoansTotal, totalDeposits]);
    const loanStatus = useMemo(() => {
        if (poolIsFrozen) {
            return {
                label: "FROZEN",
                color: "error" as const,
                message: "New loan applications are temporarily disabled due to low liquidity."
            };
        }

        if (lowLiquidityWarning) {
            return {
                label: "WARNING",
                color: "warning" as const,
                message: "Liquidity is approaching the SACCO safety limit. New loans should be reviewed carefully."
            };
        }

        return {
            label: "ACTIVE",
            color: "success" as const,
            message: "New loan applications can continue under the current liquidity position."
        };
    }, [lowLiquidityWarning, poolIsFrozen]);

    const updateField = (field: keyof BranchLiquidityFormState, value: string) => {
        setForm((current) => {
            const next = { ...current, [field]: value };
            onPreviewChange?.(buildPreview(next, policy));
            return next;
        });
        if (validationError) {
            setValidationError(null);
        }
    };

    const handleSave = () => {
        const maxLendingRatio = Number(form.max_lending_ratio);
        const minimumLiquidityReserve = Number(form.minimum_liquidity_reserve);
        const autoLoanFreezeThreshold = Number(form.auto_loan_freeze_threshold);

        if (!Number.isFinite(maxLendingRatio) || maxLendingRatio < 0 || maxLendingRatio > 100) {
            setValidationError("Maximum lending ratio must be between 0 and 100.");
            return;
        }

        if (!Number.isFinite(minimumLiquidityReserve) || minimumLiquidityReserve < 0) {
            setValidationError("Minimum liquidity reserve must be zero or a positive amount.");
            return;
        }

        if (!Number.isFinite(autoLoanFreezeThreshold) || autoLoanFreezeThreshold < 0) {
            setValidationError("Auto loan freeze threshold must be zero or a positive amount.");
            return;
        }

        setValidationError(null);
        onSave({
            max_lending_ratio: maxLendingRatio,
            minimum_liquidity_reserve: minimumLiquidityReserve,
            auto_loan_freeze_threshold: autoLoanFreezeThreshold
        });
    };

    const lastUpdatedLabel = fundPool?.last_updated
        ? new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
            timeStyle: "short"
        }).format(new Date(fundPool.last_updated))
        : "Waiting for first refresh";

    return (
        <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
                SACCO-wide liquidity controls determine how much of the deposit base can safely be converted into loans.
            </Typography>

            <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }}>
                <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Liquidity position
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {branchName ? `${branchName} · SACCO-wide policy surface` : "SACCO-wide policy surface"}
                    </Typography>
                </Box>
                <Button variant="contained" onClick={handleSave} disabled={!branchId || loading || saving}>
                    {saving ? "Saving..." : "Save guardrails"}
                </Button>
            </Stack>

            {loading ? (
                <Stack direction="row" spacing={1.25} alignItems="center">
                    <CircularProgress size={18} />
                    <Typography variant="body2" color="text.secondary">
                        Loading branch liquidity policy...
                    </Typography>
                </Stack>
            ) : null}

            {!loading && !branchId ? (
                <Alert severity="info" variant="outlined">
                    Select an active branch context before configuring liquidity controls.
                </Alert>
            ) : null}

            {!loading && policy?.source === "default" ? (
                <Alert severity="info" variant="outlined">
                    This SACCO is still using default liquidity guardrails. Saving this form will create explicit governance settings.
                </Alert>
            ) : null}

            {!loading && lowLiquidityWarning ? (
                <Alert severity="warning" variant="outlined">
                    Liquidity Warning: Loan pool is approaching minimum safe liquidity levels.
                </Alert>
            ) : null}

            {!loading && poolIsFrozen ? (
                <Alert severity="warning" variant="outlined">
                    New loan applications are currently frozen because available liquidity is at or below the configured freeze threshold.
                </Alert>
            ) : null}

            {!loading && error ? (
                <Alert severity="warning" variant="outlined">
                    {error}
                </Alert>
            ) : null}

            {!loading && validationError ? (
                <Alert severity="error" variant="outlined">
                    {validationError}
                </Alert>
            ) : null}

            <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, md: 3 }}>
                    <MetricCard label="Total Deposits" value={formatCurrency(fundPool?.total_deposits ?? 0)} />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                    <MetricCard label="Reserved Liquidity" value={formatCurrency(fundPool?.reserved_liquidity ?? 0)} />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                    <MetricCard label="Active Loans Total" value={formatCurrency(fundPool?.active_loans_total ?? 0)} />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                    <MetricCard
                        label="Remaining Lending Capacity"
                        value={formatCurrency(fundPool?.available_for_loans ?? 0)}
                        emphasize={poolIsFrozen}
                        description="Amount of funds currently available for issuing new loans."
                    />
                </Grid>
            </Grid>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Box
                        sx={(theme) => ({
                            p: 2,
                            borderRadius: 3,
                            border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                            backgroundColor: alpha(theme.palette.background.default, 0.6)
                        })}
                    >
                        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                Liquidity Health
                            </Typography>
                            <Chip
                                size="small"
                                color={liquidityHealth.color}
                                label={liquidityHealth.label}
                                variant={liquidityHealth.color === "warning" ? "filled" : "outlined"}
                            />
                        </Stack>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Liquidity Utilization
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                            {loanUtilizationPercent}% of SACCO liquidity currently used for lending.
                        </Typography>
                    </Box>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Box
                        sx={(theme) => ({
                            p: 2,
                            borderRadius: 3,
                            border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                            backgroundColor: alpha(theme.palette.background.default, 0.6)
                        })}
                    >
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            Loan Utilization
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.6 }}>
                            {formatCurrency(fundPool?.active_loans_total ?? 0)} / {formatCurrency(fundPool?.total_deposits ?? 0)} = {loanUtilizationPercent}%
                        </Typography>
                        <LinearProgress
                            variant="determinate"
                            value={loanUtilizationPercent}
                            color={loanUtilizationPercent >= 80 ? "warning" : "primary"}
                            sx={{ mt: 1.2, height: 10, borderRadius: 999 }}
                        />
                    </Box>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Box
                        sx={(theme) => ({
                            p: 2,
                            borderRadius: 3,
                            border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                            backgroundColor: alpha(
                                loanStatus.color === "error"
                                    ? theme.palette.error.main
                                    : loanStatus.color === "warning"
                                        ? theme.palette.warning.main
                                        : theme.palette.success.main,
                                theme.palette.mode === "dark" ? 0.18 : 0.08
                            )
                        })}
                    >
                        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                Loan Status
                            </Typography>
                            <Chip size="small" color={loanStatus.color} label={loanStatus.label} />
                        </Stack>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.6 }}>
                            {loanStatus.message}
                        </Typography>
                    </Box>
                </Grid>
            </Grid>

            <Stack direction="row" spacing={0.75} alignItems="center">
                <Typography variant="caption" color="text.secondary">
                    Last updated: {lastUpdatedLabel}
                </Typography>
                <Tooltip title="Refresh liquidity data" placement="top" arrow>
                    <span>
                        <IconButton
                            size="small"
                            onClick={onRefresh}
                            disabled={!branchId || loading || saving}
                            aria-label="Refresh liquidity data"
                        >
                            <RefreshRoundedIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                    </span>
                </Tooltip>
            </Stack>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                        fullWidth
                        type="number"
                        label={labelWithHelp("Max lending ratio %", "Maximum percentage of deposits that can be converted into loans.")}
                        value={form.max_lending_ratio}
                        onChange={(event) => updateField("max_lending_ratio", event.target.value)}
                        InputProps={{ inputProps: { min: 0, max: 100, step: 0.01 } }}
                        helperText="Total active lending cannot exceed this share of deposits."
                        disabled={!branchId || loading}
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                        fullWidth
                        type="number"
                        label={labelWithHelp("Minimum liquidity reserve", "Cash that remains protected from lending even when borrowing demand is high.")}
                        value={form.minimum_liquidity_reserve}
                        onChange={(event) => updateField("minimum_liquidity_reserve", event.target.value)}
                        InputProps={{ inputProps: { min: 0, step: 0.01 } }}
                        helperText="Cash that must remain protected from lending."
                        disabled={!branchId || loading}
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                        fullWidth
                        type="number"
                        label={labelWithHelp("Auto loan freeze threshold", "When available loan pool falls below this value the system blocks new loan applications.")}
                        value={form.auto_loan_freeze_threshold}
                        onChange={(event) => updateField("auto_loan_freeze_threshold", event.target.value)}
                        InputProps={{ inputProps: { min: 0, step: 0.01 } }}
                        helperText="Freeze new applications when available liquidity drops below this amount."
                        disabled={!branchId || loading}
                    />
                </Grid>
            </Grid>
        </Stack>
    );
}
