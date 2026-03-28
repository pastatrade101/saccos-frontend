import PolicyRoundedIcon from "@mui/icons-material/PolicyRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Divider,
    Stack,
    TextField,
    Typography
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/Toast";
import { TwoFactorStepUpDialog, type TwoFactorStepUpPayload } from "../components/TwoFactorStepUpDialog";
import { api, getApiErrorCode, getApiErrorMessage } from "../lib/api";
import { endpoints } from "../lib/endpoints";
import type { ApiEnvelope, TreasuryPolicy } from "../types/api";
import { formatCurrency, formatDate } from "../utils/format";

type DraftState = {
    liquidity_reserve_ratio: string;
    minimum_cash_buffer: string;
    loan_liquidity_protection_ratio: string;
    max_asset_allocation_percent: string;
    max_single_asset_percent: string;
    max_single_order_amount: string;
    approval_threshold: string;
    valuation_update_frequency_days: string;
    change_reason: string;
};

function asNumber(value: string) {
    if (!value.trim()) {
        return null;
    }

    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function buildDraft(policy: TreasuryPolicy): DraftState {
    return {
        liquidity_reserve_ratio: String(policy.liquidity_reserve_ratio ?? 30),
        minimum_cash_buffer: String(policy.minimum_cash_buffer ?? 0),
        loan_liquidity_protection_ratio: String(policy.loan_liquidity_protection_ratio ?? 0),
        max_asset_allocation_percent: policy.max_asset_allocation_percent != null ? String(policy.max_asset_allocation_percent) : "",
        max_single_asset_percent: policy.max_single_asset_percent != null ? String(policy.max_single_asset_percent) : "",
        max_single_order_amount: policy.max_single_order_amount != null ? String(policy.max_single_order_amount) : "",
        approval_threshold: policy.approval_threshold != null ? String(policy.approval_threshold) : "",
        valuation_update_frequency_days: String(policy.valuation_update_frequency_days ?? 30),
        change_reason: ""
    };
}

export function TreasuryPolicySettingsPage() {
    const navigate = useNavigate();
    const { profile, twoFactorSetupRequired } = useAuth();
    const { pushToast } = useToast();
    const tenantId = profile?.tenant_id || "";
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [policy, setPolicy] = useState<TreasuryPolicy | null>(null);
    const [draft, setDraft] = useState<DraftState>({
        liquidity_reserve_ratio: "",
        minimum_cash_buffer: "",
        loan_liquidity_protection_ratio: "",
        max_asset_allocation_percent: "",
        max_single_asset_percent: "",
        max_single_order_amount: "",
        approval_threshold: "",
        valuation_update_frequency_days: "",
        change_reason: ""
    });
    const [stepUpOpen, setStepUpOpen] = useState(false);
    const trimmedChangeReason = draft.change_reason.trim();
    const changeReasonTooShort = trimmedChangeReason.length > 0 && trimmedChangeReason.length < 8;

    const loadPolicy = async () => {
        if (!tenantId) {
            return;
        }

        setLoading(true);
        try {
            const { data } = await api.get<ApiEnvelope<TreasuryPolicy>>(endpoints.treasury.policy(), {
                params: { tenant_id: tenantId }
            });
            setPolicy(data.data);
            setDraft(buildDraft(data.data));
        } catch (error) {
            pushToast({
                type: "error",
                title: "Treasury policy",
                message: getApiErrorMessage(error, "Unable to load treasury policy.")
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadPolicy();
    }, [tenantId]);

    const previewRows = useMemo(() => {
        if (!policy) {
            return [];
        }

        const nextValues = {
            liquidity_reserve_ratio: asNumber(draft.liquidity_reserve_ratio),
            minimum_cash_buffer: asNumber(draft.minimum_cash_buffer),
            loan_liquidity_protection_ratio: asNumber(draft.loan_liquidity_protection_ratio),
            max_asset_allocation_percent: asNumber(draft.max_asset_allocation_percent),
            max_single_asset_percent: asNumber(draft.max_single_asset_percent),
            max_single_order_amount: asNumber(draft.max_single_order_amount),
            approval_threshold: asNumber(draft.approval_threshold),
            valuation_update_frequency_days: asNumber(draft.valuation_update_frequency_days)
        };

        return [
            {
                label: "Liquidity Reserve Ratio",
                current: `${policy.liquidity_reserve_ratio}%`,
                next: nextValues.liquidity_reserve_ratio != null ? `${nextValues.liquidity_reserve_ratio}%` : "-"
            },
            {
                label: "Minimum Cash Buffer",
                current: formatCurrency(policy.minimum_cash_buffer || 0),
                next: nextValues.minimum_cash_buffer != null ? formatCurrency(nextValues.minimum_cash_buffer) : "-"
            },
            {
                label: "Loan Liquidity Protection Ratio",
                current: `${policy.loan_liquidity_protection_ratio || 0}%`,
                next: nextValues.loan_liquidity_protection_ratio != null ? `${nextValues.loan_liquidity_protection_ratio}%` : "-"
            },
            {
                label: "Max Asset Allocation",
                current: policy.max_asset_allocation_percent != null ? `${policy.max_asset_allocation_percent}%` : "Not configured",
                next: nextValues.max_asset_allocation_percent != null ? `${nextValues.max_asset_allocation_percent}%` : "Not configured"
            },
            {
                label: "Max Single Asset",
                current: policy.max_single_asset_percent != null ? `${policy.max_single_asset_percent}%` : "Not configured",
                next: nextValues.max_single_asset_percent != null ? `${nextValues.max_single_asset_percent}%` : "Not configured"
            },
            {
                label: "Max Single Order",
                current: policy.max_single_order_amount != null ? formatCurrency(policy.max_single_order_amount) : "Not capped",
                next: nextValues.max_single_order_amount != null ? formatCurrency(nextValues.max_single_order_amount) : "Not capped"
            },
            {
                label: "Approval Threshold",
                current: policy.approval_threshold != null ? formatCurrency(policy.approval_threshold) : "No automatic threshold",
                next: nextValues.approval_threshold != null ? formatCurrency(nextValues.approval_threshold) : "No automatic threshold"
            },
            {
                label: "Valuation Update Frequency",
                current: `${policy.valuation_update_frequency_days} day(s)`,
                next: nextValues.valuation_update_frequency_days != null ? `${nextValues.valuation_update_frequency_days} day(s)` : "-"
            }
        ].filter((row) => row.current !== row.next);
    }, [draft, policy]);

    const handleSave = async (stepUpPayload: TwoFactorStepUpPayload) => {
        setBusy(true);
        try {
            await api.patch(endpoints.treasury.policy(), {
                tenant_id: tenantId,
                liquidity_reserve_ratio: asNumber(draft.liquidity_reserve_ratio),
                minimum_cash_buffer: asNumber(draft.minimum_cash_buffer),
                loan_liquidity_protection_ratio: asNumber(draft.loan_liquidity_protection_ratio),
                max_asset_allocation_percent: draft.max_asset_allocation_percent.trim() ? asNumber(draft.max_asset_allocation_percent) : null,
                max_single_asset_percent: draft.max_single_asset_percent.trim() ? asNumber(draft.max_single_asset_percent) : null,
                max_single_order_amount: draft.max_single_order_amount.trim() ? asNumber(draft.max_single_order_amount) : null,
                approval_threshold: draft.approval_threshold.trim() ? asNumber(draft.approval_threshold) : 0,
                valuation_update_frequency_days: asNumber(draft.valuation_update_frequency_days),
                change_reason: draft.change_reason.trim(),
                two_factor_code: stepUpPayload.two_factor_code || null,
                recovery_code: stepUpPayload.recovery_code || null
            });
            setStepUpOpen(false);
            await loadPolicy();
            pushToast({
                type: "success",
                title: "Treasury policy",
                message: "Treasury policy updated and versioned successfully."
            });
        } catch (error) {
            pushToast({
                type: "error",
                title: "Treasury policy",
                message: getApiErrorMessage(error, "Unable to update treasury policy.")
            });
        } finally {
            setBusy(false);
        }
    };

    if (twoFactorSetupRequired) {
        return <Navigate to="/security?intent=setup" replace />;
    }

    return (
        <Box sx={{ p: { xs: 2, md: 3 } }}>
            <Stack spacing={3}>
                <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
                    <Box>
                        <Typography variant="h4" fontWeight={800}>
                            Treasury policy settings
                        </Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                            Configure the liquidity, concentration, and execution guardrails that govern institutional treasury activity.
                        </Typography>
                    </Box>
                </Stack>

                <Alert severity="info">
                    Policy changes are backend-enforced, versioned, audited, and protected by two-factor step-up before they take effect.
                </Alert>

                {loading ? (
                    <Card variant="outlined">
                        <CardContent>
                            <Typography variant="body2" color="text.secondary">
                                Loading treasury policy...
                            </Typography>
                        </CardContent>
                    </Card>
                ) : policy ? (
                    <Box
                        sx={{
                            display: "grid",
                            gap: 2,
                            gridTemplateColumns: {
                                xs: "1fr",
                                xl: "minmax(0, 1.2fr) minmax(360px, 0.8fr)"
                            }
                        }}
                    >
                        <Stack spacing={2}>
                            <Card variant="outlined">
                                <CardContent>
                                    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2 }}>
                                        <ShieldRoundedIcon color="primary" />
                                        <Typography variant="h6" fontWeight={800}>
                                            Liquidity Protection
                                        </Typography>
                                    </Stack>
                                    <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" } }}>
                                        <TextField label="Liquidity Reserve Ratio (%)" value={draft.liquidity_reserve_ratio} onChange={(event) => setDraft((current) => ({ ...current, liquidity_reserve_ratio: event.target.value }))} fullWidth />
                                        <TextField label="Minimum Cash Buffer (TSh)" value={draft.minimum_cash_buffer} onChange={(event) => setDraft((current) => ({ ...current, minimum_cash_buffer: event.target.value }))} fullWidth />
                                        <TextField label="Loan Liquidity Protection Ratio (%)" value={draft.loan_liquidity_protection_ratio} onChange={(event) => setDraft((current) => ({ ...current, loan_liquidity_protection_ratio: event.target.value }))} fullWidth />
                                    </Box>
                                </CardContent>
                            </Card>

                            <Card variant="outlined">
                                <CardContent>
                                    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2 }}>
                                        <PolicyRoundedIcon color="primary" />
                                        <Typography variant="h6" fontWeight={800}>
                                            Investment Limits
                                        </Typography>
                                    </Stack>
                                    <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" } }}>
                                        <TextField label="Max Asset Allocation (%)" value={draft.max_asset_allocation_percent} onChange={(event) => setDraft((current) => ({ ...current, max_asset_allocation_percent: event.target.value }))} fullWidth />
                                        <TextField label="Max Single Asset (%)" value={draft.max_single_asset_percent} onChange={(event) => setDraft((current) => ({ ...current, max_single_asset_percent: event.target.value }))} fullWidth />
                                        <TextField label="Max Single Order Amount (TSh)" value={draft.max_single_order_amount} onChange={(event) => setDraft((current) => ({ ...current, max_single_order_amount: event.target.value }))} fullWidth />
                                        <TextField label="Approval Threshold (TSh)" value={draft.approval_threshold} onChange={(event) => setDraft((current) => ({ ...current, approval_threshold: event.target.value }))} fullWidth />
                                    </Box>
                                </CardContent>
                            </Card>

                            <Card variant="outlined">
                                <CardContent>
                                    <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>
                                        Valuation Rules
                                    </Typography>
                                    <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" } }}>
                                        <TextField label="Valuation Update Frequency (days)" value={draft.valuation_update_frequency_days} onChange={(event) => setDraft((current) => ({ ...current, valuation_update_frequency_days: event.target.value }))} fullWidth />
                                        <TextField
                                            label="Change Reason"
                                            value={draft.change_reason}
                                            onChange={(event) => setDraft((current) => ({ ...current, change_reason: event.target.value }))}
                                            multiline
                                            minRows={3}
                                            fullWidth
                                            error={changeReasonTooShort}
                                            helperText={
                                                changeReasonTooShort
                                                    ? `Enter at least 8 characters so the policy change is audit-ready. (${trimmedChangeReason.length}/8)`
                                                    : "Required for policy history, audit logging, and approval traceability."
                                            }
                                        />
                                    </Box>
                                </CardContent>
                            </Card>
                        </Stack>

                        <Stack spacing={2}>
                            <Card variant="outlined">
                                <CardContent>
                                    <Typography variant="h6" fontWeight={800}>
                                        Policy status
                                    </Typography>
                                    <Stack spacing={1.25} sx={{ mt: 2 }}>
                                        <Stack direction="row" justifyContent="space-between">
                                            <Typography variant="body2" color="text.secondary">Policy Version</Typography>
                                            <Typography variant="body2" fontWeight={700}>v{policy.policy_version}</Typography>
                                        </Stack>
                                        <Stack direction="row" justifyContent="space-between">
                                            <Typography variant="body2" color="text.secondary">Last Updated</Typography>
                                            <Typography variant="body2" fontWeight={700}>{formatDate(policy.updated_at)}</Typography>
                                        </Stack>
                                    </Stack>
                                </CardContent>
                            </Card>

                            <Card variant="outlined">
                                <CardContent>
                                    <Typography variant="h6" fontWeight={800}>
                                        Policy Change Preview
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                        Review the exact guardrails that will change before confirming with a fresh authenticator check.
                                    </Typography>
                                    <Stack spacing={1.25} sx={{ mt: 2 }}>
                                        {previewRows.length ? previewRows.map((row) => (
                                            <Box key={row.label}>
                                                <Typography variant="body2" fontWeight={700}>{row.label}</Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {row.current} → {row.next}
                                                </Typography>
                                                <Divider sx={{ mt: 1.25 }} />
                                            </Box>
                                        )) : (
                                            <Alert severity="info">No pending policy changes yet.</Alert>
                                        )}
                                    </Stack>
                                </CardContent>
                            </Card>

                            <Card variant="outlined">
                                <CardContent>
                                    <Typography variant="body2" color="text.secondary">
                                        Branch managers can configure policy limits. Saving will increment the treasury policy version, write history, and trigger treasury governance notifications.
                                    </Typography>
                                    {changeReasonTooShort ? (
                                        <Alert severity="warning" sx={{ mt: 2 }}>
                                            Add at least 8 characters to the change reason before continuing with 2FA review.
                                        </Alert>
                                    ) : null}
                                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ mt: 2 }}>
                                        <Button variant="outlined" onClick={() => navigate("/treasury")}>
                                            Cancel
                                        </Button>
                                        <Button
                                            variant="contained"
                                            disabled={busy || !previewRows.length || trimmedChangeReason.length < 8}
                                            onClick={() => setStepUpOpen(true)}
                                        >
                                            Review with 2FA
                                        </Button>
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Stack>
                    </Box>
                ) : null}
            </Stack>

            <TwoFactorStepUpDialog
                open={stepUpOpen}
                busy={busy}
                title="Approve treasury policy update"
                description="Confirm a fresh authenticator check before the updated treasury guardrails are saved, versioned, and enforced."
                actionLabel="Apply policy"
                onCancel={() => setStepUpOpen(false)}
                onConfirm={handleSave}
            />
        </Box>
    );
}
