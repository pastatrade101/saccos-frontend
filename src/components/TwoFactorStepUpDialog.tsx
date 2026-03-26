import { useState } from "react";
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    TextField,
    Typography
} from "@mui/material";

import { getApiErrorMessage } from "../lib/api";
import { useToast } from "./Toast";

export interface TwoFactorStepUpPayload {
    two_factor_code?: string;
    recovery_code?: string;
}

interface TwoFactorStepUpDialogProps {
    open: boolean;
    title: string;
    description: string;
    actionLabel: string;
    busy?: boolean;
    onCancel: () => void;
    onConfirm: (payload: TwoFactorStepUpPayload) => Promise<void>;
}

export function TwoFactorStepUpDialog({
    open,
    title,
    description,
    actionLabel,
    busy = false,
    onCancel,
    onConfirm
}: TwoFactorStepUpDialogProps) {
    const { pushToast } = useToast();
    const [useRecoveryCode, setUseRecoveryCode] = useState(false);
    const [totpCode, setTotpCode] = useState("");
    const [recoveryCode, setRecoveryCode] = useState("");

    const reset = () => {
        setUseRecoveryCode(false);
        setTotpCode("");
        setRecoveryCode("");
    };

    const handleCancel = () => {
        if (busy) {
            return;
        }

        reset();
        onCancel();
    };

    const handleConfirm = async () => {
        if (!useRecoveryCode && !/^\d{6}$/.test(totpCode.trim())) {
            pushToast({
                type: "error",
                title: "Invalid code",
                message: "Enter a valid 6-digit authenticator code."
            });
            return;
        }

        if (useRecoveryCode && !recoveryCode.trim()) {
            pushToast({
                type: "error",
                title: "Recovery code required",
                message: "Enter one unused backup recovery code."
            });
            return;
        }

        try {
            await onConfirm(
                useRecoveryCode
                    ? { recovery_code: recoveryCode.trim().toUpperCase() }
                    : { two_factor_code: totpCode.trim() }
            );
            reset();
        } catch (error) {
            pushToast({
                type: "error",
                title: "Verification failed",
                message: getApiErrorMessage(error, "Unable to verify this protected action.")
            });
        }
    };

    return (
        <Dialog open={open} onClose={handleCancel} fullWidth maxWidth="xs">
            <DialogTitle>{title}</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    <Alert severity="info">
                        This financial action requires a fresh authenticator check before the system can continue.
                    </Alert>
                    <Typography variant="body2" color="text.secondary">
                        {description}
                    </Typography>
                    {useRecoveryCode ? (
                        <TextField
                            autoFocus
                            fullWidth
                            label="Backup recovery code"
                            value={recoveryCode}
                            onChange={(event) => setRecoveryCode(event.target.value.toUpperCase())}
                            helperText="Example: 8F4K-3P92"
                        />
                    ) : (
                        <TextField
                            autoFocus
                            fullWidth
                            label="Authenticator code"
                            value={totpCode}
                            onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                            inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 6 }}
                            helperText="Enter the 6-digit code from your authenticator app."
                        />
                    )}
                    <Button
                        variant="text"
                        sx={{ alignSelf: "flex-start" }}
                        onClick={() => {
                            setUseRecoveryCode((current) => !current);
                            setTotpCode("");
                            setRecoveryCode("");
                        }}
                    >
                        {useRecoveryCode ? "Use authenticator code instead" : "Use a backup recovery code"}
                    </Button>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleCancel} disabled={busy}>
                    Cancel
                </Button>
                <Button onClick={() => void handleConfirm()} variant="contained" disabled={busy}>
                    {busy ? "Verifying..." : actionLabel}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
