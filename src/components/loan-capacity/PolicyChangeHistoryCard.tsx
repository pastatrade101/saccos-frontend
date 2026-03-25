import { Alert, Box, CardContent, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";

import type { LoanCapacityPolicyChange } from "../../types/api";
import { MotionCard } from "../../ui/motion";

interface PolicyChangeHistoryCardProps {
    rows: LoanCapacityPolicyChange[];
    loading?: boolean;
    error?: string | null;
}

function formatHistoryDate(value?: string | null) {
    if (!value) {
        return "N/A";
    }

    return new Intl.DateTimeFormat("en-TZ", {
        month: "short",
        day: "numeric"
    }).format(new Date(value));
}

export function PolicyChangeHistoryCard({
    rows,
    loading = false,
    error = null
}: PolicyChangeHistoryCardProps) {
    return (
        <MotionCard variant="outlined">
            <CardContent>
                <Stack spacing={2}>
                    <Box>
                        <Typography variant="h6">Policy Change History</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Recent SACCO policy adjustments from the audit trail, flattened into manager-readable changes.
                        </Typography>
                    </Box>

                    {loading ? (
                        <Alert severity="info" variant="outlined">
                            Loading recent policy changes...
                        </Alert>
                    ) : null}

                    {!loading && error ? (
                        <Alert severity="warning" variant="outlined">
                            {error}
                        </Alert>
                    ) : null}

                    {!loading && !error && !rows.length ? (
                        <Alert severity="info" variant="outlined">
                            No borrowing-policy or liquidity-guardrail changes are recorded yet.
                        </Alert>
                    ) : null}

                    {!loading && !error && rows.length ? (
                        <Box sx={{ overflowX: "auto" }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Date</TableCell>
                                        <TableCell>User</TableCell>
                                        <TableCell>Policy</TableCell>
                                        <TableCell>Old Value</TableCell>
                                        <TableCell>New Value</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {rows.map((row) => (
                                        <TableRow key={row.id} hover>
                                            <TableCell>{formatHistoryDate(row.event_at)}</TableCell>
                                            <TableCell>{row.actor_name || "System"}</TableCell>
                                            <TableCell>
                                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                                    {row.policy_label}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {row.policy_scope === "borrowing_policy" ? "Borrowing Policy" : "Liquidity Guardrail"}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>{row.old_value}</TableCell>
                                            <TableCell>{row.new_value}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Box>
                    ) : null}
                </Stack>
            </CardContent>
        </MotionCard>
    );
}
