import AccountBalanceRoundedIcon from "@mui/icons-material/AccountBalanceRounded";
import EventAvailableRoundedIcon from "@mui/icons-material/EventAvailableRounded";
import PaidRoundedIcon from "@mui/icons-material/PaidRounded";
import { CardContent, Stack, Typography } from "@mui/material";

import { formatCurrency, formatDate } from "../../utils/format";
import { MotionCard } from "../../ui/motion";

interface ShareCapitalCardProps {
    totalShares: number;
    dividendEarned: number;
    lastContributionDate?: string | null;
}

export function ShareCapitalCard({ totalShares, dividendEarned, lastContributionDate }: ShareCapitalCardProps) {
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
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                    <AccountBalanceRoundedIcon fontSize="small" color="warning" />
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        Share Capital
                    </Typography>
                </Stack>

                <Stack spacing={1.25}>
                    <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                            Total Shares
                        </Typography>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            {formatCurrency(totalShares)}
                        </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                        <Stack direction="row" spacing={0.75} alignItems="center">
                            <PaidRoundedIcon fontSize="small" color="success" />
                            <Typography variant="body2" color="text.secondary">
                                Dividend Earned
                            </Typography>
                        </Stack>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {formatCurrency(dividendEarned)}
                        </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                        <Stack direction="row" spacing={0.75} alignItems="center">
                            <EventAvailableRoundedIcon fontSize="small" color="info" />
                            <Typography variant="body2" color="text.secondary">
                                Last Contribution Date
                            </Typography>
                        </Stack>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {formatDate(lastContributionDate)}
                        </Typography>
                    </Stack>
                </Stack>
            </CardContent>
        </MotionCard>
    );
}
