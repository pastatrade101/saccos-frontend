import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import SavingsRoundedIcon from "@mui/icons-material/SavingsRounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import { Box, CardContent, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import { brandColors } from "../../theme/colors";
import type { StatementRow } from "../../types/api";
import { formatCurrency, formatDate } from "../../utils/format";
import { MotionCard } from "../../ui/motion";

interface RecentActivityCardProps {
    lastTransactionDate?: string | null;
    lastContribution?: StatementRow | null;
    lastLoanPayment?: StatementRow | null;
}

export function RecentActivityCard({ lastTransactionDate, lastContribution, lastLoanPayment }: RecentActivityCardProps) {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === "dark";
    const accent = isDarkMode ? "#D9B273" : brandColors.info;

    return (
        <MotionCard
            variant="outlined"
            sx={{
                borderRadius: 2,
                borderColor: "divider",
                height: "100%",
                minHeight: 260,
                width: 1,
                display: "flex"
            }}
        >
            <CardContent sx={{ p: 2.25, width: 1, display: "flex" }}>
                <Stack spacing={1.2} sx={{ width: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Box
                            sx={{
                                width: 28,
                                height: 28,
                                borderRadius: 1.25,
                                display: "grid",
                                placeItems: "center",
                                bgcolor: alpha(accent, 0.14),
                                color: accent
                            }}
                        >
                                <TimelineRoundedIcon fontSize="small" />
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                            Recent Activity
                        </Typography>
                    </Stack>

                    <Stack spacing={0.9}>
                        <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            sx={{
                                p: 1.2,
                                borderRadius: 1.5,
                                border: "1px solid",
                                borderColor: "divider",
                                bgcolor: (theme) => alpha(theme.palette.background.paper, 0.72)
                            }}
                        >
                            <Stack direction="row" spacing={0.75} alignItems="center">
                                <CalendarMonthRoundedIcon fontSize="small" sx={{ color: accent }} />
                                <Typography variant="body2" color="text.secondary">
                                    Last Transaction Date
                                </Typography>
                            </Stack>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                {formatDate(lastTransactionDate)}
                            </Typography>
                        </Stack>

                        <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            sx={{
                                p: 1.2,
                                borderRadius: 1.5,
                                border: "1px solid",
                                borderColor: "divider",
                                bgcolor: (theme) => alpha(theme.palette.background.paper, 0.72)
                            }}
                        >
                            <Stack direction="row" spacing={0.75} alignItems="center">
                                <SavingsRoundedIcon fontSize="small" sx={{ color: accent }} />
                                <Typography variant="body2" color="text.secondary">
                                    Last Contribution
                                </Typography>
                            </Stack>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                {lastContribution ? formatCurrency(lastContribution.amount) : "N/A"}
                            </Typography>
                        </Stack>

                        <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            sx={{
                                p: 1.2,
                                borderRadius: 1.5,
                                border: "1px solid",
                                borderColor: "divider",
                                bgcolor: (theme) => alpha(theme.palette.background.paper, 0.72)
                            }}
                        >
                            <Stack direction="row" spacing={0.75} alignItems="center">
                                <PaymentsRoundedIcon fontSize="small" color="warning" />
                                <Typography variant="body2" color="text.secondary">
                                    Last Loan Payment
                                </Typography>
                            </Stack>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                {lastLoanPayment ? formatCurrency(lastLoanPayment.amount) : "N/A"}
                            </Typography>
                        </Stack>
                    </Stack>
                </Stack>
            </CardContent>
        </MotionCard>
    );
}
