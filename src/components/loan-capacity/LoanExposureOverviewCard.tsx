import { Alert, Box, CardContent, Chip, Divider, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import type { LoanExposureOverview } from "../../types/api";
import { MotionCard } from "../../ui/motion";
import { formatCurrency } from "../../utils/format";

interface LoanExposureOverviewCardProps {
    overview: LoanExposureOverview | null;
    loading?: boolean;
    error?: string | null;
}

function MetricTile({
    label,
    value
}: {
    label: string;
    value: string;
}) {
    return (
        <Box
            sx={(theme) => ({
                p: 1.5,
                borderRadius: 2.5,
                border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                backgroundColor: alpha(theme.palette.background.default, 0.65)
            })}
        >
            <Typography variant="caption" color="text.secondary">
                {label}
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 700, mt: 0.35 }}>
                {value}
            </Typography>
        </Box>
    );
}

export function LoanExposureOverviewCard({
    overview,
    loading = false,
    error = null
}: LoanExposureOverviewCardProps) {
    return (
        <MotionCard variant="outlined">
            <CardContent>
                <Stack spacing={2.25}>
                    <Box>
                        <Typography variant="h6">Loan Exposure Overview</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Active lending position across the SACCO. Near-limit exposure uses the currently selected loan product policy.
                        </Typography>
                    </Box>

                    {loading ? (
                        <Alert severity="info" variant="outlined">
                            Loading current loan exposure...
                        </Alert>
                    ) : null}

                    {!loading && error ? (
                        <Alert severity="warning" variant="outlined">
                            {error}
                        </Alert>
                    ) : null}

                    {!loading && !error && overview ? (
                        <>
                            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} useFlexGap flexWrap="wrap">
                                <MetricTile label="Total Active Loans" value={formatCurrency(overview.total_active_loans)} />
                                <MetricTile label="Members With Loans" value={String(overview.members_with_active_loans)} />
                                <MetricTile label="Average Loan Size" value={formatCurrency(overview.average_loan_size)} />
                                <MetricTile label="Members Near Borrow Limit" value={String(overview.members_near_borrow_limit)} />
                            </Stack>

                            <Divider />

                            <Box>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.25}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                        Top Borrowers
                                    </Typography>
                                    <Chip size="small" label={`${overview.top_borrowers.length} shown`} variant="outlined" />
                                </Stack>
                                {!overview.top_borrowers.length ? (
                                    <Alert severity="info" variant="outlined">
                                        No active borrowers are visible yet.
                                    </Alert>
                                ) : (
                                    <Box sx={{ overflowX: "auto" }}>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Member</TableCell>
                                                    <TableCell>Exposure</TableCell>
                                                    <TableCell>Borrow Limit</TableCell>
                                                    <TableCell>Capacity Used</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {overview.top_borrowers.map((borrower) => (
                                                    <TableRow key={borrower.member_id} hover>
                                                        <TableCell>
                                                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                                                {borrower.member_name}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {borrower.member_no || "No member number"} · {borrower.loan_count} active loan(s)
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell>{formatCurrency(borrower.total_exposure)}</TableCell>
                                                        <TableCell>{formatCurrency(borrower.borrow_limit)}</TableCell>
                                                        <TableCell>
                                                            {typeof borrower.capacity_usage_percent === "number"
                                                                ? `${borrower.capacity_usage_percent}%`
                                                                : "N/A"}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </Box>
                                )}
                            </Box>
                        </>
                    ) : null}
                </Stack>
            </CardContent>
        </MotionCard>
    );
}
