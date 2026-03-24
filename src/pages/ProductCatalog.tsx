import { MotionCard, MotionModal } from "../ui/motion";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CreditScoreRoundedIcon from "@mui/icons-material/CreditScoreRounded";
import RuleRoundedIcon from "@mui/icons-material/RuleRounded";
import SavingsRoundedIcon from "@mui/icons-material/SavingsRounded";
import ShareRoundedIcon from "@mui/icons-material/PieChartRounded";
import SellRoundedIcon from "@mui/icons-material/SellRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import {
    Alert,
    Box,
    Button,
    CardContent,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    MenuItem,
    Stack,
    TextField,
    Typography
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { useAuth } from "../auth/AuthContext";
import { DataTable } from "../components/DataTable";
import { useToast } from "../components/Toast";
import { api, getApiErrorMessage } from "../lib/api";
import {
    endpoints,
    type LoanProductsResponse,
    type ProductBootstrapResponse,
    type FeeRulesResponse,
    type PenaltyRulesResponse,
    type PostingRulesResponse,
    type SavingsProductsResponse,
    type ShareProductsResponse
} from "../lib/endpoints";
import type {
    ChartOfAccountOption,
    FeeRule,
    LoanProduct,
    PenaltyRule,
    PostingRule,
    ProductBootstrapPayload,
    SavingsProduct,
    ShareProduct
} from "../types/api";
import { formatCurrency } from "../utils/format";

type CatalogKind = "loans" | "savings" | "shares" | "fees" | "penalties" | "posting-rules";
type CatalogRecord = LoanProduct | SavingsProduct | ShareProduct | FeeRule | PenaltyRule | PostingRule;

interface CatalogDialogState {
    kind: CatalogKind;
    record?: CatalogRecord | null;
}

const emptyPayload: ProductBootstrapPayload = {
    savings_products: [],
    loan_products: [],
    share_products: [],
    fee_rules: [],
    penalty_rules: [],
    posting_rules: [],
    chart_of_accounts: []
};

const penaltyTypeOptions = [
    { value: "late_repayment", label: "Late repayment" },
    { value: "missed_instalment", label: "Missed instalment" },
    { value: "loan_default", label: "Loan default" },
    { value: "other", label: "Other" }
];

const penaltyFrequencyOptions = [
    { value: "one_time", label: "One-time" },
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "per_repayment_period", label: "Per repayment period" }
];

const penaltyCalculationBaseOptions = [
    { value: "overdue_instalment", label: "Overdue instalment" },
    { value: "outstanding_balance", label: "Outstanding balance" },
    { value: "total_loan_amount", label: "Total loan amount" },
    { value: "principal_only", label: "Principal only" }
];

