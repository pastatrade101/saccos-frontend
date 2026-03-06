import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import CreditScoreRoundedIcon from "@mui/icons-material/CreditScoreRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import PaidRoundedIcon from "@mui/icons-material/PaidRounded";
import SavingsRoundedIcon from "@mui/icons-material/SavingsRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import { Box, Button, CardContent, Chip, Divider, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

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
    onPayInstallment: () => void;
}

function getStandingStyles(tone: FinancialStanding["tone"]) {
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
        color: brandColors.info,
        bg: alpha(brandColors.info, 0.1),
        border: alpha(brandColors.info, 0.24)
    };
}

export function FinancialSummary({
    summary,
    standing,
    onApplyLoan,
    onMakeContribution,
    onDownloadStatement,
    onPayInstallment
}: FinancialSummaryProps) {
    const standingStyles = getStandingStyles(standing.tone);
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
            iconColor: brandColors.info,
            iconBg: alpha(brandColors.info, 0.12),
            valueColor: "text.primary"
        },
        {
            label: "Net Position",
            value: formatCurrency(summary.netPosition),
            icon: TrendingUpRoundedIcon,
            iconColor: summary.netPosition < 0 ? brandColors.danger : brandColors.primary[700],
            iconBg: summary.netPosition < 0 ? alpha(brandColors.danger, 0.12) : alpha(brandColors.primary[500], 0.12),
            valueColor: summary.netPosition < 0 ? brandColors.danger : brandColors.primary[900]
        }
    ];

    return (
        <MotionCard variant="outlined" sx={{ borderRadius: 2, borderColor: "divider", boxShadow: "0 6px 18px rgba(15, 23, 42, 0.05)" }}>
            <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
                <Stack spacing={2.25}>
                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5}>
                        <Box>
                            <Typography variant="overline" color="text.secondary">
                                Financial Position
                            </Typography>
                            <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                                Your Financial Position
                            </Typography>
                            {standing.details ? (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                    {standing.details}
                                </Typography>
                            ) : null}
                        </Box>
                        <Chip
                            label={standing.label}
                            sx={{
                                alignSelf: { xs: "flex-start", md: "center" },
                                borderRadius: 1.5,
                                color: standingStyles.color,
                                bgcolor: standingStyles.bg,
                                border: `1px solid ${standingStyles.border}`,
                                fontWeight: 700
                            }}
                        />
                    </Stack>

                    <Box
                        sx={{
                            display: "grid",
                            gap: 2,
                            gridTemplateColumns: {
                                xs: "repeat(2, minmax(0, 1fr))",
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
                                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
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
                                    <Typography variant="h6" sx={{ mt: 1.25, fontWeight: 800, color: item.valueColor as string }}>
                                        {item.value}
                                    </Typography>
                                </Box>
                            );
                        })}
                    </Box>

                    <Divider />

                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} useFlexGap flexWrap="wrap">
                        <Button variant="contained" onClick={onApplyLoan} startIcon={<PaidRoundedIcon />} sx={{ borderRadius: 1.5, fontWeight: 700 }}>
                            Apply for Loan
                        </Button>
                        <Button
                            variant="outlined"
                            onClick={onMakeContribution}
                            startIcon={<SavingsRoundedIcon />}
                            sx={{ borderRadius: 1.5, fontWeight: 700 }}
                        >
                            Make Contribution
                        </Button>
                        <Button
                            variant="outlined"
                            onClick={onDownloadStatement}
                            startIcon={<DownloadRoundedIcon />}
                            sx={{ borderRadius: 1.5, fontWeight: 700 }}
                        >
                            Download Statement
                        </Button>
                        <Button
                            variant="outlined"
                            onClick={onPayInstallment}
                            startIcon={<PaymentsRoundedIcon />}
                            sx={{ borderRadius: 1.5, fontWeight: 700 }}
                        >
                            Pay Installment
                        </Button>
                    </Stack>
                </Stack>
            </CardContent>
        </MotionCard>
    );
}
