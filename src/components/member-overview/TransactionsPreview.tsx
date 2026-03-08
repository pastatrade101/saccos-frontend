import { Button, CardContent, Chip, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import { brandColors } from "../../theme/colors";
import type { StatementRow } from "../../types/api";
import { formatCurrency, formatDate } from "../../utils/format";
import { MotionCard } from "../../ui/motion";

interface TransactionsPreviewProps {
    rows: StatementRow[];
    onViewFullStatement: () => void;
}

export function TransactionsPreview({ rows, onViewFullStatement }: TransactionsPreviewProps) {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === "dark";
    const accent = isDarkMode ? "#D9B273" : brandColors.primary[700];

    return (
        <MotionCard variant="outlined" sx={{ borderRadius: 2, borderColor: "divider" }}>
            <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.25} sx={{ mb: 1.5 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        Recent Transactions
                    </Typography>
                    <Button
                        variant="outlined"
                        onClick={onViewFullStatement}
                        sx={{
                            borderRadius: 1.5,
                            fontWeight: 700,
                            ...(isDarkMode
                                ? {
                                    borderColor: alpha(accent, 0.4),
                                    color: accent,
                                    "&:hover": {
                                        borderColor: alpha(accent, 0.72),
                                        bgcolor: alpha(accent, 0.08)
                                    }
                                }
                                : {})
                        }}
                    >
                        View Full Statement
                    </Button>
                </Stack>

                {rows.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                        No posted transactions are available yet.
                    </Typography>
                ) : (
                    <TableContainer
                        component="div"
                        sx={{
                            border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                            borderRadius: 1.5
                        }}
                    >
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Date</TableCell>
                                    <TableCell>Type</TableCell>
                                    <TableCell align="right">Amount</TableCell>
                                    <TableCell align="right">Balance After</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {rows.map((row) => (
                                    <TableRow key={row.transaction_id} hover>
                                        <TableCell>{formatDate(row.transaction_date)}</TableCell>
                                        <TableCell>
                                            <Chip
                                                size="small"
                                                label={row.transaction_type.replace(/_/g, " ")}
                                                sx={{
                                                    borderRadius: 1.25,
                                                    bgcolor: alpha(accent, 0.12),
                                                    color: accent,
                                                    textTransform: "capitalize"
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                                            {formatCurrency(row.amount)}
                                        </TableCell>
                                        <TableCell align="right">{formatCurrency(row.running_balance)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </CardContent>
        </MotionCard>
    );
}
