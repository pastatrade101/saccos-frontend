import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import SouthWestRoundedIcon from "@mui/icons-material/SouthWestRounded";
import NorthEastRoundedIcon from "@mui/icons-material/NorthEastRounded";
import { Avatar, Box, CardContent, Chip, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import type { ChartData, ChartOptions, TooltipItem } from "chart.js";
import { Bar } from "react-chartjs-2";

import { registerCharts } from "../../lib/charts";
import { MotionCard } from "../../ui/motion";
import { formatCurrency } from "../../utils/format";

registerCharts();

interface WaterfallCardProps {
    openingCash: number;
    deposits: number;
    withdrawals: number;
    closingCash: number;
}

export function WaterfallCard({
    openingCash,
    deposits,
    withdrawals,
    closingCash
}: WaterfallCardProps) {
    const theme = useTheme();
    const accentColor = theme.palette.mode === "dark" ? "#D9B273" : theme.palette.primary.main;
    const netMovement = closingCash - openingCash;
    const hasActivity = openingCash !== 0 || deposits !== 0 || withdrawals !== 0 || closingCash !== 0;
    const openingFill = alpha(theme.palette.info.main, 0.75);
    const depositFill = alpha(theme.palette.success.main, 0.82);
    const withdrawalFill = alpha(theme.palette.error.main, 0.82);
    const closingFill = alpha(accentColor, 0.86);

    const data: ChartData<"bar"> = {
        labels: ["Opening Cash", "Deposits", "Withdrawals", "Closing Cash"],
        datasets: [
            {
                label: "base",
                data: [0, openingCash, closingCash, 0],
                backgroundColor: "transparent",
                borderWidth: 0,
                stack: "waterfall"
            },
            {
                label: "movement",
                data: [openingCash, deposits, withdrawals, closingCash],
                backgroundColor: [openingFill, depositFill, withdrawalFill, closingFill],
                borderRadius: 8,
                borderSkipped: false,
                stack: "waterfall"
            }
        ]
    };

    const options: ChartOptions<"bar"> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: (context: TooltipItem<"bar">) => {
                        const label = context.label;

                        if (label === "Deposits") {
                            return `+ ${formatCurrency(deposits)}`;
                        }

                        if (label === "Withdrawals") {
                            return `- ${formatCurrency(withdrawals)}`;
                        }

                        return formatCurrency(Number(context.raw || 0));
                    }
                }
            }
        },
        scales: {
            x: {
                stacked: true,
                grid: { display: false }
            },
            y: {
                stacked: true,
                grid: { color: alpha(theme.palette.text.primary, 0.08) },
                ticks: {
                    callback: (value) => formatCurrency(Number(value))
                }
            }
        }
    };

    return (
        <MotionCard variant="outlined" inView sx={{ height: "100%" }}>
            <CardContent sx={{ height: "100%" }}>
                <Stack spacing={2.5} sx={{ height: "100%" }}>
                    <Stack direction="row" justifyContent="space-between" spacing={2}>
                        <Box>
                            <Typography variant="h6">Net Movement</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                Opening cash, visible intake, visible outflow, and computed close.
                            </Typography>
                        </Box>
                        <Avatar
                            variant="rounded"
                            sx={{
                                width: 42,
                                height: 42,
                                borderRadius: 2,
                                bgcolor: alpha(accentColor, 0.16),
                                color: accentColor
                            }}
                        >
                            <AccountBalanceWalletRoundedIcon fontSize="small" />
                        </Avatar>
                    </Stack>

                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} useFlexGap flexWrap="wrap">
                        <Chip
                            icon={<AccountBalanceWalletRoundedIcon />}
                            label={`Opening ${formatCurrency(openingCash)}`}
                            variant="outlined"
                        />
                        <Chip
                            icon={<NorthEastRoundedIcon />}
                            label={`Deposits ${formatCurrency(deposits)}`}
                            color="success"
                            variant="outlined"
                        />
                        <Chip
                            icon={<SouthWestRoundedIcon />}
                            label={`Withdrawals ${formatCurrency(withdrawals)}`}
                            color="error"
                            variant="outlined"
                        />
                    </Stack>

                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" color="text.secondary">
                            Net movement
                        </Typography>
                        <Typography
                            variant="h5"
                            sx={{
                                color: netMovement >= 0 ? "success.main" : "error.main"
                            }}
                        >
                            {netMovement >= 0 ? "+" : "-"} {formatCurrency(Math.abs(netMovement))}
                        </Typography>
                    </Stack>

                    <Box sx={{ height: 280 }}>
                        {hasActivity ? (
                            <Bar data={data} options={options} />
                        ) : (
                            <Stack
                                spacing={1}
                                alignItems="center"
                                justifyContent="center"
                                sx={{
                                    height: "100%",
                                    borderRadius: 2,
                                    border: `1px dashed ${theme.palette.divider}`
                                }}
                            >
                                <Typography variant="subtitle2">No opening or closing movement yet</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    The waterfall will populate after the first posted teller transactions of the day.
                                </Typography>
                            </Stack>
                        )}
                    </Box>
                </Stack>
            </CardContent>
        </MotionCard>
    );
}
