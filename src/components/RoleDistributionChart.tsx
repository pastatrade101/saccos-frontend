import { CardContent, Stack, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { ChartData, ChartOptions } from "chart.js";
import { Bar } from "react-chartjs-2";

import { registerCharts } from "../lib/charts";
import type { StaffRoleCounts } from "../types/api";
import { roleCoverageLabels } from "../utils/roleRules";
import { brandColors } from "../theme/colors";
import { MotionCard } from "../ui/motion";

registerCharts();

interface RoleDistributionChartProps {
    roleCounts: StaffRoleCounts;
}

export function RoleDistributionChart({ roleCounts }: RoleDistributionChartProps) {
    const theme = useTheme();
    const labels = Object.keys(roleCounts) as Array<keyof StaffRoleCounts>;
    const total = labels.reduce((sum, role) => sum + roleCounts[role], 0);

    const data: ChartData<"bar"> = {
        labels: labels.map((role) => roleCoverageLabels[role]),
        datasets: [
            {
                label: "Staff by role",
                data: labels.map((role) => roleCounts[role]),
                backgroundColor: [
                    brandColors.primary[900],
                    brandColors.accent[500],
                    brandColors.primary[500],
                    brandColors.success,
                    brandColors.warning
                ],
                borderRadius: 8,
                borderSkipped: false,
                barThickness: 16
            }
        ]
    };

    const options: ChartOptions<"bar"> = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: (context) => `${context.parsed.x} staff`
                }
            }
        },
        scales: {
            x: {
                beginAtZero: true,
                grid: {
                    color: alpha(theme.palette.text.secondary, 0.08)
                },
                ticks: {
                    precision: 0
                }
            },
            y: {
                grid: {
                    display: false
                }
            }
        }
    };

    return (
        <MotionCard variant="outlined" inView sx={{ height: "100%" }}>
            <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2} sx={{ mb: 2 }}>
                    <BoxCopy title="Role Distribution" subtitle="See staffing balance by control role and execution role." />
                    <Typography variant="h5">{total}</Typography>
                </Stack>
                <div style={{ height: 260 }}>
                    <Bar data={data} options={options} />
                </div>
            </CardContent>
        </MotionCard>
    );
}

function BoxCopy({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <Stack spacing={0.5}>
            <Typography variant="h6">{title}</Typography>
            <Typography variant="body2" color="text.secondary">
                {subtitle}
            </Typography>
        </Stack>
    );
}