const repaymentFrequencyOptions = [
    { value: "weekly", label: "Weekly" },
    { value: "bi_weekly", label: "Bi-weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "quarterly", label: "Quarterly" }
];

const termUnitOptions = [
    { value: "months", label: "Months" },
    { value: "weeks", label: "Weeks" }
];

const processingFeeTypeOptions = [
    { value: "flat", label: "Flat amount" },
    { value: "percentage", label: "Percentage" }
];

const withdrawalFeeTypeOptions = [
    { value: "flat", label: "Flat" },
    { value: "percentage", label: "Percentage" }
];

function SectionCard({
    title,
    helper,
    icon,
    action,
    children
}: {
    title: string;
    helper: string;
    icon: React.ReactNode;
    action?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <MotionCard variant="outlined">
            <CardContent>
                <Stack spacing={3}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
                            {icon}
                            <Box sx={{ minWidth: 0, maxWidth: { xs: "100%", md: 460 } }}>
                                <Typography variant="h6">{title}</Typography>
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    noWrap
                                    sx={{ textOverflow: "ellipsis", overflow: "hidden" }}
                                >
                                    {helper}
                                </Typography>
                            </Box>
                        </Stack>
                        <Box sx={{ flexShrink: 0 }}>{action}</Box>
                    </Stack>
                    {children}
                </Stack>
            </CardContent>
        </MotionCard>
    );
}

export function ProductCatalogPage() {
    const { pushToast } = useToast();
    const { selectedTenantId } = useAuth();
    const [payload, setPayload] = useState<ProductBootstrapPayload>(emptyPayload);
    const [loading, setLoading] = useState(true);
    const [dialog, setDialog] = useState<CatalogDialogState | null>(null);
    const [saving, setSaving] = useState(false);
    const form = useForm<Record<string, string | number | boolean | null>>({
        defaultValues: {}
    });
    const penaltyDefaults: Record<string, unknown> = {
        calculation_method: "flat",
        penalty_type: "late_repayment",
        penalty_frequency: "per_repayment_period",
        calculation_base: "overdue_instalment",
        grace_period_days: 0,
        compound_penalty: "false",
        penalty_waivable: "true"
    };
    const loanDefaults: Record<string, unknown> = {
        repayment_frequency: "monthly",
        term_unit: "months",
        processing_fee_type: "flat",
        maximum_loan_multiple: 3,
        minimum_membership_duration_months: 0,
        allow_early_repayment: "true"
    };
    const savingsDefaults: Record<string, unknown> = {
        min_opening_balance: 0,
        min_balance: 0,
        withdrawal_notice_days: 0,
        allow_withdrawals: true,
        annual_interest_rate: 0,
        interest_calculation_method: "daily_balance",
        withdrawal_fee_type: "flat",
        status: "active"
    };
    const shareDefaults: Record<string, unknown> = {
        minimum_shares: 0,
        allow_refund: "true",
        status: "active"
    };
    const feeDefaults: Record<string, unknown> = {
        fee_type: "membership_fee",
        calculation_method: "flat",
        flat_amount: 0,
        is_active: "true"
    };
    const postingRulesDefaults: Record<string, unknown> = {
        scope: "general",
        is_active: "true"
    };
    const defaultDialogValues: Record<CatalogKind, Record<string, unknown>> = {
        penalties: penaltyDefaults,
        loans: loanDefaults,
        savings: savingsDefaults,
        shares: shareDefaults,
        fees: feeDefaults,
        "posting-rules": postingRulesDefaults
    };
    const penaltyCalculationMethod = form.watch("calculation_method");
    const processingFeeType = String(form.watch("processing_fee_type") ?? "flat");
    const allowEarlyRepayment = String(form.watch("allow_early_repayment") ?? "true");
    const withdrawalFeeType = String(form.watch("withdrawal_fee_type") ?? "flat");

    const chartOptions = payload.chart_of_accounts;

    const accountLabel = useMemo(
        () => new Map(chartOptions.map((account) => [account.id, `${account.account_code} · ${account.account_name}`])),
        [chartOptions]
    );

    const loadCatalog = async () => {
        if (!selectedTenantId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const { data } = await api.get<ProductBootstrapResponse>(endpoints.products.bootstrap());
            setPayload(data.data || emptyPayload);
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to load product catalog",
                message: getApiErrorMessage(error)
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadCatalog();
    }, [selectedTenantId]);

    const openDialog = (kind: CatalogKind, record?: CatalogRecord | null) => {
        const defaults = (defaultDialogValues[kind] || {}) as Record<string, string | number | boolean | null>;
        setDialog({ kind, record: record || null });
        form.reset(
            record
                ? {
                      ...defaults,
                      ...record
                  } as Record<string, string | number | boolean | null>
                : { ...defaults }
        );
    };

    const submitDialog = form.handleSubmit(async (values) => {
        if (!dialog) {
            return;
        }

        setSaving(true);

        let payloadValues = values;

        if (dialog.kind === "penalties") {
            const normalized = { ...values } as Record<string, string | number | boolean | null>;
            const toNumber = (value: unknown): number | null => {
                const parsed = Number(value);
                return Number.isNaN(parsed) ? null : parsed;
            };

            const calculationMethod = String(normalized.calculation_method || "flat");

            const gracePeriod = toNumber(normalized.grace_period_days) ?? 0;
            if (gracePeriod < 0) {
                pushToast({
                    type: "error",
                    title: "Invalid grace period",
                    message: "Grace period must be zero or a positive number of days."
                });
                setSaving(false);
                return;
            }

            const flatAmount = toNumber(normalized.flat_amount) ?? 0;
            const penaltyRate = toNumber(normalized.percentage_value) ?? 0;
            if (calculationMethod === "flat" && flatAmount < 0) {
                pushToast({
                    type: "error",
                    title: "Invalid flat amount",
                    message: "Flat amounts must be zero or positive."
                });
                setSaving(false);
                return;
            }

            if (calculationMethod === "percentage" && (penaltyRate < 0 || penaltyRate > 100)) {
                pushToast({
                    type: "error",
                    title: "Invalid penalty rate",
                    message: "Penalty rate must be between 0% and 100%."
                });
                setSaving(false);
                return;
            }

            const maxPercent = toNumber(normalized.max_penalty_percent);
            if (maxPercent !== null && maxPercent < 0) {
                pushToast({
                    type: "error",
                    title: "Invalid maximum percentage",
                    message: "Maximum penalty percentage must be zero or positive."
                });
                setSaving(false);
                return;
            }

            if (calculationMethod === "percentage" && maxPercent !== null && penaltyRate > maxPercent) {
                pushToast({
                    type: "error",
                    title: "Maximum percentage constraint",
                    message: "Maximum penalty percentage must be greater than or equal to the penalty rate."
                });
                setSaving(false);
                return;
            }

            const maxAmount = toNumber(normalized.max_penalty_amount);
            if (maxAmount !== null && maxAmount < 0) {
                pushToast({
                    type: "error",
                    title: "Invalid maximum amount",
                    message: "Maximum penalty amount must be zero or positive."
                });
                setSaving(false);
                return;
            }

            const parseBoolean = (value: unknown) => value === "true" || value === true;

            normalized.grace_period_days = gracePeriod;
            normalized.flat_amount = flatAmount;
            normalized.percentage_value = penaltyRate;
            normalized.max_penalty_percent = maxPercent;
            normalized.max_penalty_amount = maxAmount;
            normalized.compound_penalty = parseBoolean(normalized.compound_penalty);
            normalized.penalty_waivable = parseBoolean(normalized.penalty_waivable);
            normalized.penalty_frequency = normalized.penalty_frequency || "per_repayment_period";
            normalized.calculation_base = normalized.calculation_base || "overdue_instalment";
            normalized.penalty_receivable_account_id = normalized.penalty_receivable_account_id || null;
            normalized.effective_from = normalized.effective_from || null;
            normalized.effective_to = normalized.effective_to || null;

            payloadValues = normalized;
        }

        if (dialog.kind === "loans") {
            const normalized = { ...values } as Record<string, string | number | boolean | null>;
            const toNumber = (value: unknown): number | null => {
                const parsed = Number(value);
                return Number.isNaN(parsed) ? null : parsed;
            };
            const showLoanError = (title: string, message: string) => {
                pushToast({ type: "error", title, message });
                setSaving(false);
            };

            const minAmount = toNumber(normalized.min_amount);
            const maxAmount = toNumber(normalized.max_amount);
            if (minAmount !== null && maxAmount !== null && minAmount >= maxAmount) {
                showLoanError("Invalid loan range", "Minimum amount must be less than maximum amount.");
                return;
            }

            const minTerm = toNumber(normalized.min_term_count);
            const maxTerm = toNumber(normalized.max_term_count);
            if (minTerm !== null && maxTerm !== null && minTerm >= maxTerm) {
                showLoanError("Invalid term", "Minimum term must be shorter than maximum term.");
                return;
            }

            const interestRate = toNumber(normalized.annual_interest_rate);
            if (interestRate !== null && interestRate > 100) {
                showLoanError("Invalid interest rate", "Interest rate must be 100% or lower.");
                return;
            }

            const insuranceRate = toNumber(normalized.insurance_rate);
            if (insuranceRate !== null && insuranceRate > 100) {
                showLoanError("Invalid insurance rate", "Insurance rate must be 100% or lower.");
                return;
            }

            const requiredGuarantors = toNumber(normalized.required_guarantors_count);
            if (requiredGuarantors !== null && requiredGuarantors < 0) {
                showLoanError("Invalid guarantors", "Required guarantors must be zero or positive.");
                return;
            }

            const maximumLoanMultiple = toNumber(normalized.maximum_loan_multiple);
            if (maximumLoanMultiple !== null && maximumLoanMultiple < 0) {
                showLoanError("Invalid loan multiple", "Maximum loan multiple must be zero or positive.");
                return;
            }

            const minimumMembershipDuration = toNumber(normalized.minimum_membership_duration_months);
            if (minimumMembershipDuration !== null && minimumMembershipDuration < 0) {
                showLoanError(
                    "Invalid membership duration",
                    "Minimum membership duration must be zero or positive."
                );
                return;
            }

            const processingFeeTypeValue = String(normalized.processing_fee_type || "flat");
            const processingFeeAmount = toNumber(normalized.processing_fee_amount);
            const processingFeePercent = toNumber(normalized.processing_fee_percent);

            if (processingFeeTypeValue === "flat") {
                if (processingFeeAmount !== null && processingFeeAmount < 0) {
                    showLoanError("Invalid processing fee", "Flat processing fees must be zero or positive.");
                    return;
                }
                normalized.processing_fee_amount = processingFeeAmount;
                normalized.processing_fee_percent = null;
            } else {
                if (processingFeePercent !== null && (processingFeePercent < 0 || processingFeePercent > 100)) {
                    showLoanError("Invalid processing fee", "Percentage processing fees must be between 0% and 100%.");
                    return;
                }
                normalized.processing_fee_percent = processingFeePercent;
                normalized.processing_fee_amount = null;
            }

            const allowEarlyRepaymentBool = normalized.allow_early_repayment === "true" || normalized.allow_early_repayment === true;
            const earlySettlementFee = toNumber(normalized.early_settlement_fee_percent);
            if (allowEarlyRepaymentBool && earlySettlementFee !== null && earlySettlementFee > 100) {
                showLoanError("Invalid early settlement fee", "Early settlement fee must be 100% or lower.");
                return;
            }

            normalized.annual_interest_rate = interestRate;
            normalized.insurance_rate = insuranceRate;
            normalized.min_amount = minAmount;
            normalized.max_amount = maxAmount;
            normalized.min_term_count = minTerm;
            normalized.max_term_count = maxTerm;
            normalized.required_guarantors_count = requiredGuarantors;
            normalized.maximum_loan_multiple = maximumLoanMultiple ?? 3;
            normalized.minimum_membership_duration_months = minimumMembershipDuration ?? 0;
            normalized.repayment_frequency = normalized.repayment_frequency || "monthly";
            normalized.term_unit = normalized.term_unit || "months";
            normalized.allow_early_repayment = allowEarlyRepaymentBool;
            normalized.early_settlement_fee_percent = allowEarlyRepaymentBool ? earlySettlementFee ?? null : null;
            normalized.processing_fee_type = processingFeeTypeValue;

            payloadValues = normalized;
        }

        if (dialog.kind === "savings") {
            const normalized = { ...values } as Record<string, string | number | boolean | null>;
            const toNumber = (value: unknown): number | null => {
                const parsed = Number(value);
                return Number.isNaN(parsed) ? null : parsed;
            };
            const showSavingsError = (title: string, message: string) => {
                pushToast({ type: "error", title, message });
                setSaving(false);
            };

            const minOpening = toNumber(normalized.min_opening_balance);
            if (minOpening === null || minOpening < 0) {
                showSavingsError("Invalid opening balance", "Minimum opening balance must be zero or higher.");
                return;
            }

            const minBalance = toNumber(normalized.min_balance);
            if (minBalance === null || minBalance < 0) {
                showSavingsError("Invalid minimum balance", "Minimum balance must be zero or higher.");
                return;
            }

            if (minBalance > minOpening) {
                showSavingsError("Invalid balances", "Minimum balance cannot exceed the minimum opening amount.");
                return;
            }

            const maximumAccountBalance = toNumber(normalized.maximum_account_balance);
            if (maximumAccountBalance !== null && maximumAccountBalance < 0) {
                showSavingsError("Invalid maximum balance", "Maximum balance must be zero or higher.");
                return;
            }

            const interestRate = toNumber(normalized.annual_interest_rate);
            if (interestRate !== null && interestRate > 100) {
                showSavingsError("Invalid interest rate", "Interest rate must be 100% or lower.");
                return;
            }

            const noticeDays = toNumber(normalized.withdrawal_notice_days) ?? 0;
            if (noticeDays < 0) {
                showSavingsError("Invalid notice days", "Notice days must be zero or higher.");
                return;
            }

            const minimumWithdrawal = toNumber(normalized.minimum_withdrawal_amount);
            if (minimumWithdrawal !== null && minimumWithdrawal < 0) {
                showSavingsError("Invalid withdrawal minimum", "Minimum withdrawal must be zero or higher.");
                return;
            }

            const maximumWithdrawal = toNumber(normalized.maximum_withdrawal_amount);
            if (maximumWithdrawal !== null && maximumWithdrawal < 0) {
                showSavingsError("Invalid withdrawal maximum", "Maximum withdrawal must be zero or higher.");
                return;
            }

            if (minimumWithdrawal !== null && maximumWithdrawal !== null && minimumWithdrawal > maximumWithdrawal) {
                showSavingsError("Invalid withdrawal limits", "Minimum withdrawal cannot exceed the maximum.");
                return;
            }

            const withdrawalFeeTypeValue = String(normalized.withdrawal_fee_type || "flat");
            const withdrawalFeeAmount = toNumber(normalized.withdrawal_fee_amount);
            const withdrawalFeePercent = toNumber(normalized.withdrawal_fee_percent);

            if (withdrawalFeeTypeValue === "flat") {
                if (withdrawalFeeAmount !== null && withdrawalFeeAmount < 0) {
                    showSavingsError("Invalid withdrawal fee", "Flat withdrawal fees must be zero or positive.");
                    return;
                }
                normalized.withdrawal_fee_amount = withdrawalFeeAmount;
                normalized.withdrawal_fee_percent = null;
            } else {
                if (withdrawalFeePercent !== null && (withdrawalFeePercent < 0 || withdrawalFeePercent > 100)) {
                    showSavingsError("Invalid withdrawal fee", "Percentage withdrawal fees must be between 0% and 100%.");
                    return;
                }
                normalized.withdrawal_fee_percent = withdrawalFeePercent;
                normalized.withdrawal_fee_amount = null;
            }

            const dormantAfterDays = toNumber(normalized.dormant_after_days);
            if (dormantAfterDays !== null && dormantAfterDays < 0) {
                showSavingsError("Invalid dormancy", "Dormant after days must be zero or higher.");
                return;
            }

            const accountOpeningFee = toNumber(normalized.account_opening_fee);
            if (accountOpeningFee !== null && accountOpeningFee < 0) {
                showSavingsError("Invalid opening fee", "Account opening fee must be zero or higher.");
                return;
            }

            normalized.min_opening_balance = minOpening;
            normalized.min_balance = minBalance;
            normalized.maximum_account_balance = maximumAccountBalance;
            normalized.withdrawal_notice_days = noticeDays;
            normalized.annual_interest_rate = interestRate ?? 0;
            normalized.interest_calculation_method = normalized.interest_calculation_method || "daily_balance";
            normalized.withdrawal_fee_type = withdrawalFeeTypeValue;
            normalized.minimum_withdrawal_amount = minimumWithdrawal;
            normalized.maximum_withdrawal_amount = maximumWithdrawal;
            normalized.dormant_after_days = dormantAfterDays;
            normalized.account_opening_fee = accountOpeningFee;

            payloadValues = normalized;
        }

        try {
            const isEdit = Boolean(dialog.record && "id" in dialog.record);
            const id = dialog.record && "id" in dialog.record ? dialog.record.id : null;

            switch (dialog.kind) {
                case "loans":
                    if (isEdit && id) {
                        await api.patch<LoanProductsResponse>(`${endpoints.products.loans()}/${id}`, payloadValues);
                    } else {
                        await api.post<LoanProductsResponse>(endpoints.products.loans(), payloadValues);
                    }
                    break;
                case "savings":
                    if (isEdit && id) {
                        await api.patch<SavingsProductsResponse>(`${endpoints.products.savings()}/${id}`, payloadValues);
                    } else {
                        await api.post<SavingsProductsResponse>(endpoints.products.savings(), payloadValues);
                    }
                    break;
                case "shares":
                    if (isEdit && id) {
                        await api.patch<ShareProductsResponse>(`${endpoints.products.shares()}/${id}`, values);
                    } else {
                        await api.post<ShareProductsResponse>(endpoints.products.shares(), values);
                    }
                    break;
                case "fees":
                    if (isEdit && id) {
                        await api.patch<FeeRulesResponse>(`${endpoints.products.fees()}/${id}`, values);
                    } else {
                        await api.post<FeeRulesResponse>(endpoints.products.fees(), values);
                    }
                    break;
                case "penalties":
                    if (isEdit && id) {
                        await api.patch<PenaltyRulesResponse>(`${endpoints.products.penalties()}/${id}`, payloadValues);
                    } else {
                        await api.post<PenaltyRulesResponse>(endpoints.products.penalties(), payloadValues);
                    }
                    break;
                case "posting-rules":
                    if (isEdit && id) {
                        await api.patch<PostingRulesResponse>(`${endpoints.products.postingRules()}/${id}`, values);
                    } else {
                        await api.post<PostingRulesResponse>(endpoints.products.postingRules(), values);
                    }
                    break;
            }

            pushToast({
                type: "success",
                title: "Catalog updated",
                message: "The configuration has been saved."
            });
            setDialog(null);
            await loadCatalog();
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to save configuration",
                message: getApiErrorMessage(error)
            });
        } finally {
            setSaving(false);
        }
    });

    const renderProductDialog = () => {
        if (!dialog) {
            return null;
        }

        const kind = dialog.kind;
        const titleMap: Record<CatalogKind, string> = {
            loans: "Loan Product",
            savings: "Savings Product",
            shares: "Share Product",
            fees: "Fee Rule",
            penalties: "Penalty Rule",
            "posting-rules": "Posting Rule"
        };

        const accountSelect = (name: string, label: string, allowEmpty = false) => (
            <TextField select fullWidth label={label} defaultValue={form.getValues(name) || ""} {...form.register(name)}>
                {allowEmpty ? <MenuItem value="">Not set</MenuItem> : null}
                {chartOptions.map((account: ChartOfAccountOption) => (
                    <MenuItem key={account.id} value={account.id}>
                        {account.account_code} · {account.account_name}
                    </MenuItem>
                ))}
            </TextField>
        );

        return (
            <MotionModal open onClose={() => setDialog(null)} maxWidth="md" fullWidth>
                <DialogTitle>{dialog.record ? `Edit ${titleMap[kind]}` : `New ${titleMap[kind]}`}</DialogTitle>
                <DialogContent dividers>
                    <Grid container spacing={2} sx={{ mt: 0.25 }}>
                        {kind === "loans" ? (
                            <>
                                <Grid size={{ xs: 12 }}>
                                    <SectionCard
                                        title="Product information"
                                        helper="Define the loan product identity."
                                        icon={<AddRoundedIcon color="primary" fontSize="small" />}
                                    >
                                        <Grid container spacing={2}>
                                            <Grid size={{ xs: 12, md: 4 }}>
                                                <TextField fullWidth label="Code" {...form.register("code")} />
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 8 }}>
                                                <TextField fullWidth label="Name" {...form.register("name")} />
                                            </Grid>
                                            <Grid size={{ xs: 12 }}>
                                                <TextField fullWidth label="Description" {...form.register("description")} />
                                            </Grid>
                                        </Grid>
                                    </SectionCard>
                                </Grid>

                                <Grid size={{ xs: 12 }}>
                                    <SectionCard
                                        title="Loan structure"
                                        helper="Specify how the loan amortizes over time."
                                        icon={<CreditScoreRoundedIcon color="info" fontSize="small" />}
                                    >
                                        <Grid container spacing={2}>
                                            <Grid size={{ xs: 12, md: 3 }}>
                                                <TextField
                                                    select
                                                    fullWidth
                                                    label="Interest method"
                                                    defaultValue={form.getValues("interest_method") || "reducing_balance"}
                                                    {...form.register("interest_method")}
                                                >
                                                    <MenuItem value="reducing_balance">Reducing balance</MenuItem>
                                                    <MenuItem value="flat">Flat</MenuItem>
                                                </TextField>
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 3 }}>
                                                <TextField
                                                    fullWidth
                                                    type="number"
                                                    label="Annual interest %"
                                                    {...form.register("annual_interest_rate", { valueAsNumber: true })}
                                                    InputProps={{ inputProps: { min: 0, max: 100, step: 0.01 } }}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 3 }}>
                                                <TextField
                                                    select
                                                    fullWidth
                                                    label="Repayment frequency"
                                                    defaultValue={form.getValues("repayment_frequency") || "monthly"}
                                                    {...form.register("repayment_frequency")}
                                                >
                                                    {repaymentFrequencyOptions.map((option) => (
                                                        <MenuItem key={option.value} value={option.value}>
                                                            {option.label}
                                                        </MenuItem>
                                                    ))}
                                                </TextField>
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 3 }}>
                                                <TextField
                                                    select
                                                    fullWidth
                                                    label="Term unit"
                                                    defaultValue={form.getValues("term_unit") || "months"}
                                                    {...form.register("term_unit")}
                                                >
                                                    {termUnitOptions.map((option) => (
                                                        <MenuItem key={option.value} value={option.value}>
                                                            {option.label}
                                                        </MenuItem>
                                                    ))}
                                                </TextField>
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 3 }}>
                                                <TextField
                                                    fullWidth
                                                    type="number"
                                                    label="Min term"
                                                    {...form.register("min_term_count", { valueAsNumber: true })}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 3 }}>
                                                <TextField
                                                    fullWidth
                                                    type="number"
                                                    label="Max term"
                                                    {...form.register("max_term_count", { valueAsNumber: true })}
                                                />
                                            </Grid>
                                        </Grid>
                                    </SectionCard>
                                </Grid>

                                <Grid size={{ xs: 12 }}>
                                    <SectionCard
                                        title="Loan limits"
                                        helper="Enforce eligibility, savings multiples, and guarantor counts."
                                        icon={<SavingsRoundedIcon color="secondary" fontSize="small" />}
                                    >
                                        <Grid container spacing={2}>
                                            <Grid size={{ xs: 12, md: 3 }}>
                                                <TextField
                                                    fullWidth
                                                    type="number"
                                                    label="Min amount"
                                                    {...form.register("min_amount", { valueAsNumber: true })}
                                                    InputProps={{ inputProps: { min: 0, step: 1 } }}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 3 }}>
                                                <TextField
                                                    fullWidth
                                                    type="number"
                                                    label="Max amount"
                                                    {...form.register("max_amount", { valueAsNumber: true })}
                                                    InputProps={{ inputProps: { min: 0, step: 1 } }}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 2 }}>
                                                <TextField
                                                    fullWidth
                                                    type="number"
                                                    label="Maximum loan multiple"
                                                    {...form.register("maximum_loan_multiple", { valueAsNumber: true })}
                                                    InputProps={{ inputProps: { min: 0, step: 0.1 } }}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 2 }}>
                                                <TextField
                                                    fullWidth
                                                    type="number"
                                                    label="Min membership duration (months)"
                                                    {...form.register("minimum_membership_duration_months", { valueAsNumber: true })}
                                                    InputProps={{ inputProps: { min: 0, step: 1 } }}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 2 }}>
                                                <TextField
                                                    fullWidth
                                                    type="number"
                                                    label="Required guarantors"
                                                    {...form.register("required_guarantors_count", { valueAsNumber: true })}
                                                    InputProps={{ inputProps: { min: 0, step: 1 } }}
                                                />
                                            </Grid>
                                        </Grid>
                                    </SectionCard>
                                </Grid>

                                <Grid size={{ xs: 12 }}>
                                    <SectionCard
                                        title="Fees"
                                        helper="Capture processing fees, insurance, and other charges."
                                        icon={<SellRoundedIcon color="success" fontSize="small" />}
                                    >
                                        <Grid container spacing={2}>
                                            <Grid size={{ xs: 12, md: 4 }}>
                                                <TextField
                                                    select
                                                    fullWidth
                                                    label="Processing fee type"
                                                    defaultValue={form.getValues("processing_fee_type") || "flat"}
                                                    {...form.register("processing_fee_type")}
                                                >
                                                    {processingFeeTypeOptions.map((option) => (
                                                        <MenuItem key={option.value} value={option.value}>
                                                            {option.label}
                                                        </MenuItem>
                                                    ))}
                                                </TextField>
                                            </Grid>
                                            {processingFeeType === "percentage" ? (
                                                <Grid size={{ xs: 12, md: 4 }}>
                                                    <TextField
                                                        fullWidth
                                                        type="number"
                                                        label="Processing fee %"
                                                        {...form.register("processing_fee_percent", { valueAsNumber: true })}
                                                        InputProps={{ inputProps: { min: 0, max: 100, step: 0.01 } }}
                                                    />
                                                </Grid>
                                            ) : (
                                                <Grid size={{ xs: 12, md: 4 }}>
                                                    <TextField
                                                        fullWidth
                                                        type="number"
                                                        label="Processing fee amount (TSH)"
                                                        {...form.register("processing_fee_amount", { valueAsNumber: true })}
                                                        InputProps={{ inputProps: { min: 0, step: 1 } }}
                                                    />
                                                </Grid>
                                            )}
                                            <Grid size={{ xs: 12, md: 4 }}>
                                                <TextField
                                                    fullWidth
                                                    type="number"
                                                    label="Insurance %"
                                                    {...form.register("insurance_rate", { valueAsNumber: true })}
                                                    InputProps={{ inputProps: { min: 0, max: 100, step: 0.01 } }}
                                                />
                                            </Grid>
                                        </Grid>
                                    </SectionCard>
                                </Grid>

                                <Grid size={{ xs: 12 }}>
                                    <SectionCard
                                        title="Accounting"
                                        helper="Map the product to the correct ledger accounts."
                                        icon={<CreditScoreRoundedIcon color="primary" fontSize="small" />}
                                    >
                                        <Grid container spacing={2}>
                                            <Grid size={{ xs: 12, md: 3 }}>{accountSelect("receivable_account_id", "Receivable account")}</Grid>
                                            <Grid size={{ xs: 12, md: 3 }}>{accountSelect("interest_income_account_id", "Interest income account")}</Grid>
                                            <Grid size={{ xs: 12, md: 3 }}>{accountSelect("fee_income_account_id", "Fee income account")}</Grid>
                                            <Grid size={{ xs: 12, md: 3 }}>{accountSelect("penalty_income_account_id", "Penalty income account")}</Grid>
                                        </Grid>
                                    </SectionCard>
                                </Grid>

                                <Grid size={{ xs: 12 }}>
                                    <SectionCard
                                        title="Controls"
                                        helper="Manage early repayment, defaults, and product state."
                                        icon={<RuleRoundedIcon color="action" fontSize="small" />}
                                    >
                                        <Grid container spacing={2}>
                                            <Grid size={{ xs: 12, md: 3 }}>
                                                <TextField
                                                    select
                                                    fullWidth
                                                    label="Allow early repayment"
                                                    defaultValue={form.getValues("allow_early_repayment") ?? "true"}
                                                    {...form.register("allow_early_repayment")}
                                                >
                                                    <MenuItem value="true">Yes</MenuItem>
                                                    <MenuItem value="false">No</MenuItem>
                                                </TextField>
                                            </Grid>
                                            {allowEarlyRepayment === "true" ? (
                                                <Grid size={{ xs: 12, md: 3 }}>
                                                    <TextField
                                                        fullWidth
                                                        type="number"
                                                        label="Early settlement fee %"
                                                        {...form.register("early_settlement_fee_percent", { valueAsNumber: true })}
                                                        InputProps={{ inputProps: { min: 0, max: 100, step: 0.01 } }}
                                                    />
                                                </Grid>
                                            ) : null}
                                            <Grid size={{ xs: 12, md: 3 }}>
                                                <TextField
                                                    select
                                                    fullWidth
                                                    label="Default product"
                                                    defaultValue={String(Boolean(form.getValues("is_default")))}
                                                    {...form.register("is_default")}
                                                >
                                                    <MenuItem value="true">Default</MenuItem>
                                                    <MenuItem value="false">No</MenuItem>
                                                </TextField>
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 3 }}>
                                                <TextField
                                                    select
                                                    fullWidth
                                                    label="Status"
                                                    defaultValue={form.getValues("status") || "active"}
                                                    {...form.register("status")}
                                                >
                                                    <MenuItem value="active">Active</MenuItem>
                                                    <MenuItem value="inactive">Inactive</MenuItem>
                                                </TextField>
                                            </Grid>
                                        </Grid>
                                    </SectionCard>
                                </Grid>
                            </>
                        ) : null}
                        {kind === "savings" ? (
                            <>
                                <Grid size={{ xs: 12 }}>
                                    <SectionCard
                                        title="Product information"
                                        helper="Define the savings product identity and visibility."
                                        icon={<AddRoundedIcon color="primary" fontSize="small" />}
                                    >
                                        <Grid container spacing={2}>
                                            <Grid size={{ xs: 12, md: 4 }}>
                                                <TextField fullWidth label="Code" {...form.register("code")} />
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 8 }}>
                                                <TextField fullWidth label="Name" {...form.register("name")} />
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 4 }}>
                                                <TextField
                                                    select
                                                    fullWidth
                                                    label="Status"
                                                    defaultValue={form.getValues("status") || "active"}
                                                    {...form.register("status")}
                                                >
                                                    <MenuItem value="active">Active</MenuItem>
                                                    <MenuItem value="inactive">Inactive</MenuItem>
                                                </TextField>
                                            </Grid>
                                        </Grid>
                                    </SectionCard>
                                </Grid>

                                <Grid size={{ xs: 12 }}>
                                    <SectionCard
                                        title="Balance rules"
                                        helper="Control minimum and maximum balances per member account."
                                        icon={<SavingsRoundedIcon color="secondary" fontSize="small" />}
                                    >
                                        <Grid container spacing={2}>
                                            <Grid size={{ xs: 12, md: 4 }}>
                                                <TextField
                                                    fullWidth
                                                    type="number"
                                                    label="Min opening balance"
                                                    {...form.register("min_opening_balance", { valueAsNumber: true })}
                                                    helperText="Members must deposit this amount when opening the account."
                                                    InputProps={{ inputProps: { min: 0, step: 1 } }}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 4 }}>
                                                <TextField
                                                    fullWidth
                                                    type="number"
                                                    label="Min balance"
                                                    {...form.register("min_balance", { valueAsNumber: true })}
                                                    helperText="Account must maintain this balance before withdrawals."
                                                    InputProps={{ inputProps: { min: 0, step: 1 } }}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 4 }}>
                                                <TextField
                                                    fullWidth
                                                    type="number"
                                                    label="Maximum balance"
                                                    {...form.register("maximum_account_balance", { valueAsNumber: true })}
                                                    helperText="Leave empty for unlimited savings."
                                                    InputProps={{ inputProps: { min: 0, step: 1 } }}
                                                />
                                            </Grid>
                                        </Grid>
                                    </SectionCard>
                                </Grid>

                                <Grid size={{ xs: 12 }}>
                                    <SectionCard
                                        title="Interest configuration"
                                        helper="Capture how interest is calculated and paid."
                                        icon={<CreditScoreRoundedIcon color="info" fontSize="small" />}
                                    >
                                        <Grid container spacing={2}>
                                            <Grid size={{ xs: 12, md: 4 }}>
                                                <TextField
                                                    fullWidth
                                                    type="number"
                                                    label="Annual interest %"
                                                    {...form.register("annual_interest_rate", { valueAsNumber: true })}
                                                    helperText="Annual percentage rate for this product."
                                                    InputProps={{ inputProps: { min: 0, max: 100, step: 0.01 } }}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 4 }}>
                                                <TextField
                                                    select
                                                    fullWidth
                                                    label="Interest calculation"
                                                    defaultValue={form.getValues("interest_calculation_method") || "daily_balance"}
                                                    {...form.register("interest_calculation_method")}
                                                >
                                                    <MenuItem value="daily_balance">Daily balance</MenuItem>
                                                    <MenuItem value="average_balance">Average balance</MenuItem>
                                                    <MenuItem value="monthly_balance">Monthly balance</MenuItem>
                                                </TextField>
                                            </Grid>
                                        </Grid>
                                    </SectionCard>
                                </Grid>

                                <Grid size={{ xs: 12 }}>
                                    <SectionCard
                                        title="Withdrawal rules"
                                        helper="Control how members can withdraw funds and the fees involved."
                                        icon={<WarningAmberRoundedIcon color="warning" fontSize="small" />}
                                    >
                                        <Grid container spacing={2}>
                                            <Grid size={{ xs: 12, md: 3 }}>
                                                <TextField
                                                    fullWidth
                                                    type="number"
                                                    label="Notice days"
                                                    {...form.register("withdrawal_notice_days", { valueAsNumber: true })}
                                                    helperText="Number of days members must give before withdrawing."
                                                    InputProps={{ inputProps: { min: 0, step: 1 } }}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 3 }}>
                                                <TextField
                                                    fullWidth
                                                    type="number"
                                                    label="Min withdrawal amount"
                                                    {...form.register("minimum_withdrawal_amount", { valueAsNumber: true })}
                                                    helperText="Optional floor for withdrawals."
                                                    InputProps={{ inputProps: { min: 0, step: 1 } }}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 3 }}>
                                                <TextField
                                                    fullWidth
                                                    type="number"
                                                    label="Max withdrawal amount"
                                                    {...form.register("maximum_withdrawal_amount", { valueAsNumber: true })}
                                                    helperText="Optional ceiling for withdrawals."
                                                    InputProps={{ inputProps: { min: 0, step: 1 } }}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 3 }}>
                                                <TextField
                                                    select
                                                    fullWidth
                                                    label="Withdrawal fee type"
                                                    defaultValue={form.getValues("withdrawal_fee_type") || "flat"}
                                                    {...form.register("withdrawal_fee_type")}
                                                >
                                                    {withdrawalFeeTypeOptions.map((option) => (
                                                        <MenuItem key={option.value} value={option.value}>
                                                            {option.label}
                                                        </MenuItem>
                                                    ))}
                                                </TextField>
                                            </Grid>
                                            {withdrawalFeeType === "flat" ? (
                                                <Grid size={{ xs: 12, md: 4 }}>
                                                    <TextField
                                                        fullWidth
                                                        type="number"
                                                        label="Withdrawal fee amount"
                                                        {...form.register("withdrawal_fee_amount", { valueAsNumber: true })}
                                                        helperText="Flat fee applied per withdrawal."
                                                        InputProps={{ inputProps: { min: 0, step: 1 } }}
                                                    />
                                                </Grid>
                                            ) : (
                                                <Grid size={{ xs: 12, md: 4 }}>
                                                    <TextField
                                                        fullWidth
                                                        type="number"
                                                        label="Withdrawal fee %"
                                                        {...form.register("withdrawal_fee_percent", { valueAsNumber: true })}
                                                        helperText="Percentage of the withdrawal amount."
                                                        InputProps={{ inputProps: { min: 0, max: 100, step: 0.01 } }}
                                                    />
                                                </Grid>
                                            )}
                                            <Grid size={{ xs: 12, md: 4 }}>
                                                {accountSelect("fee_income_account_id", "Withdrawal fee income account", true)}
                                            </Grid>
                                        </Grid>
                                    </SectionCard>
                                </Grid>

                                <Grid size={{ xs: 12 }}>
                                    <SectionCard
                                        title="Accounting"
                                        helper="Map the savings product to ledger accounts."
                                        icon={<SellRoundedIcon color="success" fontSize="small" />}
                                    >
                                        <Grid container spacing={2}>
                                            <Grid size={{ xs: 12, md: 6 }}>{accountSelect("liability_account_id", "Liability account")}</Grid>
                                            <Grid size={{ xs: 12, md: 6 }}>{accountSelect("interest_expense_account_id", "Interest expense account")}</Grid>
                                        </Grid>
                                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                                            Withdrawal fee income account is configured above inside the withdrawal rules section.
                                        </Typography>
                                    </SectionCard>
                                </Grid>

                                <Grid size={{ xs: 12 }}>
                                    <SectionCard
                                        title="Controls"
                                        helper="Capture operational controls for dormancy and opening fees."
                                        icon={<RuleRoundedIcon color="action" fontSize="small" />}
                                    >
                                        <Grid container spacing={2}>
                                            <Grid size={{ xs: 12, md: 6 }}>
                                                <TextField
                                                    fullWidth
                                                    type="number"
                                                    label="Dormant after days"
                                                    {...form.register("dormant_after_days", { valueAsNumber: true })}
                                                    helperText="Number of idle days before marking the account dormant."
                                                    InputProps={{ inputProps: { min: 0, step: 1 } }}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 6 }}>
                                                <TextField
                                                    fullWidth
                                                    type="number"
                                                    label="Account opening fee"
                                                    {...form.register("account_opening_fee", { valueAsNumber: true })}
                                                    helperText="Optional fee charged when opening the account."
                                                    InputProps={{ inputProps: { min: 0, step: 1 } }}
                                                />
                                            </Grid>
                                        </Grid>
                                    </SectionCard>
                                </Grid>
                            </>
                        ) : null}
                        {kind === "shares" ? (
                            <>
                                <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Code" {...form.register("code")} /></Grid>
                                <Grid size={{ xs: 12, md: 8 }}><TextField fullWidth label="Name" {...form.register("name")} /></Grid>
                                <Grid size={{ xs: 12, md: 4 }}>{accountSelect("equity_account_id", "Equity account")}</Grid>
                                <Grid size={{ xs: 12, md: 4 }}>{accountSelect("fee_income_account_id", "Fee income account")}</Grid>
                                <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth type="number" label="Minimum shares" {...form.register("minimum_shares", { valueAsNumber: true })} /></Grid>
                                <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth type="number" label="Maximum shares" {...form.register("maximum_shares", { valueAsNumber: true })} /></Grid>
                                <Grid size={{ xs: 12, md: 4 }}><TextField select fullWidth label="Refund policy" defaultValue={String(Boolean(form.getValues("allow_refund")))} {...form.register("allow_refund")}><MenuItem value="true">Refund allowed</MenuItem><MenuItem value="false">Locked capital</MenuItem></TextField></Grid>
                                <Grid size={{ xs: 12, md: 4 }}><TextField select fullWidth label="Status" defaultValue={form.getValues("status") || "active"} {...form.register("status")}><MenuItem value="active">Active</MenuItem><MenuItem value="inactive">Inactive</MenuItem></TextField></Grid>
                            </>
                        ) : null}
                        {kind === "fees" ? (
                            <>
                                <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Code" {...form.register("code")} /></Grid>
                                <Grid size={{ xs: 12, md: 8 }}><TextField fullWidth label="Name" {...form.register("name")} /></Grid>
                                <Grid size={{ xs: 12, md: 4 }}><TextField select fullWidth label="Fee type" defaultValue={form.getValues("fee_type") || "membership_fee"} {...form.register("fee_type")}><MenuItem value="membership_fee">Membership fee</MenuItem><MenuItem value="withdrawal_fee">Withdrawal fee</MenuItem><MenuItem value="loan_processing_fee">Loan processing fee</MenuItem><MenuItem value="other">Other</MenuItem></TextField></Grid>
                                <Grid size={{ xs: 12, md: 4 }}><TextField select fullWidth label="Calculation" defaultValue={form.getValues("calculation_method") || "flat"} {...form.register("calculation_method")}><MenuItem value="flat">Flat</MenuItem><MenuItem value="percentage">Percentage</MenuItem><MenuItem value="percentage_per_period">Per period</MenuItem></TextField></Grid>
                                <Grid size={{ xs: 12, md: 4 }}>{accountSelect("income_account_id", "Income account")}</Grid>
                                <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth type="number" label="Flat amount" {...form.register("flat_amount", { valueAsNumber: true })} /></Grid>
                                <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth type="number" label="Percentage value" {...form.register("percentage_value", { valueAsNumber: true })} /></Grid>
                            </>
                        ) : null}
                        {kind === "penalties" ? (
                            <>
                                <Grid size={{ xs: 12 }}>
                                    <SectionCard
                                        title="Basic information"
                                        helper="Name the penalty and classify the type."
                                        icon={<RuleRoundedIcon color="primary" fontSize="small" />}
                                    >
                                        <Grid container spacing={2}>
                                            <Grid size={{ xs: 12, md: 4 }}>
                                                <TextField fullWidth label="Code" {...form.register("code")} />
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 8 }}>
                                                <TextField fullWidth label="Name" {...form.register("name")} />
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 4 }}>
                                                <TextField
                                                    select
                                                    fullWidth
                                                    label="Penalty type"
                                                    defaultValue={form.getValues("penalty_type") || "late_repayment"}
                                                    {...form.register("penalty_type")}
                                                >
                                                    {penaltyTypeOptions.map((option) => (
                                                        <MenuItem key={option.value} value={option.value}>
                                                            {option.label}
                                                        </MenuItem>
                                                    ))}
                                                </TextField>
                                            </Grid>
                                        </Grid>
                                    </SectionCard>
                                </Grid>

                                <Grid size={{ xs: 12 }}>
                                    <SectionCard
                                        title="Penalty rules"
                                        helper="Control when penalties start and how often they hit the ledger."
                                        icon={<WarningAmberRoundedIcon color="warning" fontSize="small" />}
                                    >
                                        <Grid container spacing={2}>
                                            <Grid size={{ xs: 12, md: 3 }}>
                                                <TextField
                                                    fullWidth
                                                    type="number"
                                                    label="Grace period (days)"
                                                    {...form.register("grace_period_days", { valueAsNumber: true })}
                                                    helperText="Days past the due date before penalties kick in."
                                                    InputProps={{ inputProps: { min: 0 } }}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 3 }}>
                                                <TextField
                                                    select
                                                    fullWidth
                                                    label="Penalty frequency"
                                                    defaultValue={form.getValues("penalty_frequency") || "per_repayment_period"}
                                                    {...form.register("penalty_frequency")}
                                                >
                                                    {penaltyFrequencyOptions.map((option) => (
                                                        <MenuItem key={option.value} value={option.value}>
                                                            {option.label}
                                                        </MenuItem>
                                                    ))}
                                                </TextField>
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 3 }}>
                                                <TextField
                                                    select
                                                    fullWidth
                                                    label="Calculation method"
                                                    defaultValue={form.getValues("calculation_method") || "flat"}
                                                    {...form.register("calculation_method")}
                                                >
                                                    <MenuItem value="flat">Flat amount</MenuItem>
                                                    <MenuItem value="percentage">Percentage</MenuItem>
                                                </TextField>
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 3 }}>
                                                <TextField
                                                    select
                                                    fullWidth
                                                    label="Calculation base"
                                                    defaultValue={form.getValues("calculation_base") || "overdue_instalment"}
                                                    {...form.register("calculation_base")}
                                                >
                                                    {penaltyCalculationBaseOptions.map((option) => (
                                                        <MenuItem key={option.value} value={option.value}>
                                                            {option.label}
                                                        </MenuItem>
                                                    ))}
                                                </TextField>
                                            </Grid>
                                        </Grid>
                                    </SectionCard>
                                </Grid>

                                <Grid size={{ xs: 12 }}>
                                    <SectionCard
                                        title="Penalty value"
                                        helper="Choose whether penalties are a flat amount or a percentage of the selected base."
                                        icon={<AddRoundedIcon color="success" fontSize="small" />}
                                    >
                                        <Grid container spacing={2}>
                                            {penaltyCalculationMethod === "percentage" ? (
                                                <Grid size={{ xs: 12, md: 6 }}>
                                                    <TextField
                                                        fullWidth
                                                        type="number"
                                                        label="Penalty rate (%)"
                                                        {...form.register("percentage_value", { valueAsNumber: true })}
                                                        helperText="Use a percentage of the selected calculation base."
                                                        InputProps={{ inputProps: { min: 0, max: 100, step: 0.01 } }}
                                                    />
                                                </Grid>
                                            ) : (
                                                <Grid size={{ xs: 12, md: 6 }}>
                                                    <TextField
                                                        fullWidth
                                                        type="number"
                                                        label="Flat amount (TSH)"
                                                        {...form.register("flat_amount", { valueAsNumber: true })}
                                                        helperText="Charge this amount when the penalty applies."
                                                        InputProps={{ inputProps: { min: 0, step: 1 } }}
                                                    />
                                                </Grid>
                                            )}
                                        </Grid>
                                    </SectionCard>
                                </Grid>

                                <Grid size={{ xs: 12 }}>
                                    <SectionCard
                                        title="Limits"
                                        helper="Cap penalty exposure either as a cash amount or as a percentage of the loan."
                                        icon={<CreditScoreRoundedIcon color="info" fontSize="small" />}
                                    >
                                        <Grid container spacing={2}>
                                            <Grid size={{ xs: 12, md: 6 }}>
                                                <TextField
                                                    fullWidth
                                                    type="number"
                                                    label="Maximum penalty amount (TSH)"
                                                    {...form.register("max_penalty_amount", { valueAsNumber: true })}
                                                    helperText="Optional upper bound for penalty cash charges."
                                                    InputProps={{ inputProps: { min: 0, step: 1 } }}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 6 }}>
                                                <TextField
                                                    fullWidth
                                                    type="number"
                                                    label="Maximum penalty % of loan"
                                                    {...form.register("max_penalty_percent", { valueAsNumber: true })}
                                                    helperText="Optional upper bound (0-100%) relative to the loan amount."
                                                    InputProps={{ inputProps: { min: 0, max: 100, step: 0.01 } }}
                                                />
                                            </Grid>
                                        </Grid>
                                    </SectionCard>
                                </Grid>

                                <Grid size={{ xs: 12 }}>
                                    <SectionCard
                                        title="Accounting"
                                        helper="Tie penalties to the correct income and receivable ledgers."
                                        icon={<SavingsRoundedIcon color="secondary" fontSize="small" />}
                                    >
                                        <Grid container spacing={2}>
                                            <Grid size={{ xs: 12, md: 6 }}>
                                                {accountSelect("income_account_id", "Income account")}
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 6 }}>
                                                {accountSelect("penalty_receivable_account_id", "Penalty receivable account", true)}
                                            </Grid>
                                        </Grid>
                                    </SectionCard>
                                </Grid>

                                <Grid size={{ xs: 12 }}>
                                    <SectionCard
                                        title="Policy controls"
                                        helper="Manage compounding and waiver behavior for the penalty."
                                        icon={<ShareRoundedIcon color="primary" fontSize="small" />}
                                    >
                                        <Grid container spacing={2}>
                                            <Grid size={{ xs: 12, md: 6 }}>
                                                <TextField
                                                    select
                                                    fullWidth
                                                    label="Compound penalty"
                                                    defaultValue={form.getValues("compound_penalty") ?? "false"}
                                                    {...form.register("compound_penalty")}
                                                    helperText="Apply penalties on previously assessed penalties."
                                                >
                                                    <MenuItem value="false">No</MenuItem>
                                                    <MenuItem value="true">Yes</MenuItem>
                                                </TextField>
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 6 }}>
                                                <TextField
                                                    select
                                                    fullWidth
                                                    label="Penalty waivable"
                                                    defaultValue={form.getValues("penalty_waivable") ?? "true"}
                                                    {...form.register("penalty_waivable")}
                                                    helperText="Allow Waiver approvals whenever servicing loans."
                                                >
                                                    <MenuItem value="false">No</MenuItem>
                                                    <MenuItem value="true">Yes</MenuItem>
                                                </TextField>
                                            </Grid>
                                        </Grid>
                                    </SectionCard>
                                </Grid>

                                <Grid size={{ xs: 12 }}>
                                    <SectionCard
                                        title="Validity"
                                        helper="Control when this policy version starts and, optionally, ends."
                                        icon={<RuleRoundedIcon color="action" fontSize="small" />}
                                    >
                                        <Grid container spacing={2}>
                                            <Grid size={{ xs: 12, md: 6 }}>
                                                <TextField
                                                    fullWidth
                                                    type="date"
                                                    label="Effective from"
                                                    InputLabelProps={{ shrink: true }}
                                                    {...form.register("effective_from")}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 6 }}>
                                                <TextField
                                                    fullWidth
                                                    type="date"
                                                    label="Effective to"
                                                    InputLabelProps={{ shrink: true }}
                                                    {...form.register("effective_to")}
                                                    helperText="Optional; leave empty for open-ended policies."
                                                />
                                            </Grid>
                                        </Grid>
                                    </SectionCard>
                                </Grid>
                            </>
                        ) : null}
                        {kind === "posting-rules" ? (
                            <>
                                <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Operation code" {...form.register("operation_code")} /></Grid>
                                <Grid size={{ xs: 12, md: 4 }}><TextField select fullWidth label="Scope" defaultValue={form.getValues("scope") || "general"} {...form.register("scope")}><MenuItem value="general">General</MenuItem><MenuItem value="savings">Savings</MenuItem><MenuItem value="shares">Shares</MenuItem><MenuItem value="loans">Loans</MenuItem><MenuItem value="dividends">Dividends</MenuItem><MenuItem value="membership">Membership</MenuItem></TextField></Grid>
                                <Grid size={{ xs: 12, md: 4 }}><TextField select fullWidth label="Active" defaultValue={String(form.getValues("is_active") ?? true)} {...form.register("is_active")}><MenuItem value="true">Active</MenuItem><MenuItem value="false">Inactive</MenuItem></TextField></Grid>
                                <Grid size={{ xs: 12 }}><TextField fullWidth label="Description" {...form.register("description")} /></Grid>
                                <Grid size={{ xs: 12, md: 6 }}>{accountSelect("debit_account_id", "Debit account")}</Grid>
                                <Grid size={{ xs: 12, md: 6 }}>{accountSelect("credit_account_id", "Credit account")}</Grid>
                            </>
                        ) : null}
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialog(null)}>Cancel</Button>
                    <Button variant="contained" onClick={() => void submitDialog()} disabled={saving}>
                        {saving ? "Saving..." : "Save configuration"}
                    </Button>
                </DialogActions>
            </MotionModal>
        );
    };

    return (
        <Stack spacing={3}>
            <MotionCard
                sx={{
                    color: "#fff",
                    background: "linear-gradient(135deg, #0A0573 0%, #1FA8E6 100%)"
                }}
            >
                <CardContent>
                    <Stack spacing={1}>
                        <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.72)" }}>
                            Product foundation
                        </Typography>
                        <Typography variant="h4">Member products, charges, and posting rules</Typography>
                        <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.82)", maxWidth: 760 }}>
                            Configure tenant-scoped savings, shares, fees, penalties, and the debit-credit mappings that keep every transaction balanced before operations go live.
                        </Typography>
                    </Stack>
                </CardContent>
            </MotionCard>

            <Alert severity="info">
                Posting rules are enforced at transaction time. If a rule is disabled or missing, deposits, withdrawals, fees, and loan actions will be blocked until configuration is restored.
            </Alert>

            <Grid container spacing={3}>
                <Grid size={{ xs: 12, xl: 6 }}>
                    <SectionCard
                        title="Loan products"
                        helper="Pricing, tenor controls, and ledger mappings that govern application, appraisal, and disbursement."
                        icon={<CreditScoreRoundedIcon color="primary" />}
                        action={<Button startIcon={<AddRoundedIcon />} variant="contained" sx={{ whiteSpace: "nowrap" }} onClick={() => openDialog("loans")}>Add loan product</Button>}
                    >
                        <DataTable
                            rows={payload.loan_products}
                            columns={[
                                { key: "name", header: "Product", render: (row) => <Button onClick={() => openDialog("loans", row)}>{row.name}</Button> },
                                { key: "code", header: "Code", render: (row) => row.code },
                                { key: "pricing", header: "Pricing", render: (row) => `${row.annual_interest_rate}% · ${row.interest_method.replace(/_/g, " ")}` },
                                { key: "range", header: "Range", render: (row) => `${formatCurrency(row.min_amount)} · ${row.max_amount ? formatCurrency(row.max_amount) : "Open cap"}` },
                                { key: "term", header: "Term", render: (row) => `${row.min_term_count} - ${row.max_term_count ?? "Open"}` }
                            ]}
                            emptyMessage={loading ? "Loading loan products..." : "No loan products configured."}
                        />
                    </SectionCard>
                </Grid>
                <Grid size={{ xs: 12, xl: 6 }}>
                    <SectionCard
                        title="Savings products"
                        helper="Compulsory and voluntary savings definitions mapped to liability accounts."
                        icon={<SavingsRoundedIcon color="primary" />}
                        action={<Button startIcon={<AddRoundedIcon />} variant="contained" sx={{ whiteSpace: "nowrap" }} onClick={() => openDialog("savings")}>Add savings product</Button>}
                    >
                        <DataTable
                            rows={payload.savings_products}
                            columns={[
                                { key: "name", header: "Product", render: (row) => <Button onClick={() => openDialog("savings", row)}>{row.name}</Button> },
                                { key: "code", header: "Code", render: (row) => row.code },
                                { key: "rules", header: "Rules", render: (row) => `Min ${formatCurrency(row.min_balance)} · Notice ${row.withdrawal_notice_days} days` },
                                { key: "account", header: "Liability GL", render: (row) => accountLabel.get(row.liability_account_id) || row.liability_account_id }
                            ]}
                            emptyMessage={loading ? "Loading savings products..." : "No savings products configured."}
                        />
                    </SectionCard>
                </Grid>
                <Grid size={{ xs: 12, xl: 6 }}>
                    <SectionCard
                        title="Share products"
                        helper="Share capital structures and refund restrictions for ownership balances."
                        icon={<ShareRoundedIcon color="primary" />}
                        action={<Button startIcon={<AddRoundedIcon />} variant="contained" sx={{ whiteSpace: "nowrap" }} onClick={() => openDialog("shares")}>Add share product</Button>}
                    >
                        <DataTable
                            rows={payload.share_products}
                            columns={[
                                { key: "name", header: "Product", render: (row) => <Button onClick={() => openDialog("shares", row)}>{row.name}</Button> },
                                { key: "code", header: "Code", render: (row) => row.code },
                                { key: "limits", header: "Limits", render: (row) => `Min ${row.minimum_shares} · Max ${row.maximum_shares ?? "Open"}` },
                                { key: "account", header: "Equity GL", render: (row) => accountLabel.get(row.equity_account_id) || row.equity_account_id }
                            ]}
                            emptyMessage={loading ? "Loading share products..." : "No share products configured."}
                        />
                    </SectionCard>
                </Grid>
                <Grid size={{ xs: 12, xl: 6 }}>
                    <SectionCard
                        title="Fee rules"
                        helper="Membership, withdrawal, and processing fees with explicit income mapping."
                        icon={<SellRoundedIcon color="primary" />}
                        action={<Button startIcon={<AddRoundedIcon />} variant="contained" sx={{ whiteSpace: "nowrap" }} onClick={() => openDialog("fees")}>Add fee rule</Button>}
                    >
                        <DataTable
                            rows={payload.fee_rules}
                            columns={[
                                { key: "name", header: "Rule", render: (row) => <Button onClick={() => openDialog("fees", row)}>{row.name}</Button> },
                                { key: "type", header: "Type", render: (row) => row.fee_type.replace(/_/g, " ") },
                                { key: "value", header: "Value", render: (row) => row.calculation_method === "flat" ? formatCurrency(row.flat_amount) : `${row.percentage_value}%` },
                                { key: "account", header: "Income GL", render: (row) => accountLabel.get(row.income_account_id) || row.income_account_id }
                            ]}
                            emptyMessage={loading ? "Loading fee rules..." : "No fee rules configured."}
                        />
                    </SectionCard>
                </Grid>
                <Grid size={{ xs: 12, xl: 6 }}>
                    <SectionCard
                        title="Penalty rules"
                        helper="Late repayment and arrears penalties mapped to revenue accounts."
                        icon={<WarningAmberRoundedIcon color="primary" />}
                        action={<Button startIcon={<AddRoundedIcon />} variant="contained" sx={{ whiteSpace: "nowrap" }} onClick={() => openDialog("penalties")}>Add penalty rule</Button>}
                    >
                        <DataTable
                            rows={payload.penalty_rules}
                            columns={[
                                { key: "name", header: "Rule", render: (row) => <Button onClick={() => openDialog("penalties", row)}>{row.name}</Button> },
                                { key: "type", header: "Type", render: (row) => row.penalty_type.replace(/_/g, " ") },
                                { key: "value", header: "Value", render: (row) => row.calculation_method === "flat" ? formatCurrency(row.flat_amount) : `${row.percentage_value}%` },
                                { key: "account", header: "Income GL", render: (row) => accountLabel.get(row.income_account_id) || row.income_account_id }
                            ]}
                            emptyMessage={loading ? "Loading penalty rules..." : "No penalty rules configured."}
                        />
                    </SectionCard>
                </Grid>
                <Grid size={{ xs: 12 }}>
                    <SectionCard
                        title="Posting rules"
                        helper="Operation-to-ledger mapping that must exist before any money movement can post."
                        icon={<RuleRoundedIcon color="primary" />}
                        action={<Button startIcon={<AddRoundedIcon />} variant="contained" sx={{ whiteSpace: "nowrap" }} onClick={() => openDialog("posting-rules")}>Add posting rule</Button>}
                    >
                        <DataTable
                            rows={payload.posting_rules}
                            columns={[
                                { key: "operation", header: "Operation", render: (row) => <Button onClick={() => openDialog("posting-rules", row)}>{row.operation_code}</Button> },
                                { key: "scope", header: "Scope", render: (row) => row.scope },
                                { key: "debit", header: "Debit", render: (row) => accountLabel.get(row.debit_account_id) || row.debit_account_id },
                                { key: "credit", header: "Credit", render: (row) => accountLabel.get(row.credit_account_id) || row.credit_account_id }
                            ]}
                            emptyMessage={loading ? "Loading posting rules..." : "No posting rules configured."}
                        />
                    </SectionCard>
                </Grid>
            </Grid>
            {renderProductDialog()}
        </Stack>
    );
}
