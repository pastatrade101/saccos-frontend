import AssessmentRoundedIcon from "@mui/icons-material/AssessmentRounded";
import BalanceRoundedIcon from "@mui/icons-material/BalanceRounded";
import AutoGraphRoundedIcon from "@mui/icons-material/AutoGraphRounded";
import FactCheckRoundedIcon from "@mui/icons-material/FactCheckRounded";
import FileDownloadRoundedIcon from "@mui/icons-material/FileDownloadRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import HistoryEduRoundedIcon from "@mui/icons-material/HistoryEduRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import {
    Alert,
    Box,
    Button,
    CardContent,
    Chip,
    Divider,
    Grid,
    Stack,
    Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { useAuth } from "../auth/AuthContext";
import { FormField } from "../components/FormField";
import { SearchableSelect } from "../components/SearchableSelect";
import { useToast } from "../components/Toast";
import { api, getApiErrorMessage } from "../lib/api";
import {
    endpoints,
    type ReportExportJobCreateResponse,
    type ReportExportJobDownloadResponse,
    type ReportExportJobResponse
} from "../lib/endpoints";
import { supabase } from "../lib/supabase";
import type { MemberAccount } from "../types/api";
import { MotionCard } from "../ui/motion";
import { downloadFile } from "../utils/downloadFile";
import pageStyles from "./Pages.module.css";

const statementSchema = z.object({
    account_id: z.string().uuid("Select an account.").optional().or(z.literal("")),
    from_date: z.string().optional(),
    to_date: z.string().optional()
});

type StatementExportValues = z.infer<typeof statementSchema>;
const financialExportSchema = z
    .object({
        balance_as_of_date: z.string().optional(),
        balance_compare_as_of_date: z.string().optional(),
        income_from_date: z.string().optional(),
        income_to_date: z.string().optional(),
        income_compare_from_date: z.string().optional(),
        income_compare_to_date: z.string().optional(),
        include_zero_balances: z.boolean().default(false)
    })
    .superRefine((values, ctx) => {
        if ((values.income_compare_from_date && !values.income_compare_to_date)
            || (!values.income_compare_from_date && values.income_compare_to_date)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Provide both comparative dates for income statement.",
                path: ["income_compare_from_date"]
            });
        }

        if (values.income_from_date && values.income_to_date && values.income_from_date > values.income_to_date) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Income from date cannot be after to date.",
                path: ["income_from_date"]
            });
        }

        if (values.income_compare_from_date && values.income_compare_to_date && values.income_compare_from_date > values.income_compare_to_date) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Comparative from date cannot be after comparative to date.",
                path: ["income_compare_from_date"]
            });
        }
    });
type FinancialExportValues = z.infer<typeof financialExportSchema>;
const PACK_DOWNLOAD_DELAY_MS = 260;
const REPORT_EXPORT_POLL_INTERVAL_MS = 2000;
const REPORT_EXPORT_MAX_POLLS = 45;

function wait(ms: number) {
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });
}

function dateIso(value: Date) {
    return value.toISOString().slice(0, 10);
}

function getTodayIso() {
    return dateIso(new Date());
}

function getYearStartIso() {
    const now = new Date();
    return dateIso(new Date(now.getFullYear(), 0, 1));
}

