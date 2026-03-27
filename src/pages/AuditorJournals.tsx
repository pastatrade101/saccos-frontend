import { MotionCard } from "../ui/motion";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { Alert, Box, Button, CardContent, Chip, Divider, Grid, Pagination, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { AppLoader } from "../components/AppLoader";
import { formatAuditShortId, getAuditorReasonMeta } from "../components/auditor/auditorUtils";
import { DataTable, type Column } from "../components/DataTable";
import { useToast } from "../components/Toast";
import { api, getApiErrorMessage } from "../lib/api";
import { endpoints, type AuditorJournalDetailResponse, type AuditorJournalsResponse } from "../lib/endpoints";
import type { AuditorJournal, AuditorJournalDetail, AuditorJournalLine } from "../types/api";
import { formatCurrency, formatDate } from "../utils/format";

export function AuditorJournalsPage() {
    const navigate = useNavigate();
    const { id } = useParams<{ id?: string }>();
    const { pushToast } = useToast();
    const [rows, setRows] = useState<AuditorJournal[]>([]);
    const [detail, setDetail] = useState<AuditorJournalDetail | null>(null);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [search, setSearch] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);
    const limit = 20;

    useEffect(() => {
        if (id) {
            setDetailLoading(true);
            void api.get<AuditorJournalDetailResponse>(endpoints.auditor.journalDetail(id))
                .then(({ data }) => setDetail(data.data))
                .catch((error) =>
                    pushToast({
                        type: "error",
                        title: "Unable to load journal detail",
                        message: getApiErrorMessage(error)
                    })
                )
                .finally(() => setDetailLoading(false));
        } else {
            setDetail(null);
        }
    }, [id, pushToast]);

    useEffect(() => {
        setLoading(true);
        void api.get<AuditorJournalsResponse>(endpoints.auditor.journals(), {
            params: { page, limit, search: search || undefined, from: from || undefined, to: to || undefined }
        })
            .then(({ data }) => {
                setRows(data.data.data);
                setTotal(data.data.pagination.total);
            })
            .catch((error) =>
                pushToast({
                    type: "error",
                    title: "Unable to load journals",
                    message: getApiErrorMessage(error)
                })
            )
            .finally(() => setLoading(false));
    }, [from, limit, page, pushToast, search, to]);

    const journalSummary = useMemo(() => ({
        flagged: rows.filter((row) => row.flags.length > 0).length,
        unposted: rows.filter((row) => !row.posted).length,
        debitTotal: rows.reduce((sum, row) => sum + Number(row.debit_total || 0), 0),
        creditTotal: rows.reduce((sum, row) => sum + Number(row.credit_total || 0), 0)
    }), [rows]);

    const columns: Column<AuditorJournal>[] = [
        {
            key: "reference",
            header: "Reference",
            render: (row) => (
                <Typography sx={{ fontWeight: 700, cursor: "pointer" }} onClick={() => navigate(`/auditor/journals/${row.id}`)}>
                    {row.reference}
                </Typography>
            )
        },
        { key: "entry_date", header: "Entry Date", render: (row) => formatDate(row.entry_date) },
        { key: "created_at", header: "Created", render: (row) => formatDate(row.created_at) },
        { key: "source_type", header: "Source", render: (row) => row.source_type },
        { key: "debit_total", header: "Debit", render: (row) => formatCurrency(row.debit_total) },
        { key: "credit_total", header: "Credit", render: (row) => formatCurrency(row.credit_total) },
        {
            key: "flags",
            header: "Flags",
            render: (row) => row.flags.length ? (
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {row.flags.slice(0, 2).map((flag) => {
                        const meta = getAuditorReasonMeta(flag);
                        return <Chip key={flag} size="small" label={meta.label} color={meta.chipColor} />;
                    })}
                </Stack>
            ) : "None"
        }
    ];

    const detailColumns: Column<AuditorJournalLine>[] = useMemo(() => [
        {
            key: "account",
            header: "Account",
            render: (row) => (
                <Stack spacing={0.25}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {row.chart_of_accounts?.account_code || row.account_id}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {row.chart_of_accounts?.account_name || "Unmapped account"}
                    </Typography>
                </Stack>
            )
        },
        { key: "debit", header: "Debit", render: (row) => formatCurrency(row.debit) },
        { key: "credit", header: "Credit", render: (row) => formatCurrency(row.credit) },
        { key: "branch", header: "Branch", render: (row) => row.branch_id || "N/A" }
    ], []);

    const hasRelatedContext = Boolean(
        detail?.related_context && (
            detail.related_context.reversal_of ||
            detail.related_context.reversed_by.length ||
            detail.related_context.member_transactions.length ||
            detail.related_context.loan_transactions.length ||
            detail.related_context.teller_transactions.length ||
            detail.related_context.receipts.length ||
            detail.related_context.payment_orders.length ||
            detail.related_context.dividend_cycles.length
        )
    );

    return (
        <Stack spacing={3}>
            <MotionCard variant="outlined">
                <CardContent>
                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
                        <Box>
                            <Typography variant="h4" fontWeight={800}>Journals</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                                Read-only journal review with detail visibility for lines, timing, and exception flags.
                            </Typography>
                        </Box>
                        {id ? (
                            <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate("/auditor/journals")} color="inherit">
                                Back to List
                            </Button>
                        ) : null}
                    </Stack>
                </CardContent>
            </MotionCard>

            {id ? (
                detailLoading ? (
                    <AppLoader fullscreen={false} minHeight={260} message="Loading journal detail..." />
                ) : detail ? (
                    <Stack spacing={2}>
                        <MotionCard variant="outlined">
                            <CardContent>
                                <Stack spacing={2.5}>
                                    <Grid container spacing={2}>
                                        <Grid size={{ xs: 12, md: 4 }}>
                                            <Typography variant="overline" color="text.secondary">Reference</Typography>
                                            <Typography variant="h6">{detail.journal.reference}</Typography>
                                        </Grid>
                                        <Grid size={{ xs: 12, md: 4 }}>
                                            <Typography variant="overline" color="text.secondary">Entry Date</Typography>
                                            <Typography variant="h6">{formatDate(detail.journal.entry_date)}</Typography>
                                        </Grid>
                                        <Grid size={{ xs: 12, md: 4 }}>
                                            <Typography variant="overline" color="text.secondary">Source</Typography>
                                            <Typography variant="h6">{detail.journal.source_type}</Typography>
                                        </Grid>
                                        <Grid size={{ xs: 12, md: 4 }}>
                                            <Typography variant="overline" color="text.secondary">Created by</Typography>
                                            <Typography variant="h6">{detail.related_context?.created_by_name || formatAuditShortId(detail.journal.created_by)}</Typography>
                                        </Grid>
                                    </Grid>
                                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                        {(detail.journal.flags || []).map((flag) => {
                                            const meta = getAuditorReasonMeta(flag);
                                            return <Chip key={flag} label={meta.label} color={meta.chipColor} />;
                                        })}
                                        {!detail.journal.flags?.length ? <Chip label="No control flags" variant="outlined" /> : null}
                                        <Chip label={detail.journal.posted ? "Posted" : "Unposted"} color={detail.journal.posted ? "success" : "warning"} variant="outlined" />
                                    </Stack>
                                    <Typography variant="body2" color="text.secondary">
                                        {detail.journal.description || "No description recorded."}
                                    </Typography>
                                    <Stack direction={{ xs: "column", md: "row" }} spacing={2} divider={<Divider orientation="vertical" flexItem sx={{ display: { xs: "none", md: "block" } }} />}>
                                        <Box sx={{ flex: 1 }}>
                                            <Typography variant="overline" color="text.secondary">Debit total</Typography>
                                            <Typography variant="h6">{formatCurrency(detail.lines.reduce((sum, row) => sum + Number(row.debit || 0), 0))}</Typography>
                                        </Box>
                                        <Box sx={{ flex: 1 }}>
                                            <Typography variant="overline" color="text.secondary">Credit total</Typography>
                                            <Typography variant="h6">{formatCurrency(detail.lines.reduce((sum, row) => sum + Number(row.credit || 0), 0))}</Typography>
                                        </Box>
                                        <Box sx={{ flex: 1 }}>
                                            <Typography variant="overline" color="text.secondary">Balance status</Typography>
                                            <Typography variant="h6">
                                                {Math.abs(
                                                    detail.lines.reduce((sum, row) => sum + Number(row.debit || 0), 0) -
                                                    detail.lines.reduce((sum, row) => sum + Number(row.credit || 0), 0)
                                                ) < 0.005 ? "Balanced" : "Mismatch"}
                                            </Typography>
                                        </Box>
                                    </Stack>
                                </Stack>
                            </CardContent>
                        </MotionCard>
                        {hasRelatedContext ? (
                            <MotionCard variant="outlined">
                                <CardContent>
                                    <Stack spacing={2.5}>
                                        <Box>
                                            <Typography variant="h6" sx={{ mb: 0.5 }}>Investigation context</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Linked operational records discovered through this journal entry.
                                            </Typography>
                                        </Box>

                                        {detail.related_context?.reversal_of ? (
                                            <Box>
                                                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                                                    Reversal chain
                                                </Typography>
                                                <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} flexWrap="wrap" useFlexGap>
                                                    <Button
                                                        variant="outlined"
                                                        endIcon={<OpenInNewRoundedIcon fontSize="small" />}
                                                        onClick={() => navigate(`/auditor/journals/${detail.related_context?.reversal_of?.journal_id}`)}
                                                    >
                                                        Reverses {detail.related_context.reversal_of.reference}
                                                    </Button>
                                                    {detail.related_context.reversed_by.map((item) => (
                                                        <Button
                                                            key={item.journal_id}
                                                            variant="outlined"
                                                            endIcon={<OpenInNewRoundedIcon fontSize="small" />}
                                                            onClick={() => navigate(`/auditor/journals/${item.journal_id}`)}
                                                        >
                                                            Reversed by {item.reference}
                                                        </Button>
                                                    ))}
                                                </Stack>
                                            </Box>
                                        ) : detail.related_context?.reversed_by.length ? (
                                            <Box>
                                                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                                                    Reversal chain
                                                </Typography>
                                                <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} flexWrap="wrap" useFlexGap>
                                                    {detail.related_context.reversed_by.map((item) => (
                                                        <Button
                                                            key={item.journal_id}
                                                            variant="outlined"
                                                            endIcon={<OpenInNewRoundedIcon fontSize="small" />}
                                                            onClick={() => navigate(`/auditor/journals/${item.journal_id}`)}
                                                        >
                                                            Reversed by {item.reference}
                                                        </Button>
                                                    ))}
                                                </Stack>
                                            </Box>
                                        ) : null}

                                        {detail.related_context?.loan_transactions.length ? (
                                            <Box>
                                                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                                                    Loan linkage
                                                </Typography>
                                                <Stack spacing={1.25}>
                                                    {detail.related_context.loan_transactions.map((item) => (
                                                        <Stack
                                                            key={item.id}
                                                            direction={{ xs: "column", md: "row" }}
                                                            justifyContent="space-between"
                                                            spacing={1.25}
                                                            sx={{ p: 1.5, borderRadius: 2, border: "1px solid", borderColor: "divider" }}
                                                        >
                                                            <Box>
                                                                <Typography variant="body2" fontWeight={700}>
                                                                    {item.loan_number || formatAuditShortId(item.loan_id)} • {item.transaction_type}
                                                                </Typography>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {item.member_name || "Member"} {item.member_no ? `• ${item.member_no}` : ""} • {formatCurrency(item.amount)}
                                                                </Typography>
                                                            </Box>
                                                            <Stack direction="row" spacing={1}>
                                                                <Button
                                                                    size="small"
                                                                    variant="outlined"
                                                                    endIcon={<OpenInNewRoundedIcon fontSize="small" />}
                                                                    onClick={() => navigate(`/loans/${item.loan_id}`)}
                                                                >
                                                                    Open loan
                                                                </Button>
                                                            </Stack>
                                                        </Stack>
                                                    ))}
                                                </Stack>
                                            </Box>
                                        ) : null}

                                        {detail.related_context?.member_transactions.length ? (
                                            <Box>
                                                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                                                    Member account linkage
                                                </Typography>
                                                <Stack spacing={1.25}>
                                                    {detail.related_context.member_transactions.map((item) => (
                                                        <Stack
                                                            key={item.id}
                                                            direction={{ xs: "column", md: "row" }}
                                                            justifyContent="space-between"
                                                            spacing={1.25}
                                                            sx={{ p: 1.5, borderRadius: 2, border: "1px solid", borderColor: "divider" }}
                                                        >
                                                            <Box>
                                                                <Typography variant="body2" fontWeight={700}>
                                                                    {item.account_number || formatAuditShortId(item.member_account_id)} • {item.transaction_type}
                                                                </Typography>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {item.member_name || "Member"} {item.member_no ? `• ${item.member_no}` : ""} • {formatCurrency(item.amount)}
                                                                </Typography>
                                                            </Box>
                                                            <Button size="small" variant="outlined" onClick={() => navigate("/members")}>
                                                                Open members
                                                            </Button>
                                                        </Stack>
                                                    ))}
                                                </Stack>
                                            </Box>
                                        ) : null}

                                        {(detail.related_context?.teller_transactions.length || detail.related_context?.receipts.length || detail.related_context?.payment_orders.length || detail.related_context?.dividend_cycles.length) ? (
                                            <Grid container spacing={2}>
                                                {detail.related_context?.teller_transactions.length ? (
                                                    <Grid size={{ xs: 12, md: 6 }}>
                                                        <Box sx={{ p: 1.75, borderRadius: 2, border: "1px solid", borderColor: "divider", height: "100%" }}>
                                                            <Typography variant="subtitle2" fontWeight={700}>Teller activity</Typography>
                                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                                {detail.related_context.teller_transactions.length} linked teller posting(s)
                                                            </Typography>
                                                            <Button sx={{ mt: 1.25 }} size="small" variant="outlined" onClick={() => navigate("/cash")}>
                                                                Open cash desk
                                                            </Button>
                                                        </Box>
                                                    </Grid>
                                                ) : null}
                                                {detail.related_context?.receipts.length ? (
                                                    <Grid size={{ xs: 12, md: 6 }}>
                                                        <Box sx={{ p: 1.75, borderRadius: 2, border: "1px solid", borderColor: "divider", height: "100%" }}>
                                                            <Typography variant="subtitle2" fontWeight={700}>Receipt evidence</Typography>
                                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                                {detail.related_context.receipts.length} receipt record(s) attached to this journal
                                                            </Typography>
                                                            <Button sx={{ mt: 1.25 }} size="small" variant="outlined" onClick={() => navigate("/cash")}>
                                                                Review receipts
                                                            </Button>
                                                        </Box>
                                                    </Grid>
                                                ) : null}
                                                {detail.related_context?.payment_orders.length ? (
                                                    <Grid size={{ xs: 12, md: 6 }}>
                                                        <Box sx={{ p: 1.75, borderRadius: 2, border: "1px solid", borderColor: "divider", height: "100%" }}>
                                                            <Typography variant="subtitle2" fontWeight={700}>Payment order</Typography>
                                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                                {detail.related_context.payment_orders[0].purpose} • {detail.related_context.payment_orders[0].provider} • {formatCurrency(detail.related_context.payment_orders[0].amount)}
                                                            </Typography>
                                                            <Button sx={{ mt: 1.25 }} size="small" variant="outlined" onClick={() => navigate("/payments")}>
                                                                Open payments
                                                            </Button>
                                                        </Box>
                                                    </Grid>
                                                ) : null}
                                                {detail.related_context?.dividend_cycles.length ? (
                                                    <Grid size={{ xs: 12, md: 6 }}>
                                                        <Box sx={{ p: 1.75, borderRadius: 2, border: "1px solid", borderColor: "divider", height: "100%" }}>
                                                            <Typography variant="subtitle2" fontWeight={700}>Dividend linkage</Typography>
                                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                                {detail.related_context.dividend_cycles.map((item) => `${item.period_label} (${item.journal_role})`).join(", ")}
                                                            </Typography>
                                                            <Button sx={{ mt: 1.25 }} size="small" variant="outlined" onClick={() => navigate("/dividends")}>
                                                                Open dividends
                                                            </Button>
                                                        </Box>
                                                    </Grid>
                                                ) : null}
                                            </Grid>
                                        ) : null}
                                    </Stack>
                                </CardContent>
                            </MotionCard>
                        ) : null}
                        <MotionCard variant="outlined">
                            <CardContent>
                                <Typography variant="h6" sx={{ mb: 2 }}>Journal Lines</Typography>
                                <DataTable rows={detail.lines} columns={detailColumns} emptyMessage="No lines were found for this journal." />
                            </CardContent>
                        </MotionCard>
                    </Stack>
                ) : (
                    <Alert severity="warning" variant="outlined">Journal detail is not available.</Alert>
                )
            ) : (
                <>
                    <MotionCard variant="outlined">
                        <CardContent>
                            <Stack direction={{ xs: "column", md: "row" }} spacing={2} divider={<Divider orientation="vertical" flexItem sx={{ display: { xs: "none", md: "block" } }} />}>
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="overline" color="text.secondary">Flagged journals</Typography>
                                    <Typography variant="h5" fontWeight={800}>{journalSummary.flagged}</Typography>
                                </Box>
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="overline" color="text.secondary">Unposted journals</Typography>
                                    <Typography variant="h5" fontWeight={800}>{journalSummary.unposted}</Typography>
                                </Box>
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="overline" color="text.secondary">Visible debit / credit</Typography>
                                    <Typography variant="h5" fontWeight={800}>
                                        {formatCurrency(journalSummary.debitTotal)} / {formatCurrency(journalSummary.creditTotal)}
                                    </Typography>
                                </Box>
                            </Stack>
                        </CardContent>
                    </MotionCard>
                    <MotionCard variant="outlined">
                        <CardContent>
                            <Grid container spacing={2}>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <TextField label="Search" fullWidth value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
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
                        <AppLoader fullscreen={false} minHeight={280} message="Loading journals..." />
                    ) : (
                        <MotionCard variant="outlined">
                            <CardContent>
                                <Stack spacing={2}>
                                    <DataTable rows={rows} columns={columns} emptyMessage="No journals match the current filters." />
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
                </>
            )}
        </Stack>
    );
}
