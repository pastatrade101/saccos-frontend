import RuleRoundedIcon from "@mui/icons-material/RuleRounded";
import {
    Alert,
    Box,
    Button,
    CardContent,
    Chip,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    Grid,
    MenuItem,
    Pagination,
    Stack,
    Switch,
    TextField,
    Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { useAuth } from "../auth/AuthContext";
import { DataTable, type Column } from "../components/DataTable";
import { TwoFactorStepUpDialog, type TwoFactorStepUpPayload } from "../components/TwoFactorStepUpDialog";
import { useToast } from "../components/Toast";
import { api, getApiErrorCode, getApiErrorMessage } from "../lib/api";
import {
    endpoints,
    type ApprovalPoliciesResponse,
    type ApprovalRequestResponse,
    type ApprovalRequestsResponse,
    type ApproveApprovalRequestBody,
    type RejectApprovalRequestBody,
    type SmsTriggerSettingsResponse,
    type UpdateApprovalPolicyRequest,
    type UpdateSmsTriggerRequest
} from "../lib/endpoints";
import type { ApprovalPolicy, ApprovalRequest, ApprovalRequestStatus, SmsTriggerSetting } from "../types/api";
import { MotionCard, MotionModal } from "../ui/motion";
import { formatCurrency, formatDate } from "../utils/format";

const STATUS_OPTIONS: Array<{ value: "all" | ApprovalRequestStatus; label: string }> = [
    { value: "all", label: "All statuses" },
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
    { value: "executed", label: "Executed" },
    { value: "expired", label: "Expired" },
    { value: "cancelled", label: "Cancelled" }
];

const OPERATION_OPTIONS: Array<{ value: "all" | "finance.withdraw" | "finance.loan_disburse"; label: string }> = [
    { value: "all", label: "All operations" },
    { value: "finance.withdraw", label: "Withdrawals" },
    { value: "finance.loan_disburse", label: "Loan disbursements" }
];

function statusChipColor(status: ApprovalRequestStatus): "default" | "success" | "warning" | "error" | "info" {
    if (status === "executed") return "success";
    if (status === "approved") return "info";
    if (status === "pending") return "warning";
    if (status === "rejected" || status === "expired") return "error";
    return "default";
}

function operationLabel(operation: ApprovalRequest["operation_key"]) {
    if (operation === "finance.loan_disburse") return "Loan disbursement";
    return "Withdrawal";
}

function formatSla(expiresAt?: string | null) {
    if (!expiresAt) return "No SLA";
    const diff = new Date(expiresAt).getTime() - Date.now();
    const totalMinutes = Math.round(Math.abs(diff) / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const label = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    return diff >= 0 ? `Due in ${label}` : `Overdue by ${label}`;
}

interface PolicyFormValues {
    enabled: boolean;
    threshold_amount: number;
    required_checker_count: number;
    sla_minutes: number;
    allowed_maker_roles: string;
    allowed_checker_roles: string;
}

function parseCsvRoles(raw: string) {
    return [...new Set(
        String(raw || "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
    )];
}

export function ApprovalsPage() {
    const theme = useTheme();
    const { pushToast } = useToast();
    const { selectedTenantId, selectedBranchId, profile, user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [policies, setPolicies] = useState<ApprovalPolicy[]>([]);
    const [smsTriggers, setSmsTriggers] = useState<SmsTriggerSetting[]>([]);
    const [smsSavingKey, setSmsSavingKey] = useState<string | null>(null);
    const [rows, setRows] = useState<ApprovalRequest[]>([]);
    const [page, setPage] = useState(1);
    const [limit] = useState(20);
    const [total, setTotal] = useState(0);
    const [status, setStatus] = useState<"all" | ApprovalRequestStatus>("pending");
    const [operation, setOperation] = useState<"all" | "finance.withdraw" | "finance.loan_disburse">("all");
    const [mineOnly, setMineOnly] = useState(false);
    const [selected, setSelected] = useState<ApprovalRequest | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [rejectOpen, setRejectOpen] = useState(false);
    const [policyOpen, setPolicyOpen] = useState(false);
    const [selectedPolicy, setSelectedPolicy] = useState<ApprovalPolicy | null>(null);
    const [stepUpOpen, setStepUpOpen] = useState(false);
    const [stepUpTitle, setStepUpTitle] = useState("Authenticator verification required");
    const [stepUpDescription, setStepUpDescription] = useState("");
    const [stepUpActionLabel, setStepUpActionLabel] = useState("Verify");
    const [stepUpHandler, setStepUpHandler] = useState<((payload: TwoFactorStepUpPayload) => Promise<void>) | null>(null);
    const rejectForm = useForm<RejectApprovalRequestBody>({
        defaultValues: { reason: "", notes: "" }
    });
    const policyForm = useForm<PolicyFormValues>({
        defaultValues: {
            enabled: true,
            threshold_amount: 0,
            required_checker_count: 1,
            sla_minutes: 120,
            allowed_maker_roles: "",
            allowed_checker_roles: ""
        }
    });

    const canDecide = profile?.role === "branch_manager" || profile?.role === "super_admin";
    const canManagePolicies = profile?.role === "branch_manager" || profile?.role === "super_admin";
    const canManageSmsTriggers = profile?.role === "super_admin";
    const pendingCount = useMemo(() => rows.filter((row) => row.status === "pending").length, [rows]);
    const overdueCount = useMemo(
        () => rows.filter((row) => row.status === "pending" && row.expires_at && new Date(row.expires_at).getTime() < Date.now()).length,
        [rows]
    );

    const openStepUpDialog = (
        title: string,
        description: string,
        actionLabel: string,
        handler: (payload: TwoFactorStepUpPayload) => Promise<void>
    ) => {
        setStepUpTitle(title);
        setStepUpDescription(description);
        setStepUpActionLabel(actionLabel);
        setStepUpHandler(() => handler);
        setStepUpOpen(true);
    };

    const closeStepUpDialog = () => {
        if (processing) {
            return;
        }

        setStepUpOpen(false);
        setStepUpHandler(null);
    };

    const loadPolicies = async () => {
        if (!selectedTenantId) return;
        const { data } = await api.get<ApprovalPoliciesResponse>(endpoints.approvals.policies(), {
            params: { tenant_id: selectedTenantId }
        });
        setPolicies(data.data || []);
    };

    const loadSmsTriggers = async () => {
        if (!selectedTenantId || !canManageSmsTriggers) {
            setSmsTriggers([]);
            return;
        }

        try {
            const { data } = await api.get<SmsTriggerSettingsResponse>(endpoints.notificationSettings.smsTriggers(), {
                params: { tenant_id: selectedTenantId }
            });
            setSmsTriggers(data.data || []);
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to load SMS triggers",
                message: getApiErrorMessage(error)
            });
        }
    };

    const loadRequests = async (targetPage = page) => {
        if (!selectedTenantId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const { data } = await api.get<ApprovalRequestsResponse>(endpoints.approvals.requests(), {
                params: {
                    tenant_id: selectedTenantId,
                    branch_id: selectedBranchId || undefined,
                    status: status === "all" ? undefined : status,
                    operation_key: operation === "all" ? undefined : operation,
                    maker_user_id: mineOnly ? user?.id : undefined,
                    page: targetPage,
                    limit
                }
            });
            setRows(data.data || []);
            setTotal(data.pagination?.total || 0);
            setPage(data.pagination?.page || targetPage);
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to load approvals",
                message: getApiErrorMessage(error)
            });
        } finally {
            setLoading(false);
        }
    };

    const loadRequestDetail = async (requestId: string) => {
        if (!selectedTenantId) return;

        setProcessing(true);
        try {
            const { data } = await api.get<ApprovalRequestResponse>(endpoints.approvals.request(requestId), {
                params: { tenant_id: selectedTenantId }
            });
            setSelected(data.data);
            setDetailOpen(true);
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to load request details",
                message: getApiErrorMessage(error)
            });
        } finally {
            setProcessing(false);
        }
    };

    useEffect(() => {
        void loadPolicies();
    }, [selectedTenantId]);

    useEffect(() => {
        void loadSmsTriggers();
    }, [selectedTenantId, canManageSmsTriggers]);

    useEffect(() => {
        void loadRequests(1);
    }, [selectedTenantId, selectedBranchId, status, operation, mineOnly]);

    const approveRequest = async (request: ApprovalRequest, stepUpPayload?: TwoFactorStepUpPayload) => {
        if (!selectedTenantId) return;
        setProcessing(true);
        try {
            const payload: ApproveApprovalRequestBody = {
                tenant_id: selectedTenantId,
                notes: "Approved from approvals queue.",
                two_factor_code: stepUpPayload?.two_factor_code || null,
                recovery_code: stepUpPayload?.recovery_code || null
            };
            await api.post<ApprovalRequestResponse>(endpoints.approvals.approve(request.id), payload);
            pushToast({
                type: "success",
                title: "Request approved",
                message: `${operationLabel(request.operation_key)} request is now approved.`
            });
            if (selected?.id === request.id) {
                await loadRequestDetail(request.id);
            }
            await loadRequests(page);
        } catch (error) {
            if (getApiErrorCode(error) === "TWO_FACTOR_STEP_UP_REQUIRED") {
                openStepUpDialog(
                    "Verify loan approval decision",
                    "Enter a current authenticator code or one backup recovery code before approving this request.",
                    "Verify and approve",
                    async (payload) => {
                        await approveRequest(request, payload);
                        setStepUpOpen(false);
                    }
                );
                return;
            }
            pushToast({
                type: "error",
                title: "Approval failed",
                message: getApiErrorMessage(error)
            });
        } finally {
            setProcessing(false);
        }
    };

    const submitReject = rejectForm.handleSubmit(async (values) => {
        if (!selectedTenantId || !selected) return;
        setProcessing(true);
        try {
            const payload: RejectApprovalRequestBody = {
                tenant_id: selectedTenantId,
                reason: values.reason,
                notes: values.notes || null
            };
            await api.post<ApprovalRequestResponse>(endpoints.approvals.reject(selected.id), payload);
            pushToast({
                type: "success",
                title: "Request rejected",
                message: "The maker can review and resubmit."
            });
            setRejectOpen(false);
            rejectForm.reset({ reason: "", notes: "" });
            await loadRequestDetail(selected.id);
            await loadRequests(page);
        } catch (error) {
            pushToast({
                type: "error",
                title: "Rejection failed",
                message: getApiErrorMessage(error)
            });
        } finally {
            setProcessing(false);
        }
    });
    const openPolicyEditor = (policy: ApprovalPolicy) => {
        setSelectedPolicy(policy);
        policyForm.reset({
            enabled: Boolean(policy.enabled),
            threshold_amount: Number(policy.threshold_amount || 0),
            required_checker_count: Number(policy.required_checker_count || 1),
            sla_minutes: Number(policy.sla_minutes || 120),
            allowed_maker_roles: (policy.allowed_maker_roles || []).join(", "),
            allowed_checker_roles: (policy.allowed_checker_roles || []).join(", ")
        });
        setPolicyOpen(true);
    };

    const savePolicyUpdate = async (values: PolicyFormValues, stepUpPayload?: TwoFactorStepUpPayload) => {
        if (!selectedTenantId || !selectedPolicy) return;

        const payload: UpdateApprovalPolicyRequest = {
            tenant_id: selectedTenantId,
            enabled: values.enabled,
            threshold_amount: Number(values.threshold_amount),
            required_checker_count: Number(values.required_checker_count),
            sla_minutes: Number(values.sla_minutes),
            allowed_maker_roles: parseCsvRoles(values.allowed_maker_roles),
            allowed_checker_roles: parseCsvRoles(values.allowed_checker_roles),
            two_factor_code: stepUpPayload?.two_factor_code || null,
            recovery_code: stepUpPayload?.recovery_code || null
        };

        setProcessing(true);
        try {
            await api.patch(endpoints.approvals.policy(selectedPolicy.operation_key), payload);
            pushToast({
                type: "success",
                title: "Policy updated",
                message: `${operationLabel(selectedPolicy.operation_key)} policy saved successfully.`
            });
            setPolicyOpen(false);
            setSelectedPolicy(null);
            await loadPolicies();
        } catch (error) {
            if (getApiErrorCode(error) === "TWO_FACTOR_STEP_UP_REQUIRED") {
                openStepUpDialog(
                    "Verify approval policy change",
                    "Changing checker thresholds and approval rules requires a fresh authenticator check.",
                    "Verify and save",
                    async (stepUpValues) => {
                        await savePolicyUpdate(values, stepUpValues);
                        setStepUpOpen(false);
                    }
                );
                return;
            }
            pushToast({
                type: "error",
                title: "Policy update failed",
                message: getApiErrorMessage(error)
            });
        } finally {
            setProcessing(false);
        }
    };

    const submitPolicyUpdate = policyForm.handleSubmit(async (values) => {
        await savePolicyUpdate(values);
    });

    const toggleSmsTrigger = async (trigger: SmsTriggerSetting, enabled: boolean) => {
        if (!selectedTenantId || !canManageSmsTriggers) return;
        setSmsSavingKey(trigger.event_type);

        try {
            const payload: UpdateSmsTriggerRequest = {
                tenant_id: selectedTenantId,
                enabled
            };

            await api.patch(endpoints.notificationSettings.smsTrigger(trigger.event_type), payload);
            setSmsTriggers((prev) =>
                prev.map((row) => (row.event_type === trigger.event_type ? { ...row, enabled } : row))
            );
            pushToast({
                type: "success",
                title: "SMS trigger updated",
                message: `${trigger.label} is now ${enabled ? "enabled" : "disabled"}.`
            });
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to update SMS trigger",
                message: getApiErrorMessage(error)
            });
        } finally {
            setSmsSavingKey(null);
        }
    };

    const columns: Column<ApprovalRequest>[] = [
        {
            key: "operation",
            header: "Operation",
            render: (row) => (
                <Stack spacing={0.25}>
                    <Typography variant="body2" fontWeight={700}>{operationLabel(row.operation_key)}</Typography>
                    <Typography variant="caption" color="text.secondary">{row.entity_type || "transaction"}</Typography>
                </Stack>
            )
        },
        {
            key: "amount",
            header: "Amount",
            render: (row) => (
                <Stack spacing={0.25}>
                    <Typography variant="body2" fontWeight={700}>{formatCurrency(row.requested_amount)}</Typography>
                    <Typography variant="caption" color="text.secondary">Threshold {formatCurrency(row.threshold_amount)}</Typography>
                </Stack>
            )
        },
        {
            key: "status",
            header: "Status",
            render: (row) => (
                <Chip
                    size="small"
                    label={row.status.toUpperCase()}
                    color={statusChipColor(row.status)}
                    variant={row.status === "pending" ? "filled" : "outlined"}
                />
            )
        },
        {
            key: "sla",
            header: "SLA",
            render: (row) => (
                <Typography
                    variant="body2"
                    color={row.expires_at && new Date(row.expires_at).getTime() < Date.now() && row.status === "pending" ? "error.main" : "text.secondary"}
                >
                    {formatSla(row.expires_at)}
                </Typography>
            )
        },
        {
            key: "requested",
            header: "Requested",
            render: (row) => (
                <Stack spacing={0.25}>
                    <Typography variant="body2">{formatDate(row.requested_at)}</Typography>
                    <Typography variant="caption" color="text.secondary">{row.maker_user_id.slice(0, 8)}...</Typography>
                </Stack>
            )
        },
        {
            key: "actions",
            header: "Actions",
            render: (row) => (
                <Stack direction="row" spacing={1}>
                    <Button size="small" variant="outlined" onClick={() => void loadRequestDetail(row.id)}>
                        View
                    </Button>
                    {canDecide && row.status === "pending" ? (
                        <Button size="small" variant="contained" onClick={() => void approveRequest(row)} disabled={processing}>
                            Approve
                        </Button>
                    ) : null}
                </Stack>
            )
        }
    ];

    const smsTriggerColumns: Column<SmsTriggerSetting>[] = [
        {
            key: "label",
            header: "Trigger",
            render: (row) => (
                <Stack spacing={0.25}>
                    <Typography variant="body2" fontWeight={700}>{row.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{row.event_type}</Typography>
                </Stack>
            )
        },
        {
            key: "description",
            header: "Description",
            render: (row) => (
                <Typography variant="body2" color="text.secondary">
                    {row.description}
                </Typography>
            )
        },
        {
            key: "enabled",
            header: "Enabled",
            render: (row) => (
                <Switch
                    checked={Boolean(row.enabled)}
                    onChange={(_, checked) => void toggleSmsTrigger(row, checked)}
                    disabled={!canManageSmsTriggers || smsSavingKey === row.event_type}
                />
            )
        }
    ];

    const totalPages = Math.max(1, Math.ceil(total / limit));
    const detailCanReject = canDecide && selected?.status === "pending";
    const detailCanApprove = canDecide && selected?.status === "pending";
    const accent = theme.palette.mode === "dark" ? "#D9B273" : theme.palette.primary.main;

    return (
        <Stack spacing={3}>
            <MotionCard
                variant="outlined"
                sx={{
                    borderRadius: 2,
                    borderColor: alpha(accent, 0.28),
                    background: `linear-gradient(135deg, ${alpha(accent, 0.1)}, ${theme.palette.background.paper})`
                }}
            >
                <CardContent>
                    <Stack spacing={2}>
                        <Typography variant="h5" sx={{ fontWeight: 800 }}>Approval Queue</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Manage high-risk approvals for withdrawals and loan disbursements with SLA visibility.
                        </Typography>
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 12, md: 4 }}>
                                <MotionCard variant="outlined">
                                    <CardContent>
                                        <Stack spacing={1}>
                                            <Typography variant="overline" color="text.secondary">Pending</Typography>
                                            <Typography variant="h5">{pendingCount}</Typography>
                                            <Typography variant="caption" color="text.secondary">Requests awaiting checker action.</Typography>
                                        </Stack>
                                    </CardContent>
                                </MotionCard>
                            </Grid>
                            <Grid size={{ xs: 12, md: 4 }}>
                                <MotionCard variant="outlined">
                                    <CardContent>
                                        <Stack spacing={1}>
                                            <Typography variant="overline" color="text.secondary">Overdue SLA</Typography>
                                            <Typography variant="h5">{overdueCount}</Typography>
                                            <Typography variant="caption" color="text.secondary">Pending requests beyond expiry.</Typography>
                                        </Stack>
                                    </CardContent>
                                </MotionCard>
                            </Grid>
                            <Grid size={{ xs: 12, md: 4 }}>
                                <MotionCard variant="outlined">
                                    <CardContent>
                                        <Stack spacing={1}>
                                            <Typography variant="overline" color="text.secondary">Policies</Typography>
                                            <Typography variant="h5">{policies.length}</Typography>
                                            <Typography variant="caption" color="text.secondary">Active operation control profiles.</Typography>
                                        </Stack>
                                    </CardContent>
                                </MotionCard>
                            </Grid>
                        </Grid>
                    </Stack>
                </CardContent>
            </MotionCard>

            <MotionCard variant="outlined">
                <CardContent>
                    <Stack spacing={2}>
                        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                            <TextField
                                select
                                fullWidth
                                label="Status"
                                value={status}
                                onChange={(event) => setStatus(event.target.value as typeof status)}
                            >
                                {STATUS_OPTIONS.map((option) => (
                                    <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                select
                                fullWidth
                                label="Operation"
                                value={operation}
                                onChange={(event) => setOperation(event.target.value as typeof operation)}
                            >
                                {OPERATION_OPTIONS.map((option) => (
                                    <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                                ))}
                            </TextField>
                            <FormControlLabel
                                sx={{ m: 0, minWidth: 220 }}
                                control={<Switch checked={mineOnly} onChange={(_, checked) => setMineOnly(checked)} />}
                                label="My requests only"
                            />
                        </Stack>
                        <DataTable
                            rows={rows}
                            columns={columns}
                            emptyMessage={loading ? "Loading approval requests..." : "No approval requests found for current filters."}
                        />
                        <Stack direction="row" justifyContent="flex-end">
                            <Pagination
                                count={totalPages}
                                page={page}
                                onChange={(_, next) => {
                                    setPage(next);
                                    void loadRequests(next);
                                }}
                            />
                        </Stack>
                    </Stack>
                </CardContent>
            </MotionCard>

            <MotionCard variant="outlined">
                <CardContent>
                    <Stack spacing={2}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                            <RuleRoundedIcon fontSize="small" />
                            <Typography variant="h6">Approval Policies</Typography>
                        </Stack>
                        {!canManagePolicies ? (
                            <Alert severity="info" variant="outlined">
                                Read-only view. Only super admin and branch manager can edit policy thresholds and role rules.
                            </Alert>
                        ) : null}
                        <DataTable
                            rows={policies}
                            columns={[
                                { key: "operation", header: "Operation", render: (row) => operationLabel(row.operation_key) },
                                { key: "enabled", header: "Enabled", render: (row) => row.enabled ? "Yes" : "No" },
                                { key: "threshold", header: "Threshold", render: (row) => formatCurrency(row.threshold_amount) },
                                { key: "checkers", header: "Checkers", render: (row) => row.required_checker_count },
                                { key: "sla", header: "SLA", render: (row) => `${row.sla_minutes} min` },
                                {
                                    key: "action",
                                    header: "Action",
                                    render: (row) => (
                                        canManagePolicies ? (
                                            <Button size="small" variant="outlined" onClick={() => openPolicyEditor(row)}>
                                                Edit
                                            </Button>
                                        ) : "View"
                                    )
                                }
                            ]}
                            emptyMessage="No approval policies configured."
                        />
                    </Stack>
                </CardContent>
            </MotionCard>

            {canManageSmsTriggers ? (
                <MotionCard variant="outlined">
                    <CardContent>
                        <Stack spacing={2}>
                            <Stack direction="row" alignItems="center" spacing={1}>
                                <RuleRoundedIcon fontSize="small" />
                                <Typography variant="h6">SMS Trigger Controls</Typography>
                            </Stack>
                            <Alert severity="info" variant="outlined">
                                Tenant super admin can enable or mute operational SMS alerts per trigger without changing global SMS provider settings.
                            </Alert>
                            <DataTable
                                rows={smsTriggers}
                                columns={smsTriggerColumns}
                                emptyMessage="No SMS triggers configured."
                            />
                        </Stack>
                    </CardContent>
                </MotionCard>
            ) : null}

            <MotionModal
                open={detailOpen}
                onClose={processing ? undefined : () => setDetailOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>Approval Request Detail</DialogTitle>
                <DialogContent dividers>
                    {!selected ? (
                        <Alert severity="info">Select a request to view details.</Alert>
                    ) : (
                        <Stack spacing={2}>
                            <Grid container spacing={2}>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <Typography variant="body2" color="text.secondary">Operation</Typography>
                                    <Typography variant="body1" fontWeight={700}>{operationLabel(selected.operation_key)}</Typography>
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <Typography variant="body2" color="text.secondary">Status</Typography>
                                    <Chip size="small" label={selected.status.toUpperCase()} color={statusChipColor(selected.status)} />
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <Typography variant="body2" color="text.secondary">Requested Amount</Typography>
                                    <Typography variant="body1" fontWeight={700}>{formatCurrency(selected.requested_amount)}</Typography>
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <Typography variant="body2" color="text.secondary">Threshold</Typography>
                                    <Typography variant="body1" fontWeight={700}>{formatCurrency(selected.threshold_amount)}</Typography>
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <Typography variant="body2" color="text.secondary">Maker</Typography>
                                    <Typography variant="body1">{selected.maker_user_id}</Typography>
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <Typography variant="body2" color="text.secondary">SLA</Typography>
                                    <Typography variant="body1">{formatSla(selected.expires_at)}</Typography>
                                </Grid>
                            </Grid>

                            <Box>
                                <Typography variant="subtitle2" sx={{ mb: 1 }}>Payload Snapshot</Typography>
                                <Box
                                    component="pre"
                                    sx={{
                                        m: 0,
                                        p: 1.5,
                                        borderRadius: 1,
                                        bgcolor: alpha(theme.palette.text.primary, 0.06),
                                        overflowX: "auto",
                                        fontSize: "0.78rem"
                                    }}
                                >
                                    {JSON.stringify(selected.payload_json || {}, null, 2)}
                                </Box>
                            </Box>

                            <Box>
                                <Typography variant="subtitle2" sx={{ mb: 1 }}>Decision Log</Typography>
                                {(selected.decisions || []).length ? (
                                    <Stack spacing={1}>
                                        {(selected.decisions || []).map((decision) => (
                                            <Box key={decision.id} sx={{ p: 1.2, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                                    <Typography variant="body2" fontWeight={700}>{decision.decision.toUpperCase()}</Typography>
                                                    <Typography variant="caption" color="text.secondary">{formatDate(decision.created_at)}</Typography>
                                                </Stack>
                                                <Typography variant="caption" color="text.secondary">By {decision.decided_by}</Typography>
                                                {decision.notes ? <Typography variant="body2" sx={{ mt: 0.5 }}>{decision.notes}</Typography> : null}
                                            </Box>
                                        ))}
                                    </Stack>
                                ) : (
                                    <Alert severity="info">No decisions recorded yet.</Alert>
                                )}
                            </Box>
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDetailOpen(false)} disabled={processing}>Close</Button>
                    {detailCanReject ? (
                        <Button color="error" onClick={() => setRejectOpen(true)} disabled={processing}>
                            Reject
                        </Button>
                    ) : null}
                    {detailCanApprove && selected ? (
                        <Button variant="contained" onClick={() => void approveRequest(selected)} disabled={processing}>
                            Approve
                        </Button>
                    ) : null}
                </DialogActions>
            </MotionModal>

            <MotionModal
                open={rejectOpen}
                onClose={processing ? undefined : () => setRejectOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Reject Approval Request</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2} sx={{ mt: 0.5 }}>
                        <TextField
                            label="Reason"
                            fullWidth
                            required
                            value={rejectForm.watch("reason")}
                            onChange={(event) => rejectForm.setValue("reason", event.target.value)}
                        />
                        <TextField
                            label="Notes"
                            fullWidth
                            multiline
                            minRows={3}
                            value={rejectForm.watch("notes") || ""}
                            onChange={(event) => rejectForm.setValue("notes", event.target.value)}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRejectOpen(false)} disabled={processing}>Cancel</Button>
                    <Button color="error" variant="contained" onClick={() => void submitReject()} disabled={processing}>
                        Confirm Reject
                    </Button>
                </DialogActions>
            </MotionModal>

            <MotionModal
                open={policyOpen}
                onClose={processing ? undefined : () => setPolicyOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Edit Approval Policy</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2} sx={{ mt: 0.5 }}>
                        <Typography variant="body2" color="text.secondary">
                            {selectedPolicy ? operationLabel(selectedPolicy.operation_key) : "Policy"}
                        </Typography>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={Boolean(policyForm.watch("enabled"))}
                                    onChange={(_, checked) => policyForm.setValue("enabled", checked)}
                                />
                            }
                            label="Policy enabled"
                        />
                        <TextField
                            type="number"
                            label="Threshold amount (TZS)"
                            fullWidth
                            inputProps={{ min: 0, step: 0.01 }}
                            {...policyForm.register("threshold_amount", { valueAsNumber: true })}
                        />
                        <TextField
                            type="number"
                            label="Required checker count"
                            fullWidth
                            inputProps={{ min: 1, max: 5, step: 1 }}
                            {...policyForm.register("required_checker_count", { valueAsNumber: true })}
                        />
                        <TextField
                            type="number"
                            label="SLA minutes"
                            fullWidth
                            inputProps={{ min: 5, max: 10080, step: 1 }}
                            {...policyForm.register("sla_minutes", { valueAsNumber: true })}
                        />
                        <TextField
                            label="Allowed maker roles"
                            fullWidth
                            helperText="Comma-separated roles, e.g. teller, branch_manager, super_admin"
                            {...policyForm.register("allowed_maker_roles")}
                        />
                        <TextField
                            label="Allowed checker roles"
                            fullWidth
                            helperText="Comma-separated roles, e.g. branch_manager, super_admin"
                            {...policyForm.register("allowed_checker_roles")}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPolicyOpen(false)} disabled={processing}>Cancel</Button>
                    <Button variant="contained" onClick={() => void submitPolicyUpdate()} disabled={processing}>
                        Save policy
                    </Button>
                </DialogActions>
            </MotionModal>

            <TwoFactorStepUpDialog
                open={stepUpOpen}
                title={stepUpTitle}
                description={stepUpDescription}
                actionLabel={stepUpActionLabel}
                busy={processing}
                onCancel={closeStepUpDialog}
                onConfirm={async (payload) => {
                    if (!stepUpHandler) {
                        return;
                    }

                    await stepUpHandler(payload);
                }}
            />
        </Stack>
    );
}
