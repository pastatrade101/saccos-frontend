export default {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {
            colors: {
                primary: "#0A0573",
                primaryLight: "#1FA8E6",
                success: "#16A34A",
                warning: "#F59E0B",
                danger: "#DC2626",
                info: "#2563EB",
                primaryScale: {
                    900: "#0A0573",
                    700: "#1A0FA3",
                    500: "#2F5BFF",
                    300: "#6EA8FF",
                    100: "#E7F0FF"
                },
                accentScale: {
                    700: "#0F7FB5",
                    500: "#1FA8E6",
                    300: "#63D0FF",
                    100: "#E6F8FF"
                },
                neutral: {
                    background: "#F8FAFC",
                    card: "#FFFFFF",
                    border: "#E5E7EB",
                    text_primary: "#0F172A",
                    text_secondary: "#475569",
                    text_muted: "#94A3B8"
                }
            },
            backgroundImage: {
                "gradient-fintech": "linear-gradient(135deg,#0A0573,#1FA8E6)"
            }
        }
    },
    plugins: []
};
