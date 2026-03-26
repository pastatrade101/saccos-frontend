import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";
import KeyRoundedIcon from "@mui/icons-material/KeyRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import VerifiedRoundedIcon from "@mui/icons-material/VerifiedRounded";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Divider,
    Stack,
    TextField,
    Typography
} from "@mui/material";
import { useState } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/Toast";
import { api, getApiErrorMessage } from "../lib/api";
import {
    endpoints,
    type TwoFactorBackupCodesResponse,
    type TwoFactorDisableResponse,
    type TwoFactorSetupResponse,
    type TwoFactorValidateRequest,
    type TwoFactorValidateResponse,
    type TwoFactorVerifyResponse
} from "../lib/endpoints";

function buildVerificationPayload(totpCode: string, recoveryCode: string): TwoFactorValidateRequest {
    return {
        totp_code: totpCode.trim() || undefined,
        recovery_code: recoveryCode.trim() || undefined
    };
}

export function SecuritySettingsPage() {
    const { session, profile, refreshProfile, twoFactorSetupRequired } = useAuth();
    const { pushToast } = useToast();
    const [setupData, setSetupData] = useState<TwoFactorSetupResponse | null>(null);
    const [setupCode, setSetupCode] = useState("");
    const [totpCode, setTotpCode] = useState("");
    const [recoveryCode, setRecoveryCode] = useState("");
    const [backupCodes, setBackupCodes] = useState<string[]>([]);
    const [loadingAction, setLoadingAction] = useState<string | null>(null);

    if (!session) {
        return <Navigate to="/signin" replace />;
    }

    if (!profile) {
        return (
            <Box sx={{ maxWidth: 920, mx: "auto", p: 3 }}>
                <Alert severity="info">Security settings are available after your user profile is provisioned.</Alert>
            </Box>
        );
    }

    const twoFactorEnabled = Boolean(profile.two_factor_enabled && profile.two_factor_verified);

    const managementPayload = buildVerificationPayload(totpCode, recoveryCode);

    const startSetup = async () => {
        setLoadingAction("setup");
        try {
            const { data } = await api.post<TwoFactorSetupResponse>(endpoints.auth.twoFactorSetup());
            setSetupData(data);
            setSetupCode("");
            setBackupCodes([]);
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to start 2FA setup",
                message: getApiErrorMessage(error)
            });
        } finally {
            setLoadingAction(null);
        }
    };

    const confirmSetup = async () => {
        if (!setupCode.trim()) {
            pushToast({
                type: "error",
                title: "Code required",
                message: "Enter the 6-digit code from your authenticator app."
            });
            return;
        }

        setLoadingAction("verify-setup");
        try {
            const { data } = await api.post<TwoFactorVerifyResponse>(
                endpoints.auth.twoFactorVerify(),
                { totp_code: setupCode.trim() }
            );
            setBackupCodes(data.backup_codes || []);
            setSetupData(null);
            setSetupCode("");
            await refreshProfile();
            pushToast({
                type: "success",
                title: "Two-factor enabled",
                message: "Authenticator-based verification is now active on this account."
            });
        } catch (error) {
            pushToast({
                type: "error",
                title: "Verification failed",
                message: getApiErrorMessage(error)
            });
        } finally {
            setLoadingAction(null);
        }
    };

    const validateNow = async () => {
        setLoadingAction("validate");
        try {
            await api.post<TwoFactorValidateResponse>(
                endpoints.auth.twoFactorValidate(),
                managementPayload
            );
            setTotpCode("");
            setRecoveryCode("");
            await refreshProfile();
            pushToast({
                type: "success",
                title: "Authenticator verified",
                message: "Your recent verification window has been refreshed."
            });
        } catch (error) {
            pushToast({
                type: "error",
                title: "Verification failed",
                message: getApiErrorMessage(error)
            });
        } finally {
            setLoadingAction(null);
        }
    };

    const regenerateCodes = async () => {
        setLoadingAction("backup-regenerate");
        try {
            const { data } = await api.post<TwoFactorBackupCodesResponse>(
                endpoints.auth.twoFactorBackupCodesRegenerate(),
                managementPayload
            );
            setBackupCodes(data.backup_codes || []);
            setTotpCode("");
            setRecoveryCode("");
            pushToast({
                type: "success",
                title: "Backup codes regenerated",
                message: "Save the new codes now. The previous set has been invalidated."
            });
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to regenerate backup codes",
                message: getApiErrorMessage(error)
            });
        } finally {
            setLoadingAction(null);
        }
    };

    const disableTwoFactor = async () => {
        setLoadingAction("disable");
        try {
            await api.post<TwoFactorDisableResponse>(
                endpoints.auth.twoFactorDisable(),
                managementPayload
            );
            setBackupCodes([]);
            setSetupData(null);
            setTotpCode("");
            setRecoveryCode("");
            await refreshProfile();
            pushToast({
                type: "success",
                title: "Two-factor disabled",
                message: "Authenticator verification has been removed from this account."
            });
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to disable 2FA",
                message: getApiErrorMessage(error)
            });
        } finally {
            setLoadingAction(null);
        }
    };

    return (
        <Box sx={{ maxWidth: 1040, mx: "auto", px: { xs: 2, md: 3 }, py: 3 }}>
            <Stack spacing={3}>
                <Stack spacing={1}>
                    <Typography variant="overline" color="primary.main" sx={{ letterSpacing: 2 }}>
                        Security
                    </Typography>
                    <Typography variant="h4" fontWeight={800}>
                        Two-Factor Authentication
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 760 }}>
                        Protect this SACCO workspace with authenticator-app based verification compatible with Google Authenticator, Microsoft Authenticator, Authy, Bitwarden, 1Password, and similar TOTP apps.
                    </Typography>
                </Stack>

                {twoFactorSetupRequired && (
                    <Alert severity="warning" icon={<ShieldRoundedIcon />}>
                        Your role requires two-factor authentication before you can continue using protected financial modules.
                    </Alert>
                )}

                <Box
                    sx={{
                        display: "grid",
                        gap: 2.5,
                        gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }
                    }}
                >
                    <Box>
                        <Card sx={{ height: "100%" }}>
                            <CardContent>
                                <Stack spacing={2}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                        <Stack spacing={0.5}>
                                            <Typography variant="h6" fontWeight={700}>
                                                Current Status
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Staff roles must keep 2FA enabled. Members can enable it optionally.
                                            </Typography>
                                        </Stack>
                                        <Chip
                                            color={twoFactorEnabled ? "success" : "default"}
                                            icon={twoFactorEnabled ? <VerifiedRoundedIcon /> : <SecurityRoundedIcon />}
                                            label={twoFactorEnabled ? "Enabled" : "Not enabled"}
                                        />
                                    </Stack>

                                    <Divider />

                                    <Stack spacing={1}>
                                        <Typography variant="body2" color="text.secondary">
                                            Required for this role
                                        </Typography>
                                        <Typography variant="body1" fontWeight={700}>
                                            {profile.two_factor_required ? "Yes" : "Optional"}
                                        </Typography>
                                    </Stack>

                                    <Stack spacing={1}>
                                        <Typography variant="body2" color="text.secondary">
                                            Enabled on
                                        </Typography>
                                        <Typography variant="body1" fontWeight={700}>
                                            {profile.two_factor_enabled_at
                                                ? new Date(profile.two_factor_enabled_at).toLocaleString()
                                                : "Not yet enabled"}
                                        </Typography>
                                    </Stack>

                                    <Stack spacing={1}>
                                        <Typography variant="body2" color="text.secondary">
                                            Last verified
                                        </Typography>
                                        <Typography variant="body1" fontWeight={700}>
                                            {profile.two_factor_last_verified_at
                                                ? new Date(profile.two_factor_last_verified_at).toLocaleString()
                                                : "No recent verification"}
                                        </Typography>
                                    </Stack>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Box>

                    <Box>
                        <Card sx={{ height: "100%" }}>
                            <CardContent>
                                <Stack spacing={2}>
                                    <Stack spacing={0.5}>
                                        <Typography variant="h6" fontWeight={700}>
                                            Enable or refresh 2FA
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Start setup to get a QR code, then verify a 6-digit authenticator code to activate protection on this account.
                                        </Typography>
                                    </Stack>

                                    {!twoFactorEnabled && !setupData && (
                                        <Button
                                            variant="contained"
                                            startIcon={<ShieldRoundedIcon />}
                                            onClick={() => void startSetup()}
                                            disabled={loadingAction === "setup"}
                                        >
                                            {loadingAction === "setup" ? "Preparing QR code..." : "Enable two-factor authentication"}
                                        </Button>
                                    )}

                                    {setupData && (
                                        <Stack spacing={2}>
                                            <Box
                                                component="img"
                                                src={setupData.qr_code}
                                                alt="TOTP QR code"
                                                sx={{
                                                    width: 220,
                                                    maxWidth: "100%",
                                                    alignSelf: "center",
                                                    borderRadius: 2,
                                                    border: (theme) => `1px solid ${theme.palette.divider}`,
                                                    p: 1,
                                                    bgcolor: "#fff"
                                                }}
                                            />
                                            <Alert severity="info">
                                                If you cannot scan the QR code, enter this key manually: <strong>{setupData.manual_entry_key}</strong>
                                            </Alert>
                                            <TextField
                                                label="Authenticator code"
                                                value={setupCode}
                                                onChange={(event) => setSetupCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                                                inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 6 }}
                                                helperText="Enter the 6-digit code from your authenticator app."
                                            />
                                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                                                <Button
                                                    variant="contained"
                                                    onClick={() => void confirmSetup()}
                                                    disabled={loadingAction === "verify-setup"}
                                                >
                                                    {loadingAction === "verify-setup" ? "Verifying..." : "Verify and enable"}
                                                </Button>
                                                <Button
                                                    variant="text"
                                                    onClick={() => {
                                                        setSetupData(null);
                                                        setSetupCode("");
                                                    }}
                                                >
                                                    Cancel setup
                                                </Button>
                                            </Stack>
                                        </Stack>
                                    )}

                                    {twoFactorEnabled && (
                                        <Alert severity="success">
                                            Authenticator verification is enabled. You can refresh your verification window, regenerate backup codes, or disable 2FA below.
                                        </Alert>
                                    )}
                                </Stack>
                            </CardContent>
                        </Card>
                    </Box>

                    {twoFactorEnabled && (
                        <Box sx={{ gridColumn: "1 / -1" }}>
                            <Card>
                                <CardContent>
                                    <Stack spacing={2}>
                                        <Stack spacing={0.5}>
                                            <Typography variant="h6" fontWeight={700}>
                                                Manage existing 2FA
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Use either a current authenticator code or one unused backup code to validate, regenerate backup codes, or disable 2FA.
                                            </Typography>
                                        </Stack>

                                        <Box
                                            sx={{
                                                display: "grid",
                                                gap: 2,
                                                gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }
                                            }}
                                        >
                                            <Box>
                                                <TextField
                                                    fullWidth
                                                    label="Authenticator code"
                                                    value={totpCode}
                                                    onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                                                    inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 6 }}
                                                />
                                            </Box>
                                            <Box>
                                                <TextField
                                                    fullWidth
                                                    label="Backup recovery code"
                                                    value={recoveryCode}
                                                    onChange={(event) => setRecoveryCode(event.target.value.toUpperCase())}
                                                    helperText="Example: 8F4K-3P92"
                                                />
                                            </Box>
                                        </Box>

                                        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                                            <Button
                                                variant="outlined"
                                                startIcon={<SecurityRoundedIcon />}
                                                onClick={() => void validateNow()}
                                                disabled={loadingAction === "validate"}
                                            >
                                                {loadingAction === "validate" ? "Verifying..." : "Verify now"}
                                            </Button>
                                            <Button
                                                variant="outlined"
                                                startIcon={<RefreshRoundedIcon />}
                                                onClick={() => void regenerateCodes()}
                                                disabled={loadingAction === "backup-regenerate"}
                                            >
                                                {loadingAction === "backup-regenerate" ? "Regenerating..." : "Regenerate backup codes"}
                                            </Button>
                                            <Button
                                                color="error"
                                                variant="text"
                                                startIcon={<DeleteOutlineRoundedIcon />}
                                                onClick={() => void disableTwoFactor()}
                                                disabled={loadingAction === "disable"}
                                            >
                                                {loadingAction === "disable" ? "Disabling..." : "Disable 2FA"}
                                            </Button>
                                        </Stack>
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Box>
                    )}

                    {backupCodes.length > 0 && (
                        <Box sx={{ gridColumn: "1 / -1" }}>
                            <Card>
                                <CardContent>
                                    <Stack spacing={2}>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <KeyRoundedIcon color="primary" />
                                            <Typography variant="h6" fontWeight={700}>
                                                Backup recovery codes
                                            </Typography>
                                        </Stack>
                                        <Alert severity="warning">
                                            Save these codes now. Each code works once. For security reasons, hashed backup codes are stored and cannot be displayed again later.
                                        </Alert>
                                        <Box
                                            sx={{
                                                display: "grid",
                                                gap: 1.25,
                                                gridTemplateColumns: {
                                                    xs: "1fr",
                                                    sm: "repeat(2, minmax(0, 1fr))",
                                                    md: "repeat(4, minmax(0, 1fr))"
                                                }
                                            }}
                                        >
                                            {backupCodes.map((code) => (
                                                <Box key={code}>
                                                    <Box
                                                        sx={{
                                                            border: (theme) => `1px solid ${theme.palette.divider}`,
                                                            borderRadius: 2,
                                                            px: 2,
                                                            py: 1.5,
                                                            fontFamily: "monospace",
                                                            fontWeight: 700,
                                                            fontSize: "0.95rem",
                                                            bgcolor: "background.default"
                                                        }}
                                                    >
                                                        {code}
                                                    </Box>
                                                </Box>
                                            ))}
                                        </Box>
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Box>
                    )}
                </Box>
            </Stack>
        </Box>
    );
}
