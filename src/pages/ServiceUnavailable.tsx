import { MotionCard, MotionModal } from "../ui/motion";
import WifiOffRoundedIcon from "@mui/icons-material/WifiOffRounded";
import { Alert, Box, Button, Card, CardContent, Stack, Typography } from "@mui/material";

export function ServiceUnavailablePage() {
    return (
        <Box
            sx={{
                minHeight: "100vh",
                display: "grid",
                placeItems: "center",
                px: 3,
                bgcolor: "background.default"
            }}
        >
            <MotionCard variant="outlined" sx={{ maxWidth: 560, width: "100%", borderRadius: 2 }}>
                <CardContent sx={{ p: 4 }}>
                    <Stack spacing={2.5} alignItems="flex-start">
                        <Box
                            sx={{
                                width: 52,
                                height: 52,
                                borderRadius: 2,
                                display: "grid",
                                placeItems: "center",
                                bgcolor: "action.hover",
                                color: "primary.main"
                            }}
                        >
                            <WifiOffRoundedIcon />
                        </Box>
                        <Box>
                            <Typography variant="h4" sx={{ fontWeight: 700 }}>
                                Backend unavailable
                            </Typography>
                            <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                                The application could not reach the backend service, so your workspace could not be loaded.
                            </Typography>
                        </Box>
                        <Alert severity="warning" sx={{ width: "100%", borderRadius: 2 }}>
                            Start the backend server and refresh the page. The app should not send you into setup while the API is offline.
                        </Alert>
                        <Button variant="contained" onClick={() => window.location.reload()}>
                            Retry connection
                        </Button>
                    </Stack>
                </CardContent>
            </MotionCard>
        </Box>
    );
}
