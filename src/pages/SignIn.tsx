import {
    useEffect,
    useRef,
    useState,
    type ClipboardEvent,
    type KeyboardEvent
} from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link as RouterLink, Navigate, useNavigate } from "react-router-dom";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";

import { useAuth } from "../auth/AuthProvider";
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

interface OtpRequiredDetails {
    challenge_id?: string;
    expires_at?: string;
    destination_hint?: string;
    otp_enroll_required?: boolean;
}

interface AuthFlowError extends Error {
    code?: string;
    details?: unknown;
}

const OTP_LENGTH = 6;

export function SignInPage() {
    const navigate = useNavigate();
    const { pushToast } = useToast();
    const { signIn, requestOtp, session } = useAuth();
    const { theme, toggleTheme } = useUI();
    const [submitting, setSubmitting] = useState(false);
    const [verifyingOtp, setVerifyingOtp] = useState(false);
    const [resendingOtp, setResendingOtp] = useState(false);
    const [otpModalOpen, setOtpModalOpen] = useState(false);
    const [otpDigits, setOtpDigits] = useState<string[]>(() =>
        Array.from({ length: OTP_LENGTH }, () => "")
    );
    const [otpChallengeId, setOtpChallengeId] = useState<string | null>(null);
    const [otpDestinationHint, setOtpDestinationHint] = useState<string | null>(null);
    const [otpExpiresAt, setOtpExpiresAt] = useState<string | null>(null);
    const [otpPhoneRequired, setOtpPhoneRequired] = useState(false);
    const [otpPhoneInput, setOtpPhoneInput] = useState("");
    const [lastAutoSubmittedOtp, setLastAutoSubmittedOtp] = useState<string | null>(null);
    const [showFirstTimeSetup, setShowFirstTimeSetup] = useState(false);
    const [setupEmail, setSetupEmail] = useState("");
    const [sendingSetupLink, setSendingSetupLink] = useState(false);
    const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);
    const otpCode = otpDigits.join("");

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

    const clearOtpState = () => {
        setOtpDigits(Array.from({ length: OTP_LENGTH }, () => ""));
        setOtpChallengeId(null);
        setOtpDestinationHint(null);
        setOtpExpiresAt(null);
        setOtpPhoneRequired(false);
        setOtpPhoneInput("");
        setLastAutoSubmittedOtp(null);
    };

    const handleOtpChallenge = (details: OtpRequiredDetails | null | undefined) => {
        if (!details?.challenge_id) {
            return;
        }

        setOtpChallengeId(details.challenge_id);
        setOtpDestinationHint(details.destination_hint || null);
        setOtpExpiresAt(details.expires_at || null);
        setOtpPhoneRequired(false);
        setOtpDigits(Array.from({ length: OTP_LENGTH }, () => ""));
        setOtpModalOpen(true);
        window.setTimeout(() => {
            otpInputRefs.current[0]?.focus();
        }, 0);
    };

    const closeOtpModal = () => {
        setOtpModalOpen(false);
        clearOtpState();
    };

    const toOtpDetails = (details: unknown): OtpRequiredDetails => {
        if (!details || typeof details !== "object") {
            return {};
        }

        return details as OtpRequiredDetails;
    };

    const handleEnrollPhoneAndSendOtp = async () => {
        const values = form.getValues();
        const valid = await form.trigger(["email", "password"]);

        if (!valid) {
            return;
        }

        if (!otpPhoneInput.trim()) {
            pushToast({
                type: "error",
                title: "Phone required",
                message: "Enter a phone number in 2557XXXXXXXX format."
            });
            return;
        }

        setResendingOtp(true);

        try {
            const result = await requestOtp(
                values.email,
                values.password,
                otpChallengeId,
                otpPhoneInput.trim()
            );
            setOtpPhoneRequired(false);
            handleOtpChallenge(result);
            pushToast({
                type: "success",
                title: "OTP sent",
                message: "Verification code sent to the enrolled phone number."
            });
        } catch (error) {
            pushToast({
                type: "error",
                title: "OTP send failed",
                message: error instanceof Error ? error.message : "Unable to send OTP."
            });
        } finally {
            setResendingOtp(false);
        }
    };

    const handleResendOtp = async () => {
        const values = form.getValues();
        const valid = await form.trigger(["email", "password"]);

        if (!valid) {
            return;
        }

        if (otpPhoneRequired) {
            await handleEnrollPhoneAndSendOtp();
            return;
        }

        setResendingOtp(true);

        try {
            const result = await requestOtp(values.email, values.password, otpChallengeId);
            setOtpChallengeId(result.challenge_id);
            setOtpDestinationHint(result.destination_hint || null);
            setOtpExpiresAt(result.expires_at || null);
            setOtpDigits(Array.from({ length: OTP_LENGTH }, () => ""));
            setLastAutoSubmittedOtp(null);
            window.setTimeout(() => {
                otpInputRefs.current[0]?.focus();
            }, 0);
            pushToast({
                type: "success",
                title: "OTP resent",
                message: "A new verification code has been sent to your registered phone."
            });
        } catch (error) {
            const otpError = error as AuthFlowError;
            if (otpError.code === "OTP_ENROLL_REQUIRED") {
                setOtpPhoneRequired(true);
                pushToast({
                    type: "error",
                    title: "Phone required",
                    message: "Add a phone number to receive OTP."
                });
                return;
            }

            pushToast({
                type: "error",
                title: "OTP resend failed",
                message: error instanceof Error ? error.message : "Unable to resend OTP."
            });
        } finally {
            setResendingOtp(false);
        }
    };

    const handleOtpDigitChange = (index: number, value: string) => {
        const nextDigit = value.replace(/\D/g, "").slice(-1);

        setOtpDigits((prev) => {
            const next = [...prev];
            next[index] = nextDigit;
            return next;
        });
        setLastAutoSubmittedOtp(null);

        if (nextDigit && index < OTP_LENGTH - 1) {
            otpInputRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpDigitKeyDown = (
        index: number,
        event: KeyboardEvent<HTMLInputElement>
    ) => {
        if (event.key === "Backspace") {
            if (otpDigits[index]) {
                setOtpDigits((prev) => {
                    const next = [...prev];
                    next[index] = "";
                    return next;
                });
                return;
            }

            if (index > 0) {
                setOtpDigits((prev) => {
                    const next = [...prev];
                    next[index - 1] = "";
                    return next;
                });
                otpInputRefs.current[index - 1]?.focus();
            }
        }

        if (event.key === "ArrowLeft" && index > 0) {
            otpInputRefs.current[index - 1]?.focus();
        }

        if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
            otpInputRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpPaste = (event: ClipboardEvent<HTMLInputElement>) => {
        const value = event.clipboardData
            .getData("text")
            .replace(/\D/g, "")
            .slice(0, OTP_LENGTH);

        if (!value) {
            return;
        }

        event.preventDefault();

        const next = Array.from({ length: OTP_LENGTH }, (_, index) => value[index] || "");
        setOtpDigits(next);
        setLastAutoSubmittedOtp(null);

        const focusIndex = Math.min(value.length, OTP_LENGTH - 1);
        otpInputRefs.current[focusIndex]?.focus();
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
            closeOtpModal();
            navigate("/", { replace: true });
        } catch (error) {
            const authFlowError = error as AuthFlowError;
            const details = toOtpDetails(authFlowError.details);

            if (authFlowError.code === "OTP_REQUIRED" || authFlowError.code === "OTP_ENROLL_REQUIRED") {
                setOtpModalOpen(true);

                const requiresPhone =
                    authFlowError.code === "OTP_ENROLL_REQUIRED" ||
                    details.otp_enroll_required === true;

                if (requiresPhone) {
                    setOtpPhoneRequired(true);
                    setOtpChallengeId(details.challenge_id || null);
                    setOtpDestinationHint(details.destination_hint || null);
                    setOtpExpiresAt(details.expires_at || null);
                    pushToast({
                        type: "error",
                        title: "Phone required",
                        message: "Add a phone number in 2557XXXXXXXX format to receive OTP."
                    });
                    return;
                }

                try {
                    const result = await requestOtp(values.email, values.password, otpChallengeId);
                    handleOtpChallenge(result);
                    pushToast({
                        type: "success",
                        title: "OTP required",
                        message: "A one-time verification code has been sent to your registered phone."
                    });
                } catch (otpError) {
                    const otpFlowError = otpError as AuthFlowError;
                    if (otpFlowError.code === "OTP_ENROLL_REQUIRED") {
                        setOtpPhoneRequired(true);
                        pushToast({
                            type: "error",
                            title: "Phone required",
                            message: "Add a phone number in 2557XXXXXXXX format to receive OTP."
                        });
                        return;
                    }

                    pushToast({
                        type: "error",
                        title: "OTP send failed",
                        message: otpError instanceof Error
                            ? otpError.message
                            : "Credentials passed, but OTP delivery failed. Retry in popup."
                    });
                }
                return;
            }

            pushToast({
                type: "error",
                title: "Sign-in failed",
                message: error instanceof Error ? error.message : "Unable to sign in."
            });
        } finally {
            setSubmitting(false);
        }
    });

    const handleVerifyOtp = async (codeOverride?: string) => {
        const values = form.getValues();
        const valid = await form.trigger(["email", "password"]);
        const code = codeOverride || otpCode;

        if (!valid || !otpChallengeId) {
            return;
        }

        if (!/^\d{6}$/.test(code)) {
            pushToast({
                type: "error",
                title: "Invalid OTP",
                message: "Enter the 6-digit code sent to your phone."
            });
            return;
        }

        setLastAutoSubmittedOtp(code);
        setVerifyingOtp(true);

        try {
            await signIn(values.email, values.password, {
                challengeId: otpChallengeId,
                otpCode: code
            });
            pushToast({
                type: "success",
                title: "Signed in",
                message: "OTP verified successfully."
            });
            closeOtpModal();
            navigate("/", { replace: true });
        } catch (error) {
            pushToast({
                type: "error",
                title: "OTP verification failed",
                message: error instanceof Error ? error.message : "Unable to verify OTP."
            });
        } finally {
            setVerifyingOtp(false);
        }
    };

    useEffect(() => {
        if (!otpModalOpen || !otpChallengeId || verifyingOtp || otpPhoneRequired) {
            return;
        }

        if (otpCode.length !== OTP_LENGTH) {
            return;
        }

        if (lastAutoSubmittedOtp === otpCode) {
            return;
        }

        void handleVerifyOtp(otpCode);
    }, [lastAutoSubmittedOtp, otpChallengeId, otpCode, otpModalOpen, otpPhoneRequired, verifyingOtp]);

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
                            <input
                                type="email"
                                {...form.register("email", {
                                    onChange: () => {
                                        if (otpChallengeId) {
                                            clearOtpState();
                                        }
                                    }
                                })}
                                placeholder="name@saccos.local"
                            />
                        </FormField>
                        <FormField label="Password" error={form.formState.errors.password?.message}>
                            <input
                                type="password"
                                {...form.register("password", {
                                    onChange: () => {
                                        if (otpChallengeId) {
                                            clearOtpState();
                                        }
                                    }
                                })}
                                placeholder="Enter your password"
                            />
                        </FormField>
                        <button
                            className="primary-button"
                            disabled={submitting}
                            type="submit"
                        >
                            {submitting ? "Signing in..." : "Sign In"}
                        </button>
                    </form>

                    <button
                        className={pageStyles.authForgotLink}
                        type="button"
                        onClick={() => {
                            setShowFirstTimeSetup((current) => !current);
                            setSetupEmail(form.getValues("email") || "");
                        }}
                    >
                        {showFirstTimeSetup ? "Close first-time setup" : "First-time user without password?"}
                    </button>

                    {showFirstTimeSetup ? (
                        <div className={pageStyles.firstLoginCard}>
                            <div className={pageStyles.firstLoginHeader}>
                                <strong>First-time account setup</strong>
                                <span>
                                    Send a one-time setup link to your registered email, then create your password.
                                </span>
                            </div>
                            <FormField label="Work email">
                                <input
                                    type="email"
                                    placeholder="name@saccos.local"
                                    value={setupEmail}
                                    onChange={(event) => setSetupEmail(event.target.value)}
                                />
                            </FormField>
                            <div className={pageStyles.firstLoginActions}>
                                <button
                                    className="secondary-button"
                                    type="button"
                                    disabled={sendingSetupLink}
                                    onClick={() => void handleSendSetupLink()}
                                >
                                    {sendingSetupLink ? "Sending link..." : "Send setup link"}
                                </button>
                                <span className={pageStyles.firstLoginHint}>
                                    For phone OTP onboarding, the phone must already be registered by your admin.
                                </span>
                            </div>
                        </div>
                    ) : null}

                    {otpModalOpen ? (
                        <div className={pageStyles.otpModalBackdrop}>
                            <div className={pageStyles.otpModalCard} role="dialog" aria-modal="true" aria-label="OTP verification">
                                <div className={pageStyles.otpModalHeader}>
                                    <h3>{otpPhoneRequired ? "Add phone for OTP" : "Verify one-time code"}</h3>
                                    <p>
                                        {otpPhoneRequired
                                            ? "Provide your phone number in 2557XXXXXXXX format to receive the sign-in OTP."
                                            : `Enter the OTP sent to ${otpDestinationHint || "your registered phone"} to complete sign in.`}
                                    </p>
                                </div>

                                {otpPhoneRequired ? (
                                    <FormField label="Phone number" error={undefined}>
                                        <input
                                            type="tel"
                                            inputMode="numeric"
                                            placeholder="2557XXXXXXXX"
                                            value={otpPhoneInput}
                                            onChange={(event) => setOtpPhoneInput(event.target.value.replace(/\s+/g, ""))}
                                        />
                                    </FormField>
                                ) : (
                                    <FormField label="OTP code" error={otpCode && !/^\d{6}$/.test(otpCode) ? "Enter a valid 6-digit code." : undefined}>
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
                                                    maxLength={1}
                                                    value={digit}
                                                    onChange={(event) =>
                                                        handleOtpDigitChange(index, event.target.value)
                                                    }
                                                    onKeyDown={(event) =>
                                                        handleOtpDigitKeyDown(index, event)
                                                    }
                                                    onPaste={handleOtpPaste}
                                                    aria-label={`OTP digit ${index + 1}`}
                                                />
                                            ))}
                                        </div>
                                    </FormField>
                                )}

                                <p className={pageStyles.authCopy}>
                                    {!otpPhoneRequired && otpExpiresAt
                                        ? `Code expires at ${new Date(otpExpiresAt).toLocaleTimeString()}.`
                                        : otpPhoneRequired
                                            ? "Phone is saved after password verification and OTP send."
                                            : "Your OTP expires in a few minutes."}
                                </p>

                                <div className={pageStyles.otpModalActions}>
                                    <button
                                        className="secondary-button"
                                        disabled={resendingOtp || verifyingOtp}
                                        type="button"
                                        onClick={otpPhoneRequired ? handleEnrollPhoneAndSendOtp : handleResendOtp}
                                    >
                                        {resendingOtp ? "Sending..." : otpPhoneRequired ? "Save Phone & Send OTP" : "Resend OTP"}
                                    </button>
                                    <button
                                        className={pageStyles.otpModalLink}
                                        type="button"
                                        onClick={closeOtpModal}
                                    >
                                        Change credentials
                                    </button>
                                    {verifyingOtp ? <span className={pageStyles.authCopy}>Verifying OTP...</span> : null}
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
