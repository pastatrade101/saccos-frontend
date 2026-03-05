import { MotionCard, MotionModal } from "../ui/motion";
import BalanceRoundedIcon from "@mui/icons-material/BalanceRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { Alert, Avatar, Card, CardContent, Grid, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";

import { useToast } from "../components/Toast";
import { AppLoader } from "../components/AppLoader";
import { api, getApiErrorMessage } from "../lib/api";
import { endpoints, type AuditorSummaryResponse } from "../lib/endpoints";
import type { AuditorSummary } from "../types/api";

function MetricCard({
    label,
    value,
    helper,
    icon
}: {
    label: string;
    value: string;
    helper: string;
    icon: React.ReactNode;
}) {
    return (
        <MotionCard variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
                <Stack direction="row" justifyContent="space-between" spacing={2}>
                    <Stack spacing={0.75}>
                        <Typography variant="overline" color="text.secondary">
                            {label}
                        </Typography>
                        <Typography variant="h5">{value}</Typography>
                        <Typography variant="body2" color="text.secondary">
                            {helper}
                        </Typography>
                    </Stack>
                    <Avatar variant="rounded" sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: "action.hover", color: "text.primary" }}>
                        {icon}
                    </Avatar>
                </Stack>
            </CardContent>
        </MotionCard>
    );
}

export function AuditorDashboardPage() {
    const { pushToast } = useToast();
    const [summary, setSummary] = useState<AuditorSummary | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        void api.get<AuditorSummaryResponse>(endpoints.auditor.summary())
            .then(({ data }) => setSummary(data.data))
            .catch((error) =>
                pushToast({
                    type: "error",
                    title: "Unable to load auditor dashboard",
                    message: getApiErrorMessage(error)
                })
            )
            .finally(() => setLoading(false));
    }, [pushToast]);

    if (loading) {
        return <AppLoader message="Loading auditor dashboard..." />;
    }

    if (!summary) {
        return <Alert severity="warning" variant="outlined">No auditor summary is available.</Alert>;
    }

    return (
        <Stack spacing={3}>
            <MotionCard variant="outlined">
                <CardContent>
                    <Typography variant="h5">Auditor Dashboard</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                        Exceptions-first oversight for accounting integrity, posting discipline, and audit traceability.
                    </Typography>
                </CardContent>
            </MotionCard>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                    <MetricCard
                        label="Trial Balance Integrity"
                        value={summary.trial_balance_balanced ? "Balanced" : "Mismatch"}
                        helper="Checks net debit versus credit across visible journals."
                        icon={<BalanceRoundedIcon fontSize="small" />}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                    <MetricCard
                        label="Unposted Journals"
                        value={String(summary.unposted_journals_count)}
                        helper="Entries still not fully posted."
                        icon={<ReceiptLongRoundedIcon fontSize="small" />}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                    <MetricCard
                        label="Backdated Entries"
                        value={String(summary.backdated_entries_count)}
                        helper="Entry date before actual creation date."
                        icon={<HistoryRoundedIcon fontSize="small" />}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                    <MetricCard
                        label="Reversals"
                        value={String(summary.reversals_count)}
                        helper="Journals marked as reversals."
                        icon={<WarningAmberRoundedIcon fontSize="small" />}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                    <MetricCard
                        label="High Value Flags"
                        value={String(summary.high_value_tx_count)}
                        helper="Transactions above the configured threshold."
                        icon={<WarningAmberRoundedIcon fontSize="small" />}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                    <MetricCard
                        label="Out of Hours"
                        value={String(summary.out_of_hours_count)}
                        helper="Entries posted outside allowed operating hours."
                        icon={<HistoryRoundedIcon fontSize="small" />}
                    />
                </Grid>
            </Grid>
        </Stack>
    );
}
