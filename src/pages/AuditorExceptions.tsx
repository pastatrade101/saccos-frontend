import { MotionCard } from "../ui/motion";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import {
    Alert,
    Box,
    Button,
    CardContent,
    Chip,
    CircularProgress,
    Divider,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    Grid,
    InputLabel,
    List,
    ListItem,
    ListItemText,
    MenuItem,
    Pagination,
    Select,
    Stack,
    TextField,
    Typography
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { AppLoader } from "../components/AppLoader";
import { formatAuditShortId, getAuditorReasonMeta, getSeverityScore } from "../components/auditor/auditorUtils";
import { DataTable, type Column } from "../components/DataTable";
import { useToast } from "../components/Toast";
import { api, getApiErrorMessage } from "../lib/api";
import { endpoints, type AuditorCaseAssigneesResponse, type AuditorCaseCommentResponse, type AuditorCaseDetailResponse, type AuditorCaseEvidenceResponse, type AuditorCaseResponse, type AuditorEvidenceDownloadResponse, type AuditorEvidenceInitResponse, type AuditorExceptionsResponse } from "../lib/endpoints";
import { supabase } from "../lib/supabase";
import type { AuditorCaseAssignee, AuditorCaseDetail, AuditorCaseEvidence, AuditorException } from "../types/api";
import { formatCurrency, formatDate } from "../utils/format";

const CASE_STATUS_LABELS: Record<AuditorException["case_status"], string> = {
    open: "Open",
    under_review: "Under review",
    resolved: "Resolved",
    waived: "Waived"
};

const CASE_STATUS_CHIP_COLOR: Record<AuditorException["case_status"], "default" | "warning" | "success"> = {
    open: "default",
    under_review: "warning",
    resolved: "success",
    waived: "default"
};

function buildCaseContext(row: AuditorException) {
    return {
        reason_code: row.reason_code,
        journal_id: row.journal_id || null,
        branch_id: row.branch_id || null,
        user_id: row.user_id || null,
        reference: row.reference || null
    };
}

function formatFileSize(bytes: number) {
    if (bytes >= 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    if (bytes >= 1024) {
        return `${Math.round(bytes / 1024)} KB`;
    }
    return `${bytes} B`;
}

function formatRoleLabel(value?: string | null) {
    if (!value) {
        return "User";
    }
    return value
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function formatTimelineDescription(item: AuditorCaseDetail["timeline"][number]) {
    if (item.type === "comment") {
        return item.body || "Investigation note recorded.";
    }
    if (item.type === "evidence") {
        return item.file_name || "Supporting file attached.";
    }
    if (item.type === "resolved" || item.type === "waived") {
        return item.status === "waived" ? "Case closed as waived." : "Case closed as resolved.";
    }
    if (item.type === "updated") {
        return "Case status, notes, or assignment changed.";
    }
    return "Case entered the investigation queue.";
}

export function AuditorExceptionsPage() {
    const navigate = useNavigate();
    const { pushToast } = useToast();
    const [rows, setRows] = useState<AuditorException[]>([]);
    const [assignees, setAssignees] = useState<AuditorCaseAssignee[]>([]);
    const [selectedCase, setSelectedCase] = useState<AuditorException | null>(null);
    const [caseDialogOpen, setCaseDialogOpen] = useState(false);
    const [caseStatus, setCaseStatus] = useState<AuditorException["case_status"]>("open");
    const [caseNotes, setCaseNotes] = useState("");
    const [caseAssigneeUserId, setCaseAssigneeUserId] = useState("");
    const [caseDetail, setCaseDetail] = useState<AuditorCaseDetail | null>(null);
    const [caseDetailLoading, setCaseDetailLoading] = useState(false);
    const [caseSaving, setCaseSaving] = useState(false);
    const [commentDraft, setCommentDraft] = useState("");
    const [commentSaving, setCommentSaving] = useState(false);
    const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
    const [evidenceUploading, setEvidenceUploading] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [reason, setReason] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [loading, setLoading] = useState(true);
    const limit = 20;

    useEffect(() => {
        void api.get<AuditorCaseAssigneesResponse>(endpoints.auditor.caseAssignees())
            .then(({ data }) => setAssignees(data.data))
            .catch((error) =>
                pushToast({
                    type: "error",
                    title: "Unable to load auditors",
                    message: getApiErrorMessage(error)
                })
            );
    }, [pushToast]);

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

    const sortedRows = useMemo(
        () => [...rows].sort((left, right) => getSeverityScore(right.reason_code) - getSeverityScore(left.reason_code)),
        [rows]
    );

    const currentSummary = useMemo(() => {
        const critical = rows.filter((row) => getAuditorReasonMeta(row.reason_code).severity === "critical").length;
        const warning = rows.filter((row) => getAuditorReasonMeta(row.reason_code).severity === "warning").length;
        const manual = rows.filter((row) => row.reason_code === "MANUAL_JOURNAL").length;
        const open = rows.filter((row) => row.case_status === "open").length;
        const underReview = rows.filter((row) => row.case_status === "under_review").length;
        const resolved = rows.filter((row) => ["resolved", "waived"].includes(row.case_status)).length;
        return { critical, warning, manual, open, underReview, resolved };
    }, [rows]);

    async function loadCaseDetail(row: AuditorException) {
        setCaseDetailLoading(true);
        try {
            const { data } = await api.get<AuditorCaseDetailResponse>(endpoints.auditor.caseDetail(row.case_key), {
                params: buildCaseContext(row)
            });
            setCaseDetail(data.data);
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to load case details",
                message: getApiErrorMessage(error)
            });
        } finally {
            setCaseDetailLoading(false);
        }
    }

    function openCaseDialog(row: AuditorException) {
        setSelectedCase(row);
        setCaseStatus(row.case_status);
        setCaseNotes(row.case_notes || "");
        setCaseAssigneeUserId(row.case_assignee_user_id || "");
        setCaseDetail(null);
        setCommentDraft("");
        setEvidenceFile(null);
        setCaseDialogOpen(true);
        void loadCaseDetail(row);
    }

    function closeCaseDialog() {
        if (caseSaving || commentSaving || evidenceUploading) {
            return;
        }
        setCaseDialogOpen(false);
        setSelectedCase(null);
        setCaseStatus("open");
        setCaseNotes("");
        setCaseAssigneeUserId("");
        setCaseDetail(null);
        setCommentDraft("");
        setEvidenceFile(null);
    }

    function openRelatedPath(path: string) {
        closeCaseDialog();
        navigate(path);
    }

    async function handleCaseSave() {
        if (!selectedCase) {
            return;
        }

        setCaseSaving(true);
        try {
            const { data } = await api.patch<AuditorCaseResponse>(
                endpoints.auditor.updateCase(selectedCase.case_key),
                {
                    status: caseStatus,
                    notes: caseNotes.trim() || null,
                    assignee_user_id: caseAssigneeUserId || null,
                    reason_code: selectedCase.reason_code,
                    journal_id: selectedCase.journal_id,
                    branch_id: selectedCase.branch_id,
                    user_id: selectedCase.user_id,
                    reference: selectedCase.reference
                }
            );

            setRows((current) =>
                current.map((row) =>
                    row.case_key === selectedCase.case_key
                        ? {
                            ...row,
                            ...data.data
                        }
                        : row
                )
            );
            setCaseDetail((current) => current ? {
                ...current,
                case: {
                    ...current.case,
                    ...data.data
                }
            } : current);

            pushToast({
                type: "success",
                title: "Case updated",
                message: "Audit case status, assignment, and notes were saved."
            });
            closeCaseDialog();
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to update case",
                message: getApiErrorMessage(error)
            });
        } finally {
            setCaseSaving(false);
        }
    }

    async function handleCommentSave() {
        if (!selectedCase || !commentDraft.trim()) {
            return;
        }

        setCommentSaving(true);
        try {
            const { data } = await api.post<AuditorCaseCommentResponse>(
                endpoints.auditor.addCaseComment(selectedCase.case_key),
                {
                    body: commentDraft.trim(),
                    ...buildCaseContext(selectedCase)
                }
            );

            setCaseDetail((current) => current ? {
                ...current,
                comments: [...current.comments, data.data],
                timeline: [
                    {
                        type: "comment",
                        label: "Comment added",
                        at: data.data.created_at,
                        actor_user_id: data.data.author_user_id,
                        actor_name: data.data.author_name || "Auditor",
                        body: data.data.body
                    },
                    ...current.timeline
                ]
            } : current);
            setCommentDraft("");
            pushToast({
                type: "success",
                title: "Comment added",
                message: "The investigation note was added to the case timeline."
            });
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to add comment",
                message: getApiErrorMessage(error)
            });
        } finally {
            setCommentSaving(false);
        }
    }

    async function handleEvidenceUpload() {
        if (!selectedCase || !evidenceFile) {
            return;
        }

        setEvidenceUploading(true);
        try {
            const { data: initResponse } = await api.post<AuditorEvidenceInitResponse>(
                endpoints.auditor.initCaseEvidenceUpload(selectedCase.case_key),
                {
                    file_name: evidenceFile.name,
                    mime_type: evidenceFile.type || "application/octet-stream",
                    file_size_bytes: evidenceFile.size,
                    ...buildCaseContext(selectedCase)
                }
            );

            const { evidence, upload } = initResponse.data;
            const { error: uploadError } = await supabase.storage
                .from(evidence.storage_bucket)
                .uploadToSignedUrl(upload.path, upload.token, evidenceFile);

            if (uploadError) {
                throw uploadError;
            }

            const { data: confirmResponse } = await api.post<AuditorCaseEvidenceResponse>(
                endpoints.auditor.confirmCaseEvidenceUpload(evidence.id),
                {}
            );

            setCaseDetail((current) => current ? {
                ...current,
                evidence: [confirmResponse.data, ...current.evidence.filter((item) => item.id !== confirmResponse.data.id)],
                timeline: [
                    {
                        type: "evidence",
                        label: "Evidence uploaded",
                        at: confirmResponse.data.confirmed_at || confirmResponse.data.created_at,
                        actor_user_id: confirmResponse.data.uploaded_by,
                        actor_name: confirmResponse.data.uploaded_by_name || "Auditor",
                        file_name: confirmResponse.data.file_name,
                        status: confirmResponse.data.status
                    },
                    ...current.timeline
                ]
            } : current);
            setEvidenceFile(null);
            pushToast({
                type: "success",
                title: "Evidence uploaded",
                message: "The case evidence file is now attached and available to auditors."
            });
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to upload evidence",
                message: getApiErrorMessage(error)
            });
        } finally {
            setEvidenceUploading(false);
        }
    }

    async function handleEvidenceDownload(evidence: AuditorCaseEvidence) {
        try {
            const { data } = await api.get<AuditorEvidenceDownloadResponse>(
                endpoints.auditor.downloadCaseEvidence(evidence.id)
            );
            window.open(data.data.download_url, "_blank", "noopener,noreferrer");
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to open evidence",
                message: getApiErrorMessage(error)
            });
        }
    }

    const columns: Column<AuditorException>[] = [
        {
            key: "severity",
            header: "Severity",
            render: (row) => {
                const meta = getAuditorReasonMeta(row.reason_code);
                return <Chip size="small" label={meta.severity} color={meta.chipColor} sx={{ textTransform: "capitalize" }} />;
            }
        },
        {
            key: "reason",
            header: "Exception",
            render: (row) => {
                const meta = getAuditorReasonMeta(row.reason_code);
                return (
                    <Stack spacing={0.25}>
                        <Typography variant="body2" fontWeight={700}>
                            {meta.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {meta.summary}
                        </Typography>
                    </Stack>
                );
            }
        },
        {
            key: "case_status",
            header: "Case",
            render: (row) => (
                <Stack spacing={0.5}>
                    <Chip
                        size="small"
                        label={CASE_STATUS_LABELS[row.case_status]}
                        color={CASE_STATUS_CHIP_COLOR[row.case_status]}
                        variant={row.case_status === "open" ? "outlined" : "filled"}
                        sx={{ width: "fit-content" }}
                    />
                    <Typography variant="caption" color="text.secondary">
                        {row.case_updated_at ? `Updated ${formatDate(row.case_updated_at)}` : "Awaiting triage"}
                    </Typography>
                </Stack>
            )
        },
        {
            key: "owner",
            header: "Owner",
            render: (row) => (
                <Stack spacing={0.25}>
                    <Typography variant="body2" fontWeight={600}>
                        {row.case_assignee_name || "Unassigned"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {row.case_status === "resolved" || row.case_status === "waived"
                            ? row.case_resolved_at ? `Closed ${formatDate(row.case_resolved_at)}` : "Closed"
                            : "Investigation owner"}
                    </Typography>
                </Stack>
            )
        },
        { key: "reference", header: "Reference", render: (row) => row.reference || "N/A" },
        { key: "created", header: "Created", render: (row) => formatDate(row.created_at) },
        { key: "amount", header: "Amount", render: (row) => formatCurrency(row.amount) },
        { key: "branch", header: "Branch", render: (row) => formatAuditShortId(row.branch_id) },
        {
            key: "journal",
            header: "Journal",
            render: (row) =>
                row.journal_id ? (
                    <Button
                        size="small"
                        endIcon={<ArrowForwardRoundedIcon fontSize="small" />}
                        onClick={() => navigate(`/auditor/journals/${row.journal_id}`)}
                    >
                        Open journal
                    </Button>
                ) : "No journal"
        },
        {
            key: "manage_case",
            header: "Manage",
            render: (row) => (
                <Button size="small" variant="outlined" onClick={() => openCaseDialog(row)}>
                    Manage case
                </Button>
            )
        }
    ];

    return (
        <Stack spacing={3}>
            <MotionCard variant="outlined">
                <CardContent>
                    <Stack
                        direction={{ xs: "column", lg: "row" }}
                        justifyContent="space-between"
                        spacing={2}
                        alignItems={{ xs: "flex-start", lg: "center" }}
                    >
                        <Box>
                            <Typography variant="h4" fontWeight={800}>
                                Exceptions
                            </Typography>
                            <Typography variant="body1" color="text.secondary" sx={{ mt: 0.75, maxWidth: 760 }}>
                                Review control breaches, unusual postings, and investigation candidates across the visible audit window.
                            </Typography>
                        </Box>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                            <Chip label={`${total} visible item(s)`} variant="outlined" />
                            <Chip label={`${currentSummary.critical} critical`} color="error" variant="outlined" />
                            <Chip label={`${currentSummary.warning} warning`} color="warning" variant="outlined" />
                            <Chip label={`${currentSummary.open} open`} variant="outlined" />
                            <Chip label={`${currentSummary.underReview} under review`} color="warning" variant="outlined" />
                        </Stack>
                    </Stack>
                </CardContent>
            </MotionCard>

            <MotionCard variant="outlined">
                <CardContent>
                    <Stack spacing={2}>
                        <Stack
                            direction={{ xs: "column", lg: "row" }}
                            justifyContent="space-between"
                            spacing={2}
                            alignItems={{ xs: "flex-start", lg: "center" }}
                        >
                            <Box>
                                <Typography variant="subtitle1" fontWeight={700}>
                                    Investigation filters
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Narrow the exception feed by control type or date window.
                                </Typography>
                            </Box>
                            <Button
                                variant="text"
                                onClick={() => {
                                    setReason("");
                                    setFrom("");
                                    setTo("");
                                    setPage(1);
                                }}
                                disabled={!reason && !from && !to}
                            >
                                Clear filters
                            </Button>
                        </Stack>
                        <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <TextField select label="Reason" fullWidth value={reason} onChange={(event) => { setReason(event.target.value); setPage(1); }}>
                                <MenuItem value="">All</MenuItem>
                                {["HIGH_VALUE_TX", "BACKDATED_ENTRY", "REVERSAL", "OUT_OF_HOURS_POSTING", "MAKER_CHECKER_VIOLATION", "CASH_VARIANCE", "MANUAL_JOURNAL"].map((item) => (
                                    <MenuItem key={item} value={item}>{getAuditorReasonMeta(item).label}</MenuItem>
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
                    </Stack>
                </CardContent>
            </MotionCard>

            <MotionCard variant="outlined">
                <CardContent>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={2} divider={<Divider orientation="vertical" flexItem sx={{ display: { xs: "none", md: "block" } }} />}>
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="overline" color="text.secondary">
                                Critical queue
                            </Typography>
                            <Typography variant="h5" fontWeight={800}>
                                {currentSummary.critical}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                High-severity items on the current page require fast review.
                            </Typography>
                        </Box>
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="overline" color="text.secondary">
                                Manual / reversal pressure
                            </Typography>
                            <Typography variant="h5" fontWeight={800}>
                                {currentSummary.manual}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Manual adjustment journals visible in the current result set.
                            </Typography>
                        </Box>
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="overline" color="text.secondary">
                                Current filter
                            </Typography>
                            <Typography variant="h5" fontWeight={800}>
                                {reason ? getAuditorReasonMeta(reason).label : "All controls"}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {from || to ? `Window ${from || "start"} to ${to || "today"}` : "No date window applied"}
                            </Typography>
                        </Box>
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="overline" color="text.secondary">
                                Case progress
                            </Typography>
                            <Typography variant="h5" fontWeight={800}>
                                {currentSummary.resolved}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Items already closed or waived in the current result set.
                            </Typography>
                        </Box>
                    </Stack>
                </CardContent>
            </MotionCard>

            {loading ? (
                <AppLoader fullscreen={false} minHeight={280} message="Loading exception feed..." />
            ) : (
                <MotionCard variant="outlined">
                    <CardContent>
                        {!rows.length ? <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>No exceptions match the current filters.</Alert> : null}
                        <Stack spacing={2}>
                            <DataTable rows={sortedRows} columns={columns} emptyMessage="No exception items found." />
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

            <Dialog
                open={caseDialogOpen}
                onClose={closeCaseDialog}
                fullWidth
                maxWidth="md"
            >
                <DialogTitle>Manage audit case</DialogTitle>
                <DialogContent>
                    <Stack spacing={2.5} sx={{ pt: 1 }}>
                        {selectedCase ? (
                            <Box>
                                <Typography variant="body2" color="text.secondary">
                                    {getAuditorReasonMeta(selectedCase.reason_code).label}
                                </Typography>
                                <Typography variant="h6" fontWeight={800}>
                                    {selectedCase.reference || formatAuditShortId(selectedCase.journal_id)}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                    {getAuditorReasonMeta(selectedCase.reason_code).summary}
                                </Typography>
                            </Box>
                        ) : null}

                        {caseDetailLoading ? (
                            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ py: 1 }}>
                                <CircularProgress size={18} />
                                <Typography variant="body2" color="text.secondary">
                                    Loading case timeline and evidence...
                                </Typography>
                            </Stack>
                        ) : null}

                        {caseDetail ? (
                            <Grid container spacing={2}>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <Box sx={{ border: (theme) => `1px solid ${theme.palette.divider}`, borderRadius: 3, p: 2.25 }}>
                                        <Stack spacing={1.75}>
                                            <Box>
                                                <Typography variant="subtitle1" fontWeight={800}>
                                                    Investigation context
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    Linked operational entities and quick drilldowns for this case.
                                                </Typography>
                                            </Box>

                                            <Grid container spacing={1.25}>
                                                <Grid size={{ xs: 12, sm: 6 }}>
                                                    <Box sx={{ border: (theme) => `1px solid ${theme.palette.divider}`, borderRadius: 2, p: 1.5, height: "100%" }}>
                                                        <Typography variant="overline" color="text.secondary">
                                                            Branch
                                                        </Typography>
                                                        <Typography variant="subtitle1" fontWeight={700}>
                                                            {caseDetail.related_entities.branch?.name || "No branch linked"}
                                                        </Typography>
                                                    </Box>
                                                </Grid>
                                                <Grid size={{ xs: 12, sm: 6 }}>
                                                    <Box sx={{ border: (theme) => `1px solid ${theme.palette.divider}`, borderRadius: 2, p: 1.5, height: "100%" }}>
                                                        <Typography variant="overline" color="text.secondary">
                                                            Subject user
                                                        </Typography>
                                                        <Typography variant="subtitle1" fontWeight={700}>
                                                            {caseDetail.related_entities.subject_user?.full_name || "No user linked"}
                                                        </Typography>
                                                        {caseDetail.related_entities.subject_user?.role ? (
                                                            <Typography variant="body2" color="text.secondary">
                                                                {formatRoleLabel(caseDetail.related_entities.subject_user.role)}
                                                            </Typography>
                                                        ) : null}
                                                    </Box>
                                                </Grid>
                                                <Grid size={{ xs: 12, sm: 6 }}>
                                                    <Box sx={{ border: (theme) => `1px solid ${theme.palette.divider}`, borderRadius: 2, p: 1.5, height: "100%" }}>
                                                        <Typography variant="overline" color="text.secondary">
                                                            Member
                                                        </Typography>
                                                        <Typography variant="subtitle1" fontWeight={700}>
                                                            {caseDetail.related_entities.member?.full_name || "No member linked"}
                                                        </Typography>
                                                        {caseDetail.related_entities.member ? (
                                                            <Stack spacing={0.25} sx={{ mt: 0.5 }}>
                                                                <Typography variant="body2" color="text.secondary">
                                                                    {caseDetail.related_entities.member.member_no || "Member number unavailable"}
                                                                </Typography>
                                                                {caseDetail.related_entities.member.account_number ? (
                                                                    <Typography variant="body2" color="text.secondary">
                                                                        {caseDetail.related_entities.member.account_name || "Account"} • {caseDetail.related_entities.member.account_number}
                                                                    </Typography>
                                                                ) : null}
                                                            </Stack>
                                                        ) : null}
                                                        {caseDetail.related_entities.member ? (
                                                            <Button
                                                                sx={{ mt: 1.25 }}
                                                                size="small"
                                                                variant="outlined"
                                                                endIcon={<ArrowForwardRoundedIcon fontSize="small" />}
                                                                onClick={() => openRelatedPath("/members")}
                                                            >
                                                                Open members
                                                            </Button>
                                                        ) : null}
                                                    </Box>
                                                </Grid>
                                                <Grid size={{ xs: 12, sm: 6 }}>
                                                    <Box sx={{ border: (theme) => `1px solid ${theme.palette.divider}`, borderRadius: 2, p: 1.5, height: "100%" }}>
                                                        <Typography variant="overline" color="text.secondary">
                                                            Loan
                                                        </Typography>
                                                        <Typography variant="subtitle1" fontWeight={700}>
                                                            {caseDetail.related_entities.loan?.loan_number || "No loan linked"}
                                                        </Typography>
                                                        {caseDetail.related_entities.loan ? (
                                                            <Stack spacing={0.25} sx={{ mt: 0.5 }}>
                                                                <Typography variant="body2" color="text.secondary">
                                                                    Status: {caseDetail.related_entities.loan.status}
                                                                </Typography>
                                                                {caseDetail.related_entities.loan.member_name ? (
                                                                    <Typography variant="body2" color="text.secondary">
                                                                        {caseDetail.related_entities.loan.member_name}
                                                                        {caseDetail.related_entities.loan.member_no ? ` • ${caseDetail.related_entities.loan.member_no}` : ""}
                                                                    </Typography>
                                                                ) : null}
                                                            </Stack>
                                                        ) : null}
                                                        {caseDetail.related_entities.loan ? (
                                                            <Button
                                                                sx={{ mt: 1.25 }}
                                                                size="small"
                                                                variant="outlined"
                                                                endIcon={<ArrowForwardRoundedIcon fontSize="small" />}
                                                                onClick={() => openRelatedPath("/loans")}
                                                            >
                                                                Open loans
                                                            </Button>
                                                        ) : null}
                                                    </Box>
                                                </Grid>
                                                <Grid size={{ xs: 12, sm: 6 }}>
                                                    <Box sx={{ border: (theme) => `1px solid ${theme.palette.divider}`, borderRadius: 2, p: 1.5, height: "100%" }}>
                                                        <Typography variant="overline" color="text.secondary">
                                                            Teller session
                                                        </Typography>
                                                        <Typography variant="subtitle1" fontWeight={700}>
                                                            {caseDetail.related_entities.teller_session ? formatAuditShortId(caseDetail.related_entities.teller_session.id) : "No teller session linked"}
                                                        </Typography>
                                                        {caseDetail.related_entities.teller_session ? (
                                                            <Stack spacing={0.25} sx={{ mt: 0.5 }}>
                                                                <Typography variant="body2" color="text.secondary">
                                                                    {caseDetail.related_entities.teller_session.status} • Opened {formatDate(caseDetail.related_entities.teller_session.opened_at)}
                                                                </Typography>
                                                                <Typography variant="body2" color="text.secondary">
                                                                    Expected cash {formatCurrency(caseDetail.related_entities.teller_session.expected_cash)}
                                                                </Typography>
                                                            </Stack>
                                                        ) : null}
                                                        {caseDetail.related_entities.teller_session ? (
                                                            <Button
                                                                sx={{ mt: 1.25 }}
                                                                size="small"
                                                                variant="outlined"
                                                                endIcon={<ArrowForwardRoundedIcon fontSize="small" />}
                                                                onClick={() => openRelatedPath("/cash")}
                                                            >
                                                                Open cash desk
                                                            </Button>
                                                        ) : null}
                                                    </Box>
                                                </Grid>
                                                <Grid size={{ xs: 12, sm: 6 }}>
                                                    <Box sx={{ border: (theme) => `1px solid ${theme.palette.divider}`, borderRadius: 2, p: 1.5, height: "100%" }}>
                                                        <Typography variant="overline" color="text.secondary">
                                                            Source journal
                                                        </Typography>
                                                        <Typography variant="subtitle1" fontWeight={700}>
                                                            {caseDetail.case.journal_id ? formatAuditShortId(caseDetail.case.journal_id) : "No journal linked"}
                                                        </Typography>
                                                        {caseDetail.case.reference ? (
                                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                                Reference: {caseDetail.case.reference}
                                                            </Typography>
                                                        ) : null}
                                                        {caseDetail.case.journal_id ? (
                                                            <Button
                                                                sx={{ mt: 1.25 }}
                                                                size="small"
                                                                variant="outlined"
                                                                endIcon={<ArrowForwardRoundedIcon fontSize="small" />}
                                                                onClick={() => openRelatedPath(`/auditor/journals/${caseDetail.case.journal_id}`)}
                                                            >
                                                                Open journal
                                                            </Button>
                                                        ) : null}
                                                    </Box>
                                                </Grid>
                                            </Grid>
                                        </Stack>
                                    </Box>
                                </Grid>

                                <Grid size={{ xs: 12, md: 6 }}>
                                    <Box sx={{ border: (theme) => `1px solid ${theme.palette.divider}`, borderRadius: 3, p: 2.25, height: "100%" }}>
                                        <Stack spacing={1.5}>
                                            <Box>
                                                <Typography variant="subtitle1" fontWeight={800}>
                                                    Lifecycle timeline
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    Recent case activity, evidence movement, and resolution history.
                                                </Typography>
                                            </Box>
                                            {!caseDetail.timeline.length ? (
                                                <Alert severity="info" variant="outlined">
                                                    No lifecycle activity has been recorded yet.
                                                </Alert>
                                            ) : (
                                                <List disablePadding sx={{ border: (theme) => `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
                                                    {caseDetail.timeline.map((item, index) => (
                                                        <ListItem
                                                            key={`${item.type}-${item.at}-${index}`}
                                                            sx={{
                                                                alignItems: "flex-start",
                                                                borderBottom: index < caseDetail.timeline.length - 1 ? (theme) => `1px solid ${theme.palette.divider}` : undefined
                                                            }}
                                                        >
                                                            <ListItemText
                                                                primary={
                                                                    <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                                                                        <Chip
                                                                            size="small"
                                                                            label={item.label}
                                                                            color={item.type === "resolved" ? "success" : item.type === "waived" ? "default" : item.type === "evidence" ? "info" : "warning"}
                                                                            variant={item.type === "opened" || item.type === "updated" ? "outlined" : "filled"}
                                                                        />
                                                                        <Typography variant="caption" color="text.secondary">
                                                                            {formatDate(item.at)}
                                                                        </Typography>
                                                                        {item.actor_name ? (
                                                                            <Typography variant="caption" color="text.secondary">
                                                                                {item.actor_name}
                                                                            </Typography>
                                                                        ) : null}
                                                                    </Stack>
                                                                }
                                                                secondary={
                                                                    <Typography variant="body2" color="text.primary" sx={{ mt: 0.75, whiteSpace: "pre-wrap" }}>
                                                                        {formatTimelineDescription(item)}
                                                                    </Typography>
                                                                }
                                                            />
                                                        </ListItem>
                                                    ))}
                                                </List>
                                            )}
                                        </Stack>
                                    </Box>
                                </Grid>
                            </Grid>
                        ) : null}

                        <Grid container spacing={2}>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <FormControl fullWidth>
                                    <InputLabel id="audit-case-status-label">Case status</InputLabel>
                                    <Select
                                        labelId="audit-case-status-label"
                                        label="Case status"
                                        value={caseStatus}
                                        onChange={(event) => setCaseStatus(event.target.value as AuditorException["case_status"])}
                                    >
                                        <MenuItem value="open">Open</MenuItem>
                                        <MenuItem value="under_review">Under review</MenuItem>
                                        <MenuItem value="resolved">Resolved</MenuItem>
                                        <MenuItem value="waived">Waived</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <FormControl fullWidth>
                                    <InputLabel id="audit-case-assignee-label">Assignee</InputLabel>
                                    <Select
                                        labelId="audit-case-assignee-label"
                                        label="Assignee"
                                        value={caseAssigneeUserId}
                                        onChange={(event) => setCaseAssigneeUserId(event.target.value)}
                                    >
                                        <MenuItem value="">Unassigned</MenuItem>
                                        {assignees.map((assignee) => (
                                            <MenuItem key={assignee.user_id} value={assignee.user_id}>
                                                {assignee.full_name}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                        </Grid>

                        <TextField
                            label="Investigation notes"
                            value={caseNotes}
                            onChange={(event) => setCaseNotes(event.target.value)}
                            fullWidth
                            multiline
                            minRows={5}
                            helperText="Capture what was reviewed, what needs evidence, or why the item was closed."
                        />

                        <Divider />

                        <Grid container spacing={2}>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <Stack spacing={1.5}>
                                    <Box>
                                        <Typography variant="subtitle1" fontWeight={800}>
                                            Investigation notes
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Detailed analyst notes and collaboration history for the case.
                                        </Typography>
                                    </Box>
                                    {!caseDetail?.comments.length ? (
                                        <Alert severity="info" variant="outlined">
                                            No comments yet. Add the first investigation note below.
                                        </Alert>
                                    ) : (
                                        <List disablePadding sx={{ border: (theme) => `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
                                            {caseDetail.comments.map((comment, index) => (
                                                <ListItem
                                                    key={comment.id}
                                                    sx={{
                                                        alignItems: "flex-start",
                                                        borderBottom: index < caseDetail.comments.length - 1 ? (theme) => `1px solid ${theme.palette.divider}` : undefined
                                                    }}
                                                >
                                                    <ListItemText
                                                        primary={
                                                            <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                                                                <Typography variant="subtitle2" fontWeight={700}>
                                                                    {comment.author_name || "Auditor"}
                                                                </Typography>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {formatDate(comment.created_at)}
                                                                </Typography>
                                                            </Stack>
                                                        }
                                                        secondary={
                                                            <Typography variant="body2" color="text.primary" sx={{ mt: 0.75, whiteSpace: "pre-wrap" }}>
                                                                {comment.body}
                                                            </Typography>
                                                        }
                                                    />
                                                </ListItem>
                                            ))}
                                        </List>
                                    )}
                                    <TextField
                                        label="Add investigation comment"
                                        value={commentDraft}
                                        onChange={(event) => setCommentDraft(event.target.value)}
                                        multiline
                                        minRows={3}
                                        fullWidth
                                    />
                                    <Stack direction="row" justifyContent="flex-end">
                                        <Button
                                            onClick={handleCommentSave}
                                            variant="outlined"
                                            disabled={commentSaving || !commentDraft.trim()}
                                        >
                                            Add comment
                                        </Button>
                                    </Stack>
                                </Stack>
                            </Grid>

                            <Grid size={{ xs: 12, md: 6 }}>
                                <Stack spacing={1.5}>
                                    <Box>
                                        <Typography variant="subtitle1" fontWeight={800}>
                                            Evidence
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Upload supporting files and keep the case evidence trail attached to the exception.
                                        </Typography>
                                    </Box>
                                    {!caseDetail?.evidence.length ? (
                                        <Alert severity="info" variant="outlined">
                                            No evidence files have been attached yet.
                                        </Alert>
                                    ) : (
                                        <List disablePadding sx={{ border: (theme) => `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
                                            {caseDetail.evidence.map((item, index) => (
                                                <ListItem
                                                    key={item.id}
                                                    secondaryAction={
                                                        <Button
                                                            size="small"
                                                            startIcon={<DownloadRoundedIcon fontSize="small" />}
                                                            onClick={() => void handleEvidenceDownload(item)}
                                                        >
                                                            Open
                                                        </Button>
                                                    }
                                                    sx={{
                                                        borderBottom: index < caseDetail.evidence.length - 1 ? (theme) => `1px solid ${theme.palette.divider}` : undefined
                                                    }}
                                                >
                                                    <ListItemText
                                                        primary={item.file_name}
                                                        secondary={`${item.uploaded_by_name || "Auditor"} • ${formatFileSize(item.file_size_bytes)} • ${formatDate(item.created_at)}`}
                                                    />
                                                </ListItem>
                                            ))}
                                        </List>
                                    )}
                                    <Stack spacing={1.25}>
                                        <Button
                                            component="label"
                                            variant="outlined"
                                            startIcon={<UploadFileRoundedIcon fontSize="small" />}
                                            disabled={evidenceUploading}
                                        >
                                            {evidenceFile ? "Change evidence file" : "Select evidence file"}
                                            <input
                                                hidden
                                                type="file"
                                                accept="image/*,.pdf,.csv,.xlsx,.xls,.doc,.docx"
                                                onChange={(event) => setEvidenceFile(event.target.files?.[0] || null)}
                                            />
                                        </Button>
                                        {evidenceFile ? (
                                            <Typography variant="body2" color="text.secondary">
                                                Ready to upload: {evidenceFile.name} ({formatFileSize(evidenceFile.size)})
                                            </Typography>
                                        ) : null}
                                        <Stack direction="row" justifyContent="flex-end">
                                            <Button
                                                onClick={handleEvidenceUpload}
                                                variant="outlined"
                                                disabled={evidenceUploading || !evidenceFile}
                                            >
                                                Upload evidence
                                            </Button>
                                        </Stack>
                                    </Stack>
                                </Stack>
                            </Grid>
                        </Grid>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3 }}>
                    <Button onClick={closeCaseDialog} disabled={caseSaving || commentSaving || evidenceUploading}>
                        Cancel
                    </Button>
                    <Button onClick={handleCaseSave} variant="contained" disabled={caseSaving}>
                        Save case
                    </Button>
                </DialogActions>
            </Dialog>
        </Stack>
    );
}
