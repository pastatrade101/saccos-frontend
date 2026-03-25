import CreditScoreRoundedIcon from "@mui/icons-material/CreditScoreRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import { Box, CardContent, LinearProgress, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import { brandColors } from "../../theme/colors";
import { formatCurrency, formatDate } from "../../utils/format";
import { MotionCard } from "../../ui/motion";

interface LoanCardProps {
    outstandingAmount: number;
    nextInstallmentDueDate?: string | null;
    monthlyInstallment: number;
    loanProgressPercent: number;
}

export function LoanCard({ outstandingAmount, nextInstallmentDueDate, monthlyInstallment, loanProgressPercent }: LoanCardProps) {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === "dark";
    const accent = isDarkMode ? "#D9B273" : brandColors.primary[700];
    const progress = Math.min(Math.max(loanProgressPercent, 0), 100);

    return (
        <MotionCard
            variant="outlined"
            sx={{
                width: { xs: "calc(100vw - 20px)", sm: 1 },
                maxWidth: { xs: "calc(100vw - 20px)", sm: "100%" },
                minWidth: 0,
                boxSizing: "border-box",
                borderRadius: 2,
                borderColor: "divider",
                height: "100%",
                minHeight: 260,
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
                                bgcolor: alpha(brandColors.danger, 0.14),
                                color: brandColors.danger
                            }}
                        >
                            <CreditScoreRoundedIcon fontSize="small" />
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                            Loan Exposure
                        </Typography>
                    </Stack>

                    <Box
                        sx={{
                            p: 1.5,
                            borderRadius: 1.5,
                            border: "1px solid",
                            borderColor: "divider",
                            bgcolor: (theme) => alpha(theme.palette.background.paper, 0.72)
                        }}
                    >
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                            Outstanding Amount
                        </Typography>
                        <Typography variant="h6" sx={{ mt: 1, fontWeight: 800, lineHeight: 1.2 }}>
                            {formatCurrency(outstandingAmount)}
                        </Typography>
                    </Box>

                    <Stack spacing={0.9}>
                        <Stack
                            direction={{ xs: "column", sm: "row" }}
                            justifyContent="space-between"
                            alignItems={{ xs: "flex-start", sm: "center" }}
                            spacing={1}
                            sx={{
                                p: 1.2,
                                borderRadius: 1.5,
                                border: "1px solid",
                                borderColor: "divider",
                                bgcolor: (theme) => alpha(theme.palette.background.paper, 0.72)
                            }}
                        >
                            <Stack direction="row" spacing={0.75} alignItems="center">
                                <EventRoundedIcon fontSize="small" sx={{ color: alpha(brandColors.warning, 0.95) }} />
                                <Typography variant="body2" color="text.secondary">
                                    Next Installment Due
                                </Typography>
                            </Stack>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>
                                {formatDate(nextInstallmentDueDate)}
                            </Typography>
                        </Stack>

                        <Stack
                            direction={{ xs: "column", sm: "row" }}
                            justifyContent="space-between"
                            alignItems={{ xs: "flex-start", sm: "center" }}
                            spacing={1}
                            sx={{
                                p: 1.2,
                                borderRadius: 1.5,
                                border: "1px solid",
                                borderColor: "divider",
                                bgcolor: (theme) => alpha(theme.palette.background.paper, 0.72)
                            }}
                        >
                            <Stack direction="row" spacing={0.75} alignItems="center">
                                <PaymentsRoundedIcon fontSize="small" sx={{ color: alpha(accent, 0.92) }} />
                                <Typography variant="body2" color="text.secondary">
                                    Monthly Installment
                                </Typography>
                            </Stack>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>
                                {formatCurrency(monthlyInstallment)}
                            </Typography>
                        </Stack>
                    </Stack>

                    <Box
                        sx={{
                            mt: "auto",
                            p: 1.2,
                            borderRadius: 1.5,
                            border: "1px solid",
                            borderColor: "divider",
                            bgcolor: (theme) => alpha(theme.palette.background.paper, 0.72)
                        }}
                    >
                        <Stack spacing={0.65}>
                            <Stack direction="row" justifyContent="space-between">
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                    Loan Progress
                                </Typography>
                                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                    {progress.toFixed(0)}%
                                </Typography>
                            </Stack>
                            <LinearProgress
                                variant="determinate"
                                value={progress}
                                sx={{
                                    height: 8,
                                    borderRadius: 999,
                                    bgcolor: alpha(accent, 0.16),
                                    "& .MuiLinearProgress-bar": {
                                        borderRadius: 999,
                                        bgcolor: accent
                                    }
                                }}
                            />
                        </Stack>
                    </Box>
                </Stack>
            </CardContent>
        </MotionCard>
    );
}
