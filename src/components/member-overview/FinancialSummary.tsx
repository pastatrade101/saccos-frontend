import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import CreditScoreRoundedIcon from "@mui/icons-material/CreditScoreRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import PaidRoundedIcon from "@mui/icons-material/PaidRounded";
import SavingsRoundedIcon from "@mui/icons-material/SavingsRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import { Box, Button, CardContent, Chip, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import { brandColors } from "../../theme/colors";
import { formatCurrency } from "../../utils/format";
import { MotionCard } from "../../ui/motion";
import type { FinancialStanding, FinancialSummaryData } from "./types";

interface FinancialSummaryProps {
    summary: FinancialSummaryData;
    standing: FinancialStanding;
    onApplyLoan: () => void;
    onMakeContribution: () => void;
    onDownloadStatement: () => void;
}

function getStandingStyles(tone: FinancialStanding["tone"], accent: string) {
    if (tone === "danger") {
        return {
            color: brandColors.danger,
            bg: alpha(brandColors.danger, 0.12),
            border: alpha(brandColors.danger, 0.32)
        };
    }

    if (tone === "warning") {
        return {
            color: "#9A6700",
            bg: alpha(brandColors.warning, 0.16),
            border: alpha(brandColors.warning, 0.36)
        };
    }

    if (tone === "success") {
        return {
            color: brandColors.success,
            bg: alpha(brandColors.success, 0.12),
            border: alpha(brandColors.success, 0.32)
        };
    }

    return {
        color: accent,
        bg: alpha(accent, 0.1),
        border: alpha(accent, 0.24)
    };
}

