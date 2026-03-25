import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Alert, Box, Button, CircularProgress, Grid, MenuItem, Stack, TextField, Tooltip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useEffect, useState } from "react";

import type { UpdateLoanProductPolicyRequest } from "../../lib/endpoints";
import type { LoanProduct, LoanProductPolicy } from "../../types/api";
import { formatCurrency } from "../../utils/format";

interface LoanProductPolicyManagerProps {
    loanProducts: LoanProduct[];
    selectedLoanProductId: string;
    onSelectLoanProductId: (loanProductId: string) => void;
    policy: LoanProductPolicy | null;
    loading?: boolean;
    saving?: boolean;
    error?: string | null;
    onRefresh: () => void;
    onSave: (payload: UpdateLoanProductPolicyRequest) => void;
    onPreviewChange?: (payload: UpdateLoanProductPolicyRequest | null) => void;
}

interface LoanProductPolicyFormState {
    contribution_multiplier: string;
    max_loan_amount: string;
    min_loan_amount: string;
    liquidity_buffer_percent: string;
    requires_guarantor: string;
    requires_collateral: string;
}

function MetricCard({
    label,
    value
}: {
    label: string;
    value: string;
}) {
    return (
        <Box
            sx={(theme) => ({
                p: 1.5,
                borderRadius: 2.5,
                border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.14 : 0.05)
            })}
        >
            <Typography variant="caption" color="text.secondary">
                {label}
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 700, mt: 0.35 }}>
                {value}
            </Typography>
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
    form: LoanProductPolicyFormState,
    policy: LoanProductPolicy | null
): UpdateLoanProductPolicyRequest | null {
    if (!policy) {
        return null;
    }

    const contributionMultiplier = Number(form.contribution_multiplier);
    const maxLoanAmount = Number(form.max_loan_amount);
    const minLoanAmount = Number(form.min_loan_amount);
    const liquidityBufferPercent = Number(form.liquidity_buffer_percent);

    return {
        contribution_multiplier: Number.isFinite(contributionMultiplier) ? contributionMultiplier : policy.contribution_multiplier,
        max_loan_amount: Number.isFinite(maxLoanAmount) ? maxLoanAmount : policy.max_loan_amount,
        min_loan_amount: Number.isFinite(minLoanAmount) ? minLoanAmount : policy.min_loan_amount,
        liquidity_buffer_percent: Number.isFinite(liquidityBufferPercent) ? liquidityBufferPercent : policy.liquidity_buffer_percent,
        requires_guarantor: form.requires_guarantor === "true",
        requires_collateral: form.requires_collateral === "true"
    };
}

