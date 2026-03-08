import LockResetRoundedIcon from "@mui/icons-material/LockResetRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import {
    Alert,
    Box,
    Button,
    CardContent,
    Stack,
    TextField,
    Typography
} from "@mui/material";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";

import { useToast } from "../components/Toast";
import { api } from "../lib/api";
import { endpoints } from "../lib/endpoints";
import { supabase } from "../lib/supabase";
import { MotionCard } from "../ui/motion";

const schema = z.object({
    password: z.string().min(10, "Password must be at least 10 characters."),
    confirmPassword: z.string().min(10, "Confirm your password.")
}).refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match."
});

type FormValues = z.infer<typeof schema>;

export function ResetPasswordPage() {
    const navigate = useNavigate();
    const { pushToast } = useToast();
    const [submitting, setSubmitting] = useState(false);
    const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(null);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            password: "",
            confirmPassword: ""
        }
    });

    useEffect(() => {
        let mounted = true;
        const params = new URLSearchParams(window.location.search);
        const tokenHash = params.get("token_hash");
        const flowType = params.get("type");

        const initRecoverySession = async () => {
            if (tokenHash && flowType === "recovery") {
                const { data, error } = await supabase.auth.verifyOtp({
                    type: "recovery",
                    token_hash: tokenHash
                });

                if (error) {
                    throw error;
                }

                if (!mounted) {
                    return;
                }

                setHasRecoverySession(Boolean(data.session));
                return;
            }

            const { data } = await supabase.auth.getSession();
            if (!mounted) {
                return;
            }
            setHasRecoverySession(Boolean(data.session));
        };

        void initRecoverySession().catch(() => {
            if (!mounted) {
                return;
            }
            setHasRecoverySession(false);
        });

        const {
            data: { subscription }
        } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!mounted) {
                return;
            }
            setHasRecoverySession(Boolean(session));
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const onSubmit = form.handleSubmit(async (values) => {
        setSubmitting(true);

        try {
            const { error } = await supabase.auth.updateUser({
                password: values.password
            });

            if (error) {
                throw error;
            }

            try {
                await api.post(endpoints.users.passwordChanged());
            } catch {
                // Some accounts may not have a backend profile context during recovery.
            }

            await supabase.auth.signOut();

            pushToast({
                type: "success",
                title: "Password reset complete",
                message: "Sign in with your new password."
            });
            navigate("/signin", { replace: true });
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to reset password",
                message: error instanceof Error ? error.message : "Password reset failed."
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
                                Reset your password
                            </Typography>
                        </Stack>

                        {hasRecoverySession === false ? (
                            <>
                                <Alert severity="info" icon={<LockResetRoundedIcon />}>
                                    Open this page using the password reset link from your email.
                                </Alert>
                                <Button variant="contained" onClick={() => navigate("/signin", { replace: true })}>
                                    Back to sign in
                                </Button>
                            </>
                        ) : (
                            <Stack spacing={2} component="form" onSubmit={onSubmit}>
                                <Alert severity="info" icon={<LockResetRoundedIcon />}>
                                    Enter a new password to secure your account access.
                                </Alert>
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
                                <Button type="submit" variant="contained" disabled={submitting || hasRecoverySession === null}>
                                    {submitting ? "Saving password..." : "Save new password"}
                                </Button>
                            </Stack>
                        )}
                    </Stack>
                </CardContent>
            </MotionCard>
        </Box>
    );
}
