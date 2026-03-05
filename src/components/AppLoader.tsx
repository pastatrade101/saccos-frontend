import { Box, Typography } from "@mui/material";
import { useEffect } from "react";

const LOTTIE_PLAYER_SCRIPT_ID = "lottie-player-script";
const LOTTIE_PLAYER_SCRIPT_SRC = "https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js";

function ensureLottiePlayerScript() {
    if (typeof window === "undefined") {
        return;
    }

    if (customElements.get("lottie-player")) {
        return;
    }

    if (document.getElementById(LOTTIE_PLAYER_SCRIPT_ID)) {
        return;
    }

    const script = document.createElement("script");
    script.id = LOTTIE_PLAYER_SCRIPT_ID;
    script.src = LOTTIE_PLAYER_SCRIPT_SRC;
    script.async = true;
    document.head.appendChild(script);
}

interface AppLoaderProps {
    message?: string;
    fullscreen?: boolean;
    minHeight?: number | string;
    size?: number;
}

export function AppLoader({
    message = "Loading...",
    fullscreen = true,
    minHeight = 240,
    size = 140
}: AppLoaderProps) {
    useEffect(() => {
        ensureLottiePlayerScript();
    }, []);

    return (
        <Box
            sx={{
                width: "100%",
                minHeight: fullscreen ? "100vh" : minHeight,
                display: "grid",
                placeItems: "center"
            }}
        >
            <Box sx={{ display: "grid", justifyItems: "center", gap: 1 }}>
                <lottie-player
                    autoplay
                    loop
                    mode="normal"
                    src="/Loading Dots Blue.json"
                    style={{ width: `${size}px`, height: `${size}px` }}
                />
                {message ? (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
                        {message}
                    </Typography>
                ) : null}
            </Box>
        </Box>
    );
}
