import { MotionCard, MotionModal } from "../ui/motion";
import { Alert, Card, CardContent, Chip, Grid, MenuItem, Pagination, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { AppLoader } from "../components/AppLoader";
import { DataTable, type Column } from "../components/DataTable";
import { useToast } from "../components/Toast";
import { api, getApiErrorMessage } from "../lib/api";
import { endpoints, type AuditorExceptionsResponse } from "../lib/endpoints";
import type { AuditorException } from "../types/api";
import { formatCurrency, formatDate } from "../utils/format";

export function AuditorExceptionsPage() {
    const navigate = useNavigate();
    const { pushToast } = useToast();
    const [rows, setRows] = useState<AuditorException[]>([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [reason, setReason] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [loading, setLoading] = useState(true);
    const limit = 20;

    useEffect(() => {
        setLoading(true);
        void api.get<AuditorExceptionsResponse>(endpoints.auditor.exceptions(), {
            params: {
                page,
                limit,
                reason: reason || undefined,
                from: from || undefined,
                to: to || undefined
            }
        })
            .then(({ data }) => {
                setRows(data.data.data);
                setTotal(data.data.pagination.total);
            })
            .catch((error) =>
                pushToast({
                    type: "error",
                    title: "Unable to load exceptions",
                    message: getApiErrorMessage(error)
                })
            )
            .finally(() => setLoading(false));
    }, [from, limit, page, pushToast, reason, to]);

    const columns: Column<AuditorException>[] = [
        {
            key: "reason",
            header: "Reason",
            render: (row) => <Chip size="small" label={row.reason_code} color={row.reason_code === "REVERSAL" || row.reason_code === "MAKER_CHECKER_VIOLATION" ? "error" : "warning"} />
        },
        { key: "reference", header: "Reference", render: (row) => row.reference || "N/A" },
        { key: "created", header: "Created", render: (row) => formatDate(row.created_at) },
        { key: "amount", header: "Amount", render: (row) => formatCurrency(row.amount) },
        { key: "branch", header: "Branch", render: (row) => row.branch_id || "N/A" },
        {
            key: "journal",
            header: "Journal",
            render: (row) =>
                row.journal_id ? (
                    <Typography
                        variant="body2"
                        sx={{ fontWeight: 700, cursor: "pointer" }}
                        onClick={() => navigate(`/auditor/journals/${row.journal_id}`)}
                    >
                        Open Journal
                    </Typography>
                ) : "No journal"
        }
    ];

    return (
        <Stack spacing={3}>
            <MotionCard variant="outlined">
                <CardContent>
                    <Typography variant="h5">Exceptions</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                        Review flagged postings, timing anomalies, manual journals, and maker-checker issues.
                    </Typography>
                </CardContent>
            </MotionCard>

            <MotionCard variant="outlined">
                <CardContent>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <TextField select label="Reason" fullWidth value={reason} onChange={(event) => { setReason(event.target.value); setPage(1); }}>
                                <MenuItem value="">All</MenuItem>
                                {["HIGH_VALUE_TX", "BACKDATED_ENTRY", "REVERSAL", "OUT_OF_HOURS_POSTING", "MAKER_CHECKER_VIOLATION", "MANUAL_JOURNAL"].map((item) => (
                                    <MenuItem key={item} value={item}>{item}</MenuItem>
                                ))}
                            </TextField>
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <TextField type="date" label="From" InputLabelProps={{ shrink: true }} fullWidth value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} />
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <TextField type="date" label="To" InputLabelProps={{ shrink: true }} fullWidth value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} />
                        </Grid>
                    </Grid>
                </CardContent>
            </MotionCard>

            {loading ? (
                <AppLoader fullscreen={false} minHeight={280} message="Loading exception feed..." />
            ) : (
                <MotionCard variant="outlined">
                    <CardContent>
                        {!rows.length ? <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>No exceptions match the current filters.</Alert> : null}
                        <Stack spacing={2}>
                            <DataTable rows={rows} columns={columns} emptyMessage="No exception items found." />
                            {total > 0 ? (
                                <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={1.5}>
                                    <Typography variant="body2" color="text.secondary">
                                        Showing {(page - 1) * limit + 1}-{Math.min(page * limit, total)} of {total}
                                    </Typography>
                                    <Pagination count={Math.max(1, Math.ceil(total / limit))} page={page} onChange={(_, value) => setPage(value)} color="primary" />
                                </Stack>
                            ) : null}
                        </Stack>
                    </CardContent>
                </MotionCard>
            )}
        </Stack>
    );
}
