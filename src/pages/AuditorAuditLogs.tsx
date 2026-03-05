import { MotionCard, MotionModal } from "../ui/motion";
import { Alert, Card, CardContent, Grid, Pagination, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";

import { AppLoader } from "../components/AppLoader";
import { DataTable, type Column } from "../components/DataTable";
import { useToast } from "../components/Toast";
import { api, getApiErrorMessage } from "../lib/api";
import { endpoints, type AuditorAuditLogsResponse } from "../lib/endpoints";
import type { AuditLogEntry } from "../types/api";
import { formatDate } from "../utils/format";

export function AuditorAuditLogsPage() {
    const { pushToast } = useToast();
    const [rows, setRows] = useState<AuditLogEntry[]>([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [action, setAction] = useState("");
    const [entityType, setEntityType] = useState("");
    const [actorUserId, setActorUserId] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [loading, setLoading] = useState(false);
    const limit = 20;
    const hasAnyFilter = Boolean(action.trim() || entityType.trim() || actorUserId.trim() || from || to);

    useEffect(() => {
        if (!hasAnyFilter) {
            setRows([]);
            setTotal(0);
            setLoading(false);
            return;
        }

        setLoading(true);
        void api.get<AuditorAuditLogsResponse>(endpoints.auditor.auditLogs(), {
            params: {
                page,
                limit,
                action: action || undefined,
                entity_type: entityType || undefined,
                actor_user_id: actorUserId || undefined,
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
                    title: "Unable to load audit logs",
                    message: getApiErrorMessage(error)
                })
            )
            .finally(() => setLoading(false));
    }, [action, actorUserId, entityType, from, hasAnyFilter, limit, page, pushToast, to]);

    const columns: Column<AuditLogEntry>[] = [
        { key: "created_at", header: "Time", render: (row) => formatDate(row.created_at) },
        { key: "action", header: "Action", render: (row) => row.action },
        { key: "entity_type", header: "Entity", render: (row) => row.entity_type },
        { key: "actor", header: "Actor", render: (row) => row.actor_user_id || row.user_id || "Unknown" },
        {
            key: "before",
            header: "Before",
            render: (row) => (
                <Typography component="pre" variant="caption" sx={{ whiteSpace: "pre-wrap", m: 0 }}>
                    {row.before_data ? JSON.stringify(row.before_data, null, 2) : "N/A"}
                </Typography>
            )
        },
        {
            key: "after",
            header: "After",
            render: (row) => (
                <Typography component="pre" variant="caption" sx={{ whiteSpace: "pre-wrap", m: 0 }}>
                    {row.after_data ? JSON.stringify(row.after_data, null, 2) : "N/A"}
                </Typography>
            )
        }
    ];

    return (
        <Stack spacing={3}>
            <MotionCard variant="outlined">
                <CardContent>
                    <Typography variant="h5">Audit Logs</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                        Immutable change trail for sensitive actions, user role changes, financial posting, and export activity.
                    </Typography>
                </CardContent>
            </MotionCard>

            <MotionCard variant="outlined">
                <CardContent>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 3 }}>
                            <TextField label="Action" fullWidth value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }} />
                        </Grid>
                        <Grid size={{ xs: 12, md: 3 }}>
                            <TextField label="Entity Type" fullWidth value={entityType} onChange={(event) => { setEntityType(event.target.value); setPage(1); }} />
                        </Grid>
                        <Grid size={{ xs: 12, md: 3 }}>
                            <TextField label="Actor User ID" fullWidth value={actorUserId} onChange={(event) => { setActorUserId(event.target.value); setPage(1); }} />
                        </Grid>
                        <Grid size={{ xs: 12, md: 3 }}>
                            <TextField type="date" label="From" InputLabelProps={{ shrink: true }} fullWidth value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} />
                        </Grid>
                        <Grid size={{ xs: 12, md: 3 }}>
                            <TextField type="date" label="To" InputLabelProps={{ shrink: true }} fullWidth value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} />
                        </Grid>
                    </Grid>
                </CardContent>
            </MotionCard>

            {!hasAnyFilter ? (
                <MotionCard variant="outlined">
                    <CardContent>
                        <Alert severity="info" variant="outlined">
                            Please add at least one filter to view audit logs.
                        </Alert>
                    </CardContent>
                </MotionCard>
            ) : loading ? (
                <AppLoader fullscreen={false} minHeight={280} message="Loading audit logs..." />
            ) : (
                <MotionCard variant="outlined">
                    <CardContent>
                        {!rows.length ? <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>No audit logs match the current filters.</Alert> : null}
                        <Stack spacing={2}>
                            <DataTable rows={rows} columns={columns} emptyMessage="No audit logs available." />
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
