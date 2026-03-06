import CreditScoreRoundedIcon from "@mui/icons-material/CreditScoreRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import { CardContent, LinearProgress, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

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
    const progress = Math.min(Math.max(loanProgressPercent, 0), 100);

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
            <CardContent>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                    <CreditScoreRoundedIcon fontSize="small" sx={{ color: brandColors.danger }} />
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        Loan Exposure
                    </Typography>
                </Stack>

                <Stack spacing={1.25}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" color="text.secondary">
                            Outstanding Amount
                        </Typography>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            {formatCurrency(outstandingAmount)}
                        </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Stack direction="row" spacing={0.75} alignItems="center">
                            <EventRoundedIcon fontSize="small" sx={{ color: alpha(brandColors.warning, 0.95) }} />
                            <Typography variant="body2" color="text.secondary">
                                Next Installment Due
                            </Typography>
                        </Stack>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {formatDate(nextInstallmentDueDate)}
                        </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Stack direction="row" spacing={0.75} alignItems="center">
                            <PaymentsRoundedIcon fontSize="small" sx={{ color: alpha(brandColors.info, 0.9) }} />
                            <Typography variant="body2" color="text.secondary">
                                Monthly Installment
                            </Typography>
                        </Stack>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {formatCurrency(monthlyInstallment)}
                        </Typography>
                    </Stack>
                    <Stack spacing={0.65} sx={{ pt: 0.5 }}>
                        <Stack direction="row" justifyContent="space-between">
                            <Typography variant="caption" color="text.secondary">
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
                                bgcolor: alpha(brandColors.primary[500], 0.12),
                                "& .MuiLinearProgress-bar": {
                                    borderRadius: 999,
                                    bgcolor: brandColors.primary[700]
                                }
                            }}
                        />
                    </Stack>
                </Stack>
            </CardContent>
        </MotionCard>
    );
}
