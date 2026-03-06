import { CardContent, LinearProgress, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import { brandColors } from "../../theme/colors";
import { MotionCard } from "../../ui/motion";

interface LoanRepaymentProgressProps {
    progressPercent: number;
    label?: string;
}

export function LoanRepaymentProgress({ progressPercent, label = "Loan Repayment Progress" }: LoanRepaymentProgressProps) {
    const progress = Math.max(0, Math.min(progressPercent, 100));

    return (
        <MotionCard variant="outlined" sx={{ borderRadius: 2, borderColor: "divider", height: "100%" }}>
            <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                    {label}
                </Typography>
                <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                            Completed
                        </Typography>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {progress.toFixed(0)}%
                        </Typography>
                    </Stack>
                    <LinearProgress
                        variant="determinate"
                        value={progress}
                        sx={{
                            height: 10,
                            borderRadius: 999,
                            bgcolor: alpha(brandColors.primary[500], 0.12),
                            "& .MuiLinearProgress-bar": {
                                borderRadius: 999,
                                bgcolor: brandColors.accent[500]
                            }
                        }}
                    />
                </Stack>
            </CardContent>
        </MotionCard>
    );
}
