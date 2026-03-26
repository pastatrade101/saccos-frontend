import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type ClipboardEvent,
    type KeyboardEvent
} from "react";
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
    const [otpDigits, setOtpDigits] = useState<string[]>(() =>
        Array.from({ length: 6 }, () => "")
    );
    const [recoveryCode, setRecoveryCode] = useState("");
    const [verifyingTwoFactor, setVerifyingTwoFactor] = useState(false);
    const [lastAutoSubmittedOtp, setLastAutoSubmittedOtp] = useState<string | null>(null);
    const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);
    const totpCode = useMemo(() => otpDigits.join(""), [otpDigits]);

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
        setOtpDigits(Array.from({ length: 6 }, () => ""));
        setRecoveryCode("");
        setLastAutoSubmittedOtp(null);
    };

    const focusOtpDigit = (index: number) => {
        window.setTimeout(() => {
            otpInputRefs.current[index]?.focus();
            otpInputRefs.current[index]?.select();
        }, 0);
    };

    const handleOtpDigitChange = (index: number, value: string) => {
        const nextDigit = value.replace(/\D/g, "").slice(-1);

        setOtpDigits((current) => {
            const next = [...current];
            next[index] = nextDigit;
            return next;
        });
        setLastAutoSubmittedOtp(null);

        if (nextDigit && index < 5) {
            focusOtpDigit(index + 1);
        }
    };

    const handleOtpDigitKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Backspace") {
            event.preventDefault();

            if (otpDigits[index]) {
                setOtpDigits((current) => {
                    const next = [...current];
                    next[index] = "";
                    return next;
                });
                setLastAutoSubmittedOtp(null);
                return;
            }

            if (index > 0) {
                setOtpDigits((current) => {
                    const next = [...current];
                    next[index - 1] = "";
                    return next;
                });
                setLastAutoSubmittedOtp(null);
                focusOtpDigit(index - 1);
            }

            return;
        }

        if (event.key === "ArrowLeft" && index > 0) {
            event.preventDefault();
            focusOtpDigit(index - 1);
        }

        if (event.key === "ArrowRight" && index < 5) {
            event.preventDefault();
            focusOtpDigit(index + 1);
        }
    };

    const handleOtpPaste = (event: ClipboardEvent<HTMLInputElement>) => {
        const digits = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);

        if (!digits) {
            return;
        }

        event.preventDefault();

        setOtpDigits((current) => {
            const next = [...current];
            digits.split("").forEach((digit, index) => {
                next[index] = digit;
            });
            return next;
        });
        setLastAutoSubmittedOtp(null);
        focusOtpDigit(Math.min(digits.length, 6) - 1);
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

    useEffect(() => {
        if (!twoFactorModalOpen || showRecoveryCode || verifyingTwoFactor) {
            return;
        }

        if (totpCode.length !== 6 || totpCode === lastAutoSubmittedOtp) {
            return;
        }

        setLastAutoSubmittedOtp(totpCode);
        void handleVerifyTwoFactor();
    }, [handleVerifyTwoFactor, lastAutoSubmittedOtp, showRecoveryCode, totpCode, twoFactorModalOpen, verifyingTwoFactor]);

    useEffect(() => {
        if (twoFactorModalOpen && !showRecoveryCode) {
            focusOtpDigit(0);
        }
    }, [showRecoveryCode, twoFactorModalOpen]);

    return (
        <div className={pageStyles.authShell}>
            <div className={pageStyles.authFrame}>
                <aside className={pageStyles.authVisual}>
                    <img
                        src="/bk.jpg"
                        alt="SACCO workspace background"
                        className={pageStyles.authVisualImage}
                    />
                    <div className={pageStyles.authVisualOverlay} />
                    <div className={pageStyles.authVisualContent}>
                        <span className={pageStyles.authVisualEyebrow}>Single-tenant SACCO workspace</span>
                        <div>
                            <h1 className={pageStyles.authVisualTitle}>
                                Secure access for staff operations and member service.
                            </h1>
                            <p className={pageStyles.authVisualCopy}>
                                Sign in to manage members, lending, teller activity, approvals, and reporting from one protected SACCO environment.
                            </p>
                        </div>
                        <div className={pageStyles.authVisualAssistRow}>
                            <span className={pageStyles.authVisualAssistLabel}>New member onboarding</span>
                            <RouterLink className={pageStyles.authVisualAssistLink} to="/signup">
                                Start membership
                            </RouterLink>
                        </div>
                        <div className={pageStyles.authVisualMetrics}>
                            <div className={pageStyles.authVisualMetric}>
                                <strong>Member access</strong>
                                <span>Portal balances, repayment visibility, and statements in one login.</span>
                            </div>
                            <div className={pageStyles.authVisualMetric}>
                                <strong>Staff control</strong>
                                <span>Approvals, collections, savings, loans, and audit workflows stay aligned.</span>
                            </div>
                            <div className={pageStyles.authVisualMetric}>
                                <strong>Protected sign in</strong>
                                <span>Authenticator-based verification protects financial roles and critical actions.</span>
                            </div>
                        </div>
                        <div className={pageStyles.authPanelFooter}>
                            <div className={pageStyles.authFooterItem}>
                                <strong>Two-factor protected</strong>
                                <span>Financial staff roles use authenticator-based verification to reduce SIM-swap and interception risk.</span>
                            </div>
                            <div className={pageStyles.authFooterItem}>
                                <strong>Need access support?</strong>
                                <span>Contact your branch administrator if your role was assigned but your first-time setup link does not arrive.</span>
                            </div>
                        </div>
                    </div>
                </aside>

                <section className={pageStyles.authPanel}>
                    <div className={pageStyles.authBrandRow}>
                        <div className={pageStyles.authBrandIdentity}>
                            <img
                                src="/SACCOSS-LOGO.png"
                                alt="SMART SACCOS logo"
                                className={pageStyles.authBrandLogo}
                            />
                            <div>
                                <span className={pageStyles.authBrandText}>SMART SACCOS</span>
                                <span className={pageStyles.authBrandSubtext}>Secure workspace access</span>
                            </div>
                        </div>
                        <button
                            type="button"
                            className={pageStyles.authThemeToggle}
                            aria-label="Toggle color mode"
                            onClick={toggleTheme}
                        >
                            {theme === "dark" ? <LightModeRoundedIcon fontSize="small" /> : <DarkModeRoundedIcon fontSize="small" />}
                        </button>
                    </div>

                    <div className={pageStyles.authPanelTop}>
                        <div>
                            <span className={pageStyles.authPanelEyebrow}>Welcome back</span>
                            <h2 className={pageStyles.authTitle}>Sign in to your workspace</h2>
                            <p className={pageStyles.authCopy}>
                                Use your assigned email and password to access the correct workspace for your role. Staff users may be prompted for authenticator verification after password sign in.
                            </p>
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

                    <div className={pageStyles.firstLoginCard}>
                        <div className={pageStyles.firstLoginHeader}>
                            <strong>First-time access</strong>
                            <span>
                                If your account is already provisioned but you do not have a password yet, request a one-time setup link using your registered work email.
                            </span>
                        </div>
                        <div className={pageStyles.firstLoginActions}>
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
                    </div>

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
                                <div className={pageStyles.otpDigitsRow}>
                                    {otpDigits.map((digit, index) => (
                                        <input
                                            key={index}
                                            ref={(element) => {
                                                otpInputRefs.current[index] = element;
                                            }}
                                            className={pageStyles.otpDigitBox}
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            autoComplete={index === 0 ? "one-time-code" : "off"}
                                            maxLength={1}
                                            aria-label={`Authenticator digit ${index + 1}`}
                                            value={digit}
                                            onChange={(event) => handleOtpDigitChange(index, event.target.value)}
                                            onKeyDown={(event) => handleOtpDigitKeyDown(index, event)}
                                            onPaste={handleOtpPaste}
                                        />
                                    ))}
                                </div>
                            </FormField>
                        )}

                        <p className={pageStyles.authCopy}>
                            {showRecoveryCode
                                ? "Backup codes are single-use. A used code cannot be used again."
                                : verifyingTwoFactor
                                    ? "Verifying automatically as soon as the 6-digit code is complete."
                                    : "Authenticator apps supported: Google Authenticator, Microsoft Authenticator, Authy, Bitwarden, and 1Password."}
                        </p>

                        <div className={pageStyles.otpModalActions}>
                            {showRecoveryCode ? (
                                <button
                                    className="secondary-button"
                                    disabled={verifyingTwoFactor}
                                    type="button"
                                    onClick={() => void handleVerifyTwoFactor()}
                                >
                                    {verifyingTwoFactor ? "Verifying..." : "Verify & Sign In"}
                                </button>
                            ) : (
                                <span className={pageStyles.authAssistLabel}>
                                    {verifyingTwoFactor ? "Verifying code..." : "Code submits automatically."}
                                </span>
                            )}
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
        </div>
    );
}
