import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import HourglassTopRoundedIcon from "@mui/icons-material/HourglassTopRounded";
import HighlightOffRoundedIcon from "@mui/icons-material/HighlightOffRounded";
import WalletRoundedIcon from "@mui/icons-material/WalletRounded";
import PrintRoundedIcon from "@mui/icons-material/PrintRounded";
import {
    Alert,
    Box,
    Button,
    CardContent,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Grid,
    MenuItem,
    Paper,
    Stack,
    TablePagination,
    TextField,
    Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { AppLoader } from "../components/AppLoader";
import { DataTable, type Column } from "../components/DataTable";
import { useToast } from "../components/Toast";
import { api, getApiErrorMessage } from "../lib/api";
import { endpoints, type PaymentOrdersResponse, type ReconcilePaymentOrderResponse } from "../lib/endpoints";
import type { PaymentOrder } from "../types/api";
import { brandColors } from "../theme/colors";
import { MotionCard } from "../ui/motion";
import { formatCurrency, formatDate } from "../utils/format";

function formatPaymentPurpose(purpose: string) {
    return purpose === "savings_deposit" ? "Savings deposit" : purpose === "share_contribution" ? "Share contribution" : purpose.replace(/_/g, " ");
}

function formatPaymentStatus(status: string) {
    return status.replace(/_/g, " ");
}

function normalizePaymentOrder(order: PaymentOrder) {
    if ((order.posted_at || order.journal_id) && order.status !== "posted") {
        return {
            ...order,
            status: "posted" as const
        };
    }

    return order;
}

interface MetricCardProps {
    label: string;
    value: string | number;
    helper: string;
    icon: typeof WalletRoundedIcon;
    tone: "primary" | "success" | "warning" | "danger";
}

function MetricCard({ label, value, helper, icon: Icon, tone }: MetricCardProps) {
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

export function PaymentsPage() {
    const theme = useTheme();
    const { pushToast } = useToast();
    const { selectedTenantId, selectedBranchId, selectedBranchName, subscription } = useAuth();
    const hasPaymentsAccess = Boolean(subscription?.features?.contributions_enabled);
    const [orders, setOrders] = useState<PaymentOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [purposeFilter, setPurposeFilter] = useState<string>("all");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [selectedReceipt, setSelectedReceipt] = useState<PaymentOrder | null>(null);
    const [reconcilingOrderId, setReconcilingOrderId] = useState<string | null>(null);

    useEffect(() => {
        const loadOrders = async () => {
            if (!selectedTenantId || !hasPaymentsAccess) {
                setOrders([]);
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const { data } = await api.get<PaymentOrdersResponse>(endpoints.memberPayments.listOrders(), {
                    params: {
                        tenant_id: selectedTenantId,
                        branch_id: selectedBranchId || undefined,
                        page: 1,
                        limit: 100
                    }
                });
                setOrders((data.data?.data || []).map((order) => normalizePaymentOrder(order)));
            } catch (loadError) {
                setError(getApiErrorMessage(loadError));
                setOrders([]);
            } finally {
                setLoading(false);
            }
        };

        void loadOrders();
    }, [hasPaymentsAccess, selectedBranchId, selectedTenantId]);

    const mergeOrder = (nextOrder: PaymentOrder) => {
        const normalized = normalizePaymentOrder(nextOrder);
        setOrders((current) => {
            const next = [normalized, ...current.filter((entry) => entry.id !== normalized.id)];
            next.sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
            return next;
        });
        setSelectedReceipt((current) => (current?.id === normalized.id ? normalized : current));
        return normalized;
    };

    const filteredOrders = useMemo(
        () =>
            orders.filter((order) => {
                if (statusFilter !== "all" && order.status !== statusFilter) {
                    return false;
                }

                if (purposeFilter !== "all" && order.purpose !== purposeFilter) {
                    return false;
                }

                if (search.trim()) {
                    const needle = search.trim().toLowerCase();
                    const haystack = [
                        order.member_name,
                        order.member_no,
                        order.account_name,
                        order.account_number,
                        order.provider_ref,
                        order.external_id,
                        order.error_message
                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();

                    if (!haystack.includes(needle)) {
                        return false;
                    }
                }

                return true;
            }),
        [orders, purposeFilter, search, statusFilter]
    );

    const paginatedOrders = useMemo(
        () => filteredOrders.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
        [filteredOrders, page, rowsPerPage]
    );

    const metrics = useMemo(() => ({
        total: orders.length,
        posted: orders.filter((order) => order.status === "posted").length,
        pending: orders.filter((order) => ["pending", "paid"].includes(order.status)).length,
        failed: orders.filter((order) => ["failed", "expired"].includes(order.status)).length,
        amount: orders.reduce((sum, order) => sum + order.amount, 0)
    }), [orders]);

    useEffect(() => {
        setPage(0);
    }, [purposeFilter, search, statusFilter]);

    const handleReconcile = async (order: PaymentOrder) => {
        setReconcilingOrderId(order.id);
        try {
            const { data } = await api.post<ReconcilePaymentOrderResponse>(endpoints.memberPayments.reconcile(order.id));
            const nextOrder = mergeOrder(data.data.order);
            if (data.data.reconciled && nextOrder.status === "posted") {
                pushToast({
                    title: "Payment posted",
                    message: "The paid mobile money order has been posted successfully.",
                    type: "success"
                });
            } else {
                pushToast({
                    title: "No new posting yet",
                    message: `This order is currently ${formatPaymentStatus(nextOrder.status)}.`,
                    type: nextOrder.status === "failed" ? "error" : "success"
                });
            }
        } catch (reconcileError) {
            pushToast({
                title: "Reconcile failed",
                message: getApiErrorMessage(reconcileError, "Unable to reconcile this payment order."),
                type: "error"
            });
        } finally {
            setReconcilingOrderId(null);
        }
    };

    const columns: Column<PaymentOrder>[] = [
        {
            key: "member",
            header: "Member",
            render: (row) => (
                <Stack spacing={0.35}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {row.member_name || "Unknown member"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {row.member_no || row.member_id}
                    </Typography>
                </Stack>
            )
        },
        {
            key: "payment",
            header: "Payment",
            render: (row) => (
                <Stack spacing={0.35}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {formatPaymentPurpose(row.purpose)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {row.account_name || row.account_number || row.account_id}
                    </Typography>
                </Stack>
            )
        },
        {
            key: "amount",
            header: "Amount",
            render: (row) => formatCurrency(row.amount)
        },
        {
            key: "status",
            header: "Status",
            render: (row) => (
                <Chip
                    size="small"
                    label={formatPaymentStatus(row.status)}
                    color={row.status === "posted" ? "success" : row.status === "failed" ? "error" : row.status === "expired" ? "warning" : "info"}
                    variant={row.status === "posted" ? "filled" : "outlined"}
                />
            )
        },
        {
            key: "reference",
            header: "Reference",
            render: (row) => row.provider_ref || row.external_id
        },
        {
            key: "date",
            header: "Date",
            render: (row) => formatDate(row.created_at)
        },
        {
            key: "actions",
            header: "Actions",
            render: (row) => (
                <Stack direction="row" spacing={1}>
                    <Button size="small" variant="outlined" onClick={() => setSelectedReceipt(row)}>
                        Receipt
                    </Button>
                    {row.status === "paid" && !row.posted_at ? (
                        <Button
                            size="small"
                            variant="contained"
                            onClick={() => void handleReconcile(row)}
                            disabled={reconcilingOrderId === row.id}
                        >
                            {reconcilingOrderId === row.id ? "Reconciling..." : "Reconcile"}
                        </Button>
                    ) : null}
                </Stack>
            )
        }
    ];

    if (!hasPaymentsAccess) {
        return <Navigate to="/dashboard" replace />;
    }

    if (loading) {
        return <AppLoader message="Loading payment operations..." />;
    }

    return (
        <Stack spacing={3}>
            <MotionCard
                variant="outlined"
                sx={{
                    background: theme.palette.mode === "dark"
                        ? `linear-gradient(135deg, ${alpha("#0F1A2B", 0.96)}, ${alpha("#124E78", 0.88)})`
                        : `linear-gradient(135deg, ${alpha(brandColors.primary[900], 0.96)}, ${alpha(brandColors.accent[700], 0.88)})`,
                    color: "#fff",
                    borderColor: "transparent"
                }}
            >
                <CardContent>
                    <Stack spacing={1.1}>
                        <Typography variant="overline" sx={{ color: alpha("#fff", 0.72), letterSpacing: 1.3 }}>
                            Branch payment operations
                        </Typography>
                        <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.08 }}>
                            Follow every member mobile-money action for {selectedBranchName || "the selected branch"}.
                        </Typography>
                        <Typography variant="body2" sx={{ color: alpha("#fff", 0.84), maxWidth: 860 }}>
                            Review pending approvals, failed attempts, expired requests, and posted journals in one operational ledger so the branch can follow up quickly when something goes wrong.
                        </Typography>
                    </Stack>
                </CardContent>
            </MotionCard>

            {error ? <Alert severity="error">{error}</Alert> : null}

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MetricCard icon={ReceiptLongRoundedIcon} label="Total Requests" value={metrics.total} helper="All mobile money actions in visible branch scope." tone="primary" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MetricCard icon={TaskAltRoundedIcon} label="Posted" value={metrics.posted} helper="Fully posted into the ledger." tone="success" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MetricCard icon={HourglassTopRoundedIcon} label="In Progress" value={metrics.pending} helper="Still waiting for callback or posting." tone="warning" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MetricCard icon={HighlightOffRoundedIcon} label="Failed / Expired" value={metrics.failed} helper={`Tracked amount ${formatCurrency(metrics.amount)}.`} tone="danger" />
                </Grid>
            </Grid>

            <MotionCard variant="outlined">
                <CardContent>
                    <Stack spacing={2}>
                        <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} justifyContent="space-between">
                            <Box>
                                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                    Payment Action Log
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Use this to follow up on member-reported issues and payment exceptions.
                                </Typography>
                            </Box>
                            <Stack direction={{ xs: "column", md: "row" }} spacing={1.25}>
                                <TextField
                                    label="Search"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Member, account, reference..."
                                    sx={{ minWidth: 220 }}
                                />
                                <TextField select label="Purpose" value={purposeFilter} onChange={(event) => setPurposeFilter(event.target.value)} sx={{ minWidth: 180 }}>
                                    <MenuItem value="all">All payments</MenuItem>
                                    <MenuItem value="share_contribution">Share contributions</MenuItem>
                                    <MenuItem value="savings_deposit">Savings deposits</MenuItem>
                                </TextField>
                                <TextField select label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} sx={{ minWidth: 180 }}>
                                    <MenuItem value="all">All statuses</MenuItem>
                                    <MenuItem value="posted">Posted</MenuItem>
                                    <MenuItem value="pending">Pending</MenuItem>
                                    <MenuItem value="paid">Paid</MenuItem>
                                    <MenuItem value="failed">Failed</MenuItem>
                                    <MenuItem value="expired">Expired</MenuItem>
                                </TextField>
                            </Stack>
                        </Stack>

                        <DataTable rows={paginatedOrders} columns={columns} emptyMessage="No payment actions match the current filters." />
                        <TablePagination
                            component="div"
                            count={filteredOrders.length}
                            page={page}
                            onPageChange={(_, nextPage) => setPage(nextPage)}
                            rowsPerPage={rowsPerPage}
                            onRowsPerPageChange={(event) => {
                                setRowsPerPage(Number(event.target.value));
                                setPage(0);
                            }}
                            rowsPerPageOptions={[10, 25, 50]}
                        />
                    </Stack>
                </CardContent>
            </MotionCard>

            <Dialog open={Boolean(selectedReceipt)} onClose={() => setSelectedReceipt(null)} fullWidth maxWidth="sm">
                <DialogTitle>Payment Receipt</DialogTitle>
                <DialogContent dividers>
                    {selectedReceipt ? (
                        <Stack spacing={2}>
                            <Alert
                                severity={
                                    selectedReceipt.status === "posted"
                                        ? "success"
                                        : selectedReceipt.status === "failed"
                                            ? "error"
                                            : selectedReceipt.status === "expired"
                                                ? "warning"
                                                : "info"
                                }
                                variant="outlined"
                            >
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.35 }}>
                                    {selectedReceipt.member_name || "Member payment"}
                                </Typography>
                                <Typography variant="body2">
                                    {formatPaymentPurpose(selectedReceipt.purpose)} · {formatPaymentStatus(selectedReceipt.status)}
                                </Typography>
                            </Alert>

                            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                                <Stack spacing={1.1}>
                                    <Typography variant="h5" sx={{ fontWeight: 800 }}>
                                        {formatCurrency(selectedReceipt.amount)}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {selectedReceipt.provider.toUpperCase()} · {selectedReceipt.currency}
                                    </Typography>
                                    <Divider />
                                    <Typography variant="body2"><strong>Member:</strong> {selectedReceipt.member_name || selectedReceipt.member_id}</Typography>
                                    <Typography variant="body2"><strong>Member No:</strong> {selectedReceipt.member_no || "N/A"}</Typography>
                                    <Typography variant="body2"><strong>Account:</strong> {selectedReceipt.account_name || selectedReceipt.account_number || selectedReceipt.account_id}</Typography>
                                    <Typography variant="body2"><strong>Reference:</strong> {selectedReceipt.provider_ref || selectedReceipt.external_id}</Typography>
                                    <Typography variant="body2"><strong>Initiated:</strong> {formatDate(selectedReceipt.created_at)}</Typography>
                                    {selectedReceipt.paid_at ? <Typography variant="body2"><strong>Paid:</strong> {formatDate(selectedReceipt.paid_at)}</Typography> : null}
                                    {selectedReceipt.posted_at ? <Typography variant="body2"><strong>Posted:</strong> {formatDate(selectedReceipt.posted_at)}</Typography> : null}
                                    {selectedReceipt.journal_id ? <Typography variant="body2"><strong>Journal:</strong> {selectedReceipt.journal_id}</Typography> : null}
                                    {selectedReceipt.description ? <Typography variant="body2"><strong>Description:</strong> {selectedReceipt.description}</Typography> : null}
                                    {selectedReceipt.error_message ? (
                                        <Typography variant="body2" color="error.main"><strong>Issue:</strong> {selectedReceipt.error_message}</Typography>
                                    ) : null}
                                </Stack>
                            </Paper>
                        </Stack>
                    ) : null}
                </DialogContent>
                <DialogActions>
                    <Button startIcon={<PrintRoundedIcon />} onClick={() => window.print()}>
                        Print
                    </Button>
                    <Button onClick={() => setSelectedReceipt(null)}>
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
        </Stack>
    );
}
