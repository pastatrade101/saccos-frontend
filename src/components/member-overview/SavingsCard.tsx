import LockRoundedIcon from "@mui/icons-material/LockRounded";
import SavingsRoundedIcon from "@mui/icons-material/SavingsRounded";
import WalletRoundedIcon from "@mui/icons-material/WalletRounded";
import { Box, CardContent, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import { brandColors } from "../../theme/colors";
import { formatCurrency } from "../../utils/format";
import { MotionCard } from "../../ui/motion";

interface SavingsCardProps {
    totalSavings: number;
    availableBalance: number;
    lockedAmount: number;
}

export function SavingsCard({ totalSavings, availableBalance, lockedAmount }: SavingsCardProps) {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === "dark";
    const accent = isDarkMode ? "#D9B273" : brandColors.primary[700];

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
                                bgcolor: alpha(accent, 0.14),
                                color: accent
                            }}
                        >
                            <SavingsRoundedIcon fontSize="small" />
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                            Savings
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
                            Total Savings
                        </Typography>
                        <Typography variant="h6" sx={{ mt: 1, fontWeight: 800, lineHeight: 1.2 }}>
                            {formatCurrency(totalSavings)}
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
                                <WalletRoundedIcon fontSize="small" sx={{ color: alpha(brandColors.success, 0.9) }} />
                                <Typography variant="body2" color="text.secondary">
                                    Available Balance
                                </Typography>
                            </Stack>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: brandColors.success, overflowWrap: "anywhere" }}>
                                {formatCurrency(availableBalance)}
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
                                <LockRoundedIcon fontSize="small" sx={{ color: alpha(brandColors.warning, 0.95) }} />
                                <Typography variant="body2" color="text.secondary">
                                    Locked / Pledged
                                </Typography>
                            </Stack>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#9A6700", overflowWrap: "anywhere" }}>
                                {formatCurrency(lockedAmount)}
                            </Typography>
                        </Stack>
                    </Stack>
                </Stack>
            </CardContent>
        </MotionCard>
    );
}
