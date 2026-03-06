import { alpha } from "@mui/material/styles";

import { ChartPanel } from "../ChartPanel";
import { brandColors } from "../../theme/colors";

interface SavingsTrendChartProps {
    labels: string[];
    values: number[];
}

export function SavingsTrendChart({ labels, values }: SavingsTrendChartProps) {
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
                        borderColor: brandColors.primary[700],
                        backgroundColor: alpha(brandColors.primary[500], 0.12),
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
