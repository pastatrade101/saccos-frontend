import { MotionCard, MotionModal } from "../ui/motion";
import AddCircleOutlineRoundedIcon from "@mui/icons-material/AddCircleOutlineRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import MonetizationOnOutlinedIcon from "@mui/icons-material/MonetizationOnOutlined";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import PolicyOutlinedIcon from "@mui/icons-material/PolicyOutlined";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Grid,
    MenuItem,
    Stack,
    TextField,
    Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { useAuth } from "../auth/AuthProvider";
import { AppLoader } from "../components/AppLoader";
import { DataTable, type Column } from "../components/DataTable";
import { useToast } from "../components/Toast";
import { api, getApiErrorMessage } from "../lib/api";
import {
    endpoints,
    type CreateDividendCycleRequest,
    type DividendApprovalRequest,
    type DividendCycleDetailResponse,
    type DividendCyclesResponse,
    type DividendOptionsResponse,
    type DividendPaymentRequest
} from "../lib/endpoints";
import type { DividendAllocation, DividendComponent, DividendCycle, DividendSnapshot } from "../types/api";
import { formatCurrency, formatDate, formatRole } from "../utils/format";

const componentFormSchema = z.object({
    type: z.enum(["share_dividend", "savings_interest_bonus", "patronage_refund"]),
    basis_method: z.enum([
        "end_balance",
        "average_daily_balance",
        "average_monthly_balance",
        "minimum_balance",
        "total_interest_paid",
        "total_fees_paid",
        "transaction_volume"
    ]),
    distribution_mode: z.enum(["rate", "fixed_pool"]),
    rate_percent: z.coerce.number().min(0).max(100).optional(),
    pool_amount: z.coerce.number().min(0).optional(),
    retained_earnings_account_id: z.string().uuid(),
    dividends_payable_account_id: z.string().uuid(),
    payout_account_id: z.string().uuid().optional().or(z.literal("")),
    reserve_account_id: z.string().uuid().optional().or(z.literal("")),
    active_only: z.enum(["true", "false"]).default("true"),
    min_membership_months: z.coerce.number().min(0).default(0),
    minimum_shares: z.coerce.number().min(0).default(0),
    max_par_days: z.coerce.number().min(0).default(0),
    min_contributions_count: z.coerce.number().min(0).default(0),
    require_kyc_completed: z.enum(["true", "false"]).default("false"),
    exclude_suspended_exited: z.enum(["true", "false"]).default("true"),
    rounding_increment: z.coerce.number().min(1).default(1),
    minimum_payout_threshold: z.coerce.number().min(0).default(0),
    max_payout_cap: z.coerce.number().min(0).default(0),
    residual_handling: z.enum(["carry_to_retained_earnings", "allocate_pro_rata", "allocate_to_reserve"]).default("carry_to_retained_earnings")
}).superRefine((value, ctx) => {
    if (value.distribution_mode === "rate" && value.rate_percent === undefined) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["rate_percent"],
            message: "Rate is required for RATE mode."
        });
    }

    if (value.distribution_mode === "fixed_pool" && value.pool_amount === undefined) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["pool_amount"],
            message: "Pool amount is required for FIXED POOL mode."
        });
    }
});

const createCycleSchema = z.object({
    branch_id: z.string().uuid().optional().or(z.literal("")),
    period_label: z.string().min(3),
    start_date: z.string().min(1),
    end_date: z.string().min(1),
    declaration_date: z.string().min(1),
    record_date: z.string().optional().or(z.literal("")),
    payment_date: z.string().optional().or(z.literal("")),
    required_checker_count: z.coerce.number().int().min(1).max(5),
    components: z.array(componentFormSchema).min(1)
});

type CreateCycleFormValues = z.infer<typeof createCycleSchema>;

const defaultComponent = (): CreateCycleFormValues["components"][number] => ({
    type: "share_dividend",
    basis_method: "average_daily_balance",
    distribution_mode: "rate",
    rate_percent: 10,
    pool_amount: undefined,
    retained_earnings_account_id: "",
    dividends_payable_account_id: "",
    payout_account_id: "",
    reserve_account_id: "",
    active_only: "true",
    min_membership_months: 0,
    minimum_shares: 0,
    max_par_days: 0,
    min_contributions_count: 0,
    require_kyc_completed: "false",
    exclude_suspended_exited: "true",
    rounding_increment: 1,
    minimum_payout_threshold: 0,
    max_payout_cap: 0,
    residual_handling: "carry_to_retained_earnings"
});

function MetricCard({
    label,
    value,
    helper,
    icon
}: {
    label: string;
    value: string;
    helper: string;
    icon: React.ReactNode;
}) {
    return (
        <MotionCard variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
                <Stack direction="row" justifyContent="space-between" spacing={2}>
                    <Box>
                        <Typography variant="overline" color="text.secondary">
                            {label}
                        </Typography>
                        <Typography variant="h5" sx={{ mt: 0.5 }}>
                            {value}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                            {helper}
                        </Typography>
                    </Box>
                    <Box sx={{ color: "primary.main" }}>{icon}</Box>
                </Stack>
            </CardContent>
        </MotionCard>
    );
}

