import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { Alert, Box, CardContent, Divider, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import type { ChartData, ChartOptions } from "chart.js";
import { Bar } from "react-chartjs-2";

import { registerCharts } from "../../lib/charts";
import type { TellerAlert, TellerHourlyPoint } from "../../lib/tellerDashboard";
import { MotionCard } from "../../ui/motion";

registerCharts();

interface AlertsPanelProps {
    alerts: TellerAlert[];
    hourlyActivity: TellerHourlyPoint[];
}

export function AlertsPanel({ alerts, hourlyActivity }: AlertsPanelProps) {
    const theme = useTheme();
    const accentColor = theme.palette.mode === "dark" ? "#D9B273" : theme.palette.primary.main;
    const peakHour = hourlyActivity.reduce<TellerHourlyPoint | null>((currentPeak, entry) => {
        if (!currentPeak || entry.txCount > currentPeak.txCount) {
            return entry;
        }

        return currentPeak;
    }, null);

    const chartData: ChartData<"bar"> = {
        labels: hourlyActivity.map((entry) => entry.hour),
        datasets: [
            {
                label: "Transactions",
                data: hourlyActivity.map((entry) => entry.txCount),
                backgroundColor: hourlyActivity.map((entry) =>
                    peakHour && entry.hour === peakHour.hour
                        ? alpha(theme.palette.warning.main, 0.88)
                        : alpha(accentColor, 0.78)
                ),
                borderRadius: 6,
                borderSkipped: false,
                maxBarThickness: 18
            }
        ]
    };

    const chartOptions: ChartOptions<"bar"> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false }
        },
        scales: {
            x: {
                grid: { display: false }
            },
            y: {
                grid: { color: alpha(theme.palette.text.primary, 0.08) },
                ticks: {
                    precision: 0
                }
            }
        }
    };

    return (
        <MotionCard variant="outlined" inView sx={{ height: "100%" }}>
            <CardContent sx={{ height: "100%" }}>
                <Stack spacing={2.5} sx={{ height: "100%" }}>
                    <Box>
                        <Typography variant="h6">Risk & Alerts</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            Teller-side signals for unusual movement, ticket size, and close risk.
                        </Typography>
                    </Box>

                    <Stack spacing={1.25}>
                        {alerts.length ? alerts.map((alert) => (
                            <Alert
                                key={alert.id}
                                severity={alert.severity}
                                icon={<WarningAmberRoundedIcon fontSize="inherit" />}
                                variant="outlined"
                            >
                                <Typography variant="body2" fontWeight={700}>
                                    {alert.title}
                                </Typography>
                                <Typography variant="body2">{alert.description}</Typography>
                            </Alert>
                        )) : (
                            <Alert severity="info" variant="outlined">
                                No teller alerts right now.
                            </Alert>
                        )}
                    </Stack>

                    <Divider />

                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                        <Stack spacing={0.5}>
                            <Typography variant="subtitle1">Peak Hour</Typography>
                            <Typography variant="body2" color="text.secondary">
                                {peakHour ? `${peakHour.hour} with ${peakHour.txCount} transactions` : "No hourly activity available"}
                            </Typography>
                        </Stack>
                        <WarningAmberRoundedIcon sx={{ color: "warning.main" }} />
                    </Stack>

                    <Box sx={{ height: 190 }}>
                        {hourlyActivity.length ? (
                            <Bar data={chartData} options={chartOptions} />
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
                                <ScheduleRoundedIcon sx={{ color: "text.secondary" }} />
                                <Typography variant="body2" color="text.secondary">
                                    No hourly teller activity recorded for today.
                                </Typography>
                            </Stack>
                        )}
                    </Box>
                </Stack>
            </CardContent>
        </MotionCard>
    );
}
