import { DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { MotionButton, MotionModal } from "../ui/motion";

interface ConfirmModalProps {
    open: boolean;
    title: string;
    summary: ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    loading?: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}

export function ConfirmModal({
    open,
    title,
    summary,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    loading = false,
    onCancel,
    onConfirm
}: ConfirmModalProps) {
    return (
        <MotionModal open={open} onClose={loading ? undefined : onCancel} maxWidth="sm" fullWidth>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent dividers>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Review the details carefully before posting a real-money transaction.
                </Typography>
                {summary}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <MotionButton onClick={onCancel} disabled={loading} color="inherit">
                    {cancelLabel}
                </MotionButton>
                <MotionButton onClick={onConfirm} disabled={loading} variant="contained">
                    {loading ? "Processing..." : confirmLabel}
                </MotionButton>
            </DialogActions>
        </MotionModal>
    );
}
