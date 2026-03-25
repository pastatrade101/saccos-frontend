import { Alert, Box, CardContent, Grid, Stack, TextField, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useMemo, useState } from "react";

import type { BranchFundPool, BranchLiquidityPolicy, LoanProductPolicy } from "../../types/api";
import { MotionCard } from "../../ui/motion";
import { formatCurrency } from "../../utils/format";

interface BorrowingSimulationCardProps {
    loanProductPolicy: Pick<LoanProductPolicy, "contribution_multiplier" | "max_loan_amount" | "liquidity_buffer_percent"> | null;
    branchLiquidityPolicy: Pick<BranchLiquidityPolicy, "max_lending_ratio" | "minimum_liquidity_reserve" | "auto_loan_freeze_threshold"> | null;
    fundPool: Pick<BranchFundPool, "total_deposits" | "active_loans_total" | "available_for_loans"> | null;
}

function MetricTile({
    label,
    value,
    emphasize = false
}: {
    label: string;
    value: string;
    emphasize?: boolean;
}) {
    return (
        <Box
            sx={(theme) => ({
                p: 1.5,
                borderRadius: 2.5,
                border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                backgroundColor: emphasize
                    ? alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.18 : 0.08)
                    : alpha(theme.palette.background.default, 0.65)
            })}
        >
            <Typography variant="caption" color="text.secondary">
                {label}
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: emphasize ? 800 : 700, mt: 0.35 }}>
                {value}
            </Typography>
        </Box>
    );
}

export function BorrowingSimulationCard({
    loanProductPolicy,
    branchLiquidityPolicy,
    fundPool
}: BorrowingSimulationCardProps) {
    const [memberContributionsInput, setMemberContributionsInput] = useState("2000000");

    const simulation = useMemo(() => {
        if (!loanProductPolicy || !branchLiquidityPolicy || !fundPool) {
            return null;
        }

        const memberContributions = Math.max(0, Number(memberContributionsInput) || 0);
        const contributionLimit = memberContributions * loanProductPolicy.contribution_multiplier;
        const ratioHeadroom = Math.max(
            0,
            (fundPool.total_deposits * (branchLiquidityPolicy.max_lending_ratio / 100)) - fundPool.active_loans_total
        );
        const reserveHeadroom = Math.max(
            0,
            fundPool.total_deposits - branchLiquidityPolicy.minimum_liquidity_reserve - fundPool.active_loans_total
        );
        const bufferHeadroom = Math.max(
            0,
            fundPool.available_for_loans * (1 - (loanProductPolicy.liquidity_buffer_percent / 100))
        );
        const liquidityLimit = Math.max(
            0,
            Math.min(
                fundPool.available_for_loans,
                ratioHeadroom,
                reserveHeadroom,
                bufferHeadroom
            )
        );
        const finalBorrowLimit = Math.max(
            0,
            Math.min(
                contributionLimit,
                loanProductPolicy.max_loan_amount,
                liquidityLimit
            )
        );

        return {
            memberContributions,
            contributionMultiplier: loanProductPolicy.contribution_multiplier,
            contributionLimit,
            productCap: loanProductPolicy.max_loan_amount,
            liquidityLimit,
            finalBorrowLimit
        };
    }, [branchLiquidityPolicy, fundPool, loanProductPolicy, memberContributionsInput]);

    return (
        <MotionCard variant="outlined">
            <CardContent>
                <Stack spacing={2.25}>
                    <Box>
                        <Typography variant="h6">Borrowing Simulation</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Test how SACCO policy and current liquidity change the maximum amount a member can borrow.
                        </Typography>
                    </Box>

                    {!simulation ? (
                        <Alert severity="info" variant="outlined">
                            Load a loan product policy and SACCO liquidity position to run a borrowing simulation.
                        </Alert>
                    ) : (
                        <>
                            <TextField
                                fullWidth
                                type="number"
                                label="Member Contributions"
                                value={memberContributionsInput}
                                onChange={(event) => setMemberContributionsInput(event.target.value)}
                                InputProps={{ inputProps: { min: 0, step: 0.01 } }}
                                helperText="Enter hypothetical member savings or contribution balances."
                            />

                            <Grid container spacing={1.5}>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <MetricTile label="Member Contributions" value={formatCurrency(simulation.memberContributions)} />
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <MetricTile label="Loan Multiplier" value={`${simulation.contributionMultiplier}x`} />
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <MetricTile label="Contribution Limit" value={formatCurrency(simulation.contributionLimit)} />
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <MetricTile label="Product Loan Cap" value={formatCurrency(simulation.productCap)} />
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <MetricTile label="SACCO Liquidity Limit" value={formatCurrency(simulation.liquidityLimit)} />
                                </Grid>
                                <Grid size={{ xs: 12 }}>
                                    <MetricTile label="Final Borrow Limit" value={formatCurrency(simulation.finalBorrowLimit)} emphasize />
                                </Grid>
                            </Grid>
                        </>
                    )}
                </Stack>
            </CardContent>
        </MotionCard>
    );
}
