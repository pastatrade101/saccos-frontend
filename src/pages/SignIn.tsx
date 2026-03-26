import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";

import { useAuth } from "../auth/AuthContext";
import { FormField } from "../components/FormField";
import { useToast } from "../components/Toast";
import { api, getApiErrorMessage } from "../lib/api";
import { endpoints, type PasswordSetupLinkSendResponse } from "../lib/endpoints";
import { useUI } from "../ui/UIProvider";
import pageStyles from "./Pages.module.css";

const schema = z.object({
    email: z.string().email("Enter a valid email address."),
    password: z.string().min(8, "Password must be at least 8 characters.")
});

type SignInValues = z.infer<typeof schema>;

interface AuthFlowError extends Error {
    code?: string;
    details?: unknown;
}

export function SignInPage() {
    const navigate = useNavigate();
    const { pushToast } = useToast();
    const { signIn } = useAuth();
    const { theme, toggleTheme } = useUI();
    const [submitting, setSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showFirstTimeSetup, setShowFirstTimeSetup] = useState(false);
    const [setupEmail, setSetupEmail] = useState("");
    const [sendingSetupLink, setSendingSetupLink] = useState(false);
    const [twoFactorModalOpen, setTwoFactorModalOpen] = useState(false);
    const [showRecoveryCode, setShowRecoveryCode] = useState(false);
    const [totpCode, setTotpCode] = useState("");
    const [recoveryCode, setRecoveryCode] = useState("");
    const [verifyingTwoFactor, setVerifyingTwoFactor] = useState(false);

    const form = useForm<SignInValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            email: "",
            password: ""
        }
    });

    const closeTwoFactorModal = () => {
        setTwoFactorModalOpen(false);
        setShowRecoveryCode(false);
        setTotpCode("");
        setRecoveryCode("");
    };

    const handleSendSetupLink = async () => {
        const candidateEmail = setupEmail.trim().toLowerCase();
        const parsed = z.string().email().safeParse(candidateEmail);

        if (!parsed.success) {
            pushToast({
                type: "error",
                title: "Valid email required",
                message: "Enter a valid work email to continue first-time setup."
            });
            return;
        }

        setSendingSetupLink(true);

        try {
            const { data } = await api.post<PasswordSetupLinkSendResponse>(
                endpoints.auth.passwordSetupLinkSend(),
                {
                    email: candidateEmail
                }
            );

            pushToast({
                type: "success",
                title: "Setup link sent",
                message: data.destination_hint
                    ? `Password setup link sent via SMS to ${data.destination_hint}.`
                    : "If this account exists and has a phone, a setup link has been sent via SMS."
            });
            setShowFirstTimeSetup(false);
            setSetupEmail("");
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to send setup link",
                message: getApiErrorMessage(error, "Try again in a moment.")
            });
        } finally {
            setSendingSetupLink(false);
        }
    };

    const onSubmit = form.handleSubmit(async (values) => {
        setSubmitting(true);

        try {
            await signIn(values.email, values.password);
            pushToast({
                type: "success",
                title: "Signed in",
                message: "You are now signed in."
            });
            closeTwoFactorModal();
            navigate("/", { replace: true });
        } catch (error) {
            const authFlowError = error as AuthFlowError;

            if (authFlowError.code === "TWO_FACTOR_REQUIRED") {
                setTwoFactorModalOpen(true);
                pushToast({
                    type: "success",
                    title: "Authenticator code required",
                    message: "Enter the code from your authenticator app or use a backup recovery code."
                });
                return;
            }

            pushToast({
                type: "error",
                title: "Sign in failed",
                message: error instanceof Error ? error.message : "Unable to sign in."
            });
        } finally {
            setSubmitting(false);
        }
    });

    const handleVerifyTwoFactor = async () => {
        const values = form.getValues();
        const valid = await form.trigger(["email", "password"]);

        if (!valid) {
            return;
        }

        if (!showRecoveryCode && !/^\d{6}$/.test(totpCode.trim())) {
            pushToast({
                type: "error",
                title: "Invalid code",
                message: "Enter a valid 6-digit authenticator code."
            });
            return;
        }

        if (showRecoveryCode && !recoveryCode.trim()) {
            pushToast({
                type: "error",
                title: "Backup code required",
                message: "Enter one unused backup recovery code."
            });
            return;
        }

        setVerifyingTwoFactor(true);

        try {
            await signIn(values.email, values.password, {
                totpCode: showRecoveryCode ? undefined : totpCode.trim(),
                recoveryCode: showRecoveryCode ? recoveryCode.trim() : undefined
            });
            pushToast({
                type: "success",
                title: "Two-factor verified",
                message: "You are now signed in."
            });
            closeTwoFactorModal();
            navigate("/", { replace: true });
        } catch (error) {
            pushToast({
                type: "error",
                title: "Verification failed",
                message: error instanceof Error ? error.message : "Unable to verify the authenticator code."
            });
        } finally {
            setVerifyingTwoFactor(false);
        }
    };

    return (
        <div className={pageStyles.authPage}>
            <div className={pageStyles.authGrid}>
                <section className={pageStyles.authContentPanel}>
                    <div className={pageStyles.authHeroCard}>
                        <div className={pageStyles.authHeroHeader}>
                            <div>
                                <span className={pageStyles.authPanelEyebrow}>Welcome back</span>
                                <h2 className={pageStyles.authTitle}>Sign in to SMART SACCOS</h2>
                                <p className={pageStyles.authCopy}>
                                    Use your assigned credentials to enter the correct workspace for your role.
                                </p>
                            </div>
                            <div className={pageStyles.authThemeToggleWrap}>
                                <button
                                    type="button"
                                    className={pageStyles.authThemeToggle}
                                    aria-label="Toggle color mode"
                                    onClick={toggleTheme}
                                >
                                    {theme === "dark" ? <LightModeRoundedIcon fontSize="small" /> : <DarkModeRoundedIcon fontSize="small" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <form className={pageStyles.form} onSubmit={onSubmit}>
                        <FormField label="Email" error={form.formState.errors.email?.message}>
                            <input
                                type="email"
                                {...form.register("email")}
                                placeholder="name@saccos.local"
                            />
                        </FormField>
                        <FormField label="Password" error={form.formState.errors.password?.message}>
                            <div className={pageStyles.passwordField}>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    {...form.register("password")}
                                    placeholder="Enter your password"
                                />
                                <button
                                    type="button"
                                    className={pageStyles.passwordToggle}
                                    onClick={() => setShowPassword((current) => !current)}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    aria-pressed={showPassword}
                                >
                                    {showPassword ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                                </button>
                            </div>
                        </FormField>
                        <button
                            className="primary-button"
                            disabled={submitting}
                            type="submit"
                        >
                            {submitting ? "Signing in..." : "Sign In"}
                        </button>
                    </form>

                    <div className={pageStyles.authAssistRow}>
                        <span className={pageStyles.authAssistLabel}>Need first-time access?</span>
                        <button
                            className={pageStyles.authForgotLink}
                            type="button"
                            onClick={() => {
                                setSetupEmail(form.getValues("email") || "");
                                setShowFirstTimeSetup(true);
                            }}
                        >
                            First-time user without password?
                        </button>
                    </div>

                    {showFirstTimeSetup ? (
                        <div className={pageStyles.setupModalBackdrop} onClick={() => setShowFirstTimeSetup(false)}>
                            <div
                                className={pageStyles.setupModalCard}
                                role="dialog"
                                aria-modal="true"
                                aria-label="First-time account setup"
                                onClick={(event) => event.stopPropagation()}
                            >
                                <div className={pageStyles.setupModalHeader}>
                                    <h3>First-time account setup</h3>
                                    <p>
                                        Enter your work email. If your member account exists with a registered phone,
                                        we will send a one-time setup link by SMS.
                                    </p>
                                </div>
                                <FormField label="Work email">
                                    <input
                                        type="email"
                                        placeholder="name@saccos.local"
                                        value={setupEmail}
                                        onChange={(event) => setSetupEmail(event.target.value)}
                                    />
                                </FormField>
                                <span className={pageStyles.firstLoginHint}>
                                    The destination phone must already be registered on your profile.
                                </span>
                                <div className={pageStyles.setupModalActions}>
                                    <button
                                        className={pageStyles.otpModalLink}
                                        type="button"
                                        onClick={() => setShowFirstTimeSetup(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="secondary-button"
                                        type="button"
                                        disabled={sendingSetupLink}
                                        onClick={() => void handleSendSetupLink()}
                                    >
                                        {sendingSetupLink ? "Sending link..." : "Send setup link"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {twoFactorModalOpen ? (
                        <div className={pageStyles.otpModalBackdrop}>
                            <div className={pageStyles.otpModalCard} role="dialog" aria-modal="true" aria-label="Two-factor verification">
                                <div className={pageStyles.otpModalHeader}>
                                    <h3>{showRecoveryCode ? "Use backup recovery code" : "Verify authenticator code"}</h3>
                                    <p>
                                        {showRecoveryCode
                                            ? "Enter one unused backup code to recover access if your authenticator device is unavailable."
                                            : "Open your authenticator app and enter the current 6-digit TOTP code to complete sign in."}
                                    </p>
                                </div>

                                {showRecoveryCode ? (
                                    <FormField label="Backup recovery code">
                                        <input
                                            type="text"
                                            placeholder="8F4K-3P92"
                                            value={recoveryCode}
                                            onChange={(event) => setRecoveryCode(event.target.value.toUpperCase())}
                                        />
                                    </FormField>
                                ) : (
                                    <FormField
                                        label="Authenticator code"
                                        error={totpCode && !/^\d{6}$/.test(totpCode) ? "Enter a valid 6-digit code." : undefined}
                                    >
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            placeholder="123456"
                                            value={totpCode}
                                            onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                                        />
                                    </FormField>
                                )}

                                <p className={pageStyles.authCopy}>
                                    {showRecoveryCode
                                        ? "Backup codes are single-use. A used code cannot be used again."
                                        : "Authenticator apps supported: Google Authenticator, Microsoft Authenticator, Authy, Bitwarden, and 1Password."}
                                </p>

                                <div className={pageStyles.otpModalActions}>
                                    <button
                                        className="secondary-button"
                                        disabled={verifyingTwoFactor}
                                        type="button"
                                        onClick={() => void handleVerifyTwoFactor()}
                                    >
                                        {verifyingTwoFactor ? "Verifying..." : "Verify & Sign In"}
                                    </button>
                                    <button
                                        className={pageStyles.otpModalLink}
                                        type="button"
                                        onClick={() => setShowRecoveryCode((current) => !current)}
                                    >
                                        {showRecoveryCode ? "Use authenticator code instead" : "Use backup recovery code"}
                                    </button>
                                    <button
                                        className={pageStyles.otpModalLink}
                                        type="button"
                                        onClick={closeTwoFactorModal}
                                    >
                                        Change credentials
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : null}

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
