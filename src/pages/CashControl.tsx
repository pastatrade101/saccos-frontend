import { MotionCard, MotionModal } from "../ui/motion";
import FileDownloadRoundedIcon from "@mui/icons-material/FileDownloadRounded";
import PolicyRoundedIcon from "@mui/icons-material/PolicyRounded";
import PointOfSaleRoundedIcon from "@mui/icons-material/PointOfSaleRounded";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Grid,
    MenuItem,
    Stack,
    TextField,
    Typography
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../auth/AuthContext";
import { DataTable } from "../components/DataTable";
import { useToast } from "../components/Toast";
import { api, getApiErrorMessage } from "../lib/api";
import {
    endpoints,
    type BranchesListResponse,
    type DailyCashSummaryResponse,
    type ReceiptPolicyResponse,
    type TellerSessionsResponse,
    type UpdateReceiptPolicyRequest
} from "../lib/endpoints";
import type { Branch, DailyCashSummary, ReceiptPolicy, TellerSession } from "../types/api";
import { downloadFile, getFilenameFromDisposition } from "../utils/downloadFile";
import { formatCurrency, formatDate } from "../utils/format";

function statusChip(status: TellerSession["status"]) {
    if (status === "reviewed") return "success";
    if (status === "closed_pending_review") return "warning";
    return "info";
}

