import { Alert, Button, DialogActions, DialogContent, DialogTitle, Divider, Paper, Stack, Typography } from "@mui/material";

import { MotionModal } from "../../ui/motion";
import type { PaymentOrder } from "../../types/api";
import { formatCurrency, formatDate } from "../../utils/format";

interface PaymentReceiptDialogProps {
    receipt: PaymentOrder | null;
    open: boolean;
    onClose: () => void;
    formatPaymentPurpose: (purpose: string) => string;
    formatPaymentStatus: (status: string) => string;
}

export function PaymentReceiptDialog({
    receipt,
    open,
    onClose,
    formatPaymentPurpose,
    formatPaymentStatus
}: PaymentReceiptDialogProps) {
    return (
        <MotionModal open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Payment Receipt</DialogTitle>
            <DialogContent dividers>
                {receipt ? (
                    <Stack spacing={2}>
                        <Alert
                            severity={
                                receipt.status === "posted"
                                    ? "success"
                                    : receipt.status === "failed"
                                        ? "error"
                                        : receipt.status === "expired"
                                            ? "warning"
                                            : "info"
                            }
                            variant="outlined"
                        >
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.4 }}>
                                {formatPaymentPurpose(receipt.purpose)}
                            </Typography>
                            <Typography variant="body2">
                                Status: {formatPaymentStatus(receipt.status)}
                            </Typography>
                        </Alert>

                        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                            <Stack spacing={1.15}>
                                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                                    {formatCurrency(receipt.amount)}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {receipt.provider.toUpperCase()} · {receipt.currency}
                                </Typography>
                                <Divider />
                                <Typography variant="body2">
                                    <strong>{receipt.purpose === "loan_repayment" ? "Loan" : "Account"}:</strong>{" "}
                                    {receipt.purpose === "loan_repayment"
                                        ? receipt.loan_number || receipt.loan_id
                                        : receipt.account_name || receipt.account_number || receipt.account_id}
                                </Typography>
                                <Typography variant="body2"><strong>Reference:</strong> {receipt.provider_ref || receipt.external_id}</Typography>
                                <Typography variant="body2"><strong>Initiated:</strong> {formatDate(receipt.created_at)}</Typography>
                                {receipt.paid_at ? (
                                    <Typography variant="body2"><strong>Paid:</strong> {formatDate(receipt.paid_at)}</Typography>
                                ) : null}
                                {receipt.posted_at ? (
                                    <Typography variant="body2"><strong>Posted:</strong> {formatDate(receipt.posted_at)}</Typography>
                                ) : null}
                                {receipt.journal_id ? (
                                    <Typography variant="body2"><strong>Journal:</strong> {receipt.journal_id}</Typography>
                                ) : null}
                                {receipt.description ? (
                                    <Typography variant="body2"><strong>Description:</strong> {receipt.description}</Typography>
                                ) : null}
                                {receipt.error_message ? (
                                    <Typography variant="body2" color="error.main"><strong>Issue:</strong> {receipt.error_message}</Typography>
                                ) : null}
                            </Stack>
                        </Paper>
                    </Stack>
                ) : null}
            </DialogContent>
            <DialogActions>
                <Button onClick={() => window.print()}>
                    Print
                </Button>
                <Button onClick={onClose}>
                    Close
                </Button>
            </DialogActions>
        </MotionModal>
    );
}
