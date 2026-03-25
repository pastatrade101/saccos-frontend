import AccountBalanceRoundedIcon from "@mui/icons-material/AccountBalanceRounded";
import EventAvailableRoundedIcon from "@mui/icons-material/EventAvailableRounded";
import PaidRoundedIcon from "@mui/icons-material/PaidRounded";
import { Box, CardContent, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import { brandColors } from "../../theme/colors";
import { formatCurrency, formatDate } from "../../utils/format";
import { MotionCard } from "../../ui/motion";

interface ShareCapitalCardProps {
    totalShares: number;
    dividendEarned: number;
    lastContributionDate?: string | null;
}

export function ShareCapitalCard({ totalShares, dividendEarned, lastContributionDate }: ShareCapitalCardProps) {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === "dark";
    const accent = isDarkMode ? "#D9B273" : brandColors.info;

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
                                bgcolor: alpha(brandColors.warning, 0.16),
                                color: "#B45309"
                            }}
                        >
                            <AccountBalanceRoundedIcon fontSize="small" />
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                            Share Capital
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
                            Total Shares
                        </Typography>
                        <Typography variant="h6" sx={{ mt: 1, fontWeight: 800, lineHeight: 1.2 }}>
                            {formatCurrency(totalShares)}
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
                                <PaidRoundedIcon fontSize="small" sx={{ color: alpha(brandColors.success, 0.92) }} />
                                <Typography variant="body2" color="text.secondary">
                                    Dividend Earned
                                </Typography>
                            </Stack>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>
                                {formatCurrency(dividendEarned)}
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
                                <EventAvailableRoundedIcon fontSize="small" sx={{ color: accent }} />
                                <Typography variant="body2" color="text.secondary">
                                    Last Contribution Date
                                </Typography>
                            </Stack>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>
                                {formatDate(lastContributionDate)}
                            </Typography>
                        </Stack>
                    </Stack>
                </Stack>
            </CardContent>
        </MotionCard>
    );
}
