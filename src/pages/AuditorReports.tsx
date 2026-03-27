import { MotionCard } from "../ui/motion";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import {
    Alert,
    Box,
    Button,
    CardContent,
    Chip,
    Divider,
    Grid,
    List,
    ListItem,
    ListItemText,
    Stack,
    TextField,
    Typography
} from "@mui/material";
import { useEffect, useState } from "react";

import { useToast } from "../components/Toast";
import { api, getApiErrorMessage } from "../lib/api";
import { endpoints, type ReportExportJob, type ReportExportJobCreateResponse, type ReportExportJobDownloadResponse, type ReportExportJobResponse, type ReportExportJobsResponse } from "../lib/endpoints";
import { downloadFile, getFilenameFromDisposition } from "../utils/downloadFile";

const REPORT_EXPORT_MAX_POLLS = 30;
const REPORT_EXPORT_POLL_INTERVAL_MS = 2000;

function wait(ms: number) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function runCsvDownload(
    url: string,
    params: Record<string, string | undefined>,
    fallbackFilename: string,
    onSuccess: (filename: string) => void
) {
    const response = await api.get(url, {
        params,
        responseType: "blob"
    });

    const filename = getFilenameFromDisposition(
        response.headers["content-disposition"],
        fallbackFilename
    );

    downloadFile(response.data as Blob, filename);
    onSuccess(filename);
}

