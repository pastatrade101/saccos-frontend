import { Box, CardContent, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import type { ChartData, ChartOptions } from "chart.js";
import { Bar } from "react-chartjs-2";

import { registerCharts } from "../../lib/charts";
import type { TellerDistributionPoint } from "../../lib/tellerDashboard";
import { MotionCard } from "../../ui/motion";

registerCharts();

interface DistributionChartProps {
    points: TellerDistributionPoint[];
}

export function DistributionChart({ points }: DistributionChartProps) {
    const theme = useTheme();
    const accentColor = theme.palette.mode === "dark" ? "#D9B273" : theme.palette.primary.main;
    const hasActivity = points.some((point) => point.count > 0);
    const data: ChartData<"bar"> = {
        labels: points.map((point) => point.bucketLabel),
        datasets: [
            {
                label: "Transactions",
                data: points.map((point) => point.count),
                backgroundColor: points.map((_, index) =>
                    index === points.length - 1
                        ? alpha(theme.palette.warning.main, 0.86)
                        : alpha(accentColor, 0.82)
                ),
                borderRadius: 7,
                borderSkipped: false,
                maxBarThickness: 18
            }
        ]
    };

    const options: ChartOptions<"bar"> = {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false }
        },
        scales: {
            x: {
                grid: { color: alpha(theme.palette.text.primary, 0.08) },
                ticks: {
                    precision: 0
                }
            },
            y: {
                grid: { display: false }
            }
        }
    };

    return (
        <MotionCard variant="outlined" inView sx={{ height: "100%" }}>
            <CardContent sx={{ height: "100%" }}>
                <Typography variant="h6">Transaction Size Distribution</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2.5 }}>
                    Count of today&apos;s posted teller transactions by value bucket.
                </Typography>
                <Box sx={{ height: 260 }}>
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
                            <Typography variant="subtitle2">No transaction distribution yet</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Bucket counts will show once the teller posts cash transactions today.
                            </Typography>
                        </Stack>
                    )}
                </Box>
            </CardContent>
        </MotionCard>
    );
}
