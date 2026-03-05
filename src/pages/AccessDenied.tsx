import { MotionCard, MotionModal } from "../ui/motion";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import { Alert, Box, Button, Card, CardContent, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";

export function AccessDeniedPage() {
    const navigate = useNavigate();

    return (
        <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", px: 2 }}>
            <MotionCard variant="outlined" sx={{ maxWidth: 560, width: "100%" }}>
                <CardContent sx={{ p: 4 }}>
                    <Stack spacing={2.5} alignItems="flex-start">
                        <Stack direction="row" spacing={1.5} alignItems="center">
                            <LockRoundedIcon color="warning" />
                            <Typography variant="h5">Access Denied</Typography>
                        </Stack>
                        <Alert severity="warning" variant="outlined" sx={{ width: "100%" }}>
                            You do not have permission to access this page in the current workspace.
                        </Alert>
                        <Typography variant="body2" color="text.secondary">
                            If you expected access, confirm your assigned role and tenant context with the system administrator.
                        </Typography>
                        <Button variant="contained" onClick={() => navigate("/")}>
                            Return to Workspace
                        </Button>
                    </Stack>
                </CardContent>
            </MotionCard>
        </Box>
    );
}
