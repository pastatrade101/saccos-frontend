import { Grid, Stack } from "@mui/material";

import type { StatementRow } from "../../types/api";
import { Alerts } from "./Alerts";
import { FinancialSummary } from "./FinancialSummary";
import { LoanCard } from "./LoanCard";
import { LoanRepaymentProgress } from "./LoanRepaymentProgress";
import { RecentActivityCard } from "./RecentActivityCard";
import { SavingsCard } from "./SavingsCard";
import { SavingsTrendChart } from "./SavingsTrendChart";
import { ShareCapitalCard } from "./ShareCapitalCard";
import { TransactionsPreview } from "./TransactionsPreview";
import type { FinancialStanding, FinancialSummaryData, LoanExposureData, MemberAlertItem, RecentActivityData } from "./types";

interface MemberOverviewProps {
    summary: FinancialSummaryData;
    standing: FinancialStanding;
    savingsCard: {
        totalSavings: number;
        availableBalance: number;
        lockedAmount: number;
    };
    shareCard: {
        totalShares: number;
        dividendEarned: number;
        lastContributionDate?: string | null;
    };
    loanExposure: LoanExposureData;
    recentActivity: RecentActivityData;
    alerts: MemberAlertItem[];
    savingsTrend: {
        labels: string[];
        values: number[];
    };
    transactions: StatementRow[];
    onApplyLoan: () => void;
    onMakeContribution: () => void;
    onDownloadStatement: () => void;
    onViewFullStatement: () => void;
}

export function MemberOverview({
    summary,
    standing,
    savingsCard,
    shareCard,
    loanExposure,
    recentActivity,
    alerts,
    savingsTrend,
    transactions,
    onApplyLoan,
    onMakeContribution,
    onDownloadStatement,
    onViewFullStatement
}: MemberOverviewProps) {
    return (
        <Stack spacing={2.5} sx={{ width: "100%", minWidth: 0 }}>
            <FinancialSummary
                summary={summary}
                standing={standing}
                onApplyLoan={onApplyLoan}
                onMakeContribution={onMakeContribution}
                onDownloadStatement={onDownloadStatement}
            />

            <Grid container spacing={2} alignItems="stretch" sx={{ width: "100%", minWidth: 0 }}>
                <Grid size={{ xs: 12, md: 6, xl: 3 }} sx={{ display: "flex", minWidth: 0 }}>
                    <SavingsCard {...savingsCard} />
                </Grid>
                <Grid size={{ xs: 12, md: 6, xl: 3 }} sx={{ display: "flex", minWidth: 0 }}>
                    <ShareCapitalCard {...shareCard} />
                </Grid>
                <Grid size={{ xs: 12, md: 6, xl: 3 }} sx={{ display: "flex", minWidth: 0 }}>
                    <LoanCard {...loanExposure} />
                </Grid>
                <Grid size={{ xs: 12, md: 6, xl: 3 }} sx={{ display: "flex", minWidth: 0 }}>
                    <RecentActivityCard {...recentActivity} />
                </Grid>
            </Grid>

            <Alerts alerts={alerts} />

            <Grid container spacing={2} sx={{ width: "100%", minWidth: 0 }}>
                <Grid size={{ xs: 12, lg: 8 }} sx={{ minWidth: 0 }}>
                    <SavingsTrendChart labels={savingsTrend.labels} values={savingsTrend.values} />
                </Grid>
                <Grid size={{ xs: 12, lg: 4 }} sx={{ minWidth: 0 }}>
                    <LoanRepaymentProgress progressPercent={loanExposure.loanProgressPercent} />
                </Grid>
            </Grid>

            <TransactionsPreview rows={transactions.slice(0, 5)} onViewFullStatement={onViewFullStatement} />
        </Stack>
    );
}
