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

import { useAuth } from "../auth/AuthProvider";
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
        setDialog({ kind, record: record || null });
        form.reset(record ? { ...record } as Record<string, string | number | boolean | null> : {});
    };

    const submitDialog = form.handleSubmit(async (values) => {
        if (!dialog) {
            return;
        }

        setSaving(true);

        try {
            const isEdit = Boolean(dialog.record && "id" in dialog.record);
            const id = dialog.record && "id" in dialog.record ? dialog.record.id : null;

            switch (dialog.kind) {
                case "loans":
                    if (isEdit && id) {
                        await api.patch<LoanProductsResponse>(`${endpoints.products.loans()}/${id}`, values);
                    } else {
                        await api.post<LoanProductsResponse>(endpoints.products.loans(), values);
                    }
                    break;
                case "savings":
                    if (isEdit && id) {
                        await api.patch<SavingsProductsResponse>(`${endpoints.products.savings()}/${id}`, values);
                    } else {
                        await api.post<SavingsProductsResponse>(endpoints.products.savings(), values);
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
                        await api.patch<PenaltyRulesResponse>(`${endpoints.products.penalties()}/${id}`, values);
                    } else {
                        await api.post<PenaltyRulesResponse>(endpoints.products.penalties(), values);
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

        const accountSelect = (name: string, label: string) => (
            <TextField select fullWidth label={label} defaultValue={form.getValues(name) || ""} {...form.register(name)}>
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
                                <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Code" {...form.register("code")} /></Grid>
                                <Grid size={{ xs: 12, md: 8 }}><TextField fullWidth label="Name" {...form.register("name")} /></Grid>
                                <Grid size={{ xs: 12 }}><TextField fullWidth label="Description" {...form.register("description")} /></Grid>
                                <Grid size={{ xs: 12, md: 3 }}><TextField select fullWidth label="Interest method" defaultValue={form.getValues("interest_method") || "reducing_balance"} {...form.register("interest_method")}><MenuItem value="reducing_balance">Reducing balance</MenuItem><MenuItem value="flat">Flat</MenuItem></TextField></Grid>
                                <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth type="number" label="Annual interest %" {...form.register("annual_interest_rate", { valueAsNumber: true })} /></Grid>
                                <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth type="number" label="Min amount" {...form.register("min_amount", { valueAsNumber: true })} /></Grid>
                                <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth type="number" label="Max amount" {...form.register("max_amount", { valueAsNumber: true })} /></Grid>
                                <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth type="number" label="Min term" {...form.register("min_term_count", { valueAsNumber: true })} /></Grid>
                                <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth type="number" label="Max term" {...form.register("max_term_count", { valueAsNumber: true })} /></Grid>
                                <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth type="number" label="Insurance %" {...form.register("insurance_rate", { valueAsNumber: true })} /></Grid>
                                <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth type="number" label="Required guarantors" {...form.register("required_guarantors_count", { valueAsNumber: true })} /></Grid>
                                <Grid size={{ xs: 12, md: 3 }}>{accountSelect("receivable_account_id", "Receivable account")}</Grid>
                                <Grid size={{ xs: 12, md: 3 }}>{accountSelect("interest_income_account_id", "Interest income account")}</Grid>
                                <Grid size={{ xs: 12, md: 3 }}>{accountSelect("fee_income_account_id", "Fee income account")}</Grid>
                                <Grid size={{ xs: 12, md: 3 }}>{accountSelect("penalty_income_account_id", "Penalty income account")}</Grid>
                                <Grid size={{ xs: 12, md: 6 }}><TextField select fullWidth label="Default product" defaultValue={String(Boolean(form.getValues("is_default")))} {...form.register("is_default")}><MenuItem value="true">Default</MenuItem><MenuItem value="false">No</MenuItem></TextField></Grid>
                                <Grid size={{ xs: 12, md: 6 }}><TextField select fullWidth label="Status" defaultValue={form.getValues("status") || "active"} {...form.register("status")}><MenuItem value="active">Active</MenuItem><MenuItem value="inactive">Inactive</MenuItem></TextField></Grid>
                            </>
                        ) : null}
                        {kind === "savings" ? (
                            <>
                                <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Code" {...form.register("code")} /></Grid>
                                <Grid size={{ xs: 12, md: 8 }}><TextField fullWidth label="Name" {...form.register("name")} /></Grid>
                                <Grid size={{ xs: 12, md: 4 }}>{accountSelect("liability_account_id", "Liability account")}</Grid>
                                <Grid size={{ xs: 12, md: 4 }}>{accountSelect("fee_income_account_id", "Withdrawal fee income")}</Grid>
                                <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth type="number" label="Min opening balance" {...form.register("min_opening_balance", { valueAsNumber: true })} /></Grid>
                                <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth type="number" label="Min balance" {...form.register("min_balance", { valueAsNumber: true })} /></Grid>
                                <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth type="number" label="Notice days" {...form.register("withdrawal_notice_days", { valueAsNumber: true })} /></Grid>
                                <Grid size={{ xs: 12, md: 4 }}><TextField select fullWidth label="Status" defaultValue={form.getValues("status") || "active"} {...form.register("status")}><MenuItem value="active">Active</MenuItem><MenuItem value="inactive">Inactive</MenuItem></TextField></Grid>
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
                                <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Code" {...form.register("code")} /></Grid>
                                <Grid size={{ xs: 12, md: 8 }}><TextField fullWidth label="Name" {...form.register("name")} /></Grid>
                                <Grid size={{ xs: 12, md: 4 }}><TextField select fullWidth label="Penalty type" defaultValue={form.getValues("penalty_type") || "late_repayment"} {...form.register("penalty_type")}><MenuItem value="late_repayment">Late repayment</MenuItem><MenuItem value="arrears">Arrears</MenuItem><MenuItem value="other">Other</MenuItem></TextField></Grid>
                                <Grid size={{ xs: 12, md: 4 }}><TextField select fullWidth label="Calculation" defaultValue={form.getValues("calculation_method") || "flat"} {...form.register("calculation_method")}><MenuItem value="flat">Flat</MenuItem><MenuItem value="percentage">Percentage</MenuItem><MenuItem value="percentage_per_period">Per period</MenuItem></TextField></Grid>
                                <Grid size={{ xs: 12, md: 4 }}>{accountSelect("income_account_id", "Income account")}</Grid>
                                <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth type="number" label="Flat amount" {...form.register("flat_amount", { valueAsNumber: true })} /></Grid>
                                <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth type="number" label="Percentage value" {...form.register("percentage_value", { valueAsNumber: true })} /></Grid>
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