export function ReportsPage() {
    const theme = useTheme();
    const { pushToast } = useToast();
    const { selectedTenantId } = useAuth();
    const [accounts, setAccounts] = useState<MemberAccount[]>([]);
    const [downloading, setDownloading] = useState<string | null>(null);
    const todayIso = useMemo(() => getTodayIso(), []);
    const yearStartIso = useMemo(() => getYearStartIso(), []);
    const reportsAccent = theme.palette.mode === "dark" ? "#D9B273" : theme.palette.primary.main;
    const reportsAccentStrong = theme.palette.mode === "dark" ? "#C89B52" : theme.palette.primary.dark;

    const form = useForm<StatementExportValues>({
        resolver: zodResolver(statementSchema),
        defaultValues: {
            account_id: localStorage.getItem("saccos:selectedAccountId") || "",
            from_date: "",
            to_date: ""
        }
    });
    const financialForm = useForm<FinancialExportValues>({
        resolver: zodResolver(financialExportSchema),
        defaultValues: {
            balance_as_of_date: todayIso,
            balance_compare_as_of_date: "",
            income_from_date: yearStartIso,
            income_to_date: todayIso,
            income_compare_from_date: "",
            income_compare_to_date: "",
            include_zero_balances: false
        }
    });

    useEffect(() => {
        if (!selectedTenantId) {
            return;
        }

        void supabase
            .from("member_accounts")
            .select("*")
            .eq("tenant_id", selectedTenantId)
            .is("deleted_at", null)
            .then(({ data }) => setAccounts((data || []) as MemberAccount[]));
    }, [selectedTenantId]);

    const accountOptions = accounts.map((account) => ({
        value: account.id,
        label: account.account_number,
        secondary: account.account_name
    }));

    const performAsyncReportDownload = async (
        key: string,
        url: string,
        params: Record<string, string | undefined>
    ) => {
        const start = await api.get<ReportExportJobCreateResponse>(url, {
            params: {
                ...params,
                async: "true"
            }
        });

        const jobId = start.data?.data?.job_id;
        if (!jobId) {
            throw new Error("Report export job could not be created.");
        }

        for (let attempt = 0; attempt < REPORT_EXPORT_MAX_POLLS; attempt += 1) {
            const statusResponse = await api.get<ReportExportJobResponse>(
                endpoints.reports.exportJob(jobId)
            );
            const job = statusResponse.data?.data;

            if (!job?.status) {
                throw new Error("Report export job status is unavailable.");
            }

            if (job.status === "completed") {
                const downloadResponse = await api.get<ReportExportJobDownloadResponse>(
                    endpoints.reports.exportJobDownload(jobId)
                );
                const downloadData = downloadResponse.data?.data;

                if (!downloadData?.signed_url) {
                    throw new Error("Report file URL is missing.");
                }

                const fileResponse = await fetch(downloadData.signed_url);
                if (!fileResponse.ok) {
                    throw new Error("Unable to download generated report file.");
                }

                const payload = await fileResponse.blob();
                if (payload.size <= 0) {
                    throw new Error("The report file is empty.");
                }

                const preferredExtension = params.format === "pdf" ? "pdf" : "csv";
                const filename = downloadData.filename || `${key}.${preferredExtension}`;
                downloadFile(payload, filename);
                return filename;
            }

            if (job.status === "failed") {
                throw new Error(job.error_message || "Report export failed.");
            }

            await wait(REPORT_EXPORT_POLL_INTERVAL_MS);
        }

        throw new Error("Report export timed out. Please try again.");
    };

    const runDownload = async (
        key: string,
        url: string,
        params: Record<string, string | undefined>
    ) => {
        setDownloading(key);

        try {
            const filename = await performAsyncReportDownload(key, url, params);
            pushToast({
                type: "success",
                title: "Download ready",
                message: `${filename} was downloaded successfully.`
            });
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

    const runReadyMadePack = async (
        key: string,
        jobs: Array<{ fileKey: string; url: string; params: Record<string, string | undefined> }>
    ) => {
        setDownloading(key);

        try {
            for (let index = 0; index < jobs.length; index += 1) {
                const job = jobs[index];
                await performAsyncReportDownload(job.fileKey, job.url, job.params);

                if (index < jobs.length - 1) {
                    await wait(PACK_DOWNLOAD_DELAY_MS);
                }
            }

            pushToast({
                type: "success",
                title: "Report pack ready",
                message: `${jobs.length} report file(s) were downloaded.`
            });
        } catch (error) {
            pushToast({
                type: "error",
                title: "Report pack failed",
                message: getApiErrorMessage(error)
            });
        } finally {
            setDownloading(null);
        }
    };

    const exportStatement = form.handleSubmit(async (values) => {
        await runDownload("member-statements", endpoints.reports.memberStatements(), {
            tenant_id: selectedTenantId || undefined,
            account_id: values.account_id || undefined,
            from_date: values.from_date || undefined,
            to_date: values.to_date || undefined,
            format: "pdf"
        });
    });
    const exportBalanceSheet = financialForm.handleSubmit(async (values) => {
        await runDownload("balance-sheet", endpoints.reports.balanceSheet(), {
            tenant_id: selectedTenantId || undefined,
            as_of_date: values.balance_as_of_date || todayIso,
            compare_as_of_date: values.balance_compare_as_of_date || undefined,
            include_zero_balances: values.include_zero_balances ? "true" : undefined,
            format: "pdf"
        });
    });
    const exportIncomeStatement = financialForm.handleSubmit(async (values) => {
        await runDownload("income-statement", endpoints.reports.incomeStatement(), {
            tenant_id: selectedTenantId || undefined,
            from_date: values.income_from_date || yearStartIso,
            to_date: values.income_to_date || todayIso,
            compare_from_date: values.income_compare_from_date || undefined,
            compare_to_date: values.income_compare_to_date || undefined,
            include_zero_balances: values.include_zero_balances ? "true" : undefined,
            format: "pdf"
        });
    });

    const applyStatementDatePreset = (preset: "month" | "quarter" | "year" | "last30") => {
        const now = new Date();
        const today = now.toISOString().slice(0, 10);

        let fromDate = today;

        if (preset === "month") {
            fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        } else if (preset === "quarter") {
            const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
            fromDate = new Date(now.getFullYear(), quarterStartMonth, 1).toISOString().slice(0, 10);
        } else if (preset === "year") {
            fromDate = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
        } else {
            const last30 = new Date(now);
            last30.setDate(last30.getDate() - 30);
            fromDate = last30.toISOString().slice(0, 10);
        }

        form.setValue("from_date", fromDate, { shouldValidate: true });
        form.setValue("to_date", today, { shouldValidate: true });
    };
    const applyIncomeDatePreset = (preset: "month" | "quarter" | "year" | "last30") => {
        const now = new Date();
        const today = dateIso(now);

        let fromDate = today;
        if (preset === "month") {
            fromDate = dateIso(new Date(now.getFullYear(), now.getMonth(), 1));
        } else if (preset === "quarter") {
            const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
            fromDate = dateIso(new Date(now.getFullYear(), quarterStartMonth, 1));
        } else if (preset === "year") {
            fromDate = dateIso(new Date(now.getFullYear(), 0, 1));
        } else {
            const last30 = new Date(now);
            last30.setDate(last30.getDate() - 30);
            fromDate = dateIso(last30);
        }

        financialForm.setValue("income_from_date", fromDate, { shouldValidate: true });
        financialForm.setValue("income_to_date", today, { shouldValidate: true });
    };

    const readyMadePacks = useMemo(
        () => [
            {
                key: "board-pack",
                label: "Board Pack",
                helper: "Trial Balance + PAR + Loan Aging in one click.",
                icon: <InsightsRoundedIcon fontSize="small" />,
                jobs: [
                    { fileKey: "trial-balance", url: endpoints.reports.trialBalance(), params: { tenant_id: selectedTenantId || undefined, format: "pdf" } },
                    { fileKey: "par", url: endpoints.reports.par(), params: { tenant_id: selectedTenantId || undefined, format: "pdf" } },
                    { fileKey: "loan-aging", url: endpoints.reports.loanAging(), params: { tenant_id: selectedTenantId || undefined, format: "pdf" } }
                ]
            },
            {
                key: "risk-pack",
                label: "Risk Pack",
                helper: "PAR + Loan Aging for portfolio delinquency review.",
                icon: <AutoGraphRoundedIcon fontSize="small" />,
                jobs: [
                    { fileKey: "par", url: endpoints.reports.par(), params: { tenant_id: selectedTenantId || undefined, format: "pdf" } },
                    { fileKey: "loan-aging", url: endpoints.reports.loanAging(), params: { tenant_id: selectedTenantId || undefined, format: "pdf" } }
                ]
            },
            {
                key: "compliance-pack",
                label: "Compliance Pack",
                helper: "Trial Balance + Member Statements export package.",
                icon: <FactCheckRoundedIcon fontSize="small" />,
                jobs: [
                    { fileKey: "trial-balance", url: endpoints.reports.trialBalance(), params: { tenant_id: selectedTenantId || undefined, format: "pdf" } },
                    { fileKey: "member-statements", url: endpoints.reports.memberStatements(), params: { tenant_id: selectedTenantId || undefined, format: "pdf" } }
                ]
            },
            {
                key: "statutory-pack",
                label: "Statutory Pack",
                helper: "Balance Sheet + Income Statement for period governance review.",
                icon: <BalanceRoundedIcon fontSize="small" />,
                jobs: [
                    {
                        fileKey: "balance-sheet",
                        url: endpoints.reports.balanceSheet(),
                        params: { tenant_id: selectedTenantId || undefined, as_of_date: todayIso, format: "pdf" }
                    },
                    {
                        fileKey: "income-statement",
                        url: endpoints.reports.incomeStatement(),
                        params: { tenant_id: selectedTenantId || undefined, from_date: yearStartIso, to_date: todayIso, format: "pdf" }
                    }
                ]
            }
        ],
        [selectedTenantId, todayIso, yearStartIso]
    );

    const metricCards = [
        {
            label: "Ready-made packs",
            value: String(readyMadePacks.length),
            helper: "One-tap bundles for common reporting cycles.",
            icon: <Inventory2RoundedIcon fontSize="small" />
        },
        {
            label: "Core exports",
            value: "5",
            helper: "Trial Balance, Balance Sheet, Income Statement, PAR, and Loan Aging.",
            icon: <AssessmentRoundedIcon fontSize="small" />
        },
        {
            label: "Member accounts",
            value: accounts.length.toLocaleString(),
            helper: "Accounts available for statement generation.",
            icon: <GroupsRoundedIcon fontSize="small" />
        }
    ];

    const darkContainedButtonSx = {
        bgcolor: reportsAccent,
        color: "#1a1a1a",
        "&:hover": { bgcolor: reportsAccentStrong }
    };
    const darkOutlinedButtonSx = {
        borderColor: alpha(reportsAccent, 0.5),
        color: reportsAccent,
        "&:hover": {
            borderColor: alpha(reportsAccent, 0.84),
            bgcolor: alpha(reportsAccent, 0.12)
        }
    };

    return (
        <Stack spacing={2.5}>
            <MotionCard
                variant="outlined"
                sx={{
                    borderRadius: 2,
                    color: "text.primary",
                    background: theme.palette.mode === "dark"
                        ? `linear-gradient(135deg, ${alpha("#1B2535", 0.92)}, ${alpha("#D9B273", 0.16)})`
                        : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)}, ${alpha(theme.palette.background.paper, 0.96)})`
                }}
            >
                <CardContent sx={{ p: { xs: 2.25, md: 2.75 } }}>
                    <Stack spacing={2}>
                        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5}>
                            <Box>
                                <Typography variant="overline" color="text.secondary">
                                    Reports Command Center
                                </Typography>
                                <Typography variant="h5" sx={{ mt: 0.5 }}>
                                    Export-ready financial, portfolio, and member reporting
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 760 }}>
                                    Generate standard compliance files or use ready-made report packs for board meetings, risk reviews, and month-end operations.
                                </Typography>
                            </Box>
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="flex-start">
                                <Chip label="Operational Reports Ready" color="success" variant="outlined" />
                                <Chip label={`${accounts.length} member account(s)`} variant="outlined" />
                            </Stack>
                        </Stack>

                        <Grid container spacing={1.25}>
                            {metricCards.map((metric) => (
                                <Grid key={metric.label} size={{ xs: 12, sm: 4 }}>
                                    <Box
                                        sx={{
                                            height: "100%",
                                            borderRadius: 2,
                                            px: 1.4,
                                            py: 1.35,
                                            border: `1px solid ${alpha(reportsAccent, theme.palette.mode === "dark" ? 0.36 : 0.2)}`,
                                            bgcolor: theme.palette.mode === "dark"
                                                ? alpha("#141D2A", 0.75)
                                                : alpha(theme.palette.background.paper, 0.85)
                                        }}
                                    >
                                        <Stack direction="row" justifyContent="space-between" spacing={1.25}>
                                            <Stack spacing={0.35}>
                                                <Typography variant="overline" color="text.secondary">
                                                    {metric.label}
                                                </Typography>
                                                <Typography variant="h5" sx={{ lineHeight: 1 }}>
                                                    {metric.value}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {metric.helper}
                                                </Typography>
                                            </Stack>
                                            <Box
                                                sx={{
                                                    width: 34,
                                                    height: 34,
                                                    borderRadius: 1.6,
                                                    display: "grid",
                                                    placeItems: "center",
                                                    bgcolor: alpha(reportsAccent, 0.15),
                                                    color: reportsAccent,
                                                    flexShrink: 0
                                                }}
                                            >
                                                {metric.icon}
                                            </Box>
                                        </Stack>
                                    </Box>
                                </Grid>
                            ))}
                        </Grid>
                    </Stack>
                </CardContent>
            </MotionCard>

            <MotionCard variant="outlined">
                <CardContent>
                    <Stack spacing={1.5}>
                        <Box>
                            <Typography variant="h6">Ready-made Report Buttons</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                Use these quick buttons to download complete report bundles for board, risk, and compliance reviews.
                            </Typography>
                        </Box>
                        <Grid container spacing={1.25}>
                            {readyMadePacks.map((pack) => (
                                <Grid key={pack.key} size={{ xs: 12, md: 4 }}>
                                    <MotionCard
                                        variant="outlined"
                                        sx={{
                                            height: "100%",
                                            borderColor: alpha(reportsAccent, theme.palette.mode === "dark" ? 0.34 : 0.2),
                                            background: theme.palette.mode === "dark"
                                                ? `linear-gradient(145deg, ${alpha("#111A28", 0.94)}, ${alpha("#D9B273", 0.12)})`
                                                : `linear-gradient(145deg, ${alpha(theme.palette.primary.main, 0.05)}, ${alpha(theme.palette.background.paper, 0.95)})`
                                        }}
                                    >
                                        <CardContent sx={{ p: 2 }}>
                                            <Stack spacing={1.25} sx={{ height: "100%" }}>
                                                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                                                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                                        {pack.label}
                                                    </Typography>
                                                    <Box
                                                        sx={{
                                                            width: 32,
                                                            height: 32,
                                                            borderRadius: 1.5,
                                                            display: "grid",
                                                            placeItems: "center",
                                                            bgcolor: alpha(reportsAccent, 0.15),
                                                            color: reportsAccent,
                                                            flexShrink: 0
                                                        }}
                                                    >
                                                        {pack.icon}
                                                    </Box>
                                                </Stack>
                                                <Typography variant="body2" color="text.secondary">
                                                    {pack.helper}
                                                </Typography>
                                                <Chip
                                                    label={`${pack.jobs.length} file(s)`}
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{
                                                        width: "fit-content",
                                                        borderColor: alpha(reportsAccent, 0.36),
                                                        color: "text.secondary"
                                                    }}
                                                />
                                                <Button
                                                    variant="contained"
                                                    onClick={() => void runReadyMadePack(pack.key, pack.jobs)}
                                                    disabled={Boolean(downloading)}
                                                    startIcon={<FileDownloadRoundedIcon />}
                                                    fullWidth
                                                    sx={theme.palette.mode === "dark" ? darkContainedButtonSx : undefined}
                                                >
                                                    {downloading === pack.key ? "Preparing..." : `Run ${pack.label}`}
                                                </Button>
                                            </Stack>
                                        </CardContent>
                                    </MotionCard>
                                </Grid>
                            ))}
                        </Grid>

                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap flexWrap="wrap">
                            {readyMadePacks.map((pack) => (
                                <Button
                                    key={`${pack.key}-quick`}
                                    variant="outlined"
                                    onClick={() => void runReadyMadePack(pack.key, pack.jobs)}
                                    disabled={Boolean(downloading)}
                                    startIcon={<HistoryEduRoundedIcon />}
                                    sx={theme.palette.mode === "dark" ? darkOutlinedButtonSx : undefined}
                                >
                                    {downloading === pack.key ? "Preparing..." : pack.label}
                                </Button>
                            ))}
                        </Stack>
                    </Stack>
                </CardContent>
            </MotionCard>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                    <MotionCard variant="outlined" sx={{ height: "100%" }}>
                        <CardContent>
                            <Stack spacing={1.5}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
                                    <Typography variant="h6">Financial Core Exports</Typography>
                                    <Chip size="small" icon={<AssessmentRoundedIcon />} label="PDF" variant="outlined" />
                                </Stack>
                                <Typography variant="body2" color="text.secondary">
                                    Standard exports for finance operations and audit support.
                                </Typography>
                                <Stack spacing={1}>
                                    <Button
                                        variant="outlined"
                                        onClick={() =>
                                            void runDownload("trial-balance", endpoints.reports.trialBalance(), {
                                                tenant_id: selectedTenantId || undefined,
                                                format: "pdf"
                                            })
                                        }
                                        disabled={Boolean(downloading)}
                                        startIcon={<AssessmentRoundedIcon />}
                                        sx={theme.palette.mode === "dark" ? darkOutlinedButtonSx : undefined}
                                    >
                                        {downloading === "trial-balance" ? "Preparing Trial Balance..." : "Download Trial Balance PDF"}
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        onClick={() =>
                                            void runDownload("loan-aging", endpoints.reports.loanAging(), {
                                                tenant_id: selectedTenantId || undefined,
                                                format: "pdf"
                                            })
                                        }
                                        disabled={Boolean(downloading)}
                                        startIcon={<AutoGraphRoundedIcon />}
                                        sx={theme.palette.mode === "dark" ? darkOutlinedButtonSx : undefined}
                                    >
                                        {downloading === "loan-aging" ? "Preparing Loan Aging..." : "Download Loan Aging PDF"}
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        onClick={() =>
                                            void runDownload("par", endpoints.reports.par(), {
                                                tenant_id: selectedTenantId || undefined,
                                                format: "pdf"
                                            })
                                        }
                                        disabled={Boolean(downloading)}
                                        startIcon={<InsightsRoundedIcon />}
                                        sx={theme.palette.mode === "dark" ? darkOutlinedButtonSx : undefined}
                                    >
                                        {downloading === "par" ? "Preparing PAR..." : "Download PAR PDF"}
                                    </Button>
                                </Stack>
                                <Divider />
                                <Stack spacing={1}>
                                    <Typography variant="subtitle2">Balance Sheet Export</Typography>
                                    <form className={pageStyles.form} onSubmit={exportBalanceSheet}>
                                        <div className="grid-2">
                                            <FormField label="As of date">
                                                <input type="date" {...financialForm.register("balance_as_of_date")} />
                                            </FormField>
                                            <FormField label="Comparative as of date (optional)">
                                                <input type="date" {...financialForm.register("balance_compare_as_of_date")} />
                                            </FormField>
                                        </div>
                                        <Box sx={{ mt: 0.5 }}>
                                            <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                                <input type="checkbox" {...financialForm.register("include_zero_balances")} />
                                                <Typography variant="body2" color="text.secondary">
                                                    Include zero-balance accounts
                                                </Typography>
                                            </label>
                                        </Box>
                                        <Button
                                            variant="contained"
                                            type="submit"
                                            disabled={Boolean(downloading)}
                                            startIcon={<BalanceRoundedIcon />}
                                            sx={theme.palette.mode === "dark" ? darkContainedButtonSx : undefined}
                                        >
                                            {downloading === "balance-sheet" ? "Preparing Balance Sheet..." : "Download Balance Sheet PDF"}
                                        </Button>
                                    </form>
                                </Stack>
                                <Divider />
                                <Stack spacing={1}>
                                    <Typography variant="subtitle2">Income Statement Export</Typography>
                                    <form className={pageStyles.form} onSubmit={exportIncomeStatement}>
                                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                            <Chip label="This Month" variant="outlined" onClick={() => applyIncomeDatePreset("month")} sx={{ cursor: "pointer" }} />
                                            <Chip label="This Quarter" variant="outlined" onClick={() => applyIncomeDatePreset("quarter")} sx={{ cursor: "pointer" }} />
                                            <Chip label="YTD" variant="outlined" onClick={() => applyIncomeDatePreset("year")} sx={{ cursor: "pointer" }} />
                                            <Chip label="Last 30 Days" variant="outlined" onClick={() => applyIncomeDatePreset("last30")} sx={{ cursor: "pointer" }} />
                                        </Stack>
                                        <div className="grid-2">
                                            <FormField label="From date">
                                                <input type="date" {...financialForm.register("income_from_date")} />
                                            </FormField>
                                            <FormField label="To date">
                                                <input type="date" {...financialForm.register("income_to_date")} />
                                            </FormField>
                                        </div>
                                        <div className="grid-2">
                                            <FormField label="Comparative from (optional)">
                                                <input type="date" {...financialForm.register("income_compare_from_date")} />
                                            </FormField>
                                            <FormField label="Comparative to (optional)">
                                                <input type="date" {...financialForm.register("income_compare_to_date")} />
                                            </FormField>
                                        </div>
                                        <Button
                                            variant="contained"
                                            type="submit"
                                            disabled={Boolean(downloading)}
                                            startIcon={<BalanceRoundedIcon />}
                                            sx={theme.palette.mode === "dark" ? darkContainedButtonSx : undefined}
                                        >
                                            {downloading === "income-statement" ? "Preparing Income Statement..." : "Download Income Statement PDF"}
                                        </Button>
                                    </form>
                                </Stack>
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                    <MotionCard variant="outlined" sx={{ height: "100%" }}>
                        <CardContent>
                            <Stack spacing={1.5}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
                                    <Typography variant="h6">Member Statement Export</Typography>
                                    <Chip size="small" icon={<FileDownloadRoundedIcon />} label="Filtered" variant="outlined" />
                                </Stack>
                                <Typography variant="body2" color="text.secondary">
                                    Select account and date range, then export statement data for reconciliation.
                                </Typography>
                                <form className={pageStyles.form} onSubmit={exportStatement}>
                                    <FormField label="Account">
                                        <SearchableSelect
                                            value={form.watch("account_id") || ""}
                                            options={accountOptions}
                                            onChange={(value) => form.setValue("account_id", value, { shouldValidate: true })}
                                        />
                                    </FormField>
                                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                        <Chip label="This Month" variant="outlined" onClick={() => applyStatementDatePreset("month")} sx={{ cursor: "pointer" }} />
                                        <Chip label="This Quarter" variant="outlined" onClick={() => applyStatementDatePreset("quarter")} sx={{ cursor: "pointer" }} />
                                        <Chip label="YTD" variant="outlined" onClick={() => applyStatementDatePreset("year")} sx={{ cursor: "pointer" }} />
                                        <Chip label="Last 30 Days" variant="outlined" onClick={() => applyStatementDatePreset("last30")} sx={{ cursor: "pointer" }} />
                                    </Stack>
                                    <div className="grid-2">
                                        <FormField label="From date">
                                            <input type="date" {...form.register("from_date")} />
                                        </FormField>
                                        <FormField label="To date">
                                            <input type="date" {...form.register("to_date")} />
                                        </FormField>
                                    </div>
                                    <Divider />
                                    <Button
                                        variant="contained"
                                        disabled={Boolean(downloading)}
                                        type="submit"
                                        startIcon={<FileDownloadRoundedIcon />}
                                        sx={theme.palette.mode === "dark" ? darkContainedButtonSx : undefined}
                                    >
                                        {downloading === "member-statements" ? "Preparing..." : "Download Member Statement PDF"}
                                    </Button>
                                </form>
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>
            </Grid>
        </Stack>
    );
}
