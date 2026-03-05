import {
    ArcElement,
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Filler,
    Legend,
    LineElement,
    LinearScale,
    PointElement,
    Tooltip
} from "chart.js";
import { brandColors, chartColors, darkThemeColors } from "../theme/colors";

let chartsRegistered = false;

export function registerCharts() {
    if (chartsRegistered) {
        return;
    }

    ChartJS.register(
        CategoryScale,
        LinearScale,
        PointElement,
        LineElement,
        BarElement,
        ArcElement,
        Tooltip,
        Legend,
        Filler
    );

    ChartJS.defaults.color = brandColors.neutral.textSecondary;
    ChartJS.defaults.borderColor = brandColors.neutral.border;
    ChartJS.defaults.font.family = '"Source Sans 3", "Segoe UI", sans-serif';
    ChartJS.defaults.plugins.legend.labels.usePointStyle = true;
    ChartJS.defaults.plugins.legend.labels.color = brandColors.neutral.textSecondary;
    ChartJS.defaults.plugins.tooltip.backgroundColor = darkThemeColors.paper;
    ChartJS.defaults.plugins.tooltip.titleColor = "#ffffff";
    ChartJS.defaults.plugins.tooltip.bodyColor = "#ffffff";
    ChartJS.defaults.plugins.tooltip.borderColor = chartColors.loans;
    ChartJS.defaults.plugins.tooltip.borderWidth = 1;

    chartsRegistered = true;
}
