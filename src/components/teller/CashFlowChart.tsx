import { Box, CardContent, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import type { ChartData, ChartOptions, TooltipItem } from "chart.js";
import { Line } from "react-chartjs-2";

import { registerCharts } from "../../lib/charts";
import type { TellerTimePoint } from "../../lib/tellerDashboard";
import { MotionCard } from "../../ui/motion";
import { formatCurrency } from "../../utils/format";

registerCharts();

function formatShortDate(date: string) {
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric"
    }).format(new Date(date));
}

interface CashFlowChartProps {
    points: TellerTimePoint[];
}

export function CashFlowChart({ points }: CashFlowChartProps) {
    const theme = useTheme();
    const labels = points.map((point) => formatShortDate(point.date));
    const lastIndex = Math.max(points.length - 1, 0);
    const hasActivity = points.some((point) => point.deposits > 0 || point.withdrawals > 0);

    const data: ChartData<"line"> = {
        labels,
        datasets: [
            {
                label: "Deposits",
                data: points.map((point) => point.deposits),
                borderColor: theme.palette.success.main,
                backgroundColor: alpha(theme.palette.success.main, 0.16),
                fill: true,
                pointRadius: points.map((_, index) => (index === lastIndex ? 4 : 2)),
                pointHoverRadius: 5,
                pointBackgroundColor: points.map((_, index) =>
                    index === lastIndex ? theme.palette.success.main : alpha(theme.palette.success.main, 0.72)
                ),
                borderWidth: 2.4,
                tension: 0.34
            },
            {
                label: "Withdrawals",
                data: points.map((point) => point.withdrawals),
                borderColor: theme.palette.error.main,
                backgroundColor: alpha(theme.palette.error.main, 0.12),
                fill: true,
                pointRadius: points.map((_, index) => (index === lastIndex ? 4 : 2)),
                pointHoverRadius: 5,
                pointBackgroundColor: points.map((_, index) =>
                    index === lastIndex ? theme.palette.error.main : alpha(theme.palette.error.main, 0.72)
                ),
                borderWidth: 2.4,
                tension: 0.34
            }
        ]
    };

    const options: ChartOptions<"line"> = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: "index",
            intersect: false
        },
        plugins: {
            legend: {
                position: "bottom"
            },
            tooltip: {
                callbacks: {
                    title: (items) => points[items[0]?.dataIndex || 0]?.date || "",
                    label: (context: TooltipItem<"line">) => `${context.dataset.label}: ${formatCurrency(Number(context.raw || 0))}`,
                    afterBody: (items) => items[0]?.dataIndex === lastIndex ? ["Today"] : []
                }
            }
        },
        scales: {
            x: {
                grid: { display: false }
            },
            y: {
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
                <Typography variant="h6">Cash Flow Over 7 Days</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2.5 }}>
                    Deposit intake versus withdrawal outflow, with today highlighted at the edge of the trend.
                </Typography>
                <Box sx={{ height: 320 }}>
                    {hasActivity ? (
                        <Line data={data} options={options} />
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
                            <Typography variant="subtitle2">No cash activity yet</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Posted deposits and withdrawals will appear here once teller transactions start.
                            </Typography>
                        </Stack>
                    )}
                </Box>
            </CardContent>
        </MotionCard>
    );
}