export function CashControlPage() {
    const { pushToast } = useToast();
    const { profile, selectedTenantId, selectedBranchId } = useAuth();
    const [branches, setBranches] = useState<Branch[]>([]);
    const [policy, setPolicy] = useState<ReceiptPolicy | null>(null);
    const [sessions, setSessions] = useState<TellerSession[]>([]);
    const [summary, setSummary] = useState<DailyCashSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showPolicyEditor, setShowPolicyEditor] = useState(false);
    const [branchId, setBranchId] = useState<string>(selectedBranchId || "");
    const [policyForm, setPolicyForm] = useState<UpdateReceiptPolicyRequest>({
        branch_id: selectedBranchId || null,
        receipt_required: false,
        required_threshold: 500000,
        max_receipts_per_tx: 3,
        allowed_mime_types: ["image/jpeg", "image/png", "application/pdf"],
        max_file_size_mb: 10,
        enforce_on_types: ["deposit", "withdraw", "loan_repay", "loan_disburse"]
    });

    const editable = profile?.role === "branch_manager" || profile?.role === "super_admin";

    const loadData = async () => {
        if (!selectedTenantId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const branchQuery = branchId || selectedBranchId || undefined;
            const [{ data: branchesResponse }, { data: policyResponse }, { data: sessionsResponse }, { data: summaryResponse }] = await Promise.all([
                api.get<BranchesListResponse>(endpoints.branches.list(), {
                    params: { tenant_id: selectedTenantId, page: 1, limit: 100 }
                }),
                api.get<ReceiptPolicyResponse>(endpoints.cashControl.receiptPolicy(), { params: branchQuery ? { branch_id: branchQuery } : {} }),
                api.get<TellerSessionsResponse>(endpoints.cashControl.sessions(), {
                    params: branchQuery ? { branch_id: branchQuery, page: 1, limit: 100 } : { page: 1, limit: 100 }
                }),
                api.get<DailyCashSummaryResponse>(endpoints.cashControl.dailySummary(), { params: branchQuery ? { branch_id: branchQuery } : {} })
            ]);

            setBranches(branchesResponse.data || []);
            setPolicy(policyResponse.data);
            setSessions(sessionsResponse.data || []);
            setSummary(summaryResponse.data || []);
            if (policyResponse.data) {
                setPolicyForm({
                    branch_id: policyResponse.data.branch_id || null,
                    receipt_required: policyResponse.data.receipt_required,
                    required_threshold: policyResponse.data.required_threshold,
                    max_receipts_per_tx: policyResponse.data.max_receipts_per_tx,
                    allowed_mime_types: policyResponse.data.allowed_mime_types,
                    max_file_size_mb: policyResponse.data.max_file_size_mb,
                    enforce_on_types: policyResponse.data.enforce_on_types
                });
            }
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to load cash control",
                message: getApiErrorMessage(error)
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
    }, [selectedTenantId, branchId]);

    const totals = useMemo(() => {
        return summary.reduce(
            (acc, row) => {
                acc.deposits += Number(row.deposits_total || 0);
                acc.withdrawals += Number(row.withdrawals_total || 0);
                acc.variance += Number(row.variance_total || 0);
                return acc;
            },
            { deposits: 0, withdrawals: 0, variance: 0 }
        );
    }, [summary]);

    const savePolicy = async () => {
        setSaving(true);
        try {
            await api.put(endpoints.cashControl.receiptPolicy(), {
                ...policyForm,
                branch_id: branchId || null
            });
            pushToast({
                type: "success",
                title: "Policy updated",
                message: "Receipt and teller control policy has been saved."
            });
            setShowPolicyEditor(false);
            await loadData();
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to save policy",
                message: getApiErrorMessage(error)
            });
        } finally {
            setSaving(false);
        }
    };

    const downloadReport = async (url: string, fallback: string) => {
        try {
            const response = await api.get(url, {
                params: branchId ? { branch_id: branchId } : {},
                responseType: "blob"
            });

            downloadFile(response.data as Blob, getFilenameFromDisposition(response.headers["content-disposition"], fallback));
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to download report",
                message: getApiErrorMessage(error)
            });
        }
    };

    return (
        <Stack spacing={3}>
            <MotionCard sx={{ color: "#fff", background: "linear-gradient(135deg, #0A0573 0%, #1FA8E6 100%)" }}>
                <CardContent>
                    <Stack spacing={1}>
                        <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.72)" }}>
                            Cash governance
                        </Typography>
                        <Typography variant="h4">Receipt policy, teller balancing, and daily cashbook</Typography>
                        <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.82)", maxWidth: 760 }}>
                            Configure evidence requirements for cash movements, review teller sessions, and export branch cash summaries for balancing and oversight.
                        </Typography>
                    </Stack>
                </CardContent>
            </MotionCard>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 3 }}><MotionCard variant="outlined"><CardContent><Typography variant="overline">Deposits</Typography><Typography variant="h5">{formatCurrency(totals.deposits)}</Typography></CardContent></MotionCard></Grid>
                <Grid size={{ xs: 12, md: 3 }}><MotionCard variant="outlined"><CardContent><Typography variant="overline">Withdrawals</Typography><Typography variant="h5">{formatCurrency(totals.withdrawals)}</Typography></CardContent></MotionCard></Grid>
                <Grid size={{ xs: 12, md: 3 }}><MotionCard variant="outlined"><CardContent><Typography variant="overline">Variance</Typography><Typography variant="h5">{formatCurrency(totals.variance)}</Typography></CardContent></MotionCard></Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                    <MotionCard variant="outlined">
                        <CardContent>
                            <Typography variant="overline">Branch filter</Typography>
                            <TextField
                                select
                                fullWidth
                                size="small"
                                value={branchId}
                                onChange={(event) => setBranchId(event.target.value)}
                                sx={{ mt: 1 }}
                            >
                                <MenuItem value="">All accessible branches</MenuItem>
                                {branches.map((branch) => (
                                    <MenuItem key={branch.id} value={branch.id}>
                                        {branch.name}
                                    </MenuItem>
                                ))}
                            </TextField>
                        </CardContent>
                    </MotionCard>
                </Grid>
            </Grid>

            <Grid container spacing={3}>
                <Grid size={{ xs: 12, lg: 5 }}>
                    <MotionCard variant="outlined">
                        <CardContent>
                            <Stack spacing={2}>
                                <Stack direction="row" spacing={1.5} alignItems="center">
                                    <PolicyRoundedIcon color="primary" />
                                    <Box>
                                        <Typography variant="h6">Receipt policy</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Threshold, evidence formats, and enforced transaction types.
                                        </Typography>
                                    </Box>
                                </Stack>
                                <Alert severity="info">
                                    Uploaded receipts become immutable once they are attached to a posted journal entry.
                                </Alert>
                                {editable ? (
                                    showPolicyEditor ? (
                                        <>
                                            <TextField
                                                select
                                                label="Receipt required"
                                                value={String(policyForm.receipt_required)}
                                                onChange={(event) => setPolicyForm((current) => ({ ...current, receipt_required: event.target.value === "true" }))}
                                                fullWidth
                                                disabled={!editable}
                                            >
                                                <MenuItem value="true">Required over threshold</MenuItem>
                                                <MenuItem value="false">Optional</MenuItem>
                                            </TextField>
                                            <TextField
                                                label="Required threshold"
                                                type="number"
                                                value={policyForm.required_threshold}
                                                onChange={(event) => setPolicyForm((current) => ({ ...current, required_threshold: Number(event.target.value) }))}
                                                fullWidth
                                                disabled={!editable}
                                            />
                                            <TextField
                                                label="Max receipts per transaction"
                                                type="number"
                                                value={policyForm.max_receipts_per_tx}
                                                onChange={(event) => setPolicyForm((current) => ({ ...current, max_receipts_per_tx: Number(event.target.value) }))}
                                                fullWidth
                                                disabled={!editable}
                                            />
                                            <TextField
                                                label="Max file size (MB)"
                                                type="number"
                                                value={policyForm.max_file_size_mb}
                                                onChange={(event) => setPolicyForm((current) => ({ ...current, max_file_size_mb: Number(event.target.value) }))}
                                                fullWidth
                                                disabled={!editable}
                                            />
                                            <TextField
                                                label="Allowed MIME types"
                                                value={policyForm.allowed_mime_types.join(", ")}
                                                onChange={(event) => setPolicyForm((current) => ({
                                                    ...current,
                                                    allowed_mime_types: event.target.value.split(",").map((value) => value.trim()).filter(Boolean)
                                                }))}
                                                fullWidth
                                                disabled={!editable}
                                            />
                                            <TextField
                                                label="Enforce on"
                                                value={policyForm.enforce_on_types.join(", ")}
                                                onChange={(event) => setPolicyForm((current) => ({
                                                    ...current,
                                                    enforce_on_types: event.target.value.split(",").map((value) => value.trim()) as UpdateReceiptPolicyRequest["enforce_on_types"]
                                                }))}
                                                fullWidth
                                                disabled={!editable}
                                            />
                                            <Stack direction="row" spacing={1.25}>
                                                <Button variant="contained" onClick={() => void savePolicy()} disabled={saving}>
                                                    {saving ? "Saving..." : "Save policy"}
                                                </Button>
                                                <Button
                                                    variant="outlined"
                                                    onClick={() => setShowPolicyEditor(false)}
                                                    disabled={saving}
                                                >
                                                    Cancel
                                                </Button>
                                            </Stack>
                                        </>
                                    ) : (
                                        <Button variant="contained" onClick={() => setShowPolicyEditor(true)}>
                                            Edit policy
                                        </Button>
                                    )
                                ) : (
                                    <Chip label="Read only" color="default" />
                                )}
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>
                <Grid size={{ xs: 12, lg: 7 }}>
                    <MotionCard variant="outlined">
                        <CardContent>
                            <Stack spacing={2}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                                    <Stack direction="row" spacing={1.5} alignItems="center">
                                        <PointOfSaleRoundedIcon color="primary" />
                                        <Box>
                                            <Typography variant="h6">Reports</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Export branch cashbook and teller balancing evidence.
                                            </Typography>
                                        </Box>
                                    </Stack>
                                    <Stack direction="row" spacing={1}>
                                        <Button startIcon={<FileDownloadRoundedIcon />} variant="outlined" onClick={() => void downloadReport(endpoints.cashControl.dailyCashbookCsv(), "daily-cashbook.csv")}>
                                            Daily cashbook
                                        </Button>
                                        <Button startIcon={<FileDownloadRoundedIcon />} variant="outlined" onClick={() => void downloadReport(endpoints.cashControl.tellerBalancingCsv(), "teller-balancing.csv")}>
                                            Teller balancing
                                        </Button>
                                    </Stack>
                                </Stack>
                                <DataTable
                                    rows={summary}
                                    columns={[
                                        { key: "date", header: "Date", render: (row) => formatDate(row.business_date) },
                                        { key: "deposits", header: "Deposits", render: (row) => formatCurrency(row.deposits_total) },
                                        { key: "withdrawals", header: "Withdrawals", render: (row) => formatCurrency(row.withdrawals_total) },
                                        { key: "net", header: "Net", render: (row) => formatCurrency(row.net_movement) },
                                        { key: "variance", header: "Variance", render: (row) => formatCurrency(row.variance_total) }
                                    ]}
                                    emptyMessage={loading ? "Loading daily cash summary..." : "No daily cash data recorded."}
                                />
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>
            </Grid>

            <MotionCard variant="outlined">
                <CardContent>
                    <Stack spacing={2}>
                        <Typography variant="h6">Teller sessions</Typography>
                        <DataTable
                            rows={sessions}
                            columns={[
                                { key: "opened", header: "Opened", render: (row) => formatDate(row.opened_at) },
                                { key: "opening", header: "Opening cash", render: (row) => formatCurrency(row.opening_cash) },
                                { key: "expected", header: "Expected", render: (row) => formatCurrency(row.expected_cash) },
                                { key: "closing", header: "Closing", render: (row) => row.closing_cash != null ? formatCurrency(row.closing_cash) : "Open" },
                                { key: "variance", header: "Variance", render: (row) => row.variance != null ? formatCurrency(row.variance) : "Pending" },
                                { key: "status", header: "Status", render: (row) => <Chip size="small" color={statusChip(row.status)} label={row.status.replace(/_/g, " ")} /> }
                            ]}
                            emptyMessage={loading ? "Loading teller sessions..." : "No teller sessions recorded."}
                        />
                    </Stack>
                </CardContent>
            </MotionCard>
        </Stack>
    );
}
