import { MotionCard, MotionModal } from "../ui/motion";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import { Card, CardContent, Grid, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";

import { useToast } from "../components/Toast";
import { api, getApiErrorMessage } from "../lib/api";
import { endpoints } from "../lib/endpoints";
import { downloadFile, getFilenameFromDisposition } from "../utils/downloadFile";

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

    return (
        <Stack spacing={3}>
            <MotionCard variant="outlined">
                <CardContent>
                    <Typography variant="h5">Auditor Reports</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                        Download read-only CSV extracts for control testing, portfolio review, and audit evidence.
                    </Typography>
                </CardContent>
            </MotionCard>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                    <MotionCard variant="outlined">
                        <CardContent>
                            <Stack spacing={2}>
                                <Typography variant="h6">Trial Balance</Typography>
                                <div className="grid-2">
                                    <TextField type="date" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(event) => setFrom(event.target.value)} />
                                    <TextField type="date" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(event) => setTo(event.target.value)} />
                                </div>
                                <button
                                    className="primary-button"
                                    disabled={downloading === "trial-balance"}
                                    onClick={() => void handleDownload("trial-balance", endpoints.auditor.trialBalanceCsv(), { from: from || undefined, to: to || undefined }, "auditor-trial-balance.csv")}
                                >
                                    <DownloadRoundedIcon fontSize="small" style={{ marginRight: 8 }} />
                                    {downloading === "trial-balance" ? "Preparing..." : "Download CSV"}
                                </button>
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <MotionCard variant="outlined">
                        <CardContent>
                            <Stack spacing={2}>
                                <Typography variant="h6">Loan Aging</Typography>
                                <TextField type="date" label="As Of" InputLabelProps={{ shrink: true }} value={asOf} onChange={(event) => setAsOf(event.target.value)} />
                                <button
                                    className="primary-button"
                                    disabled={downloading === "loan-aging"}
                                    onClick={() => void handleDownload("loan-aging", endpoints.auditor.loanAgingCsv(), { asOf: asOf || undefined }, "auditor-loan-aging.csv")}
                                >
                                    <DownloadRoundedIcon fontSize="small" style={{ marginRight: 8 }} />
                                    {downloading === "loan-aging" ? "Preparing..." : "Download CSV"}
                                </button>
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <MotionCard variant="outlined">
                        <CardContent>
                            <Stack spacing={2}>
                                <Typography variant="h6">PAR</Typography>
                                <TextField type="date" label="As Of" InputLabelProps={{ shrink: true }} value={asOf} onChange={(event) => setAsOf(event.target.value)} />
                                <button
                                    className="primary-button"
                                    disabled={downloading === "par"}
                                    onClick={() => void handleDownload("par", endpoints.auditor.parCsv(), { asOf: asOf || undefined }, "auditor-par.csv")}
                                >
                                    <DownloadRoundedIcon fontSize="small" style={{ marginRight: 8 }} />
                                    {downloading === "par" ? "Preparing..." : "Download CSV"}
                                </button>
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <MotionCard variant="outlined">
                        <CardContent>
                            <Stack spacing={2}>
                                <Typography variant="h6">Dividends Register</Typography>
                                <TextField label="Period ID" value={periodId} onChange={(event) => setPeriodId(event.target.value)} />
                                <button
                                    className="primary-button"
                                    disabled={downloading === "dividends"}
                                    onClick={() => void handleDownload("dividends", endpoints.auditor.dividendsRegisterCsv(), { periodId: periodId || undefined }, "auditor-dividends-register.csv")}
                                >
                                    <DownloadRoundedIcon fontSize="small" style={{ marginRight: 8 }} />
                                    {downloading === "dividends" ? "Preparing..." : "Download CSV"}
                                </button>
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>
            </Grid>
        </Stack>
    );
}
