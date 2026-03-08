import { MotionCard, MotionModal } from "../ui/motion";
import CloudUploadRoundedIcon from "@mui/icons-material/CloudUploadRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import FilePresentRoundedIcon from "@mui/icons-material/FilePresentRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    FormControlLabel,
    Grid,
    LinearProgress,
    MenuItem,
    Pagination,
    Stack,
    Switch,
    TextField,
    Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { useAuth } from "../auth/AuthProvider";
import { DataTable, type Column } from "../components/DataTable";
import { useToast } from "../components/Toast";
import { api, getApiErrorMessage } from "../lib/api";
import {
    endpoints,
    type BranchesListResponse,
    type CredentialsLinkResponse,
    type ImportJobResponse,
    type ImportJobRowsResponse,
    type ImportMembersResponse
} from "../lib/endpoints";
import type { Branch, ImportJob, ImportJobRow } from "../types/api";
import { downloadFile, getFilenameFromDisposition } from "../utils/downloadFile";
import { formatDate } from "../utils/format";

const schema = z.object({
    default_branch_id: z.string().uuid().optional().or(z.literal("")),
    create_portal_account: z.boolean().default(false),
    file: z
        .custom<FileList | null>((value) => value instanceof FileList || value === null)
        .refine((value) => value && value.length > 0, "CSV file is required.")
});

type FormValues = z.infer<typeof schema>;

function triggerSignedDownload(url: string) {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
}

function SummaryCard({
    label,
    value,
    helper
}: {
    label: string;
    value: string;
    helper: string;
}) {
    return (
        <MotionCard variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent>
                <Typography variant="overline" color="text.secondary">
                    {label}
                </Typography>
                <Typography variant="h4" sx={{ mt: 1 }}>
                    {value}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {helper}
                </Typography>
            </CardContent>
        </MotionCard>
    );
}