export function FinancialSummary({
    summary,
    standing,
    onApplyLoan,
    onMakeContribution,
    onDownloadStatement
}: FinancialSummaryProps) {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === "dark";
    const accent = isDarkMode ? "#D9B273" : brandColors.info;
    const accentStrong = isDarkMode ? "#C89B52" : brandColors.primary[900];
    const standingStyles = getStandingStyles(standing.tone, accent);
    const summaryCards = [
        {
            label: "Total Savings",
            value: formatCurrency(summary.totalSavings),
            icon: SavingsRoundedIcon,
            iconColor: brandColors.success,
            iconBg: alpha(brandColors.success, 0.12),
            valueColor: "text.primary"
        },
        {
            label: "Share Capital",
            value: formatCurrency(summary.totalShareCapital),
            icon: AccountBalanceWalletRoundedIcon,
            iconColor: "#B45309",
            iconBg: alpha(brandColors.warning, 0.16),
            valueColor: "text.primary"
        },
        {
            label: "Outstanding Loan",
            value: formatCurrency(summary.outstandingLoan),
            icon: CreditScoreRoundedIcon,
            iconColor: brandColors.danger,
            iconBg: alpha(brandColors.danger, 0.12),
            valueColor: "text.primary"
        },
        {
            label: "Available to Withdraw",
            value: formatCurrency(summary.availableToWithdraw),
            icon: PaidRoundedIcon,
            iconColor: accent,
            iconBg: alpha(accent, 0.12),
            valueColor: "text.primary"
        },
        {
            label: "Net Position",
            value: formatCurrency(summary.netPosition),
            icon: TrendingUpRoundedIcon,
            iconColor: summary.netPosition < 0 ? brandColors.danger : accent,
            iconBg: summary.netPosition < 0 ? alpha(brandColors.danger, 0.12) : alpha(accent, 0.12),
            valueColor: summary.netPosition < 0 ? brandColors.danger : accentStrong
        }
    ];

    return (
        <MotionCard
            variant="outlined"
            sx={{
                width: { xs: "calc(100vw - 20px)", sm: "100%" },
                maxWidth: { xs: "calc(100vw - 20px)", sm: "100%" },
                minWidth: 0,
                boxSizing: "border-box",
                borderRadius: 2,
                borderColor: "divider",
                boxShadow: "0 6px 18px rgba(15, 23, 42, 0.05)"
            }}
        >
            <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
                <Stack spacing={2.25}>
                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5}>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant="overline" color="text.secondary">
                                Financial Position
                            </Typography>
                            <Typography
                                variant="h4"
                                sx={{
                                    fontWeight: 800,
                                    lineHeight: 1.1,
                                    fontSize: { xs: "2rem", sm: undefined },
                                    overflowWrap: "anywhere"
                                }}
                            >
                                Your Financial Position
                            </Typography>
                            {standing.details ? (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, overflowWrap: "anywhere" }}>
                                    {standing.details}
                                </Typography>
                            ) : null}
                        </Box>
                        <Stack spacing={1} sx={{ width: { xs: "100%", md: "auto" }, alignItems: { xs: "stretch", md: "flex-end" } }}>
                            {standing.showChip !== false ? (
                                <Chip
                                    label={standing.label}
                                    sx={{
                                        alignSelf: { xs: "flex-start", md: "flex-end" },
                                        borderRadius: 1.5,
                                        color: standingStyles.color,
                                        bgcolor: standingStyles.bg,
                                        border: `1px solid ${standingStyles.border}`,
                                        fontWeight: 700
                                    }}
                                />
                            ) : null}
                            <Stack
                                direction={{ xs: "column", sm: "row" }}
                                spacing={1}
                                useFlexGap
                                flexWrap="wrap"
                                sx={{
                                    width: { xs: "100%", md: "auto" },
                                    justifyContent: { xs: "flex-start", md: "flex-end" }
                                }}
                            >
                                <Button
                                    variant="contained"
                                    onClick={onApplyLoan}
                                    startIcon={<PaidRoundedIcon />}
                                    sx={{
                                        borderRadius: 1.5,
                                        fontWeight: 700,
                                        width: { xs: "100%", sm: "auto" },
                                        ...(isDarkMode
                                            ? { bgcolor: accent, color: "#1a1a1a", "&:hover": { bgcolor: "#E6C88A" } }
                                            : {})
                                    }}
                                >
                                    Apply for Loan
                                </Button>
                                <Button
                                    variant="outlined"
                                    onClick={onMakeContribution}
                                    startIcon={<SavingsRoundedIcon />}
                                    sx={{
                                        borderRadius: 1.5,
                                        fontWeight: 700,
                                        width: { xs: "100%", sm: "auto" },
                                        ...(isDarkMode
                                            ? {
                                                borderColor: alpha(accent, 0.4),
                                                color: accent,
                                                "&:hover": { borderColor: alpha(accent, 0.72), bgcolor: alpha(accent, 0.08) }
                                            }
                                            : {})
                                    }}
                                >
                                    Make Contribution
                                </Button>
                                <Button
                                    variant="outlined"
                                    onClick={onDownloadStatement}
                                    startIcon={<DownloadRoundedIcon />}
                                    sx={{
                                        borderRadius: 1.5,
                                        fontWeight: 700,
                                        width: { xs: "100%", sm: "auto" },
                                        ...(isDarkMode
                                            ? {
                                                borderColor: alpha(accent, 0.4),
                                                color: accent,
                                                "&:hover": { borderColor: alpha(accent, 0.72), bgcolor: alpha(accent, 0.08) }
                                            }
                                            : {})
                                    }}
                                >
                                    Download Statement
                                </Button>
                            </Stack>
                        </Stack>
                    </Stack>

                    <Box
                        sx={{
                            width: "100%",
                            minWidth: 0,
                            display: "grid",
                            gap: 2,
                            gridTemplateColumns: {
                                xs: "minmax(0, 1fr)",
                                sm: "repeat(2, minmax(0, 1fr))",
                                md: "repeat(3, minmax(0, 1fr))",
                                xl: "repeat(5, minmax(0, 1fr))"
                            }
                        }}
                    >
                        {summaryCards.map((item) => {
                            const Icon = item.icon;

                            return (
                                <Box
                                    key={item.label}
                                    sx={{
                                        minWidth: 0,
                                        p: 1.5,
                                        borderRadius: 1.5,
                                        border: "1px solid",
                                        borderColor: "divider",
                                        bgcolor: (theme) => alpha(theme.palette.background.paper, 0.72),
                                        minHeight: 114,
                                        display: "flex",
                                        flexDirection: "column",
                                        justifyContent: "space-between"
                                    }}
                                >
                                    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, minWidth: 0, overflowWrap: "anywhere" }}>
                                            {item.label}
                                        </Typography>
                                        <Box
                                            sx={{
                                                width: 28,
                                                height: 28,
                                                borderRadius: 1.25,
                                                display: "grid",
                                                placeItems: "center",
                                                bgcolor: item.iconBg,
                                                color: item.iconColor
                                            }}
                                        >
                                            <Icon sx={{ fontSize: 16 }} />
                                        </Box>
                                    </Stack>
                                    <Typography variant="h6" sx={{ mt: 1.25, fontWeight: 800, color: item.valueColor as string, overflowWrap: "anywhere" }}>
                                        {item.value}
                                    </Typography>
                                </Box>
                            );
                        })}
                    </Box>
                </Stack>
            </CardContent>
        </MotionCard>
    );
}
