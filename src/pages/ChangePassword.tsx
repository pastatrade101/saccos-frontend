import { MotionCard, MotionModal } from "../ui/motion";
import LockResetRoundedIcon from "@mui/icons-material/LockResetRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Stack,
    TextField,
    Typography
} from "@mui/material";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { useToast } from "../components/Toast";
import { api, getApiErrorMessage } from "../lib/api";
import { endpoints } from "../lib/endpoints";
import { supabase } from "../lib/supabase";

const schema = z.object({
    password: z.string().min(10, "Password must be at least 10 characters."),
    confirmPassword: z.string().min(10, "Confirm your password.")
}).refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match."
});

type FormValues = z.infer<typeof schema>;

export function ChangePasswordPage() {
    const navigate = useNavigate();
    const { profile, session, refreshProfile } = useAuth();
    const { pushToast } = useToast();
    const [submitting, setSubmitting] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            password: "",
            confirmPassword: ""
        }
    });

    if (!session) {
        return <Navigate to="/signin" replace />;
    }

    if (!profile?.must_change_password) {
        return <Navigate to="/" replace />;
    }

    const onSubmit = form.handleSubmit(async (values) => {
        setSubmitting(true);

        try {
            const { error } = await supabase.auth.updateUser({
                password: values.password
            });

            if (error) {
                throw error;
            }

            await api.post(endpoints.users.passwordChanged());
            await refreshProfile();
            pushToast({
                type: "success",
                title: "Password updated",
                message: "Your portal access is now fully activated."
            });
            navigate("/", { replace: true });
        } catch (error) {
            pushToast({
                type: "error",
                title: "Password update failed",
                message: getApiErrorMessage(error)
            });
        } finally {
            setSubmitting(false);
        }
    });

    return (
        <Box
            sx={{
                minHeight: "100vh",
                display: "grid",
                placeItems: "center",
                background: "linear-gradient(135deg, #0A0573, #1FA8E6)",
                p: 3
            }}
        >
            <MotionCard sx={{ width: "100%", maxWidth: 520, borderRadius: 3 }}>
                <CardContent sx={{ p: 4 }}>
                    <Stack spacing={3}>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                            <ShieldRoundedIcon color="primary" />
                            <Typography variant="h5" fontWeight={700}>
                                Secure your first login
                            </Typography>
                        </Stack>
                        <Alert severity="info" icon={<LockResetRoundedIcon />}>
                            Your temporary password must be replaced before you can continue.
                        </Alert>
                        <Stack spacing={2} component="form" onSubmit={onSubmit}>
                            <TextField
                                label="New password"
                                type="password"
                                autoComplete="new-password"
                                error={Boolean(form.formState.errors.password)}
                                helperText={form.formState.errors.password?.message}
                                {...form.register("password")}
                            />
                            <TextField
                                label="Confirm new password"
                                type="password"
                                autoComplete="new-password"
                                error={Boolean(form.formState.errors.confirmPassword)}
                                helperText={form.formState.errors.confirmPassword?.message}
                                {...form.register("confirmPassword")}
                            />
                            <Button type="submit" variant="contained" disabled={submitting}>
                                {submitting ? "Saving password..." : "Save new password"}
                            </Button>
                        </Stack>
                    </Stack>
                </CardContent>
            </MotionCard>
        </Box>
    );
}