export function MemberImportPage() {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === "dark";
    const memberAccent = isDarkMode ? "#D9B273" : "#1FA8E6";
    const memberAccentStrong = isDarkMode ? "#C89B52" : "#0A0573";
    const { pushToast } = useToast();
    const { selectedTenantId, selectedBranchId } = useAuth();
    const [branches, setBranches] = useState<Branch[]>([]);
    const [job, setJob] = useState<ImportJob | null>(null);
    const [failedRows, setFailedRows] = useState<ImportJobRow[]>([]);
    const [failedRowsTotal, setFailedRowsTotal] = useState(0);
    const [failedRowsPage, setFailedRowsPage] = useState(1);
    const [failedRowsLimit, setFailedRowsLimit] = useState(10);
    const [loadingBranches, setLoadingBranches] = useState(true);
    const [loadingRows, setLoadingRows] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [credentialsUrl, setCredentialsUrl] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [importStage, setImportStage] = useState<"idle" | "uploading" | "processing">("idle");
    const [importStartedAt, setImportStartedAt] = useState<number | null>(null);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [activeJobId, setActiveJobId] = useState<string | null>(null);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            default_branch_id: selectedBranchId || "",
            create_portal_account: false,
            file: null
        }
    });

    const createPortalAccount = form.watch("create_portal_account");
    const selectedDefaultBranchId = form.watch("default_branch_id");
    const selectedFile = form.watch("file");
    const hasSingleBranch = branches.length <= 1;
    const selectedDefaultBranch = branches.find((branch) => branch.id === selectedDefaultBranchId) || branches[0] || null;

    useEffect(() => {
        if (!submitting || !importStartedAt) {
            setElapsedSeconds(0);
            return;
        }

        const interval = window.setInterval(() => {
            setElapsedSeconds(Math.max(0, Math.floor((Date.now() - importStartedAt) / 1000)));
        }, 1000);

        return () => {
            window.clearInterval(interval);
        };
    }, [importStartedAt, submitting]);

    useEffect(() => {
        if (!selectedTenantId) {
            setBranches([]);
            setLoadingBranches(false);
            return;
        }

        setLoadingBranches(true);
        void api
            .get<BranchesListResponse>(endpoints.branches.list(), {
                params: { tenant_id: selectedTenantId }
            })
            .then(({ data }) => {
                setBranches(data.data || []);
            })
            .catch((error) => {
                pushToast({
                    type: "error",
                    title: "Branch load failed",
                    message: getApiErrorMessage(error)
                });
                setBranches([]);
            })
            .finally(() => {
                setLoadingBranches(false);
            });
    }, [pushToast, selectedTenantId]);

    useEffect(() => {
        const preferredBranchId = selectedBranchId || branches[0]?.id || "";
        const currentBranchId = form.getValues("default_branch_id");

        if (!currentBranchId && preferredBranchId) {
            form.setValue("default_branch_id", preferredBranchId);
        }
    }, [branches, form, selectedBranchId]);

    const loadFailedRows = async (jobId: string, page = failedRowsPage, limit = failedRowsLimit) => {
        setLoadingRows(true);

        try {
            const { data } = await api.get<ImportJobRowsResponse>(endpoints.imports.memberJobRows(jobId), {
                params: {
                    status: "failed",
                    page,
                    limit
                }
            });

            setFailedRows(data.data.items || []);
            setFailedRowsTotal(data.data.total || 0);
        } catch (error) {
            pushToast({
                type: "error",
                title: "Failed rows unavailable",
                message: getApiErrorMessage(error)
            });
        } finally {
            setLoadingRows(false);
        }
    };

    useEffect(() => {
        if (!job) {
            return;
        }

        void loadFailedRows(job.id, failedRowsPage, failedRowsLimit);
    }, [failedRowsLimit, failedRowsPage, job]);

    useEffect(() => {
        if (!activeJobId) {
            return;
        }

        let cancelled = false;

        const poll = async () => {
            try {
                const { data } = await api.get<ImportJobResponse>(endpoints.imports.memberJob(activeJobId));

                if (cancelled) {
                    return;
                }

                setJob(data.data);

                if (data.data.status === "completed" || data.data.status === "failed") {
                    setSubmitting(false);
                    setImportStage("idle");
                    setImportStartedAt(null);
                    setActiveJobId(null);

                    if (createPortalAccount && data.data.success_rows > 0) {
                        try {
                            const credentialsResponse = await api.get<CredentialsLinkResponse>(endpoints.imports.memberJobCredentials(activeJobId));
                            const signedUrl = credentialsResponse.data.data.signed_url;
                            setCredentialsUrl(signedUrl);
                            triggerSignedDownload(signedUrl);
                        } catch {
                            setCredentialsUrl(null);
                        }
                    }

                    pushToast({
                        type: data.data.status === "completed" ? "success" : "error",
                        title: data.data.status === "completed" ? "Import completed" : "Import finished with failures",
                        message: `${data.data.success_rows} rows imported successfully. ${data.data.failed_rows} failed.`
                    });
                    return;
                }

                window.setTimeout(() => {
                    void poll();
                }, 1500);
            } catch (error) {
                if (cancelled) {
                    return;
                }

                setSubmitting(false);
                setImportStage("idle");
                setImportStartedAt(null);
                setActiveJobId(null);

                pushToast({
                    type: "error",
                    title: "Import status unavailable",
                    message: getApiErrorMessage(error)
                });
            }
        };

        void poll();

        return () => {
            cancelled = true;
        };
    }, [activeJobId, createPortalAccount, pushToast]);

    const onSubmit = form.handleSubmit(async (values) => {
        const file = values.file?.item(0);

        if (!file) {
            return;
        }

        setSubmitting(true);
        setJob(null);
        setFailedRows([]);
        setFailedRowsTotal(0);
        setCredentialsUrl(null);
        setFailedRowsPage(1);
        setUploadProgress(0);
        setImportStage("uploading");
        setImportStartedAt(Date.now());
        let jobQueued = false;

        try {
            const body = new FormData();
            body.append("file", file);
            body.append("create_portal_account", String(values.create_portal_account));

            if (values.default_branch_id) {
                body.append("default_branch_id", values.default_branch_id);
            }

            const { data } = await api.post<ImportMembersResponse>(endpoints.imports.members(), body, {
                headers: {
                    "Content-Type": "multipart/form-data"
                },
                timeout: 0,
                onUploadProgress: (progressEvent) => {
                    if (!progressEvent.total) {
                        return;
                    }

                    const percent = Math.min(100, Math.round((progressEvent.loaded / progressEvent.total) * 100));
                    setUploadProgress(percent);

                    if (percent >= 100) {
                        setImportStage("processing");
                    }
                }
            });
            setActiveJobId(data.data.job_id);
            setImportStage("processing");
            setUploadProgress(100);
            jobQueued = true;
            pushToast({
                type: "success",
                title: "Import queued",
                message: "The file upload is complete. Member import is now processing in the background."
            });
        } catch (error) {
            setActiveJobId(null);
            pushToast({
                type: "error",
                title: "Import failed",
                message: getApiErrorMessage(error)
            });
        } finally {
            if (!jobQueued) {
                setSubmitting(false);
                setImportStage("idle");
                setImportStartedAt(null);
            }
        }
    });

    const failedRowsColumns = useMemo<Column<ImportJobRow>[]>(
        () => [
            {
                key: "row_number",
                header: "Row",
                render: (row) => row.row_number
            },
            {
                key: "error",
                header: "Error",
                render: (row) => (
                    <Typography variant="body2" sx={{ color: "error.main", fontWeight: 600 }}>
                        {row.error || "Row failed"}
                    </Typography>
                )
            },
            {
                key: "raw",
                header: "Raw data",
                render: (row) => (
                    <Typography variant="body2" color="text.secondary">
                        {Object.entries(row.raw || {})
                            .filter(([, value]) => value)
                            .map(([key, value]) => `${key}: ${value}`)
                            .join(" | ")}
                    </Typography>
                )
            }
        ],
        []
    );

    const downloadCredentials = async () => {
        try {
            const signedUrl = credentialsUrl
                ? credentialsUrl
                : (
                    await api.get<CredentialsLinkResponse>(endpoints.imports.memberJobCredentials(job!.id))
                ).data.data.signed_url;

            setCredentialsUrl(signedUrl);
            window.open(signedUrl, "_blank", "noopener,noreferrer");
        } catch (error) {
            pushToast({
                type: "error",
                title: "Credentials download failed",
                message: getApiErrorMessage(error)
            });
        }
    };

    const downloadFailures = async () => {
        if (!job) {
            return;
        }

        try {
            const response = await api.get(endpoints.imports.memberJobFailuresCsv(job.id), {
                responseType: "blob"
            });
            downloadFile(
                response.data as Blob,
                getFilenameFromDisposition(response.headers["content-disposition"], `member-import-${job.id}-failures.csv`)
            );
        } catch (error) {
            pushToast({
                type: "error",
                title: "Failure export failed",
                message: getApiErrorMessage(error)
            });
        }
    };

    const totalFailedPages = Math.max(1, Math.ceil(failedRowsTotal / failedRowsLimit));

    return (
        <Stack
            spacing={3}
            sx={
                isDarkMode
                    ? {
                        "& .MuiButton-containedPrimary": {
                            bgcolor: memberAccent,
                            color: "#1a1a1a",
                            "&:hover": { bgcolor: memberAccentStrong }
                        },
                        "& .MuiButton-outlinedPrimary": {
                            borderColor: alpha(memberAccent, 0.42),
                            color: memberAccent
                        }
                    }
                    : undefined
            }
        >
            <MotionCard
                sx={{
                    borderRadius: 2,
                    background: isDarkMode
                        ? `linear-gradient(135deg, ${alpha(memberAccentStrong, 0.92)}, ${alpha(memberAccent, 0.78)})`
                        : "linear-gradient(135deg, rgba(10,5,115,0.98), rgba(31,168,230,0.92))",
                    color: "#fff"
                }}
            >
                <CardContent sx={{ p: 3.5 }}>
                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={3}>
                        <Box>
                            <Typography variant="overline" sx={{ color: alpha("#fff", 0.8) }}>
                                Member Bulk Onboarding
                            </Typography>
                            <Typography variant="h4" fontWeight={700} sx={{ mt: 1 }}>
                                Import members and issue secure first-login credentials
                            </Typography>
                            <Typography variant="body1" sx={{ mt: 1.5, maxWidth: 760, color: alpha("#fff", 0.82) }}>
                                Upload a tenant-scoped CSV to create or update members, optionally provision member portal access,
                                and issue unique temporary passwords for one-time export only.
                            </Typography>
                        </Box>
                        <Stack spacing={1.25} alignItems={{ xs: "flex-start", md: "flex-end" }}>
                            <Chip icon={<LockRoundedIcon />} label="Temporary passwords are never stored in Postgres" sx={{ bgcolor: alpha("#fff", 0.16), color: "#fff" }} />
                            <Chip icon={<FilePresentRoundedIcon />} label="Credentials file expires after 10 minutes" sx={{ bgcolor: alpha("#fff", 0.16), color: "#fff" }} />
                        </Stack>
                    </Stack>
                </CardContent>
            </MotionCard>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}>
                    <SummaryCard
                        label="Current Import"
                        value={job ? job.status.toUpperCase() : "READY"}
                        helper={job ? `Created ${formatDate(job.created_at)}` : "Upload a CSV template to start."}
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <SummaryCard
                        label="Success Rows"
                        value={String(job?.success_rows || 0)}
                        helper="Members created or updated successfully."
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <SummaryCard
                        label="Failed Rows"
                        value={String(job?.failed_rows || 0)}
                        helper="Rows needing correction before retry."
                    />
                </Grid>
            </Grid>

            <Grid container spacing={3}>
                <Grid size={{ xs: 12, lg: 5 }}>
                    <MotionCard variant="outlined" sx={{ borderRadius: 2 }}>
                        <CardContent sx={{ p: 3 }}>
                            <Stack spacing={2.5} component="form" onSubmit={onSubmit}>
                                <Box>
                                    <Typography variant="h6" fontWeight={700}>
                                        Upload CSV
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                                        Use the provided template. For your current setup, one branch is enough, so you can leave <strong>branch_code</strong> blank and the system will automatically attach imported members to the tenant's default branch.
                                    </Typography>
                                </Box>

                                <Alert severity="warning">
                                    Store any downloaded credentials file securely. After distribution, delete it from local devices.
                                </Alert>

                                <Alert severity="info">
                                    The current template accepts dated activity fields too: <strong>opening_savings_date</strong>, <strong>opening_shares_date</strong>, <strong>withdrawal_date</strong>, <strong>loan_disbursed_at</strong>, and <strong>repayment_date</strong>. Leave <strong>branch_code</strong> blank for a single-branch tenant and use the dates to spread imported activity across past months so dashboards and trends look realistic.
                                </Alert>

                                {submitting ? (
                                    <MotionCard
                                        variant="outlined"
                                        sx={{
                                            borderRadius: 2,
                                            bgcolor: alpha(memberAccent, isDarkMode ? 0.12 : 0.04),
                                            borderColor: alpha(memberAccent, isDarkMode ? 0.28 : 0.2)
                                        }}
                                    >
                                        <CardContent sx={{ p: 2 }}>
                                            <Stack spacing={1.25}>
                                                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                                                    <Box>
                                                        <Typography variant="subtitle2" fontWeight={700}>
                                                            {importStage === "uploading" ? "Uploading import file" : "Processing imported rows"}
                                                        </Typography>
                                                        <Typography variant="body2" color="text.secondary">
                                                            {importStage === "uploading"
                                                                ? "Sending the CSV to the backend."
                                                                : "The backend is validating rows, creating members, posting opening balances, disbursing loans, applying withdrawals and repayments, and provisioning accounts."}
                                                        </Typography>
                                                    </Box>
                                                    <Chip
                                                        label={`${elapsedSeconds}s`}
                                                        variant="outlined"
                                                        sx={{
                                                            borderRadius: 1.5,
                                                            borderColor: alpha(memberAccent, 0.38),
                                                            color: memberAccent
                                                        }}
                                                    />
                                                </Stack>
                                                {importStage === "uploading" ? (
                                                    <>
                                                        <LinearProgress
                                                            variant="determinate"
                                                            value={uploadProgress}
                                                            sx={{ height: 10, borderRadius: 999 }}
                                                        />
                                                        <Typography variant="caption" color="text.secondary">
                                                            Upload progress: {uploadProgress}%
                                                        </Typography>
                                                    </>
                                                ) : (
                                                    <>
                                                        <LinearProgress
                                                            variant="indeterminate"
                                                            sx={{ height: 10, borderRadius: 999 }}
                                                        />
                                                        <Typography variant="caption" color="text.secondary">
                                                            Processing can take longer for large CSV files, especially when portal accounts and loans are included.
                                                        </Typography>
                                                    </>
                                                )}
                                            </Stack>
                                        </CardContent>
                                    </MotionCard>
                                ) : null}

                                {hasSingleBranch ? (
                                    <TextField
                                        label="Default branch"
                                        fullWidth
                                        value={
                                            selectedDefaultBranch
                                                ? `${selectedDefaultBranch.name}${selectedDefaultBranch.code ? ` (${selectedDefaultBranch.code})` : ""}`
                                                : "Loading branch..."
                                        }
                                        slotProps={{
                                            input: {
                                                readOnly: true
                                            }
                                        }}
                                        InputLabelProps={{ shrink: true }}
                                        helperText="Single-branch tenant detected. The tenant's default branch will be used automatically."
                                    />
                                ) : (
                                    <TextField
                                        select
                                        label="Default branch"
                                        fullWidth
                                        disabled={loadingBranches}
                                        value={selectedDefaultBranchId}
                                        onChange={(event) => form.setValue("default_branch_id", event.target.value, { shouldValidate: true })}
                                        helperText="Used when branch_code is blank in the CSV."
                                    >
                                        <MenuItem value="">Use my assigned branch</MenuItem>
                                        {branches.map((branch) => (
                                            <MenuItem key={branch.id} value={branch.id}>
                                                {branch.name} ({branch.code})
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                )}

                                <FormControlLabel
                                    control={<Switch checked={createPortalAccount} onChange={(event) => form.setValue("create_portal_account", event.target.checked)} />}
                                    label="Create member portal accounts"
                                />

                                <Button
                                    variant="outlined"
                                    component="label"
                                    startIcon={<UploadFileRoundedIcon />}
                                >
                                    {selectedFile?.item(0)?.name || "Select CSV file"}
                                    <input
                                        hidden
                                        type="file"
                                        accept=".csv,text/csv"
                                        onChange={(event) => form.setValue("file", event.target.files)}
                                    />
                                </Button>
                                {form.formState.errors.file ? (
                                    <Typography variant="body2" color="error.main">
                                        {form.formState.errors.file.message as string}
                                    </Typography>
                                ) : null}

                                <Stack direction="row" spacing={1.5} flexWrap="wrap">
                                    <Button type="submit" variant="contained" disabled={submitting} startIcon={<CloudUploadRoundedIcon />}>
                                        {submitting
                                            ? importStage === "uploading"
                                                ? "Uploading..."
                                                : "Processing..."
                                            : "Start import"}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="text"
                                        startIcon={<DownloadRoundedIcon />}
                                        onClick={() => window.open("/member-import-template.csv", "_blank", "noopener,noreferrer")}
                                    >
                                        Download template
                                    </Button>
                                </Stack>
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>

                <Grid size={{ xs: 12, lg: 7 }}>
                    <MotionCard variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
                        <CardContent sx={{ p: 3 }}>
                            <Stack spacing={2.5}>
                                <Box>
                                    <Typography variant="h6" fontWeight={700}>
                                        Import report
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                                        Review job results, download one-time credentials, and export failures for correction.
                                    </Typography>
                                </Box>

                                {job ? (
                                    <Stack spacing={2}>
                                        <Stack direction="row" spacing={1} flexWrap="wrap">
                                            <Chip label={`Job ${job.id.slice(0, 8)}`} />
                                            <Chip color={job.status === "completed" ? "success" : job.status === "failed" ? "error" : "warning"} label={job.status.toUpperCase()} />
                                            <Chip label={`Rows ${job.total_rows}`} />
                                        </Stack>

                                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                                            <Button
                                                variant="contained"
                                                disabled={!credentialsUrl && !job.credentials_path}
                                                startIcon={<LockRoundedIcon />}
                                                onClick={downloadCredentials}
                                            >
                                                Download credentials CSV
                                            </Button>
                                            <Button
                                                variant="outlined"
                                                disabled={!job.failed_rows}
                                                startIcon={<DownloadRoundedIcon />}
                                                onClick={downloadFailures}
                                            >
                                                Download failures CSV
                                            </Button>
                                            <Button
                                                variant="text"
                                                startIcon={<ReplayRoundedIcon />}
                                                onClick={() => void loadFailedRows(job.id, failedRowsPage, failedRowsLimit)}
                                            >
                                                Refresh failed rows
                                            </Button>
                                        </Stack>

                                        <Alert severity={job.failed_rows ? "warning" : "success"}>
                                            {job.failed_rows
                                                ? `${job.failed_rows} row(s) failed. Review the failed rows below before retrying.`
                                                : "All rows processed successfully."}
                                        </Alert>
                                    </Stack>
                                ) : (
                                    <Alert severity="info">
                                        No import job has been run in this session yet.
                                    </Alert>
                                )}
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>
            </Grid>

            <MotionCard variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent sx={{ p: 3 }}>
                    <Stack spacing={2}>
                        <Stack
                            direction={{ xs: "column", md: "row" }}
                            justifyContent="space-between"
                            alignItems={{ xs: "flex-start", md: "center" }}
                            spacing={2}
                        >
                            <Box>
                                <Typography variant="h6" fontWeight={700}>
                                    Failed rows
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                                    Rows that failed validation or provisioning are listed here with detailed reasons.
                                </Typography>
                            </Box>
                            <Stack direction="row" spacing={1.5} alignItems="center">
                                <TextField
                                    select
                                    size="small"
                                    label="Rows per page"
                                    value={failedRowsLimit}
                                    onChange={(event) => {
                                        setFailedRowsLimit(Number(event.target.value));
                                        setFailedRowsPage(1);
                                    }}
                                    sx={{ minWidth: 140 }}
                                >
                                    {[10, 25, 50].map((limit) => (
                                        <MenuItem key={limit} value={limit}>
                                            {limit}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Stack>
                        </Stack>

                        {loadingRows ? (
                            <Alert severity="info">Loading failed rows...</Alert>
                        ) : (
                            <DataTable
                                rows={failedRows}
                                columns={failedRowsColumns}
                                emptyMessage="No failed rows for this import."
                            />
                        )}

                        {failedRowsTotal > 0 ? (
                            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }}>
                                <Typography variant="body2" color="text.secondary">
                                    Showing {(failedRowsPage - 1) * failedRowsLimit + 1}-{Math.min(failedRowsPage * failedRowsLimit, failedRowsTotal)} of {failedRowsTotal} failed row(s)
                                </Typography>
                                <Pagination
                                    page={failedRowsPage}
                                    count={totalFailedPages}
                                    onChange={(_, page) => setFailedRowsPage(page)}
                                    sx={{
                                        "& .MuiPaginationItem-root.Mui-selected": {
                                            bgcolor: alpha(memberAccentStrong, 0.18),
                                            color: memberAccentStrong
                                        }
                                    }}
                                />
                            </Stack>
                        ) : null}
                    </Stack>
                </CardContent>
            </MotionCard>
        </Stack>
    );
}
