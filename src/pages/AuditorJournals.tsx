import { MotionCard, MotionModal } from "../ui/motion";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { Alert, Box, Button, Card, CardContent, Chip, Grid, Pagination, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { AppLoader } from "../components/AppLoader";
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
                    {row.flags.slice(0, 2).map((flag) => <Chip key={flag} size="small" label={flag} color="warning" />)}
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

    return (
        <Stack spacing={3}>
            <MotionCard variant="outlined">
                <CardContent>
                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
                        <Box>
                            <Typography variant="h5">Journals</Typography>
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
                                </Grid>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                                    {detail.journal.description || "No description recorded."}
                                </Typography>
                            </CardContent>
                        </MotionCard>
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
