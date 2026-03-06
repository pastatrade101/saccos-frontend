import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import SavingsRoundedIcon from "@mui/icons-material/SavingsRounded";
import { CardContent, Stack, Typography } from "@mui/material";

import type { StatementRow } from "../../types/api";
import { formatCurrency, formatDate } from "../../utils/format";
import { MotionCard } from "../../ui/motion";

interface RecentActivityCardProps {
    lastTransactionDate?: string | null;
    lastContribution?: StatementRow | null;
    lastLoanPayment?: StatementRow | null;
}

export function RecentActivityCard({ lastTransactionDate, lastContribution, lastLoanPayment }: RecentActivityCardProps) {
    return (
        <MotionCard
            variant="outlined"
            sx={{
                borderRadius: 2,
                borderColor: "divider",
                height: "100%",
                minHeight: 260,
                width: 1,
                display: "flex"
            }}
        >
            <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
                    Recent Activity
                </Typography>
                <Stack spacing={1.25}>
                    <Stack direction="row" justifyContent="space-between">
                        <Stack direction="row" spacing={0.75} alignItems="center">
                            <CalendarMonthRoundedIcon fontSize="small" color="info" />
                            <Typography variant="body2" color="text.secondary">
                                Last Transaction Date
                            </Typography>
                        </Stack>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {formatDate(lastTransactionDate)}
                        </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                        <Stack direction="row" spacing={0.75} alignItems="center">
                            <SavingsRoundedIcon fontSize="small" color="primary" />
                            <Typography variant="body2" color="text.secondary">
                                Last Contribution
                            </Typography>
                        </Stack>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {lastContribution ? formatCurrency(lastContribution.amount) : "N/A"}
                        </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                        <Stack direction="row" spacing={0.75} alignItems="center">
                            <PaymentsRoundedIcon fontSize="small" color="warning" />
                            <Typography variant="body2" color="text.secondary">
                                Last Loan Payment
                            </Typography>
                        </Stack>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {lastLoanPayment ? formatCurrency(lastLoanPayment.amount) : "N/A"}
                        </Typography>
                    </Stack>
                </Stack>
            </CardContent>
        </MotionCard>
    );
}