export function LoanProductPolicyManager({
    loanProducts,
    selectedLoanProductId,
    onSelectLoanProductId,
    policy,
    loading = false,
    saving = false,
    error = null,
    onRefresh,
    onSave,
    onPreviewChange
}: LoanProductPolicyManagerProps) {
    const [form, setForm] = useState<LoanProductPolicyFormState>({
        contribution_multiplier: "",
        max_loan_amount: "",
        min_loan_amount: "",
        liquidity_buffer_percent: "",
        requires_guarantor: "false",
        requires_collateral: "false"
    });
    const [validationError, setValidationError] = useState<string | null>(null);

    useEffect(() => {
        if (!policy) {
            setForm({
                contribution_multiplier: "",
                max_loan_amount: "",
                min_loan_amount: "",
                liquidity_buffer_percent: "",
                requires_guarantor: "false",
                requires_collateral: "false"
            });
            onPreviewChange?.(null);
            return;
        }

        setForm({
            contribution_multiplier: toInputValue(policy.contribution_multiplier),
            max_loan_amount: toInputValue(policy.max_loan_amount),
            min_loan_amount: toInputValue(policy.min_loan_amount),
            liquidity_buffer_percent: toInputValue(policy.liquidity_buffer_percent),
            requires_guarantor: String(Boolean(policy.requires_guarantor)),
            requires_collateral: String(Boolean(policy.requires_collateral))
        });
        setValidationError(null);
        onPreviewChange?.({
            contribution_multiplier: policy.contribution_multiplier,
            max_loan_amount: policy.max_loan_amount,
            min_loan_amount: policy.min_loan_amount,
            liquidity_buffer_percent: policy.liquidity_buffer_percent,
            requires_guarantor: Boolean(policy.requires_guarantor),
            requires_collateral: Boolean(policy.requires_collateral)
        });
    }, [onPreviewChange, policy]);

    const selectedProduct = loanProducts.find((loanProduct) => loanProduct.id === selectedLoanProductId) || null;

    const updateField = (field: keyof LoanProductPolicyFormState, value: string) => {
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
        const contributionMultiplier = Number(form.contribution_multiplier);
        const maxLoanAmount = Number(form.max_loan_amount);
        const minLoanAmount = Number(form.min_loan_amount);
        const liquidityBufferPercent = Number(form.liquidity_buffer_percent);

        if (!Number.isFinite(contributionMultiplier) || contributionMultiplier < 0) {
            setValidationError("Contribution multiplier must be zero or a positive number.");
            return;
        }

        if (!Number.isFinite(minLoanAmount) || minLoanAmount < 0) {
            setValidationError("Minimum loan amount must be zero or a positive number.");
            return;
        }

        if (!Number.isFinite(maxLoanAmount) || maxLoanAmount < minLoanAmount) {
            setValidationError("Maximum loan amount must be greater than or equal to the minimum loan amount.");
            return;
        }

        if (!Number.isFinite(liquidityBufferPercent) || liquidityBufferPercent < 0 || liquidityBufferPercent > 100) {
            setValidationError("Liquidity buffer percent must be between 0 and 100.");
            return;
        }

        setValidationError(null);
        onSave({
            contribution_multiplier: contributionMultiplier,
            max_loan_amount: maxLoanAmount,
            min_loan_amount: minLoanAmount,
            liquidity_buffer_percent: liquidityBufferPercent,
            requires_guarantor: form.requires_guarantor === "true",
            requires_collateral: form.requires_collateral === "true"
        });
    };

    return (
        <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
                These SACCO-wide controls drive the real borrowing cap shown in the member portal and the staff loan creation flow.
            </Typography>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                        select
                        fullWidth
                        label="Loan product"
                        value={selectedLoanProductId}
                        onChange={(event) => onSelectLoanProductId(event.target.value)}
                        disabled={!loanProducts.length}
                    >
                        {loanProducts.length ? null : (
                            <MenuItem value="">No loan products configured</MenuItem>
                        )}
                        {loanProducts.map((loanProduct) => (
                            <MenuItem key={loanProduct.id} value={loanProduct.id}>
                                {loanProduct.name} ({loanProduct.code})
                            </MenuItem>
                        ))}
                    </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Stack direction="row" spacing={1.25} justifyContent={{ xs: "flex-start", md: "flex-end" }}>
                        <Button variant="outlined" onClick={onRefresh} disabled={!selectedLoanProductId || loading || saving}>
                            Refresh policy
                        </Button>
                        <Button variant="contained" onClick={handleSave} disabled={!selectedLoanProductId || loading || saving}>
                            {saving ? "Saving..." : "Save policy"}
                        </Button>
                    </Stack>
                </Grid>
            </Grid>

            {loading ? (
                <Stack direction="row" spacing={1.25} alignItems="center">
                    <CircularProgress size={18} />
                    <Typography variant="body2" color="text.secondary">
                        Loading borrowing policy...
                    </Typography>
                </Stack>
            ) : null}

            {!loading && !loanProducts.length ? (
                <Alert severity="info" variant="outlined">
                    Add at least one loan product first, then configure its borrowing policy here.
                </Alert>
            ) : null}

            {!loading && selectedProduct && policy?.source === "derived_from_loan_product" ? (
                <Alert severity="info" variant="outlined">
                    This product is currently using derived defaults from the loan product catalog. Saving this form will create an explicit borrowing policy.
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

            {selectedProduct ? (
                <Grid container spacing={1.5}>
                    <Grid size={{ xs: 12, md: 4 }}>
                        <MetricCard label="Catalog Range" value={`${formatCurrency(selectedProduct.min_amount)} to ${selectedProduct.max_amount ? formatCurrency(selectedProduct.max_amount) : "Open cap"}`} />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                        <MetricCard label="Catalog Multiplier" value={`${selectedProduct.maximum_loan_multiple}x contributions`} />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                        <MetricCard label="Required Guarantors" value={String(selectedProduct.required_guarantors_count || 0)} />
                    </Grid>
                </Grid>
            ) : null}

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 3 }}>
                    <TextField
                        fullWidth
                        type="number"
                        value={form.contribution_multiplier}
                        onChange={(event) => updateField("contribution_multiplier", event.target.value)}
                        InputProps={{ inputProps: { min: 0, step: 0.01 } }}
                        helperText="Contribution-based multiple used in the borrow limit."
                        label={labelWithHelp("Loan multiplier", "Defines how many times a member can borrow relative to their contributions. Example: savings of 2,000,000 with a multiplier of 3 gives a borrow limit of 6,000,000 before other caps apply.")}
                        disabled={!selectedLoanProductId || loading}
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                    <TextField
                        fullWidth
                        type="number"
                        label={labelWithHelp("Minimum loan amount", "Applications below this amount are blocked even if the member still has available borrowing room.")}
                        value={form.min_loan_amount}
                        onChange={(event) => updateField("min_loan_amount", event.target.value)}
                        InputProps={{ inputProps: { min: 0, step: 0.01 } }}
                        helperText="Applications below this amount are blocked."
                        disabled={!selectedLoanProductId || loading}
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                    <TextField
                        fullWidth
                        type="number"
                        label={labelWithHelp("Maximum loan amount", "Absolute product cap before liquidity and member contribution limits are applied.")}
                        value={form.max_loan_amount}
                        onChange={(event) => updateField("max_loan_amount", event.target.value)}
                        InputProps={{ inputProps: { min: 0, step: 0.01 } }}
                        helperText="This cap is combined with member contributions and liquidity."
                        disabled={!selectedLoanProductId || loading}
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                    <TextField
                        fullWidth
                        type="number"
                        label={labelWithHelp("Liquidity buffer %", "Percentage of SACCO liquidity reserved and protected from lending.")}
                        value={form.liquidity_buffer_percent}
                        onChange={(event) => updateField("liquidity_buffer_percent", event.target.value)}
                        InputProps={{ inputProps: { min: 0, max: 100, step: 0.01 } }}
                        helperText="Keep part of SACCO liquidity protected from lending."
                        disabled={!selectedLoanProductId || loading}
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                        select
                        fullWidth
                        label={labelWithHelp("Requires guarantor", "When enabled, new applications must include the required number of guarantors before submission.")}
                        value={form.requires_guarantor}
                        onChange={(event) => updateField("requires_guarantor", event.target.value)}
                        disabled={!selectedLoanProductId || loading}
                    >
                        <MenuItem value="true">Yes</MenuItem>
                        <MenuItem value="false">No</MenuItem>
                    </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                        select
                        fullWidth
                        label={labelWithHelp("Requires collateral", "When enabled, loan officers must capture collateral before the application can move forward.")}
                        value={form.requires_collateral}
                        onChange={(event) => updateField("requires_collateral", event.target.value)}
                        disabled={!selectedLoanProductId || loading}
                    >
                        <MenuItem value="true">Yes</MenuItem>
                        <MenuItem value="false">No</MenuItem>
                    </TextField>
                </Grid>
            </Grid>
        </Stack>
    );
}