export function AuditorReportsPage() {
    const { pushToast } = useToast();
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [asOf, setAsOf] = useState("");
    const [periodId, setPeriodId] = useState("");
    const [downloading, setDownloading] = useState<string | null>(null);
    const [exportJobs, setExportJobs] = useState<ReportExportJob[]>([]);

    useEffect(() => {
        void api.get<ReportExportJobsResponse>(endpoints.reports.exportJobs(), {
            params: {
                report_key: "audit_evidence_pack",
                limit: 8
            }
        })
            .then(({ data }) => setExportJobs(data.data))
            .catch((error) =>
                pushToast({
                    type: "error",
                    title: "Unable to load export history",
                    message: getApiErrorMessage(error)
                })
            );
    }, [pushToast]);

    const handleDownload = async (
        key: string,
        url: string,
        params: Record<string, string | undefined>,
        filename: string
    ) => {
        setDownloading(key);

        try {
            await runCsvDownload(url, params, filename, (resolvedFilename) =>
                pushToast({
                    type: "success",
                    title: "Download ready",
                    message: `${resolvedFilename} downloaded successfully.`
                })
            );
        } catch (error) {
            pushToast({
                type: "error",
                title: "Export failed",
                message: getApiErrorMessage(error)
            });
        } finally {
            setDownloading(null);
        }
    };

    const queueEvidencePack = async () => {
        setDownloading("audit-evidence-pack");
        try {
            const start = await api.get<ReportExportJobCreateResponse>(endpoints.reports.auditEvidencePack(), {
                params: {
                    from_date: from || undefined,
                    to_date: to || undefined,
                    format: "pdf",
                    async: "true"
                }
            });

            const jobId = start.data?.data?.job_id;
            if (!jobId) {
                throw new Error("Evidence pack job could not be created.");
            }

            for (let attempt = 0; attempt < REPORT_EXPORT_MAX_POLLS; attempt += 1) {
                const statusResponse = await api.get<ReportExportJobResponse>(endpoints.reports.exportJob(jobId));
                const job = statusResponse.data?.data;

                if (!job?.status) {
                    throw new Error("Evidence pack job status is unavailable.");
                }

                if (job.status === "completed") {
                    const downloadResponse = await api.get<ReportExportJobDownloadResponse>(
                        endpoints.reports.exportJobDownload(jobId)
                    );
                    const downloadData = downloadResponse.data?.data;

                    if (!downloadData?.signed_url) {
                        throw new Error("Evidence pack URL is missing.");
                    }

                    const fileResponse = await fetch(downloadData.signed_url);
                    if (!fileResponse.ok) {
                        throw new Error("Unable to download the evidence pack.");
                    }

                    const payload = await fileResponse.blob();
                    if (payload.size <= 0) {
                        throw new Error("The evidence pack file is empty.");
                    }

                    downloadFile(payload, downloadData.filename || "audit-evidence-pack.pdf");
                    pushToast({
                        type: "success",
                        title: "Evidence pack ready",
                        message: `${downloadData.filename || "audit-evidence-pack.pdf"} downloaded successfully.`
                    });

                    const jobsResponse = await api.get<ReportExportJobsResponse>(endpoints.reports.exportJobs(), {
                        params: {
                            report_key: "audit_evidence_pack",
                            limit: 8
                        }
                    });
                    setExportJobs(jobsResponse.data.data);
                    return;
                }

                if (job.status === "failed") {
                    throw new Error(job.error_message || "Evidence pack generation failed.");
                }

                await wait(REPORT_EXPORT_POLL_INTERVAL_MS);
            }

            throw new Error("Evidence pack generation timed out. Please try again.");
        } catch (error) {
            pushToast({
                type: "error",
                title: "Evidence pack failed",
                message: getApiErrorMessage(error)
            });
        } finally {
            setDownloading(null);
        }
    };

    return (
        <Stack spacing={3}>
            <MotionCard variant="outlined">
                <CardContent>
                    <Typography variant="h4" fontWeight={800}>Auditor Reports</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                        Download read-only CSV extracts for control testing, portfolio review, and audit evidence.
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
                        <Chip label="CSV evidence pack inputs" variant="outlined" />
                        <Chip label="Read-only auditor exports" color="primary" variant="outlined" />
                    </Stack>
                </CardContent>
            </MotionCard>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                    <MotionCard variant="outlined">
                        <CardContent>
                            <Stack spacing={2}>
                                <Stack
                                    direction={{ xs: "column", md: "row" }}
                                    justifyContent="space-between"
                                    spacing={2}
                                    alignItems={{ xs: "flex-start", md: "center" }}
                                >
                                    <Box>
                                        <Typography variant="h6">Audit Evidence Pack</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Generate a formal PDF pack with summary control posture, exception concentration, and audit-case evidence signals for the selected period.
                                        </Typography>
                                    </Box>
                                    <Chip icon={<HistoryRoundedIcon fontSize="small" />} label={`${exportJobs.length} recent pack(s)`} variant="outlined" />
                                </Stack>
                                <Grid container spacing={2}>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <TextField type="date" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(event) => setFrom(event.target.value)} />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <TextField type="date" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(event) => setTo(event.target.value)} />
                                    </Grid>
                                </Grid>
                                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                                    <Button
                                        variant="contained"
                                        startIcon={<DownloadRoundedIcon fontSize="small" />}
                                        disabled={downloading === "audit-evidence-pack"}
                                        onClick={() => void queueEvidencePack()}
                                    >
                                        {downloading === "audit-evidence-pack" ? "Preparing..." : "Generate evidence pack"}
                                    </Button>
                                    <Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center" }}>
                                        Uses the async export worker and will appear in export history below.
                                    </Typography>
                                </Stack>
                                <Divider />
                                {!exportJobs.length ? (
                                    <Alert severity="info" variant="outlined">
                                        No audit evidence packs have been generated yet.
                                    </Alert>
                                ) : (
                                    <List disablePadding>
                                        {exportJobs.map((job, index) => (
                                            <ListItem
                                                key={job.id}
                                                disablePadding
                                                sx={{
                                                    py: 1.25,
                                                    borderBottom: index < exportJobs.length - 1 ? (theme) => `1px solid ${theme.palette.divider}` : undefined
                                                }}
                                                secondaryAction={
                                                    job.status === "completed" ? (
                                                        <Button
                                                            size="small"
                                                            onClick={async () => {
                                                                try {
                                                                    const downloadResponse = await api.get<ReportExportJobDownloadResponse>(
                                                                        endpoints.reports.exportJobDownload(job.id)
                                                                    );
                                                                    const signedUrl = downloadResponse.data?.data?.signed_url;
                                                                    const filename = downloadResponse.data?.data?.filename || `${job.filename || "audit-evidence-pack"}.pdf`;
                                                                    if (!signedUrl) {
                                                                        throw new Error("Evidence pack download URL is missing.");
                                                                    }
                                                                    const fileResponse = await fetch(signedUrl);
                                                                    if (!fileResponse.ok) {
                                                                        throw new Error("Unable to download the evidence pack.");
                                                                    }
                                                                    downloadFile(await fileResponse.blob(), filename);
                                                                } catch (error) {
                                                                    pushToast({
                                                                        type: "error",
                                                                        title: "Unable to download pack",
                                                                        message: getApiErrorMessage(error)
                                                                    });
                                                                }
                                                            }}
                                                        >
                                                            Download
                                                        </Button>
                                                    ) : null
                                                }
                                            >
                                                <ListItemText
                                                    primary={job.title || "Audit Evidence Pack"}
                                                    secondary={`${job.status.toUpperCase()} • ${job.created_at.slice(0, 10)}${job.completed_at ? ` • completed ${job.completed_at.slice(0, 10)}` : ""}${job.error_message ? ` • ${job.error_message}` : ""}`}
                                                />
                                            </ListItem>
                                        ))}
                                    </List>
                                )}
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <MotionCard variant="outlined">
                        <CardContent>
                            <Stack spacing={2}>
                                <Typography variant="h6">Trial Balance</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Export a dated ledger balance view for audit evidence and control testing.
                                </Typography>
                                <Grid container spacing={2}>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                    <TextField type="date" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(event) => setFrom(event.target.value)} />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                    <TextField type="date" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(event) => setTo(event.target.value)} />
                                    </Grid>
                                </Grid>
                                <Button
                                    variant="contained"
                                    startIcon={<DownloadRoundedIcon fontSize="small" />}
                                    disabled={downloading === "trial-balance"}
                                    onClick={() => void handleDownload("trial-balance", endpoints.auditor.trialBalanceCsv(), { from: from || undefined, to: to || undefined }, "auditor-trial-balance.csv")}
                                >
                                    {downloading === "trial-balance" ? "Preparing..." : "Download CSV"}
                                </Button>
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <MotionCard variant="outlined">
                        <CardContent>
                            <Stack spacing={2}>
                                <Typography variant="h6">Loan Aging</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Review aging buckets as of a specific date for credit-risk evidence.
                                </Typography>
                                <TextField type="date" label="As Of" InputLabelProps={{ shrink: true }} value={asOf} onChange={(event) => setAsOf(event.target.value)} />
                                <Button
                                    variant="contained"
                                    startIcon={<DownloadRoundedIcon fontSize="small" />}
                                    disabled={downloading === "loan-aging"}
                                    onClick={() => void handleDownload("loan-aging", endpoints.auditor.loanAgingCsv(), { asOf: asOf || undefined }, "auditor-loan-aging.csv")}
                                >
                                    {downloading === "loan-aging" ? "Preparing..." : "Download CSV"}
                                </Button>
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <MotionCard variant="outlined">
                        <CardContent>
                            <Stack spacing={2}>
                                <Typography variant="h6">PAR</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Export portfolio-at-risk output for delinquency and internal control review.
                                </Typography>
                                <TextField type="date" label="As Of" InputLabelProps={{ shrink: true }} value={asOf} onChange={(event) => setAsOf(event.target.value)} />
                                <Button
                                    variant="contained"
                                    startIcon={<DownloadRoundedIcon fontSize="small" />}
                                    disabled={downloading === "par"}
                                    onClick={() => void handleDownload("par", endpoints.auditor.parCsv(), { asOf: asOf || undefined }, "auditor-par.csv")}
                                >
                                    {downloading === "par" ? "Preparing..." : "Download CSV"}
                                </Button>
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <MotionCard variant="outlined">
                        <CardContent>
                            <Stack spacing={2}>
                                <Typography variant="h6">Dividends Register</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Export dividend allocation and payout evidence for the selected cycle.
                                </Typography>
                                <TextField label="Period ID" value={periodId} onChange={(event) => setPeriodId(event.target.value)} />
                                <Button
                                    variant="contained"
                                    startIcon={<DownloadRoundedIcon fontSize="small" />}
                                    disabled={downloading === "dividends"}
                                    onClick={() => void handleDownload("dividends", endpoints.auditor.dividendsRegisterCsv(), { periodId: periodId || undefined }, "auditor-dividends-register.csv")}
                                >
                                    {downloading === "dividends" ? "Preparing..." : "Download CSV"}
                                </Button>
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>
            </Grid>
        </Stack>
    );
}
