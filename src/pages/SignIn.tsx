import {
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
    };

    const handleOtpChallenge = (details: OtpRequiredDetails | null | undefined) => {
        if (!details?.challenge_id) {
            return;
        }

        setOtpChallengeId(details.challenge_id);
        setOtpDestinationHint(details.destination_hint || null);
        setOtpExpiresAt(details.expires_at || null);
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

    const handleResendOtp = async () => {
        const values = form.getValues();
        const valid = await form.trigger(["email", "password"]);

        if (!valid) {
            return;
        }

        setResendingOtp(true);

        try {
            const result = await requestOtp(values.email, values.password, otpChallengeId);
            setOtpChallengeId(result.challenge_id);
            setOtpDestinationHint(result.destination_hint || null);
            setOtpExpiresAt(result.expires_at || null);
            setOtpDigits(Array.from({ length: OTP_LENGTH }, () => ""));
            window.setTimeout(() => {
                otpInputRefs.current[0]?.focus();
            }, 0);
            pushToast({
                type: "success",
                title: "OTP resent",
                message: "A new verification code has been sent to your registered phone."
            });
        } catch (error) {
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

        const focusIndex = Math.min(value.length, OTP_LENGTH - 1);
        otpInputRefs.current[focusIndex]?.focus();
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

            if (authFlowError.code === "OTP_REQUIRED") {
                setOtpModalOpen(true);

                try {
                    const result = await requestOtp(values.email, values.password, otpChallengeId);
                    handleOtpChallenge(result);
                    pushToast({
                        type: "success",
                        title: "OTP required",
                        message: "A one-time verification code has been sent to your registered phone."
                    });
                } catch (otpError) {
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

    const handleVerifyOtp = async () => {
        const values = form.getValues();
        const valid = await form.trigger(["email", "password"]);

        if (!valid || !otpChallengeId) {
            return;
        }

        if (!/^\d{6}$/.test(otpCode)) {
            pushToast({
                type: "error",
                title: "Invalid OTP",
                message: "Enter the 6-digit code sent to your phone."
            });
            return;
        }

        setVerifyingOtp(true);

        try {
            await signIn(values.email, values.password, {
                challengeId: otpChallengeId,
                otpCode
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

                    {otpModalOpen ? (
                        <div className={pageStyles.otpModalBackdrop}>
                            <div className={pageStyles.otpModalCard} role="dialog" aria-modal="true" aria-label="OTP verification">
                                <div className={pageStyles.otpModalHeader}>
                                    <h3>Verify one-time code</h3>
                                    <p>
                                        Enter the OTP sent to {otpDestinationHint || "your registered phone"} to complete sign in.
                                    </p>
                                </div>

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

                                <p className={pageStyles.authCopy}>
                                    {otpExpiresAt
                                        ? `Code expires at ${new Date(otpExpiresAt).toLocaleTimeString()}.`
                                        : "Your OTP expires in a few minutes."}
                                </p>

                                <div className={pageStyles.otpModalActions}>
                                    <button
                                        className="secondary-button"
                                        disabled={resendingOtp || verifyingOtp}
                                        type="button"
                                        onClick={handleResendOtp}
                                    >
                                        {resendingOtp ? "Resending..." : "Resend OTP"}
                                    </button>
                                    <button
                                        className={pageStyles.otpModalLink}
                                        type="button"
                                        onClick={closeOtpModal}
                                    >
                                        Change credentials
                                    </button>
                                    <button
                                        className="primary-button"
                                        type="button"
                                        disabled={verifyingOtp || !otpChallengeId || otpCode.length !== 6}
                                        onClick={handleVerifyOtp}
                                    >
                                        {verifyingOtp ? "Verifying..." : "Verify & Sign In"}
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
