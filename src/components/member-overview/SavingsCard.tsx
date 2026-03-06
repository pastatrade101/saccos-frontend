import LockRoundedIcon from "@mui/icons-material/LockRounded";
import SavingsRoundedIcon from "@mui/icons-material/SavingsRounded";
import WalletRoundedIcon from "@mui/icons-material/WalletRounded";
import { CardContent, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import { brandColors } from "../../theme/colors";
import { formatCurrency } from "../../utils/format";
import { MotionCard } from "../../ui/motion";

interface SavingsCardProps {
    totalSavings: number;
    availableBalance: number;
    lockedAmount: number;
}

export function SavingsCard({ totalSavings, availableBalance, lockedAmount }: SavingsCardProps) {
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
                    <SavingsRoundedIcon fontSize="small" sx={{ color: brandColors.primary[700] }} />
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        Savings
                    </Typography>
                </Stack>

                <Stack spacing={1.25}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" color="text.secondary">
                            Total Savings
                        </Typography>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            {formatCurrency(totalSavings)}
                        </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Stack direction="row" spacing={0.75} alignItems="center">
                            <WalletRoundedIcon fontSize="small" sx={{ color: alpha(brandColors.success, 0.9) }} />
                            <Typography variant="body2" color="text.secondary">
                                Available Balance
                            </Typography>
                        </Stack>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: brandColors.success }}>
                            {formatCurrency(availableBalance)}
                        </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Stack direction="row" spacing={0.75} alignItems="center">
                            <LockRoundedIcon fontSize="small" sx={{ color: alpha(brandColors.warning, 0.95) }} />
                            <Typography variant="body2" color="text.secondary">
                                Locked / Pledged
                            </Typography>
                        </Stack>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#9A6700" }}>
                            {formatCurrency(lockedAmount)}
                        </Typography>
                    </Stack>
                </Stack>
            </CardContent>
        </MotionCard>
    );
}
