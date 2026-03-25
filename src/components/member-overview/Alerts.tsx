import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import ErrorRoundedIcon from "@mui/icons-material/ErrorRounded";
import { Alert, AlertTitle, CardContent, Stack, Typography } from "@mui/material";

import { MotionCard } from "../../ui/motion";
import type { MemberAlertItem } from "./types";

interface AlertsProps {
    alerts: MemberAlertItem[];
}

function getAlertIcon(severity: MemberAlertItem["severity"]) {
    if (severity === "error") {
        return <ErrorRoundedIcon fontSize="small" />;
    }

    if (severity === "warning") {
        return <WarningRoundedIcon fontSize="small" />;
    }

    if (severity === "success") {
        return <CheckCircleRoundedIcon fontSize="small" />;
    }

    return <InfoRoundedIcon fontSize="small" />;
}

export function Alerts({ alerts }: AlertsProps) {
    return (
        <MotionCard
            variant="outlined"
            sx={{
                width: { xs: "calc(100vw - 20px)", sm: "100%" },
                maxWidth: { xs: "calc(100vw - 20px)", sm: "100%" },
                minWidth: 0,
                boxSizing: "border-box",
                borderRadius: 2,
                borderColor: "divider"
            }}
        >
            <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
                    Alerts
                </Typography>
                <Stack spacing={1.25}>
                    {alerts.length === 0 ? (
                        <Alert severity="success" icon={<CheckCircleRoundedIcon fontSize="small" />} variant="outlined">
                            No pending obligations.
                        </Alert>
                    ) : (
                        alerts.map((entry) => (
                            <Alert key={entry.id} severity={entry.severity} icon={getAlertIcon(entry.severity)} variant="outlined">
                                <AlertTitle>{entry.title}</AlertTitle>
                                {entry.message}
                            </Alert>
                        ))
                    )}
                </Stack>
            </CardContent>
        </MotionCard>
    );
}
