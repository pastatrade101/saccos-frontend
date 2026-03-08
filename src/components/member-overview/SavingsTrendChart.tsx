import { alpha, useTheme } from "@mui/material/styles";

import { ChartPanel } from "../ChartPanel";
import { brandColors } from "../../theme/colors";

interface SavingsTrendChartProps {
    labels: string[];
    values: number[];
}

export function SavingsTrendChart({ labels, values }: SavingsTrendChartProps) {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === "dark";
    const accent = isDarkMode ? "#D9B273" : brandColors.primary[700];

    return (
        <ChartPanel
            title="Savings Trend (Last 6 Months)"
            subtitle="Monthly trend based on posted member statement balances."
            data={{
                labels,
                datasets: [
                    {
                        label: "Savings balance",
                        data: values,
                        borderColor: accent,
                        backgroundColor: alpha(accent, 0.12),
                        fill: true,
                        tension: 0.3
                    }
                ]
            }}
            options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { title: { display: true, text: "Month" } },
                    y: { title: { display: true, text: "Balance (TZS)" } }
                }
            }}
            height={250}
        />
    );
}
