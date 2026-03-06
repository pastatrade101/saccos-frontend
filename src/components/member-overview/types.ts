import type { StatementRow } from "../../types/api";

export interface FinancialSummaryData {
    totalSavings: number;
    totalShareCapital: number;
    outstandingLoan: number;
    availableToWithdraw: number;
    netPosition: number;
}

export type FinancialStandingTone = "success" | "warning" | "danger" | "neutral";

export interface FinancialStanding {
    label: string;
    tone: FinancialStandingTone;
    details?: string;
}

export interface LoanExposureData {
    outstandingAmount: number;
    nextInstallmentDueDate?: string | null;
    monthlyInstallment: number;
    loanProgressPercent: number;
    activeLoans: number;
}

export interface MemberAlertItem {
    id: string;
    severity: "success" | "info" | "warning" | "error";
    title: string;
    message: string;
}

export interface RecentActivityData {
    lastTransactionDate?: string | null;
    lastContribution?: StatementRow | null;
    lastLoanPayment?: StatementRow | null;
}
