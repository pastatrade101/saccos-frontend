import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link as RouterLink, Navigate, useNavigate } from "react-router-dom";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";

import { useAuth } from "../auth/AuthProvider";
import { FormField } from "../components/FormField";
import { useToast } from "../components/Toast";
import { useUI } from "../ui/UIProvider";
import pageStyles from "./Pages.module.css";

const schema = z.object({
    email: z.string().email("Enter a valid email address."),
    password: z.string().min(8, "Password must be at least 8 characters.")
});

type SignInValues = z.infer<typeof schema>;

export function SignInPage() {
    const navigate = useNavigate();
    const { pushToast } = useToast();
    const { signIn, session } = useAuth();
    const { theme, toggleTheme } = useUI();
    const [submitting, setSubmitting] = useState(false);

    const form = useForm<SignInValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            email: "",
            password: ""
        }
    });

    if (session) {
        return <Navigate to="/" replace />;
    }

    const onSubmit = form.handleSubmit(async (values) => {
        setSubmitting(true);

        try {
            await signIn(values.email, values.password);
            pushToast({
                type: "success",
                title: "Signed in",
                message: "You are now signed in."
            });
            navigate("/", { replace: true });
        } catch (error) {
            pushToast({
                type: "error",
                title: "Sign-in failed",
                message: error instanceof Error ? error.message : "Unable to sign in."
            });
        } finally {
            setSubmitting(false);
        }
    });

    return (
        <div className={pageStyles.authShell}>
            <div className={pageStyles.authFrame}>
                <section className={pageStyles.authVisual}>
                    <img
                        alt="SACCOS dashboard preview"
                        className={pageStyles.authVisualImage}
                        src="/13321.jpg"
                    />
                    <div className={pageStyles.authVisualOverlay} />
                    <div className={pageStyles.authVisualContent}>
                        <span className={pageStyles.authVisualEyebrow}>Core SACCOS Platform</span>
                        <h1 className={pageStyles.authVisualTitle}>Run savings, loans, dividends, and controls from one governed workspace.</h1>
                        <p className={pageStyles.authVisualCopy}>
                            Built for operational discipline, auditability, and fast branch execution with your existing brand system.
                        </p>
                        <div className={pageStyles.authVisualMetrics}>
                            <div className={pageStyles.authVisualMetric}>
                                <strong>Multi-tenant</strong>
                                <span>Strict tenant isolation</span>
                            </div>
                            <div className={pageStyles.authVisualMetric}>
                                <strong>Double-entry</strong>
                                <span>Real-money safe postings</span>
                            </div>
                            <div className={pageStyles.authVisualMetric}>
                                <strong>Role-based</strong>
                                <span>Controlled operator access</span>
                            </div>
                        </div>
                    </div>
                </section>

                <section className={pageStyles.authPanel}>
                    <div className={pageStyles.authPanelTop}>
                        <div>
                            <div className={pageStyles.authBrandRow}>
                                <div className={pageStyles.authBrandIdentity}>
                                    <img
                                        src="/SACCOSS-LOGO.png"
                                        alt="SMART SACCOS logo"
                                        className={pageStyles.authBrandLogo}
                                    />
                                    <div>
                                        <span className={pageStyles.authBrandText}>SMART SACCOS</span>
                                        <span className={pageStyles.authBrandSubtext}>Secure workforce portal</span>
                                    </div>
                                </div>
                                <button
                                    aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                                    className={pageStyles.authThemeToggle}
                                    type="button"
                                    onClick={toggleTheme}
                                >
                                    {theme === "dark" ? <LightModeRoundedIcon fontSize="small" /> : <DarkModeRoundedIcon fontSize="small" />}
                                </button>
                            </div>
                            <span className={pageStyles.authPanelEyebrow}>Welcome back</span>
                            <h2 className={pageStyles.authTitle}>Sign in to SMART SACCOS</h2>
                            <p className={pageStyles.authCopy}>
                                Use your assigned credentials to enter the correct workspace for your role.
                            </p>
                        </div>
                    </div>

                    <form className={pageStyles.form} onSubmit={onSubmit}>
                        <FormField label="Email" error={form.formState.errors.email?.message}>
                            <input type="email" {...form.register("email")} placeholder="name@saccos.local" />
                        </FormField>
                        <FormField label="Password" error={form.formState.errors.password?.message}>
                            <input type="password" {...form.register("password")} placeholder="Enter your password" />
                        </FormField>
                        <button className="primary-button" disabled={submitting} type="submit">
                            {submitting ? "Signing in..." : "Sign In"}
                        </button>
                    </form>

                    <p className={pageStyles.authLegal}>
                        By signing in, you acknowledge the{" "}
                        <RouterLink className={pageStyles.authLegalLink} to="/privacy-policy">
                            Privacy Policy
                        </RouterLink>{" "}
                        and{" "}
                        <RouterLink className={pageStyles.authLegalLink} to="/terms-and-agreement">
                            Terms & Agreement
                        </RouterLink>
                        .
                    </p>
                </section>
            </div>
        </div>
    );
}
