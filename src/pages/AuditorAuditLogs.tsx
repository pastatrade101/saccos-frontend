import { MotionCard } from "../ui/motion";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
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
    Pagination,
    Stack,
    TextField,
    Typography
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { AppLoader } from "../components/AppLoader";
import { buildAuditLogFieldChanges, buildAuditLogFieldSummary, formatAuditShortId, formatAuditValue } from "../components/auditor/auditorUtils";
import { DataTable, type Column } from "../components/DataTable";
import { useToast } from "../components/Toast";
import { api, getApiErrorMessage } from "../lib/api";
import { endpoints, type AuditorAuditLogsResponse } from "../lib/endpoints";
import type { AuditLogEntry } from "../types/api";
import { formatDate } from "../utils/format";

export function AuditorAuditLogsPage() {
    const navigate = useNavigate();
    const { pushToast } = useToast();
    const [rows, setRows] = useState<AuditLogEntry[]>([]);
    const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
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
    const selectedLogChanges = useMemo(
        () => buildAuditLogFieldChanges(selectedLog?.before_data, selectedLog?.after_data),
        [selectedLog]
    );
    const actionBreakdown = useMemo(() => {
        const counts = new Map<string, number>();
        for (const row of rows) {
            counts.set(row.action, (counts.get(row.action) || 0) + 1);
        }
        return Array.from(counts.entries())
            .sort((left, right) => right[1] - left[1])
            .slice(0, 4);
    }, [rows]);

    const presets = [
        { label: "Approval actions", action: "APPROVAL", entityType: "" },
        { label: "Policy changes", action: "", entityType: "approval_policy" },
        { label: "Report exports", action: "AUDITOR_EXPORT", entityType: "report_export" }
    ];

    function resolveEntityRoute(row: AuditLogEntry) {
        if (row.entity_type === "loan_application" || row.entity_type === "loan") {
            return "/loans";
        }
        if (row.entity_type === "member" || row.entity_type === "member_application") {
            return "/members";
        }
        if (row.entity_type === "payment_order") {
            return "/payments";
        }
        if (row.entity_type === "teller_session" || row.entity_type === "cash_transaction") {
            return "/cash";
        }
        if (row.entity_type === "approval_policy" || row.entity_type === "approval_request") {
            return "/approvals";
        }
        if (row.entity_type === "report_export") {
            return "/auditor/reports";
        }
        return "/dashboard";
    }

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
        { key: "created_at", header: "Time", render: (row) => formatDate(row.event_at || row.created_at) },
        { key: "action", header: "Action", render: (row) => row.action },
        { key: "entity_type", header: "Entity", render: (row) => row.entity_type },
        {
            key: "actor",
            header: "Actor",
            render: (row) => (
                <Stack spacing={0.25}>
                    <Typography variant="body2" fontWeight={700}>
                        {row.actor_name || formatAuditShortId(row.actor_user_id || row.user_id)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {formatAuditShortId(row.actor_user_id || row.user_id)}
                    </Typography>
                </Stack>
            )
        },
        {
            key: "changes",
            header: "Change summary",
            render: (row) => (
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {buildAuditLogFieldSummary(row.before_data, row.after_data).length ? (
                        buildAuditLogFieldSummary(row.before_data, row.after_data).map((field) => (
                            <Chip key={field} size="small" label={field} variant="outlined" />
                        ))
                    ) : (
                        <Typography variant="caption" color="text.secondary">
                            No structured field diff available.
                        </Typography>
                    )}
                </Stack>
            )
        },
        {
            key: "inspect",
            header: "Inspect",
            render: (row) => (
                <Button size="small" variant="outlined" onClick={() => setSelectedLog(row)}>
                    Open
                </Button>
            )
        }
    ];

    return (
        <Stack spacing={3}>
            <MotionCard variant="outlined">
                <CardContent>
                    <Typography variant="h4" fontWeight={800}>Audit Logs</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                        Immutable change trail for sensitive actions, user role changes, financial posting, and export activity.
                    </Typography>
                </CardContent>
            </MotionCard>

            <MotionCard variant="outlined">
                <CardContent>
                    <Stack spacing={2}>
                        {hasAnyFilter && rows.length ? (
                            <Grid container spacing={2}>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <Box sx={{ border: (theme) => `1px solid ${theme.palette.divider}`, borderRadius: 2.5, p: 1.75 }}>
                                        <Typography variant="overline" color="text.secondary">
                                            Loaded events
                                        </Typography>
                                        <Typography variant="h5" fontWeight={800}>
                                            {total}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Audit trail rows matching the current investigation filter.
                                        </Typography>
                                    </Box>
                                </Grid>
                                <Grid size={{ xs: 12, md: 8 }}>
                                    <Box sx={{ border: (theme) => `1px solid ${theme.palette.divider}`, borderRadius: 2.5, p: 1.75 }}>
                                        <Typography variant="overline" color="text.secondary">
                                            Action mix
                                        </Typography>
                                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
                                            {actionBreakdown.map(([entryAction, count]) => (
                                                <Chip key={entryAction} label={`${entryAction}: ${count}`} variant="outlined" />
                                            ))}
                                        </Stack>
                                    </Box>
                                </Grid>
                            </Grid>
                        ) : null}
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            {presets.map((preset) => (
                                <Chip
                                    key={preset.label}
                                    label={preset.label}
                                    variant="outlined"
                                    onClick={() => {
                                        setAction(preset.action);
                                        setEntityType(preset.entityType);
                                        setPage(1);
                                    }}
                                />
                            ))}
                            <Button
                                size="small"
                                onClick={() => {
                                    setAction("");
                                    setEntityType("");
                                    setActorUserId("");
                                    setFrom("");
                                    setTo("");
                                    setPage(1);
                                }}
                                disabled={!hasAnyFilter}
                            >
                                Clear filters
                            </Button>
                        </Stack>
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
                    </Stack>
                </CardContent>
            </MotionCard>

            {!hasAnyFilter ? (
                <MotionCard variant="outlined">
                    <CardContent>
                        <Stack spacing={1.5}>
                            <Alert severity="info" variant="outlined">
                                Add a filter or choose a preset to load the audit trail.
                            </Alert>
                            <Box>
                                <Typography variant="body2" color="text.secondary">
                                    Recommended starting points: approval actions, policy changes, or report exports.
                                </Typography>
                            </Box>
                        </Stack>
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

            <Dialog open={Boolean(selectedLog)} onClose={() => setSelectedLog(null)} fullWidth maxWidth="md">
                <DialogTitle>Audit log detail</DialogTitle>
                <DialogContent>
                    {selectedLog ? (
                        <Stack spacing={2.5} sx={{ pt: 1 }}>
                            <Grid container spacing={2}>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <Box sx={{ border: (theme) => `1px solid ${theme.palette.divider}`, borderRadius: 2.5, p: 2 }}>
                                        <Typography variant="subtitle1" fontWeight={800}>
                                            Event context
                                        </Typography>
                                        <Stack spacing={1} sx={{ mt: 1.5 }}>
                                            <Typography variant="body2"><strong>Action:</strong> {selectedLog.action}</Typography>
                                            <Typography variant="body2"><strong>Entity:</strong> {selectedLog.entity_type}</Typography>
                                            <Typography variant="body2"><strong>Entity ID:</strong> {selectedLog.entity_id || "N/A"}</Typography>
                                            <Typography variant="body2"><strong>Time:</strong> {formatDate(selectedLog.event_at || selectedLog.created_at)}</Typography>
                                            <Typography variant="body2"><strong>Actor:</strong> {selectedLog.actor_name || formatAuditShortId(selectedLog.actor_user_id || selectedLog.user_id)}</Typography>
                                        </Stack>
                                    </Box>
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <Box sx={{ border: (theme) => `1px solid ${theme.palette.divider}`, borderRadius: 2.5, p: 2 }}>
                                        <Typography variant="subtitle1" fontWeight={800}>
                                            Access trail
                                        </Typography>
                                        <Stack spacing={1} sx={{ mt: 1.5 }}>
                                            <Typography variant="body2"><strong>IP:</strong> {selectedLog.ip || "Not captured"}</Typography>
                                            <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
                                                <strong>User agent:</strong> {selectedLog.user_agent || "Not captured"}
                                            </Typography>
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                endIcon={<ArrowForwardRoundedIcon fontSize="small" />}
                                                sx={{ width: "fit-content", mt: 0.5 }}
                                                onClick={() => {
                                                    const path = resolveEntityRoute(selectedLog);
                                                    setSelectedLog(null);
                                                    navigate(path);
                                                }}
                                            >
                                                Open related workspace
                                            </Button>
                                        </Stack>
                                    </Box>
                                </Grid>
                            </Grid>

                            <Divider />

                            <Box>
                                <Typography variant="subtitle1" fontWeight={800}>
                                    Structured field diff
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                    Changed fields are shown side by side to make policy, approval, and configuration changes easier to review.
                                </Typography>
                            </Box>

                            {!selectedLogChanges.length ? (
                                <Alert severity="info" variant="outlined">
                                    No structured before/after diff is available for this event.
                                </Alert>
                            ) : (
                                <Stack spacing={1.5}>
                                    {selectedLogChanges.map((change) => (
                                        <Box
                                            key={change.field}
                                            sx={{
                                                border: (theme) => `1px solid ${theme.palette.divider}`,
                                                borderRadius: 2.5,
                                                p: 2
                                            }}
                                        >
                                            <Typography variant="subtitle2" fontWeight={800}>
                                                {change.field}
                                            </Typography>
                                            <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
                                                <Grid size={{ xs: 12, md: 6 }}>
                                                    <Box sx={{ borderRadius: 2, bgcolor: "action.hover", p: 1.5 }}>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Before
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                                                            {formatAuditValue(change.before)}
                                                        </Typography>
                                                    </Box>
                                                </Grid>
                                                <Grid size={{ xs: 12, md: 6 }}>
                                                    <Box sx={{ borderRadius: 2, bgcolor: "primary.50", p: 1.5 }}>
                                                        <Typography variant="caption" color="text.secondary">
                                                            After
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                                                            {formatAuditValue(change.after)}
                                                        </Typography>
                                                    </Box>
                                                </Grid>
                                            </Grid>
                                        </Box>
                                    ))}
                                </Stack>
                            )}
                        </Stack>
                    ) : null}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3 }}>
                    <Button onClick={() => setSelectedLog(null)}>Close</Button>
                </DialogActions>
            </Dialog>
        </Stack>
    );
}
