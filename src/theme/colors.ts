export const brandColors = {
    primary: {
        900: "#0A0573",
        700: "#1A0FA3",
        500: "#2F5BFF",
        300: "#6EA8FF",
        100: "#E7F0FF"
    },
    accent: {
        700: "#0F7FB5",
        500: "#1FA8E6",
        300: "#63D0FF",
        100: "#E6F8FF"
    },
    success: "#16A34A",
    warning: "#F59E0B",
    danger: "#DC2626",
    info: "#2563EB",
    neutral: {
        background: "#F8FAFC",
        card: "#FFFFFF",
        border: "#E5E7EB",
        textPrimary: "#0F172A",
        textSecondary: "#475569",
        textMuted: "#94A3B8"
    }
} as const;

export const chartColors = {
    deposits: brandColors.success,
    withdrawals: brandColors.danger,
    loans: brandColors.accent[500],
    savings: brandColors.primary[900],
    dividends: brandColors.warning
} as const;

export const fintechGradient = `linear-gradient(135deg, ${brandColors.primary[900]}, ${brandColors.accent[500]})`;

export const darkThemeColors = {
    background: "#081122",
    paper: "#0E1730",
    elevated: "#132043",
    border: "rgba(148, 163, 184, 0.18)",
    textPrimary: "#E2E8F0",
    textSecondary: "#CBD5E1",
    textMuted: "#94A3B8"
} as const;

export const tailwindPalette = {
    primary: brandColors.primary[900],
    primaryLight: brandColors.accent[500],
    success: brandColors.success,
    warning: brandColors.warning,
    danger: brandColors.danger,
    info: brandColors.info
} as const;
