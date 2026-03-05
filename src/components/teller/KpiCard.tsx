import TrendingDownRoundedIcon from "@mui/icons-material/TrendingDownRounded";
import TrendingFlatRoundedIcon from "@mui/icons-material/TrendingFlatRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import { Box, CardContent, Chip, Stack, Typography } from "@mui/material";
import { alpha, type Theme, useTheme } from "@mui/material/styles";
import type { ChartData, ChartOptions } from "chart.js";
import { Line } from "react-chartjs-2";

import { registerCharts } from "../../lib/charts";
import { MotionCard } from "../../ui/motion";
import { formatCurrency } from "../../utils/format";

registerCharts();

type Tone = "positive" | "negative" | "neutral";

interface KpiCardProps {
    label: string;
    value: number;
    deltaLabel: string;
    statusLabel: string;
    sparkline: number[];
    tone?: Tone;
    formatter?: (value: number) => string;
}

function getToneColors(tone: Tone, theme: Theme) {
    if (tone === "positive") {
        return {
            main: theme.palette.success.main,
            soft: alpha(theme.palette.success.main, 0.12)
        };
    }

    if (tone === "negative") {
        return {
            main: theme.palette.error.main,
            soft: alpha(theme.palette.error.main, 0.12)
        };
    }

    return {
        main: theme.palette.text.secondary,
        soft: alpha(theme.palette.text.primary, 0.08)
    };
}

export function KpiCard({
    label,
    value,
    deltaLabel,
    statusLabel,
    sparkline,
    tone = "neutral",
    formatter = formatCurrency
}: KpiCardProps) {
    const theme = useTheme();
    const colors = getToneColors(tone, theme);
    const deltaIcon = tone === "positive"
        ? <TrendingUpRoundedIcon sx={{ fontSize: 16 }} />
        : tone === "negative"
            ? <TrendingDownRoundedIcon sx={{ fontSize: 16 }} />
            : <TrendingFlatRoundedIcon sx={{ fontSize: 16 }} />;

    const chartData: ChartData<"line"> = {
        labels: sparkline.map((_, index) => `${index + 1}`),
        datasets: [
            {
                data: sparkline,
                borderColor: colors.main,
                backgroundColor: alpha(colors.main, 0.14),
                fill: true,
                pointRadius: 0,
                borderWidth: 2,
                tension: 0.42
            }
        ]
    };

    const options: ChartOptions<"line"> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: { enabled: false }
        },
        scales: {
            x: { display: false },
            y: { display: false }
        },
        elements: {
            line: {
                capBezierPoints: true
            }
        }
    };

    return (
        <MotionCard
            variant="outlined"
            inView
            interactive
            sx={{
                height: "100%",
                borderColor: alpha(colors.main, 0.24),
                background: `linear-gradient(180deg, ${alpha(colors.main, 0.06)}, ${theme.palette.background.paper})`
            }}
        >
            <CardContent sx={{ pb: 2 }}>
                <Stack spacing={2}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                        <Box>
                            <Typography variant="overline" color="text.secondary">
                                {label}
                            </Typography>
                            <Typography variant="h5" sx={{ mt: 0.5 }}>
                                {formatter(value)}
                            </Typography>
                        </Box>
                        <Chip
                            size="small"
                            label={statusLabel}
                            sx={{
                                bgcolor: colors.soft,
                                color: colors.main,
                                borderColor: alpha(colors.main, 0.18)
                            }}
                            variant="outlined"
                        />
                    </Stack>

                    <Stack direction="row" spacing={1} alignItems="center" sx={{ color: colors.main }}>
                        {deltaIcon}
                        <Typography variant="body2" fontWeight={600}>
                            {deltaLabel}
                        </Typography>
                    </Stack>

                    <Box sx={{ height: 60 }}>
                        <Line data={chartData} options={options} />
                    </Box>
                </Stack>
            </CardContent>
        </MotionCard>
    );
}