function parseCsv(text: string): Array<Record<string, string>> {
    const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    if (lines.length < 2) {
        return [];
    }

    const splitCsvLine = (line: string) => {
        const values: string[] = [];
        let current = "";
        let inQuotes = false;

        for (let index = 0; index < line.length; index += 1) {
            const char = line[index];
            const nextChar = line[index + 1];

            if (char === "\"") {
                if (inQuotes && nextChar === "\"") {
                    current += "\"";
                    index += 1;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === "," && !inQuotes) {
                values.push(current.trim());
                current = "";
            } else {
                current += char;
            }
        }

        values.push(current.trim());
        return values.map((value) => value.replace(/^"(.*)"$/, "$1").trim());
    };

    const headers = splitCsvLine(lines[0]);

    return lines.slice(1).map((line) => {
        const values = splitCsvLine(line);
        return headers.reduce<Record<string, string>>((record, header, index) => {
            record[header] = values[index] || "";
            return record;
        }, {});
    });
}

export function DividendsPage() {
    const theme = useTheme();
    const { pushToast } = useToast();
    const { profile, selectedTenantId, selectedTenantName } = useAuth();
    const [cycles, setCycles] = useState<DividendCycle[]>([]);
    const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
    const [selectedCycleDetail, setSelectedCycleDetail] = useState<DividendCycleDetailResponse["data"] | null>(null);
    const [options, setOptions] = useState<DividendOptionsResponse["data"] | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [actionDialog, setActionDialog] = useState<null | {
        type: "approve" | "reject" | "pay";
    }>(null);
    const [actionNotes, setActionNotes] = useState("");
    const [paymentMethod, setPaymentMethod] = useState<DividendPaymentRequest["payment_method"]>("reinvest_to_shares");
    const [paymentReference, setPaymentReference] = useState("");
    const importInputRef = useRef<HTMLInputElement | null>(null);

    const canManageCycles = Boolean(profile?.role === "branch_manager");
    const canApproveAndPay = Boolean(profile?.role === "super_admin");

    const form = useForm<CreateCycleFormValues>({
        resolver: zodResolver(createCycleSchema),
        defaultValues: {
            branch_id: "",
            period_label: "",
            start_date: "",
            end_date: "",
            declaration_date: "",
            record_date: "",
            payment_date: "",
            required_checker_count: 1,
            components: [defaultComponent()]
        }
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "components"
    });

    const loadCycles = async () => {
        if (!selectedTenantId) {
            setLoading(false);
            return;
        }

        setLoading(true);

        try {
            const [{ data: cyclesResponse }, { data: optionsResponse }] = await Promise.all([
                api.get<DividendCyclesResponse>(endpoints.dividends.cycles(), {
                    params: { tenant_id: selectedTenantId, page: 1, limit: 100 }
                }),
                api.get<DividendOptionsResponse>(endpoints.dividends.options())
            ]);

            setCycles(cyclesResponse.data || []);
            setOptions(optionsResponse.data);
            setSelectedCycleId((current) => current || cyclesResponse.data?.[0]?.id || null);
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to load dividend workspace",
                message: getApiErrorMessage(error)
            });
        } finally {
            setLoading(false);
        }
    };

    const loadCycleDetail = async (cycleId: string) => {
        try {
            const { data } = await api.get<DividendCycleDetailResponse>(endpoints.dividends.cycle(cycleId));
            setSelectedCycleDetail(data.data);
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to load cycle detail",
                message: getApiErrorMessage(error)
            });
        }
    };

    useEffect(() => {
        void loadCycles();
    }, [selectedTenantId]);

    useEffect(() => {
        if (selectedCycleId) {
            void loadCycleDetail(selectedCycleId);
        } else {
            setSelectedCycleDetail(null);
        }
    }, [selectedCycleId]);

    const accountOptions = options?.accounts || [];
    const branchOptions = options?.branches || [];

    const branchCodeMap = useMemo(() => new Map(
        branchOptions.map((branch) => [branch.code.trim().toLowerCase(), branch.id])
    ), [branchOptions]);

    const accountCodeMap = useMemo(() => new Map(
        accountOptions.map((account) => [account.account_code.trim().toLowerCase(), account.id])
    ), [accountOptions]);

    const summary = useMemo(() => ({
        total: cycles.length,
        draft: cycles.filter((cycle) => cycle.status === "draft").length,
        approved: cycles.filter((cycle) => cycle.status === "approved").length,
        paid: cycles.filter((cycle) => cycle.status === "paid" || cycle.status === "closed").length
    }), [cycles]);

    const approvalQueue = useMemo(
        () => cycles.filter((cycle) => cycle.status === "allocated" && cycle.submitted_for_approval_at),
        [cycles]
    );

    const allocationNameMap = useMemo(() => {
        const map = new Map<string, string>();
        (selectedCycleDetail?.snapshots || []).forEach((snapshot) => {
            const memberName = typeof snapshot.snapshot_json?.member_name === "string"
                ? snapshot.snapshot_json.member_name
                : snapshot.member_id;
            map.set(snapshot.member_id, memberName);
        });
        return map;
    }, [selectedCycleDetail?.snapshots]);

    const cycleColumns: Column<DividendCycle>[] = [
        { key: "period", header: "Period", render: (row) => row.period_label },
        { key: "status", header: "Status", render: (row) => <Chip size="small" label={row.status.toUpperCase()} color={row.status === "approved" ? "success" : row.status === "paid" || row.status === "closed" ? "primary" : "default"} /> },
        { key: "dates", header: "Window", render: (row) => `${formatDate(row.start_date)} - ${formatDate(row.end_date)}` },
        { key: "version", header: "Version", render: (row) => `v${row.config_version}` },
        { key: "action", header: "Action", render: (row) => <Button size="small" variant="outlined" onClick={() => setSelectedCycleId(row.id)}>Open</Button> }
    ];

    const allocationColumns: Column<DividendAllocation>[] = [
        { key: "member", header: "Member", render: (row) => allocationNameMap.get(row.member_id) || row.member_id },
        { key: "basis", header: "Basis", render: (row) => formatCurrency(row.basis_value) },
        { key: "payout", header: "Payout", render: (row) => formatCurrency(row.payout_amount) },
        { key: "status", header: "Status", render: (row) => row.status },
        { key: "paid_at", header: "Paid At", render: (row) => row.paid_at ? formatDate(row.paid_at) : "Pending" }
    ];

    const submitCreateCycle = form.handleSubmit(async (values) => {
        if (!selectedTenantId) {
            return;
        }

        setSubmitting(true);

        try {
            const payload: CreateDividendCycleRequest = {
                tenant_id: selectedTenantId,
                branch_id: values.branch_id || null,
                period_label: values.period_label,
                start_date: values.start_date,
                end_date: values.end_date,
                declaration_date: values.declaration_date,
                record_date: values.record_date || values.end_date,
                payment_date: values.payment_date || null,
                required_checker_count: values.required_checker_count,
                components: values.components.map((component) => ({
                    type: component.type,
                    basis_method: component.basis_method,
                    distribution_mode: component.distribution_mode,
                    rate_percent: component.distribution_mode === "rate" ? Number(component.rate_percent || 0) : null,
                    pool_amount: component.distribution_mode === "fixed_pool" ? Number(component.pool_amount || 0) : null,
                    retained_earnings_account_id: component.retained_earnings_account_id,
                    dividends_payable_account_id: component.dividends_payable_account_id,
                    payout_account_id: component.payout_account_id || null,
                    reserve_account_id: component.reserve_account_id || null,
                    eligibility_rules_json: {
                        active_only: component.active_only === "true",
                        min_membership_months: Number(component.min_membership_months || 0),
                        minimum_shares: Number(component.minimum_shares || 0),
                        max_par_days: Number(component.max_par_days || 0),
                        min_contributions_count: Number(component.min_contributions_count || 0),
                        require_kyc_completed: component.require_kyc_completed === "true",
                        exclude_suspended_exited: component.exclude_suspended_exited === "true"
                    },
                    rounding_rules_json: {
                        rounding_increment: Number(component.rounding_increment || 1),
                        minimum_payout_threshold: Number(component.minimum_payout_threshold || 0),
                        max_payout_cap: Number(component.max_payout_cap || 0),
                        residual_handling: component.residual_handling
                    }
                }))
            };

            const { data } = await api.post<DividendCycleDetailResponse>(endpoints.dividends.cycles(), payload);
            pushToast({
                type: "success",
                title: "Dividend cycle created",
                message: `${data.data.cycle.period_label} was created in draft mode.`
            });
            setShowCreateDialog(false);
            form.reset({
                branch_id: "",
                period_label: "",
                start_date: "",
                end_date: "",
                declaration_date: "",
                record_date: "",
                payment_date: "",
                required_checker_count: 1,
                components: [defaultComponent()]
            });
            await loadCycles();
            setSelectedCycleId(data.data.cycle.id);
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to create dividend cycle",
                message: getApiErrorMessage(error)
            });
        } finally {
            setSubmitting(false);
        }
    });

    const runCycleAction = async (type: "freeze" | "allocate" | "submit" | "approve" | "reject" | "pay" | "close") => {
        if (!selectedCycleId) {
            return;
        }

        setSubmitting(true);

        try {
            if (type === "freeze") {
                await api.post(endpoints.dividends.freeze(selectedCycleId));
            } else if (type === "allocate") {
                await api.post(endpoints.dividends.allocate(selectedCycleId));
            } else if (type === "submit") {
                await api.post(endpoints.dividends.submit(selectedCycleId));
            } else if (type === "approve") {
                const payload: DividendApprovalRequest = { notes: actionNotes || null };
                await api.post(endpoints.dividends.approve(selectedCycleId), payload);
            } else if (type === "reject") {
                const payload: DividendApprovalRequest = { notes: actionNotes || null };
                await api.post(endpoints.dividends.reject(selectedCycleId), payload);
            } else if (type === "pay") {
                const payload: DividendPaymentRequest = {
                    payment_method: paymentMethod,
                    reference: paymentReference || null,
                    description: actionNotes || null
                };
                await api.post(endpoints.dividends.pay(selectedCycleId), payload);
            } else if (type === "close") {
                await api.post(endpoints.dividends.close(selectedCycleId));
            }

            pushToast({
                type: "success",
                title: "Dividend cycle updated",
                message: `The cycle action ${type} completed successfully.`
            });
            setActionDialog(null);
            setActionNotes("");
            setPaymentReference("");
            await loadCycles();
            await loadCycleDetail(selectedCycleId);
        } catch (error) {
            pushToast({
                type: "error",
                title: "Dividend action failed",
                message: getApiErrorMessage(error)
            });
        } finally {
            setSubmitting(false);
        }
    };

    const openImportPicker = () => {
        importInputRef.current?.click();
    };

    const importCsvTemplate = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";

        if (!file) {
            return;
        }

        if (!accountOptions.length) {
            pushToast({
                type: "error",
                title: "Dividend options not ready",
                message: "Load the dividend workspace first so account mappings are available."
            });
            return;
        }

        try {
            const text = await file.text();
            const rows = parseCsv(text);

            if (!rows.length) {
                throw new Error("The CSV file does not contain any data rows.");
            }

            const firstRow = rows[0];
            const branchCode = firstRow.branch_code?.trim().toLowerCase() || "";
            const branchId = branchCode ? branchCodeMap.get(branchCode) || "" : "";

            if (branchCode && !branchId) {
                throw new Error(`Branch code "${firstRow.branch_code}" was not found in this tenant.`);
            }

            const importedComponents = rows.map((row, index) => {
                const retainedAccountId = accountCodeMap.get((row.retained_earnings_account_code || "").trim().toLowerCase());
                const dividendsPayableAccountId = accountCodeMap.get((row.dividends_payable_account_code || "").trim().toLowerCase());
                const payoutAccountId = row.payout_account_code
                    ? accountCodeMap.get(row.payout_account_code.trim().toLowerCase()) || ""
                    : "";
                const reserveAccountId = row.reserve_account_code
                    ? accountCodeMap.get(row.reserve_account_code.trim().toLowerCase()) || ""
                    : "";

                if (!retainedAccountId) {
                    throw new Error(`Row ${index + 2}: retained earnings account code "${row.retained_earnings_account_code}" was not found.`);
                }

                if (!dividendsPayableAccountId) {
                    throw new Error(`Row ${index + 2}: dividends payable account code "${row.dividends_payable_account_code}" was not found.`);
                }

                if (row.payout_account_code && !payoutAccountId) {
                    throw new Error(`Row ${index + 2}: payout account code "${row.payout_account_code}" was not found.`);
                }

                if (row.reserve_account_code && !reserveAccountId) {
                    throw new Error(`Row ${index + 2}: reserve account code "${row.reserve_account_code}" was not found.`);
                }

                return {
                    type: row.component_type as CreateCycleFormValues["components"][number]["type"],
                    basis_method: row.basis_method as CreateCycleFormValues["components"][number]["basis_method"],
                    distribution_mode: row.distribution_mode as CreateCycleFormValues["components"][number]["distribution_mode"],
                    rate_percent: row.rate_percent ? Number(row.rate_percent) : undefined,
                    pool_amount: row.pool_amount ? Number(row.pool_amount) : undefined,
                    retained_earnings_account_id: retainedAccountId,
                    dividends_payable_account_id: dividendsPayableAccountId,
                    payout_account_id: payoutAccountId,
                    reserve_account_id: reserveAccountId,
                    active_only: (String(row.active_only || "true").toLowerCase() === "false" ? "false" : "true") as "true" | "false",
                    min_membership_months: Number(row.min_membership_months || 0),
                    minimum_shares: Number(row.minimum_shares || 0),
                    max_par_days: Number(row.max_par_days || 0),
                    min_contributions_count: Number(row.min_contributions_count || 0),
                    require_kyc_completed: (String(row.require_kyc_completed || "false").toLowerCase() === "true" ? "true" : "false") as "true" | "false",
                    exclude_suspended_exited: (String(row.exclude_suspended_exited || "true").toLowerCase() === "false" ? "false" : "true") as "true" | "false",
                    rounding_increment: Number(row.rounding_increment || 1),
                    minimum_payout_threshold: Number(row.minimum_payout_threshold || 0),
                    max_payout_cap: Number(row.max_payout_cap || 0),
                    residual_handling: (row.residual_handling || "carry_to_retained_earnings") as CreateCycleFormValues["components"][number]["residual_handling"]
                };
            });

            form.reset({
                branch_id: branchId,
                period_label: firstRow.period_label || "",
                start_date: firstRow.start_date || "",
                end_date: firstRow.end_date || "",
                declaration_date: firstRow.declaration_date || "",
                record_date: firstRow.record_date || "",
                payment_date: firstRow.payment_date || "",
                required_checker_count: Number(firstRow.required_checker_count || 1),
                components: importedComponents
            });

            setShowCreateDialog(true);
            pushToast({
                type: "success",
                title: "Dividend CSV imported",
                message: `${rows.length} component row(s) loaded into the cycle form.`
            });
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to import dividend CSV",
                message: error instanceof Error ? error.message : "The CSV file could not be parsed."
            });
        }
    };

    const selectedCycle = selectedCycleDetail?.cycle;

    return (
        <Stack spacing={3}>
            <MotionCard
                variant="outlined"
                sx={{
                    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)}, ${alpha(theme.palette.background.paper, 0.94)})`
                }}
            >
                <CardContent>
                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
                        <Box>
                            <Typography variant="h5">Dividend Administration</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 840 }}>
                                Branch managers prepare dividend cycles and freeze auditable balance snapshots. Tenant super admins approve, pay, and close the cycle under maker-checker control.
                            </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                            <input
                                ref={importInputRef}
                                type="file"
                                accept=".csv,text/csv"
                                hidden
                                onChange={(event) => void importCsvTemplate(event)}
                            />
                            <Button
                                component="a"
                                href="/dividend-cycle-template.csv"
                                download="dividend-cycle-template.csv"
                                variant="outlined"
                                startIcon={<DownloadRoundedIcon />}
                            >
                                Download CSV Template
                            </Button>
                            {canManageCycles ? (
                                <>
                                    <Button variant="outlined" startIcon={<UploadFileRoundedIcon />} onClick={openImportPicker}>
                                        Import CSV
                                    </Button>
                                    <Button variant="contained" startIcon={<AddCircleOutlineRoundedIcon />} onClick={() => setShowCreateDialog(true)}>
                                        Create Cycle
                                    </Button>
                                </>
                            ) : null}
                            <Chip label={selectedTenantName || "Tenant workspace"} variant="outlined" />
                            <Chip label={`Role: ${profile ? formatRole(profile.role) : "Setup"}`} variant="outlined" />
                        </Stack>
                    </Stack>
                </CardContent>
            </MotionCard>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MetricCard label="Cycles" value={String(summary.total)} helper="Dividend runs created for this tenant." icon={<PolicyOutlinedIcon />} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MetricCard label="Draft / Frozen" value={`${summary.draft}`} helper="Cycles still being configured or snapshotted." icon={<MonetizationOnOutlinedIcon />} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MetricCard label="Approved" value={`${summary.approved}`} helper="Liability declared and waiting payment." icon={<CheckCircleOutlineRoundedIcon />} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MetricCard label="Paid / Closed" value={`${summary.paid}`} helper="Completed dividend payout cycles." icon={<PaidOutlinedIcon />} />
                </Grid>
            </Grid>

            {profile?.role === "super_admin" ? (
                <MotionCard variant="outlined">
                    <CardContent>
                        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
                            <Box>
                                <Typography variant="h6">Approval Queue</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                    Dividend cycles submitted by branch managers and waiting for tenant super admin review.
                                </Typography>
                            </Box>
                            <Chip label={`${approvalQueue.length} waiting`} color={approvalQueue.length ? "warning" : "default"} />
                        </Stack>
                        <Stack spacing={1.25} sx={{ mt: 2 }}>
                            {approvalQueue.length ? approvalQueue.map((cycle) => (
                                <Box
                                    key={cycle.id}
                                    sx={{
                                        p: 1.5,
                                        border: `1px solid ${theme.palette.divider}`,
                                        borderRadius: 2,
                                        display: "flex",
                                        flexDirection: { xs: "column", md: "row" },
                                        alignItems: { xs: "flex-start", md: "center" },
                                        justifyContent: "space-between",
                                        gap: 1.5
                                    }}
                                >
                                    <Box>
                                        <Typography variant="subtitle2">{cycle.period_label}</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Submitted {formatDate(cycle.submitted_for_approval_at || cycle.created_at)} • {formatDate(cycle.start_date)} - {formatDate(cycle.end_date)}
                                        </Typography>
                                    </Box>
                                    <Button size="small" variant="outlined" onClick={() => setSelectedCycleId(cycle.id)}>
                                        Review Queue Item
                                    </Button>
                                </Box>
                            )) : (
                                <Alert severity="info" variant="outlined">
                                    No dividend cycles are currently waiting for super admin approval.
                                </Alert>
                            )}
                        </Stack>
                    </CardContent>
                </MotionCard>
            ) : null}

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, xl: 5 }}>
                    <MotionCard variant="outlined">
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Dividend Cycles
                            </Typography>
                            {loading ? (
                                <AppLoader fullscreen={false} minHeight={260} message="Loading dividend cycles..." />
                            ) : (
                                <DataTable rows={cycles} columns={cycleColumns} emptyMessage="No dividend cycles yet." />
                            )}
                        </CardContent>
                    </MotionCard>
                </Grid>
                <Grid size={{ xs: 12, xl: 7 }}>
                    <MotionCard variant="outlined" sx={{ height: "100%" }}>
                        <CardContent>
                            {selectedCycle ? (
                                <Stack spacing={2.5}>
                                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
                                        <Box>
                                            <Typography variant="h6">{selectedCycle.period_label}</Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                {formatDate(selectedCycle.start_date)} - {formatDate(selectedCycle.end_date)} • Version {selectedCycle.config_version}
                                            </Typography>
                                        </Box>
                                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                            <Chip label={selectedCycle.status.toUpperCase()} color={selectedCycle.status === "approved" ? "success" : selectedCycle.status === "paid" || selectedCycle.status === "closed" ? "primary" : "default"} />
                                            <Chip label={`${selectedCycle.required_checker_count} checker(s)`} variant="outlined" />
                                            {selectedCycle.status === "allocated" && selectedCycle.submitted_for_approval_at ? (
                                                <Chip label="Waiting for Super Admin Approval" color="warning" variant="filled" />
                                            ) : null}
                                        </Stack>
                                    </Stack>

                                    <Grid container spacing={1.5}>
                                        {[
                                            ["Declaration", formatDate(selectedCycle.declaration_date)],
                                            ["Record", formatDate(selectedCycle.record_date || selectedCycle.end_date)],
                                            ["Payment", selectedCycle.payment_date ? formatDate(selectedCycle.payment_date) : "Planned later"],
                                            ["Config Hash", selectedCycle.config_hash.slice(0, 12)]
                                        ].map(([label, value]) => (
                                            <Grid key={label} size={{ xs: 12, sm: 6 }}>
                                                <Box sx={{ p: 1.5, border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
                                                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                                                    <Typography variant="body2" sx={{ mt: 0.5 }}>{value}</Typography>
                                                </Box>
                                            </Grid>
                                        ))}
                                    </Grid>

                                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                        {selectedCycle.status === "draft" && canManageCycles ? (
                                            <Button variant="outlined" onClick={() => void runCycleAction("freeze")} disabled={submitting}>
                                                Freeze Snapshot
                                            </Button>
                                        ) : null}
                                        {selectedCycle.status === "frozen" && canManageCycles ? (
                                            <Button variant="outlined" onClick={() => void runCycleAction("allocate")} disabled={submitting}>
                                                Generate Allocations
                                            </Button>
                                        ) : null}
                                        {selectedCycle.status === "allocated" && canManageCycles && !selectedCycle.submitted_for_approval_at ? (
                                            <Button variant="contained" onClick={() => void runCycleAction("submit")} disabled={submitting}>
                                                Submit for Approval
                                            </Button>
                                        ) : null}
                                        {selectedCycle.status === "allocated" && canApproveAndPay ? (
                                            <>
                                                <Button variant="contained" onClick={() => setActionDialog({ type: "approve" })} disabled={submitting}>
                                                    Approve Cycle
                                                </Button>
                                                <Button variant="outlined" color="inherit" onClick={() => setActionDialog({ type: "reject" })} disabled={submitting}>
                                                    Reject For Rework
                                                </Button>
                                            </>
                                        ) : null}
                                        {selectedCycle.status === "approved" && canApproveAndPay ? (
                                            <Button variant="contained" color="success" onClick={() => setActionDialog({ type: "pay" })} disabled={submitting}>
                                                Process Payment Run
                                            </Button>
                                        ) : null}
                                        {selectedCycle.status === "paid" && canApproveAndPay ? (
                                            <Button variant="outlined" color="inherit" onClick={() => void runCycleAction("close")} disabled={submitting}>
                                                Close Cycle
                                            </Button>
                                        ) : null}
                                    </Stack>

                                    <Divider />

                                    <Box>
                                        <Typography variant="subtitle1">Configured Components</Typography>
                                        <Stack spacing={1.25} sx={{ mt: 1.25 }}>
                                            {(selectedCycleDetail?.components || []).map((component: DividendComponent) => (
                                                <Box key={component.id} sx={{ p: 1.5, border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
                                                    <Typography variant="body2" fontWeight={700}>
                                                        {component.type}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                        {component.basis_method} • {component.distribution_mode} • {component.distribution_mode === "rate"
                                                            ? `${component.rate_percent}%`
                                                            : formatCurrency(component.pool_amount)}
                                                    </Typography>
                                                </Box>
                                            ))}
                                        </Stack>
                                    </Box>
                                </Stack>
                            ) : (
                                <Alert severity="info" variant="outlined">
                                    Select a dividend cycle to review snapshots, allocations, approvals, and payment progress.
                                </Alert>
                            )}
                        </CardContent>
                    </MotionCard>
                </Grid>
            </Grid>

            {selectedCycleDetail ? (
                <MotionCard variant="outlined">
                    <CardContent>
                        <Stack spacing={2}>
                            <Box>
                                <Typography variant="h6">Allocation Register</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                    Auditable member allocation results for the selected cycle.
                                </Typography>
                            </Box>
                            <DataTable rows={selectedCycleDetail.allocations} columns={allocationColumns} emptyMessage="No allocations generated yet." />
                        </Stack>
                    </CardContent>
                </MotionCard>
            ) : null}

            <MotionModal open={showCreateDialog} onClose={submitting ? undefined : () => setShowCreateDialog(false)} maxWidth="lg" fullWidth>
                <DialogTitle>Create Dividend Cycle</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={3} sx={{ pt: 0.5 }}>
                        <Typography variant="body2" color="text.secondary">
                            Create a new dividend cycle. After freeze, the configuration becomes immutable and any further change requires a new version.
                        </Typography>
                        <Box component="form" id="dividend-cycle-form" onSubmit={submitCreateCycle} sx={{ display: "grid", gap: 2 }}>
                            <Grid container spacing={2}>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField label="Period Label" fullWidth {...form.register("period_label")} error={Boolean(form.formState.errors.period_label)} helperText={form.formState.errors.period_label?.message || "Example: FY2025/2026"} />
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField select label="Branch Scope" fullWidth value={form.watch("branch_id") || ""} onChange={(event) => form.setValue("branch_id", event.target.value, { shouldValidate: true })} helperText="Optional. Leave blank for tenant-wide cycle.">
                                        <MenuItem value="">Tenant-wide</MenuItem>
                                        {branchOptions.map((branch) => (
                                            <MenuItem key={branch.id} value={branch.id}>{branch.name}</MenuItem>
                                        ))}
                                    </TextField>
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <TextField label="Start Date" type="date" fullWidth InputLabelProps={{ shrink: true }} {...form.register("start_date")} />
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <TextField label="End Date" type="date" fullWidth InputLabelProps={{ shrink: true }} {...form.register("end_date")} />
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <TextField label="Declaration Date" type="date" fullWidth InputLabelProps={{ shrink: true }} {...form.register("declaration_date")} />
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <TextField label="Record Date" type="date" fullWidth InputLabelProps={{ shrink: true }} {...form.register("record_date")} />
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <TextField label="Planned Payment Date" type="date" fullWidth InputLabelProps={{ shrink: true }} {...form.register("payment_date")} />
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <TextField label="Required Checker Count" type="number" fullWidth {...form.register("required_checker_count")} />
                                </Grid>
                            </Grid>

                            <Divider />

                            <Stack spacing={2}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                    <Typography variant="subtitle1">Dividend Components</Typography>
                                    <Button onClick={() => append(defaultComponent())} startIcon={<AddCircleOutlineRoundedIcon />}>
                                        Add Component
                                    </Button>
                                </Stack>

                                {fields.map((field, index) => (
                                    <MotionCard key={field.id} variant="outlined">
                                        <CardContent>
                                            <Stack spacing={2}>
                                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                                    <Typography variant="subtitle2">Component {index + 1}</Typography>
                                                    {fields.length > 1 ? (
                                                        <Button color="inherit" onClick={() => remove(index)}>Remove</Button>
                                                    ) : null}
                                                </Stack>

                                                <Grid container spacing={2}>
                                                    <Grid size={{ xs: 12, md: 4 }}>
                                                        <TextField select label="Type" fullWidth value={form.watch(`components.${index}.type`)} onChange={(event) => form.setValue(`components.${index}.type`, event.target.value as CreateCycleFormValues["components"][number]["type"], { shouldValidate: true })}>
                                                            <MenuItem value="share_dividend">Share Dividend</MenuItem>
                                                            <MenuItem value="savings_interest_bonus">Savings Interest Bonus</MenuItem>
                                                            <MenuItem value="patronage_refund">Patronage Refund</MenuItem>
                                                        </TextField>
                                                    </Grid>
                                                    <Grid size={{ xs: 12, md: 4 }}>
                                                        <TextField select label="Basis Method" fullWidth value={form.watch(`components.${index}.basis_method`)} onChange={(event) => form.setValue(`components.${index}.basis_method`, event.target.value as CreateCycleFormValues["components"][number]["basis_method"], { shouldValidate: true })}>
                                                            <MenuItem value="end_balance">End Balance</MenuItem>
                                                            <MenuItem value="average_daily_balance">Average Daily Balance</MenuItem>
                                                            <MenuItem value="average_monthly_balance">Average Monthly Balance</MenuItem>
                                                            <MenuItem value="minimum_balance">Minimum Balance</MenuItem>
                                                            <MenuItem value="total_interest_paid">Total Interest Paid</MenuItem>
                                                            <MenuItem value="total_fees_paid">Total Fees Paid</MenuItem>
                                                            <MenuItem value="transaction_volume">Transaction Volume</MenuItem>
                                                        </TextField>
                                                    </Grid>
                                                    <Grid size={{ xs: 12, md: 4 }}>
                                                        <TextField select label="Distribution Mode" fullWidth value={form.watch(`components.${index}.distribution_mode`)} onChange={(event) => form.setValue(`components.${index}.distribution_mode`, event.target.value as CreateCycleFormValues["components"][number]["distribution_mode"], { shouldValidate: true })}>
                                                            <MenuItem value="rate">Rate</MenuItem>
                                                            <MenuItem value="fixed_pool">Fixed Pool</MenuItem>
                                                        </TextField>
                                                    </Grid>
                                                    {form.watch(`components.${index}.distribution_mode`) === "rate" ? (
                                                        <Grid size={{ xs: 12, md: 4 }}>
                                                            <TextField label="Rate %" type="number" fullWidth {...form.register(`components.${index}.rate_percent`)} />
                                                        </Grid>
                                                    ) : (
                                                        <Grid size={{ xs: 12, md: 4 }}>
                                                            <TextField label="Pool Amount" type="number" fullWidth {...form.register(`components.${index}.pool_amount`)} />
                                                        </Grid>
                                                    )}
                                                    <Grid size={{ xs: 12, md: 4 }}>
                                                        <TextField select label="Retained Earnings Account" fullWidth value={form.watch(`components.${index}.retained_earnings_account_id`)} onChange={(event) => form.setValue(`components.${index}.retained_earnings_account_id`, event.target.value, { shouldValidate: true })}>
                                                            {accountOptions.map((account) => (
                                                                <MenuItem key={account.id} value={account.id}>{account.account_code} - {account.account_name}</MenuItem>
                                                            ))}
                                                        </TextField>
                                                    </Grid>
                                                    <Grid size={{ xs: 12, md: 4 }}>
                                                        <TextField select label="Dividends Payable Account" fullWidth value={form.watch(`components.${index}.dividends_payable_account_id`)} onChange={(event) => form.setValue(`components.${index}.dividends_payable_account_id`, event.target.value, { shouldValidate: true })}>
                                                            {accountOptions.map((account) => (
                                                                <MenuItem key={account.id} value={account.id}>{account.account_code} - {account.account_name}</MenuItem>
                                                            ))}
                                                        </TextField>
                                                    </Grid>
                                                    <Grid size={{ xs: 12, md: 4 }}>
                                                        <TextField select label="Payout Account" fullWidth value={form.watch(`components.${index}.payout_account_id`) || ""} onChange={(event) => form.setValue(`components.${index}.payout_account_id`, event.target.value, { shouldValidate: true })}>
                                                            <MenuItem value="">Not required now</MenuItem>
                                                            {accountOptions.map((account) => (
                                                                <MenuItem key={account.id} value={account.id}>{account.account_code} - {account.account_name}</MenuItem>
                                                            ))}
                                                        </TextField>
                                                    </Grid>
                                                </Grid>

                                                <Divider />

                                                <Typography variant="subtitle2">Eligibility & Rounding</Typography>
                                                <Grid container spacing={2}>
                                                    <Grid size={{ xs: 12, md: 3 }}>
                                                        <TextField select label="Active Members Only" fullWidth value={form.watch(`components.${index}.active_only`)} onChange={(event) => form.setValue(`components.${index}.active_only`, event.target.value as "true" | "false", { shouldValidate: true })}>
                                                            <MenuItem value="true">Yes</MenuItem>
                                                            <MenuItem value="false">No</MenuItem>
                                                        </TextField>
                                                    </Grid>
                                                    <Grid size={{ xs: 12, md: 3 }}>
                                                        <TextField label="Min Membership Months" type="number" fullWidth {...form.register(`components.${index}.min_membership_months`)} />
                                                    </Grid>
                                                    <Grid size={{ xs: 12, md: 3 }}>
                                                        <TextField label="Minimum Shares" type="number" fullWidth {...form.register(`components.${index}.minimum_shares`)} />
                                                    </Grid>
                                                    <Grid size={{ xs: 12, md: 3 }}>
                                                        <TextField label="Max PAR Days" type="number" fullWidth {...form.register(`components.${index}.max_par_days`)} />
                                                    </Grid>
                                                    <Grid size={{ xs: 12, md: 3 }}>
                                                        <TextField label="Min Contribution Count" type="number" fullWidth {...form.register(`components.${index}.min_contributions_count`)} />
                                                    </Grid>
                                                    <Grid size={{ xs: 12, md: 3 }}>
                                                        <TextField select label="Require KYC" fullWidth value={form.watch(`components.${index}.require_kyc_completed`)} onChange={(event) => form.setValue(`components.${index}.require_kyc_completed`, event.target.value as "true" | "false", { shouldValidate: true })}>
                                                            <MenuItem value="true">Yes</MenuItem>
                                                            <MenuItem value="false">No</MenuItem>
                                                        </TextField>
                                                    </Grid>
                                                    <Grid size={{ xs: 12, md: 3 }}>
                                                        <TextField select label="Exclude Suspended/Exited" fullWidth value={form.watch(`components.${index}.exclude_suspended_exited`)} onChange={(event) => form.setValue(`components.${index}.exclude_suspended_exited`, event.target.value as "true" | "false", { shouldValidate: true })}>
                                                            <MenuItem value="true">Yes</MenuItem>
                                                            <MenuItem value="false">No</MenuItem>
                                                        </TextField>
                                                    </Grid>
                                                    <Grid size={{ xs: 12, md: 3 }}>
                                                        <TextField label="Rounding Increment" type="number" fullWidth {...form.register(`components.${index}.rounding_increment`)} />
                                                    </Grid>
                                                    <Grid size={{ xs: 12, md: 4 }}>
                                                        <TextField label="Minimum Payout Threshold" type="number" fullWidth {...form.register(`components.${index}.minimum_payout_threshold`)} />
                                                    </Grid>
                                                    <Grid size={{ xs: 12, md: 4 }}>
                                                        <TextField label="Max Payout Cap" type="number" fullWidth {...form.register(`components.${index}.max_payout_cap`)} />
                                                    </Grid>
                                                    <Grid size={{ xs: 12, md: 4 }}>
                                                        <TextField select label="Residual Handling" fullWidth value={form.watch(`components.${index}.residual_handling`)} onChange={(event) => form.setValue(`components.${index}.residual_handling`, event.target.value as CreateCycleFormValues["components"][number]["residual_handling"], { shouldValidate: true })}>
                                                            <MenuItem value="carry_to_retained_earnings">Carry to Retained Earnings</MenuItem>
                                                            <MenuItem value="allocate_pro_rata">Allocate Pro Rata</MenuItem>
                                                            <MenuItem value="allocate_to_reserve">Allocate to Reserve</MenuItem>
                                                        </TextField>
                                                    </Grid>
                                                </Grid>
                                            </Stack>
                                        </CardContent>
                                    </MotionCard>
                                ))}
                            </Stack>
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setShowCreateDialog(false)} disabled={submitting} color="inherit">Cancel</Button>
                    <Button form="dividend-cycle-form" type="submit" variant="contained" disabled={submitting}>
                        {submitting ? "Creating cycle..." : "Create Cycle"}
                    </Button>
                </DialogActions>
            </MotionModal>

            <MotionModal open={Boolean(actionDialog)} onClose={submitting ? undefined : () => setActionDialog(null)} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {actionDialog?.type === "approve" ? "Approve Dividend Cycle" : actionDialog?.type === "reject" ? "Reject Dividend Cycle" : "Process Dividend Payment"}
                </DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2} sx={{ pt: 0.5 }}>
                        {actionDialog?.type === "pay" ? (
                            <>
                                <TextField select label="Payment Method" fullWidth value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as DividendPaymentRequest["payment_method"])}>
                                    <MenuItem value="reinvest_to_shares">Reinvest to Shares</MenuItem>
                                    <MenuItem value="cash">Cash</MenuItem>
                                    <MenuItem value="bank">Bank</MenuItem>
                                    <MenuItem value="mobile_money">Mobile Money</MenuItem>
                                </TextField>
                                <TextField label="Reference" fullWidth value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} />
                            </>
                        ) : null}
                        <TextField label="Notes" multiline minRows={4} fullWidth value={actionNotes} onChange={(event) => setActionNotes(event.target.value)} />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setActionDialog(null)} disabled={submitting} color="inherit">Cancel</Button>
                    <Button
                        variant="contained"
                        disabled={submitting}
                        onClick={() => {
                            if (actionDialog?.type === "approve") {
                                void runCycleAction("approve");
                            } else if (actionDialog?.type === "reject") {
                                void runCycleAction("reject");
                            } else if (actionDialog?.type === "pay") {
                                void runCycleAction("pay");
                            }
                        }}
                    >
                        {submitting ? "Working..." : "Confirm"}
                    </Button>
                </DialogActions>
            </MotionModal>
        </Stack>
    );
}
