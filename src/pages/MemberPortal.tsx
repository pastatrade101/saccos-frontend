import { MotionCard, MotionModal, easeOutFast, springSoft, useReducedMotionSafe } from "../ui/motion";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import ApartmentRoundedIcon from "@mui/icons-material/ApartmentRounded";
import ApprovalRoundedIcon from "@mui/icons-material/ApprovalRounded";
import AutoGraphRoundedIcon from "@mui/icons-material/AutoGraphRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import CreditScoreRoundedIcon from "@mui/icons-material/CreditScoreRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import EastRoundedIcon from "@mui/icons-material/EastRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import HourglassTopRoundedIcon from "@mui/icons-material/HourglassTopRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import NorthEastRoundedIcon from "@mui/icons-material/NorthEastRounded";
import PrintRoundedIcon from "@mui/icons-material/PrintRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import SavingsRoundedIcon from "@mui/icons-material/SavingsRounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import HighlightOffRoundedIcon from "@mui/icons-material/HighlightOffRounded";
import WalletRoundedIcon from "@mui/icons-material/WalletRounded";
import WorkspacesRoundedIcon from "@mui/icons-material/WorkspacesRounded";
import {
    Alert,
    Avatar,
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    Divider,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Chip,
    CircularProgress,
    Drawer,
    FormControlLabel,
    Grid,
    IconButton,
    InputBase,
    List,
    ListItem,
    ListItemAvatar,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Paper,
    LinearProgress,
    Skeleton,
    Stack,
    Step,
    StepLabel,
    Stepper,
    Switch,
    TablePagination,
    TextField,
    Typography,
    useMediaQuery
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState, type ChangeEvent, type MouseEvent } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { useAuth } from "../auth/AuthContext";
import { ChartPanel } from "../components/ChartPanel";
import { ConfirmModal } from "../components/ConfirmModal";
import { DataTable, type Column } from "../components/DataTable";
import { MemberOverview, type MemberAlertItem } from "../components/member-overview";
import { LoanEligibilitySummary } from "../components/loan-capacity/LoanEligibilitySummary";
import { NotificationBell } from "../components/notifications/NotificationBell";
import { SearchableSelect } from "../components/SearchableSelect";
import { useToast } from "../components/Toast";
import { AppLoader } from "../components/AppLoader";
import { api, getApiErrorCode, getApiErrorDetails, getApiErrorMessage } from "../lib/api";
import {
    endpoints,
    type CreateLoanApplicationRequest,
    type UpdateLoanApplicationRequest,
    type LoanApplicationResponse,
    type LoanApplicationsResponse,
    type LoanCapacityResponse,
    type LoanProductsResponse,
    type LoansResponse,
    type LoanSchedulesResponse,
    type LoanTransactionsResponse,
    type MemberAccountsResponse,
    type MembersResponse,
    type MemberApplicationResponse,
    type StatementsResponse,
    type GuarantorConsentRequest,
    type GuarantorRequestItem,
    type GuarantorRequestsResponse,
    type InitiateContributionPaymentRequest,
    type InitiateContributionPaymentResponse,
    type PaymentOrdersResponse,
    type PaymentOrderStatusResponse,
    type ReconcilePaymentOrderResponse
} from "../lib/endpoints";
import { brandColors, darkThemeColors } from "../theme/colors";
import { useUI } from "../ui/UIProvider";
import type { Loan, LoanApplication, LoanCapacitySummary, LoanProduct, LoanSchedule, LoanTransaction, Member, MemberAccount, MemberApplication, MemberApplicationStatus, PaymentOrder, StatementRow } from "../types/api";
import { downloadLoanStatementPdf, downloadMemberStatementPdf } from "../utils/memberStatementPdf";
import { memberApplicationStatusLabels } from "../utils/member-application-status";
import { formatCurrency, formatDate, formatRole } from "../utils/format";

type LoanRepaymentFrequency = "daily" | "weekly" | "monthly";

const SUPPORTED_LOAN_REPAYMENT_FREQUENCIES: LoanRepaymentFrequency[] = ["daily", "weekly", "monthly"];
const loanPurposePattern = /^[A-Za-z0-9\s,.]+$/;
const loanReferencePattern = /^[A-Za-z0-9_-]+$/;

function stripHtml(value: string) {
    return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
        .replace(/<[^>]+>/g, " ");
}

function normalizeWhitespace(value: string) {
    return value.replace(/\s+/g, " ").trim();
}

function sanitizeLoanPurpose(value: string) {
    return normalizeWhitespace(stripHtml(value || ""));
}

function sanitizeLoanReference(value: string) {
    return normalizeWhitespace(stripHtml(value || ""));
}

function toPositiveNumber(value: unknown, fallback: number | null) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return fallback;
    }
    return parsed;
}

function getNumericDetail(details: unknown, key: string) {
    if (!details || typeof details !== "object") {
        return null;
    }

    const value = Number((details as Record<string, unknown>)[key]);
    return Number.isFinite(value) ? value : null;
}

function getLoanEligibilityRuleNumber(rules: Record<string, unknown> | undefined, keys: string[], fallback: number | null) {
    for (const key of keys) {
        if (rules && Object.prototype.hasOwnProperty.call(rules, key)) {
            const parsed = toPositiveNumber(rules[key], fallback);
            if (parsed !== null) {
                return parsed;
            }
        }
    }

    return fallback;
}

function resolveLoanAllowedFrequencies(product?: LoanProduct | null) {
    const rules = product?.eligibility_rules_json;
    const candidates = [
        rules?.allowed_repayment_frequencies,
        rules?.allowedRepaymentFrequencies,
        rules?.repayment_frequencies,
        rules?.repaymentFrequencies
    ];

    for (const candidate of candidates) {
        if (!Array.isArray(candidate)) {
            continue;
        }

        const frequencies = candidate
            .map((value) => String(value || "").trim().toLowerCase())
            .filter((value): value is LoanRepaymentFrequency => SUPPORTED_LOAN_REPAYMENT_FREQUENCIES.includes(value as LoanRepaymentFrequency));

        if (frequencies.length) {
            return Array.from(new Set(frequencies));
        }
    }

    return [...SUPPORTED_LOAN_REPAYMENT_FREQUENCIES];
}

function resolveLoanEligibilityPolicy(product?: LoanProduct | null) {
    const rules = product?.eligibility_rules_json;

    return {
        savingsMultiplier: getLoanEligibilityRuleNumber(rules, [
            "savings_multiplier",
            "savingsMultiplier",
            "savings_balance_multiplier",
            "savingsBalanceMultiplier",
            "savings_eligibility_multiplier",
            "savingsEligibilityMultiplier"
        ], 1) ?? 1,
        sharesMultiplier: getLoanEligibilityRuleNumber(rules, [
            "share_multiplier",
            "shareMultiplier",
            "shares_multiplier",
            "sharesMultiplier",
            "share_balance_multiplier",
            "shareBalanceMultiplier",
            "shares_balance_multiplier",
            "sharesBalanceMultiplier",
            "share_eligibility_multiplier",
            "shareEligibilityMultiplier"
        ], 1) ?? 1,
        baseEligibilityAmount: getLoanEligibilityRuleNumber(rules, [
            "base_eligibility_amount",
            "baseEligibilityAmount"
        ], 0) ?? 0,
        eligibilityCapAmount: getLoanEligibilityRuleNumber(rules, [
            "eligibility_cap_amount",
            "eligibilityCapAmount",
            "max_eligible_amount",
            "maxEligibleAmount"
        ], null),
        allowedRepaymentFrequencies: resolveLoanAllowedFrequencies(product)
    };
}

function formatWholeNumber(value: number | string | null | undefined) {
    const digits = String(value ?? "").replace(/[^\d]/g, "");
    if (!digits) {
        return "";
    }

    return new Intl.NumberFormat("en-TZ").format(Number(digits));
}

function getRepaymentPeriodsPerYear(frequency: LoanRepaymentFrequency) {
    if (frequency === "daily") {
        return 365;
    }

    if (frequency === "weekly") {
        return 52;
    }

    return 12;
}

function getRepaymentFrequencyLabel(frequency: LoanRepaymentFrequency) {
    if (frequency === "daily") {
        return "Daily";
    }

    if (frequency === "weekly") {
        return "Weekly";
    }

    return "Monthly";
}

function estimateInstallment(amount: number, annualRate: number, termCount: number, frequency: LoanRepaymentFrequency) {
    if (!(amount > 0) || !(termCount > 0)) {
        return null;
    }

    const ratePerPeriod = annualRate > 0 ? (annualRate / 100) / getRepaymentPeriodsPerYear(frequency) : 0;

    let installment = amount / termCount;
    if (ratePerPeriod > 0) {
        installment = amount * ratePerPeriod / (1 - Math.pow(1 + ratePerPeriod, -termCount));
    }

    const totalRepayment = installment * termCount;
    return {
        installment,
        totalRepayment
    };
}

const loanApplicationSchema = z.object({
    product_id: z.string().uuid("Select a loan product."),
    purpose: z.string()
        .transform((value) => sanitizeLoanPurpose(value))
        .refine((value) => value.length >= 20, "Loan purpose must be at least 20 characters")
        .refine((value) => value.length <= 500, "Loan purpose cannot exceed 500 characters")
        .refine((value) => loanPurposePattern.test(value), "Loan purpose may contain only letters, numbers, spaces, commas, and periods"),
    requested_amount: z.coerce.number().min(10000, "Requested amount must be at least TZS 10,000"),
    requested_term_count: z.coerce.number().int("Loan term must be a whole number").min(1, "Loan term must be at least 1 month"),
    requested_repayment_frequency: z.enum(["daily", "weekly", "monthly"]).default("monthly"),
    requested_interest_rate: z.coerce.number().min(0).max(100),
    external_reference: z.string()
        .transform((value) => sanitizeLoanReference(value))
        .refine((value) => !value || value.length <= 100, "Application reference cannot exceed 100 characters")
        .refine((value) => !value || loanReferencePattern.test(value), "Reference may contain only letters, numbers, dashes, and underscores")
        .optional()
        .or(z.literal("")),
    confirmation_checked: z.boolean().refine((value) => value, {
        message: "Confirm the application details before submission."
    })
});

type LoanApplicationValues = z.infer<typeof loanApplicationSchema>;

const contributionPaymentSchema = z.object({
    account_id: z.string().uuid("Select an account.").optional().or(z.literal("")),
    loan_id: z.string().uuid("Select a loan.").optional().or(z.literal("")),
    amount: z.coerce.number().positive("Enter a contribution amount.").multipleOf(0.01, "Use up to two decimal places."),
    provider: z.enum(["airtel", "vodacom", "tigo", "halopesa"]),
    msisdn: z.string().trim().min(9, "Phone number is required.").max(20, "Phone number is too long."),
    description: z.string().trim().max(255).optional().or(z.literal(""))
});

type ContributionPaymentValues = z.infer<typeof contributionPaymentSchema>;
type MemberPaymentPurpose = "share_contribution" | "savings_deposit" | "membership_fee" | "loan_repayment";
type DateRangePreset = "month" | "quarter" | "year" | "custom";

interface DateRangeState {
    preset: DateRangePreset;
    from: string;
    to: string;
}

function groupBalances(statements: StatementRow[]) {
    return statements
        .slice()
        .reverse()
        .slice(-8)
        .map((entry) => ({
            label: formatDate(entry.transaction_date),
            balance: entry.running_balance,
            amount: entry.amount
        }));
}

function groupSavingsByMonth(statements: StatementRow[]) {
    const monthly = new Map<string, { label: string; balance: number; date: number }>();

    statements.forEach((entry) => {
        const date = new Date(entry.created_at || entry.transaction_date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const existing = monthly.get(key);
        const timestamp = date.getTime();

        if (!existing || existing.date < timestamp) {
            monthly.set(key, {
                label: new Intl.DateTimeFormat("en-TZ", { month: "short", year: "2-digit" }).format(date),
                balance: entry.running_balance,
                date: timestamp
            });
        }
    });

    return Array.from(monthly.values())
        .sort((a, b) => a.date - b.date)
        .slice(-6);
}

function getDaysUntil(dateString?: string | null) {
    if (!dateString) {
        return null;
    }

    const target = new Date(dateString);
    const now = new Date();
    const ms = target.getTime() - now.getTime();
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function toDateInputValue(date: Date) {
    return date.toISOString().slice(0, 10);
}

function parseDateValue(value: string) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return new Date(`${value}T00:00:00`);
    }

    return new Date(value);
}

function getPresetRange(preset: DateRangePreset) {
    const now = new Date();
    const from = new Date(now);

    if (preset === "month") {
        from.setMonth(from.getMonth() - 1);
    } else if (preset === "quarter") {
        from.setMonth(from.getMonth() - 3);
    } else if (preset === "year") {
        from.setFullYear(from.getFullYear() - 1);
    }

    return {
        from: toDateInputValue(from),
        to: toDateInputValue(now)
    };
}

function isWithinDateRange(value: string | null | undefined, range: DateRangeState) {
    if (!value) {
        return false;
    }

    const date = parseDateValue(value).getTime();
    if (Number.isNaN(date)) {
        return false;
    }

    const fromDate = range.from ? parseDateValue(range.from) : null;
    const toDate = range.to ? parseDateValue(range.to) : null;

    if (fromDate) {
        fromDate.setHours(0, 0, 0, 0);
    }

    if (toDate) {
        toDate.setHours(23, 59, 59, 999);
    }

    const lower = fromDate ? fromDate.getTime() : Number.NEGATIVE_INFINITY;
    const upper = toDate ? toDate.getTime() : Number.POSITIVE_INFINITY;
    const min = Math.min(lower, upper);
    const max = Math.max(lower, upper);

    return date >= min && date <= max;
}

function formatTxType(type: string) {
    return type.replace(/_/g, " ");
}

function formatPaymentPurpose(purpose: string) {
    return purpose === "savings_deposit"
        ? "Savings deposit"
        : purpose === "share_contribution"
            ? "Share contribution"
            : purpose === "membership_fee"
                ? "Membership fee"
                : purpose === "loan_repayment"
                    ? "Loan repayment"
                : purpose.replace(/_/g, " ");
}

function formatPaymentStatus(status: string) {
    return status.replace(/_/g, " ");
}

function getAuditReference(row: StatementRow) {
    return row.reference || `AUD-${row.transaction_id.slice(0, 8).toUpperCase()}`;
}

function getMemberApplicationMessage(status: MemberApplicationStatus) {
    switch (status) {
        case "draft":
            return "Complete and submit your application so the branch can start the review.";
        case "submitted":
        case "under_review":
            return "Your application is under review. You will receive a notification once the branch responds.";
        case "approved_pending_payment":
            return "You are approved. Please complete the membership fee payment to unlock your accounts.";
        case "approved":
            return "Your application is approved and your membership is being activated.";
        case "rejected":
            return "Your application was rejected. Please reach out to your branch for next steps.";
        case "cancelled":
            return "Your application was cancelled. Contact your branch to reopen it or start a new request.";
        default:
            return "Your application is being processed. We will update you soon.";
    }
}

function estimatePenaltyForSchedule(schedule: LoanSchedule) {
    if (schedule.status !== "overdue") {
        return 0;
    }

    const outstanding = Math.max(schedule.principal_due - schedule.principal_paid, 0) + Math.max(schedule.interest_due - schedule.interest_paid, 0);
    return outstanding * 0.02;
}

function getLoanScheduleOutstanding(schedule: LoanSchedule) {
    const principalOutstanding = Math.max(Number(schedule.principal_due || 0) - Number(schedule.principal_paid || 0), 0);
    const interestOutstanding = Math.max(Number(schedule.interest_due || 0) - Number(schedule.interest_paid || 0), 0);

    return {
        principalOutstanding,
        interestOutstanding,
        totalOutstanding: principalOutstanding + interestOutstanding
    };
}

function buildRepaymentInsights(loan: Loan | null, schedules: LoanSchedule[], amount: number) {
    const normalizedAmount = Math.max(Number(amount || 0), 0);
    const orderedSchedules = [...schedules].sort(
        (left, right) =>
            new Date(left.due_date).getTime() - new Date(right.due_date).getTime()
            || left.installment_number - right.installment_number
    );
    const today = new Date().toISOString().slice(0, 10);
    const overdueSchedules = orderedSchedules.filter((schedule) => schedule.due_date < today);
    const nextDueSchedule = orderedSchedules[0] || null;
    const overdueAmount = overdueSchedules.reduce((sum, schedule) => sum + getLoanScheduleOutstanding(schedule).totalOutstanding, 0);
    const nextDueAmount = nextDueSchedule ? getLoanScheduleOutstanding(nextDueSchedule).totalOutstanding : 0;
    const scheduledInterestOutstanding = orderedSchedules.reduce((sum, schedule) => sum + getLoanScheduleOutstanding(schedule).interestOutstanding, 0);
    const scheduledPrincipalOutstanding = orderedSchedules.reduce((sum, schedule) => sum + getLoanScheduleOutstanding(schedule).principalOutstanding, 0);
    const payableInterest = Math.max(Number(loan?.accrued_interest || 0), scheduledInterestOutstanding);
    const outstandingBalance = Number(loan?.outstanding_principal || 0) + payableInterest;
    const dueNowAmount = overdueAmount > 0 ? overdueAmount : nextDueAmount;
    const recommendedAmount = dueNowAmount > 0 ? Math.min(dueNowAmount, outstandingBalance) : outstandingBalance;
    const interestAllocation = Math.min(normalizedAmount, payableInterest);
    const principalAllocation = Math.min(Math.max(normalizedAmount - interestAllocation, 0), Number(loan?.outstanding_principal || 0));
    const excessOverOutstanding = Math.max(normalizedAmount - outstandingBalance, 0);
    const shortfallAmount = dueNowAmount > 0 ? Math.max(dueNowAmount - normalizedAmount, 0) : 0;
    const extraAmount = dueNowAmount > 0 ? Math.max(normalizedAmount - dueNowAmount, 0) : 0;

    return {
        overdueSchedules,
        nextDueSchedule,
        overdueAmount,
        nextDueAmount,
        dueNowAmount,
        scheduledInterestOutstanding,
        scheduledPrincipalOutstanding,
        payableInterest,
        outstandingBalance,
        recommendedAmount,
        interestAllocation,
        principalAllocation,
        excessOverOutstanding,
        shortfallAmount,
        extraAmount,
        enteredAmount: normalizedAmount,
        matchesDueNow: dueNowAmount > 0 && Math.abs(normalizedAmount - dueNowAmount) < 0.005
    };
}

const contributionProviderOptions: Array<{ value: ContributionPaymentValues["provider"]; label: string; helper: string }> = [
    { value: "vodacom", label: "Vodacom M-Pesa", helper: "Best for members paying with M-Pesa." },
    { value: "airtel", label: "Airtel Money", helper: "Use Airtel Money on the registered phone number." },
    { value: "tigo", label: "Mixx by Yas (Tigo)", helper: "Use Mixx by Yas on numbers previously registered with Tigo." },
    { value: "halopesa", label: "HaloPesa", helper: "Use HaloPesa when your phone is registered there." }
];

const PAYMENT_APPROVAL_EXPECTATION_MS = 90 * 1000;
const PAYMENT_PENDING_POLL_MS = 4000;
const PAYMENT_HANDSET_RESPONSE_POLL_MS = 2000;

const portalSections = [
    {
        id: "member-overview",
        label: "Overview",
        subtitle: "Review your balances, obligations, and recent financial position.",
        icon: AutoGraphRoundedIcon
    },
    {
        id: "member-accounts",
        label: "Accounts",
        subtitle: "Inspect savings and share accounts linked to your membership.",
        icon: WalletRoundedIcon
    },
    {
        id: "member-loans",
        label: "Loans",
        subtitle: "Track outstanding facilities, accrued interest, and repayment position.",
        icon: CreditScoreRoundedIcon
    },
    {
        id: "member-transactions",
        label: "Transactions",
        subtitle: "Review posted transaction activity and running balances.",
        icon: TimelineRoundedIcon
    },
    {
        id: "member-contributions",
        label: "Contributions",
        subtitle: "Monitor share contributions and dividend allocations credited to you.",
        icon: AccountBalanceWalletRoundedIcon
    },
    {
        id: "member-payments",
        label: "Payments",
        subtitle: "Track Mobile Money requests, failures, and posted mobile money receipts.",
        icon: WorkspacesRoundedIcon
    }
] as const;

const contentCardSx = {
    width: { xs: "calc(100vw - 20px)", sm: "100%" },
    maxWidth: { xs: "calc(100vw - 20px)", sm: "100%" },
    minWidth: 0,
    boxSizing: "border-box",
    borderRadius: 2,
    borderColor: "divider",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)"
} as const;
const DARK_MEMBER_ACCENT = "#D9B273";
const DARK_MEMBER_ACCENT_DEEP = "#C89B52";

type PortalSectionId = (typeof portalSections)[number]["id"];

interface MetricCardProps {
    icon: typeof WalletRoundedIcon;
    label: string;
    value: string | number;
    helper: string;
    tone: "primary" | "success" | "warning" | "danger";
    delta?: string;
}

function getToneStyles(tone: MetricCardProps["tone"], mode: "light" | "dark") {
    if (tone === "success") {
        return {
            color: brandColors.success,
            bg: alpha(brandColors.success, mode === "dark" ? 0.16 : 0.1),
            softBg: mode === "dark"
                ? `linear-gradient(180deg, ${alpha(brandColors.success, 0.14)} 0%, ${alpha(darkThemeColors.paper, 0.82)} 100%)`
                : `linear-gradient(180deg, ${alpha("#F3FBF6", 0.98)} 0%, ${alpha("#FFFFFF", 0.96)} 100%)`,
            border: alpha(brandColors.success, mode === "dark" ? 0.24 : 0.16),
            shadow: mode === "dark"
                ? `0 14px 28px ${alpha(brandColors.success, 0.08)}`
                : `0 14px 28px ${alpha(brandColors.success, 0.09)}`,
            glow: alpha(brandColors.success, mode === "dark" ? 0.18 : 0.12)
        };
    }

    if (tone === "warning") {
        return {
            color: brandColors.warning,
            bg: alpha(brandColors.warning, mode === "dark" ? 0.18 : 0.12),
            softBg: mode === "dark"
                ? `linear-gradient(180deg, ${alpha(brandColors.warning, 0.14)} 0%, ${alpha(darkThemeColors.paper, 0.82)} 100%)`
                : `linear-gradient(180deg, ${alpha("#FFF8EB", 0.98)} 0%, ${alpha("#FFFFFF", 0.96)} 100%)`,
            border: alpha(brandColors.warning, mode === "dark" ? 0.24 : 0.16),
            shadow: mode === "dark"
                ? `0 14px 28px ${alpha(brandColors.warning, 0.08)}`
                : `0 14px 28px ${alpha(brandColors.warning, 0.1)}`,
            glow: alpha(brandColors.warning, mode === "dark" ? 0.2 : 0.12)
        };
    }

    if (tone === "danger") {
        return {
            color: brandColors.danger,
            bg: alpha(brandColors.danger, mode === "dark" ? 0.16 : 0.1),
            softBg: mode === "dark"
                ? `linear-gradient(180deg, ${alpha(brandColors.danger, 0.12)} 0%, ${alpha(darkThemeColors.paper, 0.84)} 100%)`
                : `linear-gradient(180deg, ${alpha("#FFF4F4", 0.98)} 0%, ${alpha("#FFFFFF", 0.96)} 100%)`,
            border: alpha(brandColors.danger, mode === "dark" ? 0.22 : 0.15),
            shadow: mode === "dark"
                ? `0 14px 28px ${alpha(brandColors.danger, 0.08)}`
                : `0 14px 28px ${alpha(brandColors.danger, 0.08)}`,
            glow: alpha(brandColors.danger, mode === "dark" ? 0.18 : 0.1)
        };
    }

    const primaryTone = mode === "dark" ? DARK_MEMBER_ACCENT : brandColors.primary[700];
    const primaryTint = mode === "dark" ? DARK_MEMBER_ACCENT : brandColors.primary[500];

    return {
        color: primaryTone,
        bg: mode === "dark"
            ? alpha(DARK_MEMBER_ACCENT, 0.2)
            : alpha(brandColors.primary[500], 0.1),
        softBg: mode === "dark"
            ? `linear-gradient(180deg, ${alpha(DARK_MEMBER_ACCENT, 0.16)} 0%, ${alpha(darkThemeColors.paper, 0.82)} 100%)`
            : `linear-gradient(180deg, ${alpha("#F3F7FF", 0.98)} 0%, ${alpha("#FFFFFF", 0.96)} 100%)`,
        border: alpha(primaryTint, mode === "dark" ? 0.24 : 0.16),
        shadow: mode === "dark"
            ? `0 14px 28px ${alpha(primaryTint, 0.08)}`
            : `0 14px 28px ${alpha(primaryTint, 0.1)}`,
        glow: alpha(primaryTint, mode === "dark" ? 0.2 : 0.12)
    };
}

function MetricCard({ icon: Icon, label, value, helper, tone, delta }: MetricCardProps) {
    const theme = useTheme();
    const toneStyles = getToneStyles(tone, theme.palette.mode);

    return (
        <MotionCard
            variant="outlined"
            sx={{
                ...contentCardSx,
                overflow: "hidden",
                position: "relative",
                background: toneStyles.softBg,
                borderColor: toneStyles.border,
                boxShadow: toneStyles.shadow,
                "&::before": {
                    content: '""',
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 4,
                    background: `linear-gradient(90deg, ${toneStyles.color}, ${toneStyles.glow})`
                }
            }}
        >
            <CardContent sx={{ p: 2.25 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
                    <Box
                        sx={{
                            width: 46,
                            height: 46,
                            borderRadius: 2.2,
                            display: "grid",
                            placeItems: "center",
                            bgcolor: toneStyles.bg,
                            color: toneStyles.color,
                            border: `1px solid ${toneStyles.border}`,
                            boxShadow: `inset 0 1px 0 ${alpha("#FFFFFF", theme.palette.mode === "dark" ? 0.02 : 0.5)}`
                        }}
                    >
                        <Icon fontSize="small" />
                    </Box>
                    <Typography
                        variant="caption"
                        sx={{
                            fontWeight: 700,
                            color: toneStyles.color,
                            bgcolor: alpha(toneStyles.color, theme.palette.mode === "dark" ? 0.14 : 0.08),
                            px: 1,
                            py: 0.45,
                            borderRadius: 99,
                            border: `1px solid ${alpha(toneStyles.color, theme.palette.mode === "dark" ? 0.18 : 0.12)}`
                        }}
                    >
                        {delta || "Live"}
                    </Typography>
                </Stack>
                <Typography variant="h5" sx={{ mt: 2.25, mb: 0.35, fontWeight: 700 }}>
                    {value}
                </Typography>
                <Typography variant="overline" color="text.secondary">
                    {label}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                    {helper}
                </Typography>
            </CardContent>
        </MotionCard>
    );
}

function AccountSummaryCard({ icon: Icon, label, value, helper, tone, delta }: MetricCardProps) {
    const theme = useTheme();
    const toneStyles = getToneStyles(tone, theme.palette.mode);

    return (
        <MotionCard
            variant="outlined"
            sx={{
                ...contentCardSx,
                height: "100%",
                overflow: "hidden",
                background: toneStyles.softBg,
                borderColor: toneStyles.border,
                boxShadow: toneStyles.shadow,
                position: "relative",
                "&::before": {
                    content: '""',
                    position: "absolute",
                    inset: "0 auto 0 0",
                    width: 4,
                    background: `linear-gradient(180deg, ${toneStyles.color}, ${toneStyles.glow})`
                }
            }}
        >
            <CardContent sx={{ p: 2.25, height: "100%", display: "flex" }}>
                <Stack spacing={1.4} sx={{ width: 1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Chip
                            size="small"
                            label={delta || "Live"}
                            sx={{
                                borderRadius: 1.25,
                                bgcolor: toneStyles.bg,
                                color: toneStyles.color,
                                fontWeight: 700,
                                border: `1px solid ${toneStyles.border}`
                            }}
                        />
                        <Box
                            sx={{
                                width: 38,
                                height: 38,
                                borderRadius: 1.5,
                                display: "grid",
                                placeItems: "center",
                                bgcolor: toneStyles.bg,
                                color: toneStyles.color,
                                border: `1px solid ${toneStyles.border}`
                            }}
                        >
                            <Icon fontSize="small" />
                        </Box>
                    </Stack>

                    <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                        {value}
                    </Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {helper}
                    </Typography>

                    <Box sx={{ mt: "auto", height: 4, borderRadius: 999, bgcolor: alpha(toneStyles.color, 0.18) }}>
                        <Box sx={{ height: 1, width: "56%", borderRadius: 999, bgcolor: toneStyles.color }} />
                    </Box>
                </Stack>
            </CardContent>
        </MotionCard>
    );
}

export function MemberPortalPage() {
    const theme = useTheme();
    const navigate = useNavigate();
    const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
    const { profile, selectedTenantName, selectedBranchName, signOut, user, twoFactorSetupRequired } = useAuth();
    const canUsePortalDeposits = true;
    const { pushToast } = useToast();
    const { theme: themeMode, toggleTheme } = useUI();
    const prefersReducedMotion = useReducedMotionSafe();
    const [memberRecord, setMemberRecord] = useState<Member | null>(null);
    const [memberApplication, setMemberApplication] = useState<MemberApplication | null>(null);
    const [accounts, setAccounts] = useState<MemberAccount[]>([]);
    const [memberId, setMemberId] = useState("");
    const [loans, setLoans] = useState<Loan[]>([]);
    const [loanSchedules, setLoanSchedules] = useState<LoanSchedule[]>([]);
    const [loanProducts, setLoanProducts] = useState<LoanProduct[]>([]);
    const [loanApplications, setLoanApplications] = useState<LoanApplication[]>([]);
    const [guarantorRequests, setGuarantorRequests] = useState<GuarantorRequestItem[]>([]);
    const [processingGuarantorRequestId, setProcessingGuarantorRequestId] = useState<string | null>(null);
    const [statements, setStatements] = useState<StatementRow[]>([]);
    const [loanTransactions, setLoanTransactions] = useState<LoanTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [warning, setWarning] = useState<string | null>(null);
    const [showApplyDialog, setShowApplyDialog] = useState(false);
    const [editingLoanApplicationId, setEditingLoanApplicationId] = useState<string | null>(null);
    const [deletingLoanApplicationId, setDeletingLoanApplicationId] = useState<string | null>(null);
    const [pendingDraftDeletion, setPendingDraftDeletion] = useState<LoanApplication | null>(null);
    const [loanFormStep, setLoanFormStep] = useState(0);
    const [loanCapacity, setLoanCapacity] = useState<LoanCapacitySummary | null>(null);
    const [loanCapacityLoading, setLoanCapacityLoading] = useState(false);
    const [loanCapacityError, setLoanCapacityError] = useState<string | null>(null);
    const [dashboardLoanCapacity, setDashboardLoanCapacity] = useState<LoanCapacitySummary | null>(null);
    const [dashboardLoanCapacityLoading, setDashboardLoanCapacityLoading] = useState(false);
    const [dashboardLoanCapacityError, setDashboardLoanCapacityError] = useState<string | null>(null);
    const [showContributionDialog, setShowContributionDialog] = useState(false);
    const [submittingApplication, setSubmittingApplication] = useState(false);
    const [submittingContribution, setSubmittingContribution] = useState(false);
    const [reconcilingPayment, setReconcilingPayment] = useState(false);
    const [checkingPaymentStatus, setCheckingPaymentStatus] = useState(false);
    const [phoneCancellationRequested, setPhoneCancellationRequested] = useState(false);
    const [paymentFlowPurpose, setPaymentFlowPurpose] = useState<MemberPaymentPurpose>("share_contribution");
    const [paymentOrder, setPaymentOrder] = useState<PaymentOrder | null>(null);
    const [paymentOrders, setPaymentOrders] = useState<PaymentOrder[]>([]);
    const [lastPaymentToastStatus, setLastPaymentToastStatus] = useState<PaymentOrder["status"] | null>(null);
    const [activeContributionOrderId, setActiveContributionOrderId] = useState<string | null>(null);
    const [selectedPaymentReceipt, setSelectedPaymentReceipt] = useState<PaymentOrder | null>(null);
    const [activeSection, setActiveSection] = useState<PortalSectionId>(portalSections[0].id);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [profileMenuAnchor, setProfileMenuAnchor] = useState<null | HTMLElement>(null);
    const [transactionsRange] = useState<DateRangeState>({ preset: "custom", from: "", to: "" });
    const [contributionsRange] = useState<DateRangeState>({ preset: "custom", from: "", to: "" });
    const [loansRange] = useState<DateRangeState>({ preset: "custom", from: "", to: "" });
    const [accountsRange] = useState<DateRangeState>({ preset: "custom", from: "", to: "" });
    const [transactionTypeFilter, setTransactionTypeFilter] = useState<string>("all");
    const [transactionSearch, setTransactionSearch] = useState("");
    const [disputedTransactionIds, setDisputedTransactionIds] = useState<string[]>([]);
    const [transactionsPage, setTransactionsPage] = useState(0);
    const [transactionsRowsPerPage, setTransactionsRowsPerPage] = useState(10);
    const [contributionsPage, setContributionsPage] = useState(0);
    const [contributionsRowsPerPage, setContributionsRowsPerPage] = useState(10);
    const [paymentsPage, setPaymentsPage] = useState(0);
    const [paymentsRowsPerPage, setPaymentsRowsPerPage] = useState(10);
    const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");
    const [paymentPurposeFilter, setPaymentPurposeFilter] = useState<string>("all");
    const [accountsPage, setAccountsPage] = useState(0);
    const [accountsRowsPerPage, setAccountsRowsPerPage] = useState(10);
    const [loanSchedulePage, setLoanSchedulePage] = useState(0);
    const [loanScheduleRowsPerPage, setLoanScheduleRowsPerPage] = useState(10);
    const [loanDetailId, setLoanDetailId] = useState<string>("");
    const [prepaymentAmount, setPrepaymentAmount] = useState<number>(0);
    const [requestedAmountInput, setRequestedAmountInput] = useState("");
    const loanApplicationForm = useForm<LoanApplicationValues>({
        resolver: zodResolver(loanApplicationSchema),
        mode: "onChange",
        reValidateMode: "onChange",
        defaultValues: {
            product_id: "",
            purpose: "",
            requested_amount: 0,
            requested_term_count: 12,
            requested_repayment_frequency: "monthly",
            requested_interest_rate: 0,
            external_reference: "",
            confirmation_checked: false
        }
    });
    const contributionPaymentForm = useForm<ContributionPaymentValues>({
        resolver: zodResolver(contributionPaymentSchema),
        defaultValues: {
            account_id: "",
            loan_id: "",
            amount: 0,
            provider: "vodacom",
            msisdn: profile?.phone || "",
            description: ""
        }
    });
    const requiresMembershipFeePayment = memberApplication?.status === "approved_pending_payment";
    const canUsePortalPayments = canUsePortalDeposits || requiresMembershipFeePayment;
    const membershipFeeOutstanding = Math.max(
        Number(memberApplication?.membership_fee_amount || 0) - Number(memberApplication?.membership_fee_paid || 0),
        0
    );
    const canShowMembershipFeePaymentOption = requiresMembershipFeePayment && membershipFeeOutstanding > 0;
    const selectedLoanProductId = loanApplicationForm.watch("product_id");
    const requestedLoanTerm = loanApplicationForm.watch("requested_term_count");
    const requestedLoanAmount = loanApplicationForm.watch("requested_amount");
    const requestedLoanFrequency = loanApplicationForm.watch("requested_repayment_frequency");
    const selectedLoanProduct = useMemo(
        () => loanProducts.find((product) => product.id === selectedLoanProductId) || null,
        [loanProducts, selectedLoanProductId]
    );
    const dashboardLoanProduct = useMemo(
        () => loanProducts.find((product) => product.status === "active" && product.is_default)
            || loanProducts.find((product) => product.status === "active")
            || null,
        [loanProducts]
    );
    const selectedLoanBranchId = memberRecord?.branch_id || profile?.branch_id || "";
    const selectedLoanPolicy = useMemo(
        () => resolveLoanEligibilityPolicy(selectedLoanProduct),
        [selectedLoanProduct]
    );
    const latestStatementBalanceByAccountId = useMemo(() => {
        const latestBalances = new Map<string, { createdAt: number; runningBalance: number }>();

        for (const row of statements) {
            const createdAt = new Date(row.created_at || row.transaction_date || 0).getTime();
            const current = latestBalances.get(row.account_id);

            if (!current || createdAt >= current.createdAt) {
                latestBalances.set(row.account_id, {
                    createdAt,
                    runningBalance: Number(row.running_balance || 0)
                });
            }
        }

        return new Map(
            Array.from(latestBalances.entries()).map(([accountId, entry]) => [accountId, entry.runningBalance])
        );
    }, [statements]);
    const savingsEligibilityBalance = useMemo(
        () => accounts
            .filter((account) => account.status === "active" && account.product_type === "savings")
            .reduce(
                (sum, account) => sum + (
                    latestStatementBalanceByAccountId.has(account.id)
                        ? Number(latestStatementBalanceByAccountId.get(account.id) || 0)
                        : Number(account.available_balance || 0)
                ),
                0
            ),
        [accounts, latestStatementBalanceByAccountId]
    );
    const sharesEligibilityBalance = useMemo(
        () => accounts
            .filter((account) => account.status === "active" && account.product_type === "shares")
            .reduce(
                (sum, account) => sum + (
                    latestStatementBalanceByAccountId.has(account.id)
                        ? Number(latestStatementBalanceByAccountId.get(account.id) || 0)
                        : Number(account.available_balance || 0)
                ),
                0
            ),
        [accounts, latestStatementBalanceByAccountId]
    );
    const selectedLoanEligibleAmount = useMemo(() => {
        if (!selectedLoanProduct) {
            return 0;
        }

        let eligibleAmount = selectedLoanPolicy.baseEligibilityAmount
            + savingsEligibilityBalance * selectedLoanPolicy.savingsMultiplier
            + sharesEligibilityBalance * selectedLoanPolicy.sharesMultiplier;

        if (selectedLoanPolicy.eligibilityCapAmount !== null) {
            eligibleAmount = Math.min(eligibleAmount, selectedLoanPolicy.eligibilityCapAmount);
        }

        if (selectedLoanProduct.max_amount) {
            eligibleAmount = Math.min(eligibleAmount, Number(selectedLoanProduct.max_amount));
        }

        return Math.max(0, eligibleAmount);
    }, [selectedLoanPolicy, selectedLoanProduct, savingsEligibilityBalance, sharesEligibilityBalance]);
    const selectedLoanMinimumAmount = useMemo(
        () => Math.max(10000, Number(loanCapacity?.minimum_loan_amount ?? selectedLoanProduct?.min_amount ?? 0)),
        [loanCapacity, selectedLoanProduct]
    );
    const selectedLoanBorrowLimit = useMemo(
        () => loanCapacity?.borrow_limit ?? selectedLoanEligibleAmount,
        [loanCapacity, selectedLoanEligibleAmount]
    );
    const selectedLoanPoolFrozen = Boolean(loanCapacity?.loan_pool_frozen);
    const requestedBorrowUtilizationPercent = useMemo(() => {
        if (!selectedLoanBorrowLimit || selectedLoanBorrowLimit <= 0) {
            return null;
        }

        return (Number(requestedLoanAmount || 0) / selectedLoanBorrowLimit) * 100;
    }, [requestedLoanAmount, selectedLoanBorrowLimit]);
    const requestedBorrowUtilizationTone = useMemo(() => {
        if (requestedBorrowUtilizationPercent === null) {
            return brandColors.success;
        }

        if (requestedBorrowUtilizationPercent > 100) {
            return brandColors.danger;
        }

        if (requestedBorrowUtilizationPercent >= 80) {
            return brandColors.warning;
        }

        return brandColors.success;
    }, [requestedBorrowUtilizationPercent]);
    const selectedLoanLiquidityRatio = useMemo(
        () => (loanCapacity && loanCapacity.total_deposits > 0
            ? loanCapacity.available_for_loans / loanCapacity.total_deposits
            : 0),
        [loanCapacity]
    );
    const selectedLoanMinimumTerm = useMemo(
        () => Math.max(1, Number(selectedLoanProduct?.min_term_count || 1)),
        [selectedLoanProduct]
    );
    const selectedLoanMaximumTerm = useMemo(
        () => (selectedLoanProduct?.max_term_count ? Number(selectedLoanProduct.max_term_count) : null),
        [selectedLoanProduct]
    );
    const selectedLoanConflict = useMemo(
        () => loanApplications.find((application) =>
            application.id !== editingLoanApplicationId
            && ["submitted", "appraised", "approved"].includes(application.status)
        ) || null,
        [editingLoanApplicationId, loanApplications]
    );
    const editingLoanApplication = useMemo(
        () => loanApplications.find((application) => application.id === editingLoanApplicationId) || null,
        [editingLoanApplicationId, loanApplications]
    );
    const selectedLoanDraft = useMemo(
        () => loanApplications.find((application) =>
            application.id !== editingLoanApplicationId
            && application.status === "draft"
        ) || null,
        [editingLoanApplicationId, loanApplications]
    );
    const isEditingDraftLoanApplication = editingLoanApplication?.status === "draft";
    const isEditingRejectedLoanApplication = editingLoanApplication?.status === "rejected";
    const memberHasProblemLoan = useMemo(
        () => loans.some((loan) => ["in_arrears", "written_off"].includes(loan.status)),
        [loans]
    );
    const loanSubmissionLocks = useMemo(() => {
        const locks: string[] = [];

        if (!selectedLoanProduct) {
            locks.push("Select a loan product to continue.");
        }

        if (memberRecord?.status !== "active") {
            locks.push("Your member profile is not active, so loan submission is locked.");
        }

        if (memberHasProblemLoan) {
            locks.push("You have an in-arrears or written-off loan that must be resolved first.");
        }

        if (selectedLoanConflict) {
            locks.push(`You already have a ${selectedLoanConflict.status} loan application in progress.`);
        }

        return locks;
    }, [
        memberHasProblemLoan,
        memberRecord?.status,
        selectedLoanConflict,
        selectedLoanProduct
    ]);
    const loanCapacityWarnings = useMemo(() => {
        const warnings: string[] = [];

        if (selectedLoanProduct && loanCapacityError) {
            warnings.push("Current borrowing capacity could not be refreshed. You can still submit, but the branch will re-check the live limit during review.");
        }

        if (selectedLoanPoolFrozen) {
            warnings.push("Loan pool liquidity is currently constrained. New requests may take longer to review and may not clear until liquidity improves.");
        }

        if (selectedLoanProduct && loanCapacity && selectedLoanBorrowLimit < selectedLoanMinimumAmount) {
            warnings.push(`Your current maximum borrow limit of ${formatCurrency(selectedLoanBorrowLimit)} is below this product minimum of ${formatCurrency(selectedLoanMinimumAmount)}.`);
        }

        return warnings;
    }, [
        loanCapacity,
        loanCapacityError,
        selectedLoanBorrowLimit,
        selectedLoanMinimumAmount,
        selectedLoanPoolFrozen,
        selectedLoanProduct
    ]);
    const requestedAmountExceedsBorrowLimit = useMemo(
        () => Boolean(selectedLoanProduct && loanCapacity && requestedLoanAmount > selectedLoanBorrowLimit),
        [loanCapacity, requestedLoanAmount, selectedLoanBorrowLimit, selectedLoanProduct]
    );
    const requestedAmountCapacityWarning = useMemo(() => {
        if (!requestedAmountExceedsBorrowLimit) {
            return null;
        }

        return `Requested amount exceeds your recommended borrowing capacity. Recommended maximum: ${formatCurrency(selectedLoanBorrowLimit)}.`;
    }, [requestedAmountExceedsBorrowLimit, selectedLoanBorrowLimit]);
    const liquidityApproachingFreeze = useMemo(() => {
        if (!loanCapacity || selectedLoanPoolFrozen || loanCapacity.total_deposits <= 0) {
            return false;
        }

        const warningThreshold = Math.min(1, Number(loanCapacity.auto_loan_freeze_threshold || 0) + 0.1);
        return selectedLoanLiquidityRatio > 0 && selectedLoanLiquidityRatio <= warningThreshold;
    }, [loanCapacity, selectedLoanLiquidityRatio, selectedLoanPoolFrozen]);
    const loanLiquidityNotice = useMemo(() => {
        if (!liquidityApproachingFreeze) {
            return null;
        }

        return "Loan pool liquidity is currently limited. Loan approvals may take longer.";
    }, [liquidityApproachingFreeze]);
    const loanApplicationSteps = [
        {
            label: "Product",
            description: "Choose the loan product and review its configured terms."
        },
        {
            label: "Eligibility",
            description: "Review your live borrowing capacity and SACCO liquidity guidance."
        },
        {
            label: "Details",
            description: "Enter the amount, purpose, term, and repayment structure."
        },
        {
            label: "Review",
            description: "Confirm the application summary before sending it for appraisal."
        }
    ] as const;
    const loanStepProgressPercent = ((loanFormStep + 1) / loanApplicationSteps.length) * 100;
    const isLoanProductStep = loanFormStep === 0;
    const isLoanEligibilityStep = loanFormStep === 1;
    const isLoanDetailsStep = loanFormStep === 2;
    const isLoanReviewStep = loanFormStep === loanApplicationSteps.length - 1;
    const visibleLoanFormErrors = useMemo(
        () =>
            Object.values(loanApplicationForm.formState.errors)
                .map((entry) => entry?.message)
                .filter((message): message is string => Boolean(message)),
        [loanApplicationForm.formState.errors]
    );
    const installmentPreview = useMemo(
        () => estimateInstallment(
            Number(requestedLoanAmount || 0),
            Number(selectedLoanProduct?.annual_interest_rate || 0),
            Number(requestedLoanTerm || 0),
            requestedLoanFrequency
        ),
        [requestedLoanAmount, requestedLoanFrequency, requestedLoanTerm, selectedLoanProduct]
    );

    const getSupabaseErrorMessage = (value: unknown, fallback: string) => {
        if (value && typeof value === "object" && "message" in value && typeof value.message === "string") {
            return value.message;
        }

        return fallback;
    };

    useEffect(() => {
        let cancelled = false;

        if (!showApplyDialog || !profile?.tenant_id || !memberRecord?.id || !selectedLoanProductId || !selectedLoanBranchId) {
            setLoanCapacity(null);
            setLoanCapacityError(null);
            setLoanCapacityLoading(false);
            return () => {
                cancelled = true;
            };
        }

        setLoanCapacityLoading(true);
        setLoanCapacityError(null);

        void api.get<LoanCapacityResponse>(endpoints.loanCapacity.capacity(), {
            params: {
                tenant_id: profile.tenant_id,
                member_id: memberRecord.id,
                loan_product_id: selectedLoanProductId,
                branch_id: selectedLoanBranchId
            }
        })
            .then(({ data }) => {
                if (cancelled) {
                    return;
                }

                setLoanCapacity(data.data || null);
            })
            .catch((capacityError) => {
                if (cancelled) {
                    return;
                }

                setLoanCapacity(null);
                setLoanCapacityError(getApiErrorMessage(capacityError, "Unable to load current borrowing capacity."));
            })
            .finally(() => {
                if (!cancelled) {
                    setLoanCapacityLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [memberRecord?.id, profile?.tenant_id, selectedLoanBranchId, selectedLoanProductId, showApplyDialog]);

    useEffect(() => {
        let cancelled = false;

        if (!profile?.tenant_id || !memberRecord?.id || !selectedLoanBranchId || !dashboardLoanProduct?.id) {
            setDashboardLoanCapacity(null);
            setDashboardLoanCapacityError(null);
            setDashboardLoanCapacityLoading(false);
            return () => {
                cancelled = true;
            };
        }

        setDashboardLoanCapacityLoading(true);
        setDashboardLoanCapacityError(null);

        void api.get<LoanCapacityResponse>(endpoints.loanCapacity.capacity(), {
            params: {
                tenant_id: profile.tenant_id,
                member_id: memberRecord.id,
                loan_product_id: dashboardLoanProduct.id,
                branch_id: selectedLoanBranchId
            }
        })
            .then(({ data }) => {
                if (cancelled) {
                    return;
                }

                setDashboardLoanCapacity(data.data || null);
            })
            .catch((capacityError) => {
                if (cancelled) {
                    return;
                }

                setDashboardLoanCapacity(null);
                setDashboardLoanCapacityError(getApiErrorMessage(capacityError, "Unable to load borrowing capacity summary."));
            })
            .finally(() => {
                if (!cancelled) {
                    setDashboardLoanCapacityLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [dashboardLoanProduct?.id, memberRecord?.id, profile?.tenant_id, selectedLoanBranchId]);

    useEffect(() => {
        if (!selectedLoanProduct) {
            loanApplicationForm.setValue("requested_interest_rate", 0, { shouldDirty: false, shouldValidate: false });
            return;
        }

        loanApplicationForm.setValue("requested_interest_rate", Number(selectedLoanProduct.annual_interest_rate || 0), {
            shouldDirty: false,
            shouldValidate: false
        });

        const nextAllowedFrequencies = selectedLoanPolicy.allowedRepaymentFrequencies;
        if (!nextAllowedFrequencies.includes(requestedLoanFrequency)) {
            loanApplicationForm.setValue("requested_repayment_frequency", nextAllowedFrequencies[0] || "monthly", {
                shouldDirty: true,
                shouldValidate: true
            });
        }
    }, [loanApplicationForm, requestedLoanFrequency, selectedLoanPolicy.allowedRepaymentFrequencies, selectedLoanProduct]);

    const normalizeContributionOrder = (order: PaymentOrder) => {
        if ((order.posted_at || order.journal_id) && order.status !== "posted") {
            return {
                ...order,
                status: "posted" as const
            };
        }

        return order;
    };

    const mergePaymentOrder = (nextOrder: PaymentOrder, markAsLatest = true) => {
        const normalizedOrder = normalizeContributionOrder(nextOrder);
        setPaymentOrders((current) => {
            const next = [normalizedOrder, ...current.filter((entry) => entry.id !== normalizedOrder.id)];
            next.sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
            return next;
        });
        if (markAsLatest) {
            setPaymentOrder(normalizedOrder);
        } else {
            setPaymentOrder((current) => (current?.id === normalizedOrder.id ? normalizedOrder : current));
        }
        setSelectedPaymentReceipt((current) => (current?.id === normalizedOrder.id ? normalizedOrder : current));
        return normalizedOrder;
    };

    const normalizedPaymentOrder = paymentOrder ? normalizeContributionOrder(paymentOrder) : null;
    const normalizedPaymentOrders = useMemo(() => paymentOrders.map((order) => normalizeContributionOrder(order)), [paymentOrders]);
    const latestSharePaymentOrder = normalizedPaymentOrders.find((order) => order.purpose === "share_contribution") || null;
    const latestSavingsPaymentOrder = normalizedPaymentOrders.find((order) => order.purpose === "savings_deposit") || null;
    const latestMembershipFeePaymentOrder = normalizedPaymentOrders.find((order) => order.purpose === "membership_fee") || null;
    const latestLoanRepaymentPaymentOrder = normalizedPaymentOrders.find((order) => order.purpose === "loan_repayment") || null;
    const trackedContributionOrder = useMemo(() => {
        if (!activeContributionOrderId) {
            return null;
        }

        return (
            normalizedPaymentOrders.find((order) => order.id === activeContributionOrderId) ||
            (normalizedPaymentOrder?.id === activeContributionOrderId ? normalizedPaymentOrder : null)
        );
    }, [activeContributionOrderId, normalizedPaymentOrder, normalizedPaymentOrders]);
    const activePaymentPurpose = trackedContributionOrder?.purpose === "savings_deposit"
        || trackedContributionOrder?.purpose === "membership_fee"
        || trackedContributionOrder?.purpose === "share_contribution"
        || trackedContributionOrder?.purpose === "loan_repayment"
        ? trackedContributionOrder.purpose
        : paymentFlowPurpose;
    const activePaymentCopy = activePaymentPurpose === "savings_deposit"
        ? {
            noun: "savings deposit",
            title: "Savings Deposit",
            accountLabel: "Savings Account",
            amountLabel: "Deposit Amount",
            helperText: "Amount to push to your phone.",
            emptyAccountMessage: "A savings account will be prepared automatically when this deposit starts."
        }
        : activePaymentPurpose === "membership_fee"
            ? {
                noun: "membership fee payment",
                title: "Membership Fee",
                accountLabel: "Savings Account",
                amountLabel: "Membership Fee Amount",
                helperText: "This amount settles the outstanding membership fee.",
                emptyAccountMessage: "A savings account will be prepared automatically when the membership fee payment starts."
            }
            : activePaymentPurpose === "loan_repayment"
                ? {
                    noun: "loan repayment",
                    title: "Loan Repayment",
                    accountLabel: "Loan Facility",
                    amountLabel: "Repayment Amount",
                    helperText: "Enter any amount up to the outstanding balance. The system allocates interest first, then principal.",
                    emptyAccountMessage: "No repayable loan is linked to this member profile right now."
                }
            : {
                noun: "share contribution",
                title: "Share Contribution",
                accountLabel: "Share Account",
                amountLabel: "Deposit Amount",
                helperText: "Amount to push to your phone.",
                emptyAccountMessage: "A share account will be prepared automatically when this contribution starts."
            };
    const contributionFlowState = submittingContribution ? "initiating" : trackedContributionOrder?.status || null;
    const pendingOrderCreatedMs = trackedContributionOrder?.created_at ? Date.parse(trackedContributionOrder.created_at) : Number.NaN;
    const pendingOrderExpiryMs = trackedContributionOrder?.expires_at ? Date.parse(trackedContributionOrder.expires_at) : Number.NaN;
    const pendingOrderElapsedMs = Number.isFinite(pendingOrderCreatedMs)
        ? Math.max(Date.now() - pendingOrderCreatedMs, 0)
        : 0;
    const pendingOrderMinutesRemaining = Number.isFinite(pendingOrderExpiryMs)
        ? Math.max(Math.ceil((pendingOrderExpiryMs - Date.now()) / 60000), 0)
        : null;
    const pendingOrderExpiryLabel = trackedContributionOrder?.expires_at ? formatDate(trackedContributionOrder.expires_at) : null;
    const gatewayStillConfirming = contributionFlowState === "pending"
        && ["AZAMPAY_TIMEOUT", "SNIPPE_TIMEOUT"].includes(String(trackedContributionOrder?.error_code || ""));
    const paymentApprovalTakingLongerThanExpected = contributionFlowState === "pending"
        && !phoneCancellationRequested
        && !gatewayStillConfirming
        && pendingOrderElapsedMs >= PAYMENT_APPROVAL_EXPECTATION_MS;
    const contributionFlowProgress = contributionFlowState === "initiating"
        ? 18
        : contributionFlowState === "pending"
            ? 48
            : contributionFlowState === "paid"
                ? 78
                : contributionFlowState === "posted"
                    ? 100
                    : contributionFlowState === "failed" || contributionFlowState === "expired"
                        ? 100
                        : 0;
    const contributionFlowTone = contributionFlowState === "posted"
        ? "success"
        : contributionFlowState === "failed"
            ? "error"
            : contributionFlowState === "expired"
                ? "warning"
                : "info";
    const contributionFlowTitle = contributionFlowState === "initiating"
        ? "Contacting Mobile Money"
        : contributionFlowState === "pending"
            ? phoneCancellationRequested
                ? "Listening for cancellation callback"
                : gatewayStillConfirming
                    ? "Gateway still confirming"
                    : paymentApprovalTakingLongerThanExpected
                        ? "Approval is taking longer than usual"
                        : "Waiting for phone approval"
            : contributionFlowState === "paid"
                ? "Payment received"
                : contributionFlowState === "posted"
                    ? activePaymentPurpose === "savings_deposit"
                        ? "Savings posted"
                        : activePaymentPurpose === "loan_repayment"
                            ? "Loan repayment posted"
                        : "Contribution posted"
                    : contributionFlowState === "failed"
                        ? "Payment failed"
                        : contributionFlowState === "expired"
                            ? "Payment expired"
                            : `Make ${activePaymentCopy.title}`;
    const contributionFlowMessage = contributionFlowState === "initiating"
        ? "The portal is creating the Mobile Money request and waiting for the gateway to acknowledge it."
        : contributionFlowState === "pending"
            ? phoneCancellationRequested
                ? `You indicated that you cancelled on the phone. The source of truth is the provider callback, and the portal is polling for it now. If the provider confirms cancellation, this screen will update automatically. The provider window${pendingOrderMinutesRemaining !== null ? ` still remains open for about ${pendingOrderMinutesRemaining} more minute(s)` : " remains open"} only as a fallback expiry if no callback arrives.`
                : gatewayStillConfirming
                    ? "Mobile Money did not answer before the timeout, but the order is still open and being tracked. If you already approved on your phone, keep this dialog open while callback confirmation arrives."
                    : paymentApprovalTakingLongerThanExpected
                    ? `Most phone approvals arrive within about 1 minute. The portal is still listening for the provider callback${pendingOrderMinutesRemaining !== null ? ` while the provider window stays open for about ${pendingOrderMinutesRemaining} more minute(s)` : ""}, but you do not need to stay on this screen. Use Check Status if you already responded on your phone, or close and track it later from Payments.`
                        : `Waiting for approval on your phone. Approve the request to complete payment. If you cancel, this screen will update automatically.${pendingOrderMinutesRemaining !== null ? ` If no action is taken, the request expires in about ${pendingOrderMinutesRemaining} minute(s).` : ""}`
            : contributionFlowState === "paid"
                ? activePaymentPurpose === "savings_deposit"
                    ? "Mobile Money confirmed the payment. The backend is now posting the savings deposit into your account."
                    : activePaymentPurpose === "membership_fee"
                        ? "Mobile Money confirmed the payment. The backend is now posting the membership fee and activating your membership."
                        : activePaymentPurpose === "loan_repayment"
                            ? "Mobile Money confirmed the payment. The backend is now allocating the repayment into interest and principal."
                    : "Mobile Money confirmed the payment. The backend is now posting the contribution into your share account."
                : contributionFlowState === "posted"
                    ? activePaymentPurpose === "savings_deposit"
                        ? "The savings deposit is now reflected in your account and statement history."
                        : activePaymentPurpose === "membership_fee"
                            ? "The membership fee is posted and your membership is being activated."
                            : activePaymentPurpose === "loan_repayment"
                                ? "The repayment is now posted against your loan schedule and statement history."
                        : "The contribution is now reflected in your account and statement history."
                    : contributionFlowState === "failed"
                        ? trackedContributionOrder?.error_message || "Mobile Money reported a payment failure."
                        : contributionFlowState === "expired"
                            ? trackedContributionOrder?.error_message || "The mobile money request expired before approval."
                            : `Start a ${activePaymentCopy.noun} request and follow the progress here.`;
    const contributionRequestStepState = submittingContribution
        ? "active"
        : trackedContributionOrder
            ? "complete"
            : "idle";
    const contributionApprovalStepState = contributionFlowState === "pending"
        ? "active"
        : contributionFlowState === "paid" || contributionFlowState === "posted"
            ? "complete"
            : "idle";
    const contributionPostingStepState = contributionFlowState === "paid"
        ? "active"
        : contributionFlowState === "posted"
            ? "complete"
            : "idle";
    const showBackgroundActivity = contributionFlowState === "initiating" || contributionFlowState === "pending" || contributionFlowState === "paid";
    const backgroundActivityMessage = contributionFlowState === "initiating"
        ? "Creating the Mobile Money request..."
        : contributionFlowState === "pending"
            ? phoneCancellationRequested
                ? "Listening for the provider callback after handset cancellation..."
                : "Waiting for approval on your phone. This screen checks for webhook and status updates automatically..."
            : activePaymentPurpose === "membership_fee"
                ? "Payment is confirmed. Posting the membership fee in the background..."
                : activePaymentPurpose === "loan_repayment"
                    ? "Payment is confirmed. Posting the loan repayment in the background..."
                : "Payment is confirmed. Posting the deposit in the background...";

    const profileMenuOpen = Boolean(profileMenuAnchor);
    const m3MenuTokens = useMemo(() => {
        const surfaceContainerHighest = theme.palette.background.paper;
        const surfaceVariant = theme.palette.mode === "dark"
            ? alpha(theme.palette.common.white, 0.04)
            : alpha(theme.palette.common.black, 0.02);

        return {
            surfaceContainerHighest,
            surfaceVariant,
            shapeExtraLarge: "4px"
        };
    }, [theme]);
    const isDarkMode = theme.palette.mode === "dark";
    const memberAccent = isDarkMode ? DARK_MEMBER_ACCENT : brandColors.primary[700];
    const memberAccentStrong = isDarkMode ? DARK_MEMBER_ACCENT_DEEP : brandColors.primary[900];
    const memberAccentAlt = isDarkMode ? "#E6C88A" : brandColors.accent[700];
    const memberAccentSoftBg = alpha(memberAccent, isDarkMode ? 0.18 : 0.12);
    const portalLogoSrc = "/SACCOSS-LOGO.png";

    const handleProfileMenuOpen = (event: MouseEvent<HTMLElement>) => {
        setProfileMenuAnchor(event.currentTarget);
    };

    const handleProfileMenuClose = () => {
        setProfileMenuAnchor(null);
    };

    const handleProfileMenuAction = (action: () => void) => {
        action();
        handleProfileMenuClose();
    };

    const openDepositDialog = (purpose: MemberPaymentPurpose = "share_contribution", loanId?: string | null) => {
        if (!canUsePortalPayments) {
            pushToast({
                title: "Deposits unavailable",
                message: "Mobile-money deposit integration is not currently available for this workspace.",
                type: "error"
            });
            return;
        }

        if (purpose === "loan_repayment" && !portalRepaymentLoans.length) {
            pushToast({
                title: "No active loan",
                message: "There is no active or in-arrears loan available for self-service repayment.",
                type: "error"
            });
            return;
        }

        setPaymentFlowPurpose(purpose);
        setPhoneCancellationRequested(false);
        const latestOrder = purpose === "savings_deposit"
            ? latestSavingsPaymentOrder
            : purpose === "membership_fee"
                ? latestMembershipFeePaymentOrder
                : purpose === "loan_repayment"
                    ? latestLoanRepaymentPaymentOrder
                : latestSharePaymentOrder;
        if (latestOrder && ["pending", "paid"].includes(latestOrder.status)) {
            setActiveContributionOrderId(latestOrder.id);
        } else {
            setActiveContributionOrderId(null);
        }
        if (purpose === "membership_fee") {
            contributionPaymentForm.setValue("amount", membershipFeeOutstanding, { shouldValidate: true });
            contributionPaymentForm.setValue("description", "Membership fee payment", { shouldValidate: true });
            contributionPaymentForm.setValue("loan_id", "", { shouldValidate: false });
        } else if (purpose === "loan_repayment") {
            setLoanRepaymentDefaults(loanId);
            contributionPaymentForm.setValue("account_id", "", { shouldValidate: false });
        } else {
            contributionPaymentForm.setValue("loan_id", "", { shouldValidate: false });
        }
        setShowContributionDialog(true);
    };

    const setLoanRepaymentDefaults = (loanIdOverride?: string | null) => {
        const nextLoan =
            (loanIdOverride ? portalRepaymentLoans.find((loan) => loan.id === loanIdOverride) : null)
            || selectedRepaymentLoan
            || portalRepaymentLoans[0]
            || null;
        const nextSchedules = loanSchedules.filter((schedule) => schedule.loan_id === nextLoan?.id && schedule.status !== "paid");
        const nextInsights = buildRepaymentInsights(nextLoan, nextSchedules, 0);

        contributionPaymentForm.reset({
            account_id: "",
            loan_id: nextLoan?.id || "",
            amount: nextInsights.recommendedAmount > 0 ? Number(nextInsights.recommendedAmount.toFixed(2)) : 0,
            provider: contributionPaymentForm.getValues("provider") || "vodacom",
            msisdn: contributionPaymentForm.getValues("msisdn") || profile?.phone || "",
            description: nextLoan ? `Loan repayment for ${nextLoan.loan_number}` : ""
        });
    };

    const prepareAnotherContribution = () => {
        setActiveContributionOrderId(null);
        setPhoneCancellationRequested(false);
        if (paymentFlowPurpose === "loan_repayment") {
            setLoanRepaymentDefaults(contributionPaymentForm.getValues("loan_id"));
            return;
        }

        contributionPaymentForm.reset({
            account_id: contributionPaymentForm.getValues("account_id"),
            loan_id: "",
            amount: 0,
            provider: contributionPaymentForm.getValues("provider") || "vodacom",
            msisdn: contributionPaymentForm.getValues("msisdn") || profile?.phone || "",
            description: ""
        });
    };

    const handleStopTrackingPayment = () => {
        const openOrder = trackedContributionOrder;
        setShowContributionDialog(false);
        pushToast({
            title: "Tracking continues in background",
            message: openOrder?.status === "pending"
                ? "This payment request is still being tracked in the background. You can reopen it from Payments, and the portal will notify you when the provider confirms a final result."
                : "The payment progress dialog has been closed.",
            type: "info"
        });
    };

    const refreshMemberContributionData = async (targetMemberId = memberId) => {
        if (!profile?.tenant_id) {
            return;
        }

        const [membersResult, applicationResult] = await Promise.allSettled([
            api.get<MembersResponse>(endpoints.members.list(), {
                params: {
                    tenant_id: profile.tenant_id,
                    page: 1,
                    limit: 100
                }
            }),
            api.get<MemberApplicationResponse>(endpoints.memberApplications.me(), {
                params: {
                    tenant_id: profile.tenant_id
                }
            })
        ]);

        let resolvedMemberId = targetMemberId;

        if (membersResult.status === "fulfilled") {
            const refreshedMember =
                (membersResult.value.data.data || []).find((member: Member) => member.user_id === (user?.id || "")) ||
                membersResult.value.data.data?.[0] ||
                null;
            setMemberRecord(refreshedMember);
            setMemberId(refreshedMember?.id || "");
            resolvedMemberId = refreshedMember?.id || resolvedMemberId;
        }

        if (applicationResult.status === "fulfilled") {
            setMemberApplication(applicationResult.value.data.data || null);
        }

        if (!resolvedMemberId) {
            setAccounts([]);
            setStatements([]);
            setLoanTransactions([]);
            return;
        }

        const [accountsResult, loansResult, schedulesResult, statementsResult, loanTransactionsResult] = await Promise.allSettled([
            api.get<MemberAccountsResponse>(endpoints.members.accounts(), {
                params: {
                    tenant_id: profile.tenant_id,
                    page: 1,
                    limit: 100
                }
            }),
            api.get<LoansResponse>(endpoints.finance.loanPortfolio(), {
                params: {
                    tenant_id: profile.tenant_id,
                    member_id: resolvedMemberId,
                    page: 1,
                    limit: 100
                }
            }),
            api.get<LoanSchedulesResponse>(endpoints.finance.loanSchedules(), {
                params: {
                    tenant_id: profile.tenant_id,
                    page: 1,
                    limit: 100
                }
            }),
            api.get<StatementsResponse>(endpoints.finance.statements(), {
                params: {
                    tenant_id: profile.tenant_id,
                    member_id: resolvedMemberId,
                    page: 1,
                    limit: 100
                }
            }),
            api.get<LoanTransactionsResponse>(endpoints.finance.loanTransactions(), {
                params: {
                    tenant_id: profile.tenant_id,
                    page: 1,
                    limit: 100
                }
            })
        ]);

        if (accountsResult.status === "fulfilled") {
            setAccounts(accountsResult.value.data.data || []);
        }

        if (loansResult.status === "fulfilled") {
            setLoans(loansResult.value.data.data || []);
        }

        if (schedulesResult.status === "fulfilled") {
            setLoanSchedules(schedulesResult.value.data.data || []);
        }

        if (statementsResult.status === "fulfilled") {
            setStatements(statementsResult.value.data.data || []);
        }

        if (loanTransactionsResult.status === "fulfilled") {
            setLoanTransactions(loanTransactionsResult.value.data.data || []);
        }
    };

    const handleMarkCancelledOnPhone = () => {
        setPhoneCancellationRequested(true);
        void refreshTrackedPaymentOrder(false);
        setShowContributionDialog(false);
        pushToast({
            title: "Phone cancellation noted",
            message: "The dialog is closed, but the portal is still checking in the background. If the provider confirms cancellation, you will see the final status automatically in Payments.",
            type: "info"
        });
    };

    const refreshTrackedPaymentOrder = async (manual = false) => {
        const trackedOrderId = trackedContributionOrder?.id || activeContributionOrderId;
        if (!trackedOrderId) {
            return null;
        }

        if (manual) {
            setCheckingPaymentStatus(true);
        }

        try {
            const { data } = await api.get<PaymentOrderStatusResponse>(
                endpoints.memberPayments.orderStatus(trackedOrderId)
            );
            const nextOrder = mergePaymentOrder(data.data.order, false);

            if (nextOrder.status === "paid" && lastPaymentToastStatus !== "paid") {
                setLastPaymentToastStatus("paid");
                pushToast({
                    title: "Payment confirmed",
                    message: nextOrder.purpose === "savings_deposit"
                        ? "Mobile Money marked the order as paid. The system is now posting it into your savings account."
                        : nextOrder.purpose === "membership_fee"
                            ? "Mobile Money marked the order as paid. The system is now posting the membership fee and activating your profile."
                            : nextOrder.purpose === "loan_repayment"
                                ? "Mobile Money marked the order as paid. The system is now allocating the repayment into your loan."
                                : "Mobile Money marked the order as paid. The system is now posting it into your share account.",
                    type: "success"
                });
            }

            if (nextOrder.status === "posted" && lastPaymentToastStatus !== "posted") {
                setLastPaymentToastStatus("posted");
                await refreshMemberContributionData(nextOrder.member_id);
                pushToast({
                    title: nextOrder.purpose === "savings_deposit"
                        ? "Savings posted"
                        : nextOrder.purpose === "membership_fee"
                            ? "Membership activated"
                            : nextOrder.purpose === "loan_repayment"
                                ? "Repayment posted"
                                : "Contribution posted",
                    message: nextOrder.purpose === "savings_deposit"
                        ? "Your mobile money savings deposit is now reflected in the system."
                        : nextOrder.purpose === "membership_fee"
                            ? "Your membership fee is posted and your member profile is now active."
                            : nextOrder.purpose === "loan_repayment"
                                ? "Your loan repayment is now reflected in the system."
                                : "Your mobile money contribution is now reflected in the system.",
                    type: "success"
                });
            }

            if (nextOrder.status === "failed" && lastPaymentToastStatus !== "failed") {
                setLastPaymentToastStatus("failed");
                pushToast({
                    title: "Payment failed",
                    message: nextOrder.error_message || "Mobile Money reported a payment failure.",
                    type: "error"
                });
            }

            if (nextOrder.status === "expired" && lastPaymentToastStatus !== "expired") {
                setLastPaymentToastStatus("expired");
                pushToast({
                    title: "Payment expired",
                    message: nextOrder.error_message || "The payment session expired before completion.",
                    type: "error"
                });
            }

            if (manual && nextOrder.status === "pending") {
                pushToast({
                    title: "Still waiting for provider response",
                    message: "The request is still pending with the provider. This screen will keep checking automatically, and the request will expire only if no terminal callback or status update arrives.",
                    type: "info"
                });
            }

            return nextOrder;
        } catch (error) {
            if (manual) {
                pushToast({
                    title: "Status check failed",
                    message: getApiErrorMessage(error, "Unable to refresh the payment status right now."),
                    type: "error"
                });
            } else {
                console.warn("[member-portal] payment status poll failed", error);
            }
            return null;
        } finally {
            if (manual) {
                setCheckingPaymentStatus(false);
            }
        }
    };

    const handleReconcilePaymentOrder = async () => {
        if (!trackedContributionOrder) {
            return;
        }

        setReconcilingPayment(true);
        try {
            const { data } = await api.post<ReconcilePaymentOrderResponse>(
                endpoints.memberPayments.reconcile(trackedContributionOrder.id)
            );
            const nextOrder = mergePaymentOrder(data.data.order);

                if (data.data.reconciled && nextOrder.status === "posted") {
                    setLastPaymentToastStatus("posted");
                    await refreshMemberContributionData(nextOrder.member_id);
                    pushToast({
                        title: nextOrder.purpose === "savings_deposit"
                            ? "Savings posted"
                            : nextOrder.purpose === "membership_fee"
                                ? "Membership activated"
                                : nextOrder.purpose === "loan_repayment"
                                    ? "Repayment posted"
                                : "Contribution posted",
                        message: nextOrder.purpose === "savings_deposit"
                            ? "The paid Mobile Money order has been posted into your savings account."
                            : nextOrder.purpose === "membership_fee"
                                ? "The paid Mobile Money order has posted the membership fee and activated your member profile."
                                : nextOrder.purpose === "loan_repayment"
                                    ? "The paid Mobile Money order has been posted into your loan and statements."
                                : "The paid Mobile Money order has been posted into your share account.",
                        type: "success"
                    });
                    return;
                }

            pushToast({
                title: "No new posting yet",
                message:
                    nextOrder.status === "paid"
                        ? "The order is paid but could not be posted yet. Try again shortly."
                        : `This order is currently ${nextOrder.status.replace(/_/g, " ")}.`,
                type: nextOrder.status === "failed" ? "error" : "success"
            });
        } catch (error) {
            pushToast({
                title: "Reconcile failed",
                message: getApiErrorMessage(error, "Unable to reconcile this payment order."),
                type: "error"
            });
        } finally {
            setReconcilingPayment(false);
        }
    };

    const submitContributionPayment = contributionPaymentForm.handleSubmit(async (values) => {
        if (!profile?.tenant_id) {
            pushToast({
                title: "Tenant missing",
                message: "Select a tenant before initiating a contribution payment.",
                type: "error"
            });
            return;
        }

        setSubmittingContribution(true);
        try {
            const payload: InitiateContributionPaymentRequest = {
                tenant_id: profile.tenant_id,
                account_id: paymentFlowPurpose === "loan_repayment" ? undefined : values.account_id || undefined,
                loan_id: paymentFlowPurpose === "loan_repayment" ? values.loan_id || undefined : undefined,
                amount: Number(values.amount),
                provider: values.provider,
                msisdn: values.msisdn.trim(),
                description: values.description?.trim() || undefined
            };

            const { data } = await api.post<InitiateContributionPaymentResponse>(
                paymentFlowPurpose === "savings_deposit"
                    ? endpoints.memberPayments.initiateSavings()
                    : paymentFlowPurpose === "membership_fee"
                        ? endpoints.memberPayments.initiateMembershipFee()
                        : paymentFlowPurpose === "loan_repayment"
                            ? endpoints.memberPayments.initiateLoanRepayment()
                        : endpoints.memberPayments.initiateContribution(),
                payload,
                { timeout: 70000 }
            );
            const nextOrder = mergePaymentOrder(data.data.order);
            const pendingConfirmation = data.data.processing_state === "pending_confirmation";
            setActiveContributionOrderId(nextOrder.id);
            setPhoneCancellationRequested(false);
            setLastPaymentToastStatus(nextOrder.status);
            if (paymentFlowPurpose === "loan_repayment") {
                setLoanRepaymentDefaults(values.loan_id);
            } else {
                contributionPaymentForm.reset({
                    account_id: values.account_id,
                    loan_id: "",
                    amount: paymentFlowPurpose === "membership_fee" ? membershipFeeOutstanding : 0,
                    provider: values.provider,
                    msisdn: values.msisdn,
                    description: ""
                });
            }
            pushToast({
                title: pendingConfirmation
                    ? "Mobile Money still processing"
                    : paymentFlowPurpose === "savings_deposit"
                        ? "Savings payment initiated"
                        : paymentFlowPurpose === "membership_fee"
                            ? "Membership fee initiated"
                            : paymentFlowPurpose === "loan_repayment"
                                ? "Loan repayment initiated"
                            : "Payment initiated",
                message: pendingConfirmation
                    ? "Mobile Money did not respond in time, but the order is still being tracked. Keep the dialog open while callback confirmation arrives."
                    : paymentFlowPurpose === "savings_deposit"
                        ? "Approve the Mobile Money prompt on your phone. The savings deposit will post automatically after confirmation."
                        : paymentFlowPurpose === "membership_fee"
                            ? "Approve the Mobile Money prompt on your phone. The membership fee will post automatically after confirmation."
                            : paymentFlowPurpose === "loan_repayment"
                                ? "Approve the Mobile Money prompt on your phone. The repayment will post automatically into your loan after confirmation."
                        : "Approve the Mobile Money prompt on your phone. The contribution will post automatically after confirmation.",
                type: "success"
            });
        } catch (error) {
            pushToast({
                title: paymentFlowPurpose === "savings_deposit"
                    ? "Savings payment failed"
                    : paymentFlowPurpose === "membership_fee"
                        ? "Membership fee payment failed"
                        : paymentFlowPurpose === "loan_repayment"
                            ? "Loan repayment failed"
                        : "Payment initiation failed",
                message: getApiErrorMessage(
                    error,
                    paymentFlowPurpose === "savings_deposit"
                        ? "Unable to start the Mobile Money savings deposit."
                        : paymentFlowPurpose === "membership_fee"
                            ? "Unable to start the Mobile Money membership fee payment."
                            : paymentFlowPurpose === "loan_repayment"
                                ? "Unable to start the Mobile Money loan repayment."
                        : "Unable to start the Mobile Money contribution."
                ),
                type: "error"
            });
        } finally {
            setSubmittingContribution(false);
        }
    });

    useEffect(() => {
        const loadPortal = async () => {
            if (!profile) {
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);
            setWarning(null);

            try {
                let applicationData: MemberApplication | null = null;
                try {
                    const { data: applicationResponse } = await api.get<MemberApplicationResponse>(endpoints.memberApplications.me(), {
                        params: { tenant_id: profile.tenant_id }
                    });
                    applicationData = applicationResponse.data || null;
                } catch (applicationError) {
                    setMemberApplication(null);
                    setWarning(getApiErrorMessage(applicationError, "Unable to load your membership application."));
                }

                const { data: membersResponse } = await api.get<MembersResponse>(endpoints.members.list(), {
                    params: { tenant_id: profile.tenant_id, page: 1, limit: 100 }
                });
                const memberRecord =
                    (membersResponse.data || []).find((member: Member) => member.user_id === (user?.id || "")) ||
                    membersResponse.data?.[0];

                if (!memberRecord?.id) {
                    setMemberRecord(null);
                    setMemberId("");
                    setAccounts([]);
                    setLoans([]);
                    setLoanSchedules([]);
                    setLoanProducts([]);
                    setLoanApplications([]);
                    setGuarantorRequests([]);
                    setStatements([]);
                    setLoanTransactions([]);
                    setPaymentOrders([]);
                    setPaymentOrder(null);
                    setMemberApplication(applicationData);
                    return;
                }

                setMemberRecord(memberRecord);
                setMemberId(memberRecord.id);
                setMemberApplication(applicationData);
                const canUseMemberPayments = canUsePortalDeposits || applicationData?.status === "approved_pending_payment";

                const results = await Promise.allSettled([
                    api.get<MemberAccountsResponse>(endpoints.members.accounts(), {
                        params: {
                            tenant_id: profile.tenant_id,
                            page: 1,
                            limit: 100
                        }
                    }),
                    api.get<LoansResponse>(endpoints.finance.loanPortfolio(), {
                        params: {
                            tenant_id: profile.tenant_id,
                            member_id: memberRecord.id,
                            page: 1,
                            limit: 100
                        }
                    }),
                    api.get<LoanSchedulesResponse>(endpoints.finance.loanSchedules(), {
                        params: {
                            tenant_id: profile.tenant_id,
                            page: 1,
                            limit: 100
                        }
                    }),
                    api.get<LoanProductsResponse>(endpoints.products.loans()),
                    api.get<LoanApplicationsResponse>(endpoints.loanApplications.list(), {
                        params: {
                            tenant_id: profile.tenant_id,
                            page: 1,
                            limit: 100
                        }
                    }),
                    api.get<GuarantorRequestsResponse>(endpoints.loanApplications.guarantorRequests(), {
                        params: {
                            tenant_id: profile.tenant_id,
                            page: 1,
                            limit: 100
                        }
                    }),
                    api.get<StatementsResponse>(endpoints.finance.statements(), {
                        params: { tenant_id: profile.tenant_id, member_id: memberRecord.id, page: 1, limit: 100 }
                    }),
                    api.get<LoanTransactionsResponse>(endpoints.finance.loanTransactions(), {
                        params: { tenant_id: profile.tenant_id, page: 1, limit: 100 }
                    }),
                    canUseMemberPayments
                        ? api.get<PaymentOrdersResponse>(endpoints.memberPayments.listOrders(), {
                            params: { tenant_id: profile.tenant_id, page: 1, limit: 100 }
                        })
                        : Promise.resolve(null)
                ]);

                const [accountsResult, loansResult, schedulesResult, productsResult, applicationsResult, guarantorRequestsResult, statementsResult, loanTransactionsResult, paymentOrdersResult] = results;
                const issues: string[] = [];

                if (accountsResult.status === "fulfilled") {
                    setAccounts(accountsResult.value.data.data || []);
                } else {
                    setAccounts([]);
                    issues.push(getApiErrorMessage(accountsResult.reason, "Accounts unavailable."));
                }

                if (loansResult.status === "fulfilled") {
                    setLoans(loansResult.value.data.data || []);
                } else {
                    setLoans([]);
                    issues.push(getApiErrorMessage(loansResult.reason, "Loans unavailable."));
                }

                if (schedulesResult.status === "fulfilled") {
                    setLoanSchedules(schedulesResult.value.data.data || []);
                } else {
                    setLoanSchedules([]);
                    issues.push(getApiErrorMessage(schedulesResult.reason, "Loan schedules unavailable."));
                }

                if (productsResult.status === "fulfilled") {
                    setLoanProducts(productsResult.value.data.data || []);
                } else {
                    setLoanProducts([]);
                    issues.push(getApiErrorMessage(productsResult.reason, "Loan products unavailable."));
                }

                if (applicationsResult.status === "fulfilled") {
                    setLoanApplications(applicationsResult.value.data.data || []);
                } else {
                    setLoanApplications([]);
                    issues.push(getApiErrorMessage(applicationsResult.reason, "Loan applications unavailable."));
                }

                if (guarantorRequestsResult.status === "fulfilled") {
                    setGuarantorRequests(guarantorRequestsResult.value.data.data || []);
                } else {
                    setGuarantorRequests([]);
                    issues.push(getApiErrorMessage(guarantorRequestsResult.reason, "Guarantor requests unavailable."));
                }

                if (statementsResult.status === "fulfilled") {
                    setStatements(statementsResult.value.data.data || []);
                } else {
                    setStatements([]);
                    issues.push(getApiErrorMessage(statementsResult.reason, "Transactions unavailable."));
                }

                if (loanTransactionsResult.status === "fulfilled") {
                    setLoanTransactions(loanTransactionsResult.value.data.data || []);
                } else {
                    setLoanTransactions([]);
                    issues.push(getApiErrorMessage(loanTransactionsResult.reason, "Loan transactions unavailable."));
                }

                if (!canUseMemberPayments) {
                    setPaymentOrders([]);
                    setPaymentOrder(null);
                } else if (paymentOrdersResult.status === "fulfilled" && paymentOrdersResult.value) {
                    const nextPaymentOrders = (paymentOrdersResult.value.data.data?.data || []).map((order) => normalizeContributionOrder(order));
                    setPaymentOrders(nextPaymentOrders);
                    setPaymentOrder((current) => {
                        if (current) {
                            return nextPaymentOrders.find((order) => order.id === current.id) || current;
                        }
                        return nextPaymentOrders[0] || null;
                    });
                } else if (paymentOrdersResult.status === "rejected") {
                    setPaymentOrders([]);
                    issues.push(getApiErrorMessage(paymentOrdersResult.reason, "Payment history unavailable."));
                }

                if (issues.length) {
                    setWarning(issues[0]);
                }
            } catch (portalError) {
                setMemberRecord(null);
                setError(getApiErrorMessage(portalError));
            } finally {
                setLoading(false);
            }
        };

        void loadPortal();
    }, [canUsePortalDeposits, profile?.tenant_id, user?.id]);

    useEffect(() => {
        if (!isDesktop) {
            setSidebarOpen(true);
        } else {
            setMobileMenuOpen(false);
        }
    }, [isDesktop]);

    useEffect(() => {
        if (profile?.phone && !contributionPaymentForm.getValues("msisdn")) {
            contributionPaymentForm.setValue("msisdn", profile.phone);
        }
    }, [profile?.phone]);

    useEffect(() => {
        if (!canUsePortalPayments && activeSection === "member-payments") {
            setActiveSection("member-overview");
        }

        if (!canUsePortalPayments && showContributionDialog) {
            setShowContributionDialog(false);
        }
    }, [activeSection, canUsePortalPayments, showContributionDialog]);

    const savingsAccounts = useMemo(() => accounts.filter((account) => account.product_type === "savings"), [accounts]);
    const totalSavings = useMemo(
        () => savingsAccounts.reduce((sum, account) => sum + account.available_balance + account.locked_balance, 0),
        [savingsAccounts]
    );
    const availableSavings = useMemo(
        () => savingsAccounts.reduce((sum, account) => sum + account.available_balance, 0),
        [savingsAccounts]
    );
    const lockedSavings = useMemo(
        () => savingsAccounts.reduce((sum, account) => sum + account.locked_balance, 0),
        [savingsAccounts]
    );
    const totalShareCapital = useMemo(
        () =>
            accounts
                .filter((account) => account.product_type === "shares")
                .reduce((sum, account) => sum + account.available_balance + account.locked_balance, 0),
        [accounts]
    );
    const shareAccounts = useMemo(() => accounts.filter((account) => account.product_type === "shares"), [accounts]);
    const portalRepaymentLoans = useMemo(
        () => loans.filter((loan) => ["active", "in_arrears"].includes(loan.status) && (loan.outstanding_principal + loan.accrued_interest) > 0),
        [loans]
    );
    const canShowLoanRepaymentOption = canUsePortalDeposits && portalRepaymentLoans.length > 0;
    const paymentTargetAccounts = paymentFlowPurpose === "share_contribution"
        ? shareAccounts
        : paymentFlowPurpose === "loan_repayment"
            ? []
            : savingsAccounts;
    const paymentAccountOptions = useMemo(
        () =>
            paymentTargetAccounts.map((account) => ({
                value: account.id,
                label: account.account_name || account.account_number,
                secondary: `${account.account_number} · Balance ${formatCurrency(account.available_balance + account.locked_balance)}`
            })),
        [paymentTargetAccounts]
    );
    const watchedContributionAmount = contributionPaymentForm.watch("amount");
    const selectedContributionAccountId = contributionPaymentForm.watch("account_id");
    const selectedContributionAccount = useMemo(
        () => paymentTargetAccounts.find((account) => account.id === selectedContributionAccountId) || paymentTargetAccounts[0] || null,
        [paymentTargetAccounts, selectedContributionAccountId]
    );
    const selectedRepaymentLoanId = contributionPaymentForm.watch("loan_id");
    const selectedRepaymentLoan = useMemo(
        () => portalRepaymentLoans.find((loan) => loan.id === selectedRepaymentLoanId) || portalRepaymentLoans[0] || null,
        [portalRepaymentLoans, selectedRepaymentLoanId]
    );
    const selectedRepaymentSchedules = useMemo(
        () => loanSchedules.filter((schedule) => schedule.loan_id === selectedRepaymentLoan?.id && schedule.status !== "paid"),
        [loanSchedules, selectedRepaymentLoan?.id]
    );
    const repaymentInsights = useMemo(
        () => buildRepaymentInsights(selectedRepaymentLoan, selectedRepaymentSchedules, watchedContributionAmount),
        [selectedRepaymentLoan, selectedRepaymentSchedules, watchedContributionAmount]
    );
    const repaymentLoanOptions = useMemo(
        () =>
            portalRepaymentLoans.map((loan) => ({
                value: loan.id,
                label: loan.loan_number,
                secondary: `${formatCurrency(loan.outstanding_principal + loan.accrued_interest)} outstanding`
            })),
        [portalRepaymentLoans]
    );
    const selectedContributionProvider = contributionProviderOptions.find(
        (option) => option.value === contributionPaymentForm.watch("provider")
    ) || contributionProviderOptions[0];

    useEffect(() => {
        if (!canShowMembershipFeePaymentOption && paymentFlowPurpose === "membership_fee") {
            setPaymentFlowPurpose("share_contribution");
            setActiveContributionOrderId(null);
        }
    }, [canShowMembershipFeePaymentOption, paymentFlowPurpose]);

    useEffect(() => {
        if (!canShowLoanRepaymentOption && paymentFlowPurpose === "loan_repayment") {
            setPaymentFlowPurpose("share_contribution");
            setActiveContributionOrderId(null);
        }
    }, [canShowLoanRepaymentOption, paymentFlowPurpose]);

    useEffect(() => {
        if (contributionFlowState || paymentFlowPurpose === "loan_repayment") {
            return;
        }

        const currentAccountId = contributionPaymentForm.getValues("account_id");
        const hasCurrentAccount = paymentTargetAccounts.some((account) => account.id === currentAccountId);

        if (hasCurrentAccount) {
            return;
        }

        contributionPaymentForm.setValue("account_id", paymentTargetAccounts[0]?.id || "", { shouldValidate: true });
    }, [contributionFlowState, contributionPaymentForm, paymentFlowPurpose, paymentTargetAccounts]);
    useEffect(() => {
        if (contributionFlowState || paymentFlowPurpose !== "loan_repayment") {
            return;
        }

        const currentLoanId = contributionPaymentForm.getValues("loan_id");
        const hasCurrentLoan = portalRepaymentLoans.some((loan) => loan.id === currentLoanId);

        if (hasCurrentLoan) {
            return;
        }

        contributionPaymentForm.setValue("loan_id", portalRepaymentLoans[0]?.id || "", { shouldValidate: true });
    }, [contributionFlowState, contributionPaymentForm, paymentFlowPurpose, portalRepaymentLoans]);
    const filteredPaymentOrders = useMemo(
        () =>
            normalizedPaymentOrders.filter((order) => {
                if (paymentStatusFilter !== "all" && order.status !== paymentStatusFilter) {
                    return false;
                }

                if (paymentPurposeFilter !== "all" && order.purpose !== paymentPurposeFilter) {
                    return false;
                }

                return true;
            }),
        [normalizedPaymentOrders, paymentPurposeFilter, paymentStatusFilter]
    );
    const paginatedPaymentOrders = useMemo(
        () => filteredPaymentOrders.slice(paymentsPage * paymentsRowsPerPage, paymentsPage * paymentsRowsPerPage + paymentsRowsPerPage),
        [filteredPaymentOrders, paymentsPage, paymentsRowsPerPage]
    );
    const successfulPaymentCount = useMemo(
        () => normalizedPaymentOrders.filter((order) => order.status === "posted").length,
        [normalizedPaymentOrders]
    );
    const pendingPaymentCount = useMemo(
        () => normalizedPaymentOrders.filter((order) => ["pending", "paid"].includes(order.status)).length,
        [normalizedPaymentOrders]
    );
    const failedPaymentCount = useMemo(
        () => normalizedPaymentOrders.filter((order) => ["failed", "expired"].includes(order.status)).length,
        [normalizedPaymentOrders]
    );
    const totalMobileMoneyAmount = useMemo(
        () => normalizedPaymentOrders.reduce((sum, order) => sum + order.amount, 0),
        [normalizedPaymentOrders]
    );
    const totalDividends = useMemo(
        () =>
            statements
                .filter((statement) => statement.transaction_type === "dividend_allocation")
                .reduce((sum, statement) => sum + statement.amount, 0),
        [statements]
    );
    const contributionHistory = useMemo(
        () => statements.filter((statement) => ["share_contribution", "dividend_allocation"].includes(statement.transaction_type)),
        [statements]
    );
    const totalOutstandingLoans = useMemo(
        () => loans.reduce((sum, loan) => sum + loan.outstanding_principal + loan.accrued_interest, 0),
        [loans]
    );
    const dashboardMaximumBorrowable = useMemo(
        () => Math.max(0, Number(dashboardLoanCapacity?.borrow_limit || 0)),
        [dashboardLoanCapacity]
    );
    const dashboardCurrentLoanExposure = useMemo(
        () => Math.max(0, Number(dashboardLoanCapacity?.current_loan_exposure || totalOutstandingLoans || 0)),
        [dashboardLoanCapacity, totalOutstandingLoans]
    );
    const dashboardRemainingBorrowCapacity = useMemo(
        () => Math.max(0, dashboardMaximumBorrowable - dashboardCurrentLoanExposure),
        [dashboardCurrentLoanExposure, dashboardMaximumBorrowable]
    );
    const dashboardLiquidityStatus = useMemo(() => {
        if (!dashboardLoanCapacity) {
            return null;
        }

        if (dashboardLoanCapacity.loan_pool_frozen) {
            return "Frozen";
        }

        const totalDeposits = Number(dashboardLoanCapacity.total_deposits || 0);
        const liquidityRatio = totalDeposits > 0
            ? Number(dashboardLoanCapacity.available_for_loans || 0) / totalDeposits
            : 0;

        if (liquidityRatio > 0.4) {
            return "Healthy";
        }

        if (liquidityRatio >= 0.2) {
            return "Warning";
        }

        return "Risk";
    }, [dashboardLoanCapacity]);
    const hasNoVisibleFinancialData = accounts.length === 0 && loans.length === 0 && statements.length === 0;
    const activeLoanIds = useMemo(
        () => loans.filter((loan) => ["active", "in_arrears"].includes(loan.status)).map((loan) => loan.id),
        [loans]
    );
    const nextLoanInstallment = useMemo(() => {
        if (!activeLoanIds.length) {
            return null;
        }

        const pending = loanSchedules
            .filter((schedule) => activeLoanIds.includes(schedule.loan_id) && schedule.status !== "paid")
            .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

        return pending[0] || null;
    }, [loanSchedules, activeLoanIds]);
    const nextPaymentDue = nextLoanInstallment?.due_date || null;
    const daysUntilDue = useMemo(() => getDaysUntil(nextPaymentDue), [nextPaymentDue]);
    const activeLoanCount = useMemo(() => loans.filter((loan) => ["active", "in_arrears"].includes(loan.status)).length, [loans]);
    const pendingLoanApplications = useMemo(
        () => loanApplications.filter((application) => !["rejected", "cancelled", "disbursed"].includes(application.status)),
        [loanApplications]
    );
    const pendingGuarantorRequests = useMemo(
        () => guarantorRequests.filter((request) => request.consent_status === "pending"),
        [guarantorRequests]
    );
    const visiblePortalSections = useMemo(
        () => portalSections.filter((section) => canUsePortalPayments || section.id !== "member-payments"),
        [canUsePortalPayments]
    );
    const transactionCount = statements.length;
    const balanceTrend = groupBalances(statements);
    const monthlySavingsTrend = useMemo(() => groupSavingsByMonth(statements), [statements]);
    const currentView = visiblePortalSections.find((section) => section.id === activeSection) || visiblePortalSections[0];
    const latestBalance = statements[0]?.running_balance ?? 0;
    const totalVisibleCapital = totalSavings + totalShareCapital;
    const netPosition = totalVisibleCapital - totalOutstandingLoans;
    const hasOverdueLoan = useMemo(() => loans.some((loan) => loan.status === "in_arrears"), [loans]);
    const drawerWidth = sidebarOpen ? 296 : 96;
    const chartLabels = balanceTrend.map((entry) => entry.label);
    const chartValues = balanceTrend.map((entry) => entry.balance);
    const savingsTrendLabels = monthlySavingsTrend.map((entry) => entry.label);
    const savingsTrendValues = monthlySavingsTrend.map((entry) => entry.balance);
    const monthlyInstallment = nextLoanInstallment
        ? Math.max(
            nextLoanInstallment.principal_due +
            nextLoanInstallment.interest_due -
            nextLoanInstallment.principal_paid -
            nextLoanInstallment.interest_paid,
            0
        )
        : 0;
    const totalOriginalLoanAmount = useMemo(() => loans.reduce((sum, loan) => sum + loan.principal_amount, 0), [loans]);
    const loanProgressPercent = totalOriginalLoanAmount > 0 ? ((totalOriginalLoanAmount - totalOutstandingLoans) / totalOriginalLoanAmount) * 100 : 0;
    const lastContribution = useMemo(
        () => statements.find((statement) => ["share_contribution", "dividend_allocation"].includes(statement.transaction_type)) || null,
        [statements]
    );
    const lastLoanPayment = useMemo(
        () => statements.find((statement) => ["loan_repayment", "loan_repay"].includes(statement.transaction_type)) || null,
        [statements]
    );
    const standing = useMemo(() => {
        if (hasOverdueLoan) {
            return {
                label: "Overdue",
                tone: "danger" as const,
                details: "One or more installments are overdue. Please settle immediately."
            };
        }

        if (activeLoanCount > 0 && daysUntilDue !== null) {
            return {
                label: `Installment Due in ${Math.max(daysUntilDue, 0)} day${Math.abs(daysUntilDue) === 1 ? "" : "s"}`,
                tone: daysUntilDue <= 3 ? ("warning" as const) : ("neutral" as const),
                details: "Keep your repayment schedule current to maintain good standing."
            };
        }

        if (activeLoanCount === 0) {
            return {
                label: "No Active Loans",
                tone: "neutral" as const,
                details: "Your account currently has no active loan obligations.",
                showChip: false
            };
        }

        return {
            label: "In Good Standing",
            tone: "success" as const,
            details: "All visible obligations are current."
        };
    }, [activeLoanCount, daysUntilDue, hasOverdueLoan]);
    const memberAlerts = useMemo<MemberAlertItem[]>(() => {
        const alerts: MemberAlertItem[] = [];

        if (hasOverdueLoan) {
            alerts.push({
                id: "overdue-loan",
                severity: "error",
                title: "Overdue Installment",
                message: "An overdue loan installment was detected. Pay the due amount to avoid further penalties."
            });
        } else if (activeLoanCount > 0 && daysUntilDue !== null && daysUntilDue <= 7) {
            alerts.push({
                id: "installment-due",
                severity: "warning",
                title: "Installment Due Soon",
                message: `Your next installment is due in ${Math.max(daysUntilDue, 0)} day${Math.abs(daysUntilDue) === 1 ? "" : "s"}.`
            });
        }

        if (lastContribution?.transaction_type === "dividend_allocation") {
            alerts.push({
                id: "dividend-posted",
                severity: "info",
                title: "Dividend Posted",
                message: `Dividend allocation of ${formatCurrency(lastContribution.amount)} was posted to your account.`
            });
        }

        return alerts;
    }, [activeLoanCount, daysUntilDue, hasOverdueLoan, lastContribution]);

    const sortedStatements = useMemo(
        () =>
            statements
                .slice()
                .sort((left, right) => new Date(right.created_at || right.transaction_date).getTime() - new Date(left.created_at || left.transaction_date).getTime()),
        [statements]
    );
    const filteredTransactions = useMemo(() => {
        const normalizedSearch = transactionSearch.trim().toLowerCase();

        return sortedStatements.filter((row) => {
            if (!isWithinDateRange(row.created_at || row.transaction_date, transactionsRange)) {
                return false;
            }

            if (transactionTypeFilter !== "all") {
                if (transactionTypeFilter === "loan" && !row.transaction_type.includes("loan")) {
                    return false;
                }
                if (transactionTypeFilter === "deposit" && row.transaction_type !== "deposit") {
                    return false;
                }
                if (transactionTypeFilter === "withdrawal" && row.transaction_type !== "withdrawal") {
                    return false;
                }
                if (transactionTypeFilter === "contribution" && row.transaction_type !== "share_contribution") {
                    return false;
                }
                if (transactionTypeFilter === "dividend" && row.transaction_type !== "dividend_allocation") {
                    return false;
                }
            }

            if (normalizedSearch) {
                const reference = getAuditReference(row).toLowerCase();
                return reference.includes(normalizedSearch);
            }

            return true;
        });
    }, [sortedStatements, transactionSearch, transactionTypeFilter, transactionsRange]);
    const runningBalanceMismatches = useMemo(() => {
        const grouped = new Map<string, StatementRow[]>();

        filteredTransactions
            .slice()
            .sort((left, right) => new Date(left.created_at || left.transaction_date).getTime() - new Date(right.created_at || right.transaction_date).getTime())
            .forEach((row) => {
                const key = row.account_id || "global";
                const list = grouped.get(key) || [];
                list.push(row);
                grouped.set(key, list);
            });

        let mismatches = 0;
        grouped.forEach((rows) => {
            let previousBalance: number | null = null;
            rows.forEach((row) => {
                if (previousBalance === null) {
                    previousBalance = row.running_balance;
                    return;
                }
                const signedAmount = row.direction === "in" ? row.amount : -row.amount;
                const expected = Number((previousBalance + signedAmount).toFixed(2));
                if (Math.abs(expected - row.running_balance) > 1) {
                    mismatches += 1;
                }
                previousBalance = row.running_balance;
            });
        });

        return mismatches;
    }, [filteredTransactions]);
    const paginatedTransactions = useMemo(
        () =>
            filteredTransactions.slice(
                transactionsPage * transactionsRowsPerPage,
                transactionsPage * transactionsRowsPerPage + transactionsRowsPerPage
            ),
        [filteredTransactions, transactionsPage, transactionsRowsPerPage]
    );

    const filteredContributions = useMemo(
        () => contributionHistory.filter((row) => isWithinDateRange(row.created_at || row.transaction_date, contributionsRange)),
        [contributionHistory, contributionsRange]
    );
    const contributionActual = useMemo(
        () => filteredContributions.filter((row) => row.transaction_type === "share_contribution").reduce((sum, row) => sum + row.amount, 0),
        [filteredContributions]
    );
    const contributionEntriesCount = filteredContributions.filter((row) => row.transaction_type === "share_contribution").length;
    const dividendEntriesCount = filteredContributions.filter((row) => row.transaction_type === "dividend_allocation").length;
    const contributionBaselineMonthly = useMemo(() => {
        const recent = contributionHistory
            .filter((row) => row.transaction_type === "share_contribution")
            .slice(0, 6)
            .map((row) => row.amount);

        if (!recent.length) {
            return 50000;
        }

        return Math.max(Math.round(recent.reduce((sum, value) => sum + value, 0) / recent.length), 50000);
    }, [contributionHistory]);
    const contributionExpected = useMemo(() => {
        const fromDate = contributionsRange.from ? new Date(contributionsRange.from) : null;
        const toDate = contributionsRange.to ? new Date(contributionsRange.to) : null;
        const fromValid = fromDate && !Number.isNaN(fromDate.getTime());
        const toValid = toDate && !Number.isNaN(toDate.getTime());

        const months = fromValid && toValid
            ? Math.max(
                (toDate.getFullYear() - fromDate.getFullYear()) * 12
                + (toDate.getMonth() - fromDate.getMonth())
                + 1,
                1
            )
            : Math.max(Math.ceil(contributionEntriesCount / 2), 1);

        return months * contributionBaselineMonthly;
    }, [contributionBaselineMonthly, contributionsRange, contributionEntriesCount]);
    const contributionComplianceRatio = contributionExpected ? (contributionActual / contributionExpected) * 100 : 0;
    const contributionComplianceStatus = contributionComplianceRatio >= 100 ? "On track" : "Behind schedule";
    const dividendHistoryByYear = useMemo(() => {
        const grouped = new Map<string, number>();
        filteredContributions
            .filter((row) => row.transaction_type === "dividend_allocation")
            .forEach((row) => {
                const year = new Date(row.transaction_date).getFullYear().toString();
                grouped.set(year, (grouped.get(year) || 0) + row.amount);
            });

        return Array.from(grouped.entries())
            .sort(([left], [right]) => right.localeCompare(left))
            .map(([year, amount]) => ({ year, amount }));
    }, [filteredContributions]);
    const effectiveDividendRate = useMemo(
        () => (totalShareCapital > 0 ? (totalDividends / totalShareCapital) * 100 : 0),
        [totalDividends, totalShareCapital]
    );
    const nextContributionDue = useMemo(() => {
        const latest = contributionHistory.find((row) => row.transaction_type === "share_contribution");
        if (!latest) {
            return null;
        }
        const due = new Date(latest.transaction_date);
        due.setMonth(due.getMonth() + 1);
        return due.toISOString();
    }, [contributionHistory]);
    const contributionScheduleStatus = useMemo(() => {
        if (!nextContributionDue) {
            return "No schedule";
        }

        const days = getDaysUntil(nextContributionDue);
        if (days === null) {
            return "No schedule";
        }
        if (days < 0) {
            return "Overdue";
        }
        if (days <= 5) {
            return "Due soon";
        }

        return "Scheduled";
    }, [nextContributionDue]);
    const contributionRunningTotal = useMemo(
        () => filteredContributions.reduce((sum, row) => sum + row.amount, 0),
        [filteredContributions]
    );
    const paginatedContributions = useMemo(
        () =>
            filteredContributions.slice(
                contributionsPage * contributionsRowsPerPage,
                contributionsPage * contributionsRowsPerPage + contributionsRowsPerPage
            ),
        [contributionsPage, contributionsRowsPerPage, filteredContributions]
    );
    const contributionMonthlyTrend = useMemo(() => {
        const grouped = new Map<string, { label: string; contribution: number; dividend: number; sortOrder: number }>();

        filteredContributions.forEach((row) => {
            const sourceDate = row.created_at || row.transaction_date;
            const date = new Date(sourceDate);
            if (Number.isNaN(date.getTime())) {
                return;
            }

            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
            const existing = grouped.get(key) || {
                label: new Intl.DateTimeFormat("en-TZ", { month: "short", year: "2-digit" }).format(date),
                contribution: 0,
                dividend: 0,
                sortOrder: new Date(date.getFullYear(), date.getMonth(), 1).getTime()
            };

            if (row.transaction_type === "share_contribution") {
                existing.contribution += row.amount;
            }

            if (row.transaction_type === "dividend_allocation") {
                existing.dividend += row.amount;
            }

            grouped.set(key, existing);
        });

        return Array.from(grouped.values())
            .sort((left, right) => left.sortOrder - right.sortOrder)
            .slice(-8);
    }, [filteredContributions]);
    const contributionTrendLabels = contributionMonthlyTrend.map((point) => point.label);
    const contributionTrendContributions = contributionMonthlyTrend.map((point) => point.contribution);
    const contributionTrendDividends = contributionMonthlyTrend.map((point) => point.dividend);

    const filteredAccounts = useMemo(
        () => accounts.filter((account) => isWithinDateRange(account.created_at, accountsRange)),
        [accounts, accountsRange]
    );
    const paginatedAccounts = useMemo(
        () => filteredAccounts.slice(accountsPage * accountsRowsPerPage, accountsPage * accountsRowsPerPage + accountsRowsPerPage),
        [filteredAccounts, accountsPage, accountsRowsPerPage]
    );
    const filteredInterestHistory = useMemo(
        () =>
            sortedStatements.filter(
                (row) => row.transaction_type.includes("interest") && isWithinDateRange(row.created_at || row.transaction_date, accountsRange)
            ),
        [accountsRange, sortedStatements]
    );
    const filteredDividendMapping = useMemo(
        () =>
            sortedStatements.filter(
                (row) => row.transaction_type === "dividend_allocation" && isWithinDateRange(row.created_at || row.transaction_date, accountsRange)
            ),
        [accountsRange, sortedStatements]
    );
    const accountDormancyCount = useMemo(
        () => filteredAccounts.filter((account) => account.status === "dormant").length,
        [filteredAccounts]
    );
    const interestEarned = useMemo(
        () => filteredInterestHistory.reduce((sum, row) => sum + row.amount, 0),
        [filteredInterestHistory]
    );
    const filteredLoans = useMemo(
        () =>
            loans.filter((loan) => isWithinDateRange(loan.disbursed_at || loan.created_at, loansRange)),
        [loans, loansRange]
    );
    const filteredLoansOutstanding = useMemo(
        () => filteredLoans.reduce((sum, loan) => sum + loan.outstanding_principal + loan.accrued_interest, 0),
        [filteredLoans]
    );
    const filteredLoanOriginalAmount = useMemo(
        () => filteredLoans.reduce((sum, loan) => sum + loan.principal_amount, 0),
        [filteredLoans]
    );
    const filteredLoanProgressPercent = filteredLoanOriginalAmount > 0
        ? ((filteredLoanOriginalAmount - filteredLoansOutstanding) / filteredLoanOriginalAmount) * 100
        : 0;
    const filteredActiveLoanCount = useMemo(
        () => filteredLoans.filter((loan) => ["active", "in_arrears"].includes(loan.status)).length,
        [filteredLoans]
    );
    const transactionTrend = useMemo(() => groupBalances(filteredTransactions), [filteredTransactions]);
    const transactionTrendLabels = transactionTrend.map((entry) => entry.label);
    const transactionTrendValues = transactionTrend.map((entry) => entry.balance);
    const latestFilteredTransaction = filteredTransactions[0] || null;

    useEffect(() => {
        if (paymentFlowPurpose === "loan_repayment") {
            return;
        }

        if (paymentTargetAccounts.length && !paymentTargetAccounts.some((account) => account.id === contributionPaymentForm.getValues("account_id"))) {
            contributionPaymentForm.setValue("account_id", paymentTargetAccounts[0].id, { shouldValidate: true });
        }
    }, [contributionPaymentForm, paymentFlowPurpose, paymentTargetAccounts]);

    useEffect(() => {
        if (!trackedContributionOrder?.id || !["pending", "paid"].includes(trackedContributionOrder.status)) {
            return undefined;
        }

        const nextPollDelay = trackedContributionOrder.status === "pending"
            ? (phoneCancellationRequested ? PAYMENT_HANDSET_RESPONSE_POLL_MS : PAYMENT_PENDING_POLL_MS)
            : 2500;

        let cancelled = false;
        let timeoutId: number | undefined;

        const poll = async () => {
            await refreshTrackedPaymentOrder(false);

            if (cancelled) {
                return;
            }

            timeoutId = window.setTimeout(poll, nextPollDelay);
        };

        timeoutId = window.setTimeout(poll, nextPollDelay);

        return () => {
            cancelled = true;
            if (timeoutId) {
                window.clearTimeout(timeoutId);
            }
        };
    }, [trackedContributionOrder?.id, trackedContributionOrder?.status, phoneCancellationRequested, lastPaymentToastStatus]);

    useEffect(() => {
        if (trackedContributionOrder?.status !== "pending") {
            setPhoneCancellationRequested(false);
        }
    }, [trackedContributionOrder?.id, trackedContributionOrder?.status]);

    useEffect(() => {
        setTransactionsPage(0);
    }, [transactionSearch, transactionTypeFilter, transactionsRange.from, transactionsRange.to]);

    useEffect(() => {
        setContributionsPage(0);
    }, [contributionsRange.from, contributionsRange.to]);

    useEffect(() => {
        setPaymentsPage(0);
    }, [paymentPurposeFilter, paymentStatusFilter]);

    useEffect(() => {
        setAccountsPage(0);
    }, [accountsRange.from, accountsRange.to]);

    useEffect(() => {
        setLoanSchedulePage(0);
    }, [loansRange.from, loansRange.to, loanDetailId]);

    useEffect(() => {
        if (!filteredLoans.length) {
            if (loanDetailId) {
                setLoanDetailId("");
            }
            return;
        }

        const existsInFiltered = filteredLoans.some((loan) => loan.id === loanDetailId);
        if (!existsInFiltered) {
            setLoanDetailId(filteredLoans[0].id);
        }
    }, [filteredLoans, loanDetailId]);

    const selectedLoan = useMemo(
        () => filteredLoans.find((loan) => loan.id === loanDetailId) || filteredLoans[0] || null,
        [filteredLoans, loanDetailId]
    );
    const filteredLoanSchedules = useMemo(
        () =>
            loanSchedules
                .filter(
                    (schedule) =>
                        (!selectedLoan || schedule.loan_id === selectedLoan.id) &&
                        isWithinDateRange(schedule.due_date, loansRange)
                )
                .sort((left, right) => new Date(left.due_date).getTime() - new Date(right.due_date).getTime()),
        [loanSchedules, loansRange, selectedLoan]
    );
    const paginatedLoanSchedules = useMemo(
        () =>
            filteredLoanSchedules.slice(
                loanSchedulePage * loanScheduleRowsPerPage,
                loanSchedulePage * loanScheduleRowsPerPage + loanScheduleRowsPerPage
            ),
        [filteredLoanSchedules, loanSchedulePage, loanScheduleRowsPerPage]
    );
    const loanRepaymentHistory = useMemo(
        () =>
            sortedStatements.filter(
                (row) =>
                    row.transaction_type.includes("loan_repay") &&
                    isWithinDateRange(row.created_at || row.transaction_date, loansRange)
            ),
        [loansRange, sortedStatements]
    );
    const selectedLoanNextDue = useMemo(
        () => filteredLoanSchedules.find((schedule) => schedule.status !== "paid") || null,
        [filteredLoanSchedules]
    );
    const selectedLoanNextDueAmount = selectedLoanNextDue
        ? Math.max(selectedLoanNextDue.principal_due - selectedLoanNextDue.principal_paid, 0) +
          Math.max(selectedLoanNextDue.interest_due - selectedLoanNextDue.interest_paid, 0)
        : 0;
    const selectedLoanPenaltyEstimate = useMemo(
        () => filteredLoanSchedules.reduce((sum, schedule) => sum + estimatePenaltyForSchedule(schedule), 0),
        [filteredLoanSchedules]
    );
    const prepaymentProjection = useMemo(() => {
        if (!selectedLoan) {
            return null;
        }
        const newOutstanding = Math.max(selectedLoan.outstanding_principal - prepaymentAmount, 0);
        const installment = selectedLoan.term_count ? selectedLoan.principal_amount / selectedLoan.term_count : 0;
        const termsReduced = installment > 0 ? Math.floor(prepaymentAmount / installment) : 0;
        return {
            newOutstanding,
            termsReduced
        };
    }, [prepaymentAmount, selectedLoan]);

    const accountColumns: Column<MemberAccount>[] = [
        { key: "account", header: "Account", render: (row) => row.account_number },
        { key: "product", header: "Product", render: (row) => row.product_type },
        {
            key: "status",
            header: "Status",
            render: (row) => (
                <Chip
                    size="small"
                    label={row.status}
                    color={row.status === "active" ? "success" : row.status === "dormant" ? "warning" : "default"}
                    variant="outlined"
                />
            )
        },
        { key: "opened", header: "Opened", render: (row) => formatDate(row.created_at) },
        { key: "balance", header: "Balance", render: (row) => formatCurrency(row.available_balance) }
    ];

    const toggleDisputeFlag = (transactionId: string) => {
        setDisputedTransactionIds((current) =>
            current.includes(transactionId) ? current.filter((id) => id !== transactionId) : [...current, transactionId]
        );
    };

    const statementColumns: Column<StatementRow>[] = [
        { key: "date", header: "Date", render: (row) => formatDate(row.transaction_date) },
        { key: "reference", header: "Reference", render: (row) => getAuditReference(row) },
        { key: "type", header: "Type", render: (row) => formatTxType(row.transaction_type) },
        {
            key: "direction",
            header: "Dr/Cr",
            render: (row) => (
                <Chip
                    size="small"
                    label={row.direction === "in" ? "Credit" : "Debit"}
                    color={row.direction === "in" ? "success" : "error"}
                    variant={row.direction === "in" ? "filled" : "outlined"}
                />
            )
        },
        { key: "amount", header: "Amount", render: (row) => formatCurrency(row.amount) },
        { key: "balance", header: "Running Balance", render: (row) => formatCurrency(row.running_balance) },
        {
            key: "dispute",
            header: "Dispute",
            render: (row) => (
                <Button
                    size="small"
                    variant={disputedTransactionIds.includes(row.transaction_id) ? "contained" : "outlined"}
                    color={disputedTransactionIds.includes(row.transaction_id) ? "warning" : "inherit"}
                    onClick={() => toggleDisputeFlag(row.transaction_id)}
                    startIcon={<FlagRoundedIcon fontSize="small" />}
                    sx={
                        disputedTransactionIds.includes(row.transaction_id)
                            ? undefined
                            : {
                                borderColor: alpha(memberAccent, 0.34),
                                color: memberAccent,
                                "&:hover": { borderColor: alpha(memberAccent, 0.56), bgcolor: alpha(memberAccent, 0.08) }
                            }
                    }
                >
                    {disputedTransactionIds.includes(row.transaction_id) ? "Flagged" : "Flag"}
                </Button>
            )
        }
    ];

    const paymentOrderColumns: Column<PaymentOrder>[] = [
        {
            key: "purpose",
            header: "Payment",
            render: (row) => (
                <Stack spacing={0.35}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {formatPaymentPurpose(row.purpose)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {row.purpose === "loan_repayment"
                            ? row.loan_number || row.loan_id || "Loan target pending"
                            : row.account_name || row.account_number || row.account_id}
                    </Typography>
                </Stack>
            )
        },
        {
            key: "amount",
            header: "Amount",
            render: (row) => formatCurrency(row.amount)
        },
        {
            key: "provider",
            header: "Channel",
            render: (row) => row.provider.toUpperCase()
        },
        {
            key: "status",
            header: "Status",
            render: (row) => (
                <Chip
                    size="small"
                    label={formatPaymentStatus(row.status)}
                    color={row.status === "posted" ? "success" : row.status === "failed" ? "error" : row.status === "expired" ? "warning" : "info"}
                    variant={row.status === "posted" ? "filled" : "outlined"}
                />
            )
        },
        {
            key: "date",
            header: "Initiated",
            render: (row) => formatDate(row.created_at)
        },
        {
            key: "reference",
            header: "Reference",
            render: (row) => row.provider_ref || row.external_id
        },
        {
            key: "receipt",
            header: "Receipt",
            render: (row) => (
                <Button size="small" variant="outlined" onClick={() => setSelectedPaymentReceipt(row)}>
                    View Receipt
                </Button>
            )
        }
    ];

    const loanColumns: Column<Loan>[] = [
        { key: "loan", header: "Loan", render: (row) => row.loan_number },
        { key: "status", header: "Status", render: (row) => row.status },
        { key: "rate", header: "Rate", render: (row) => `${row.annual_interest_rate}%` },
        { key: "principal", header: "Outstanding", render: (row) => formatCurrency(row.outstanding_principal) },
        { key: "interest", header: "Accrued Interest", render: (row) => formatCurrency(row.accrued_interest) }
    ];

    const loanApplicationColumns: Column<LoanApplication>[] = [
        {
            key: "product",
            header: "Product",
            render: (row) => row.loan_products?.name || "Loan product"
        },
        {
            key: "amount",
            header: "Requested",
            render: (row) => formatCurrency(row.requested_amount)
        },
        {
            key: "status",
            header: "Status",
            render: (row) =>
                row.status === "rejected" ? (
                    <Stack spacing={0.35}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            Rejected
                        </Typography>
                        {row.rejection_reason ? (
                            <Typography variant="caption" color="error.main">
                                Reason: {row.rejection_reason}
                            </Typography>
                        ) : null}
                        {row.approval_notes ? (
                            <Typography variant="caption" color="text.secondary">
                                Notes: {row.approval_notes}
                            </Typography>
                        ) : null}
                    </Stack>
                ) : (
                    row.status.replace(/_/g, " ")
                )
        },
        {
            key: "updated",
            header: "Last Update",
            render: (row) => formatDate(row.updated_at)
        },
        {
            key: "actions",
            header: "Actions",
            render: (row) =>
                row.status === "rejected" ? (
                    <Button size="small" variant="outlined" onClick={() => openLoanApplicationEditor(row)}>
                        Edit & Resubmit
                    </Button>
                ) : row.status === "draft" ? (
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                        <Button size="small" variant="outlined" onClick={() => openLoanApplicationEditor(row)}>
                            Continue Draft
                        </Button>
                        <Button
                            size="small"
                            variant="text"
                            color="error"
                            onClick={() => setPendingDraftDeletion(row)}
                            disabled={deletingLoanApplicationId === row.id}
                        >
                            {deletingLoanApplicationId === row.id ? "Deleting..." : "Delete Draft"}
                        </Button>
                    </Stack>
                ) : (
                    <Chip size="small" variant="outlined" label={row.status === "submitted" ? "In review" : row.status.replace(/_/g, " ")} />
                )
        }
    ];

    const guarantorRequestColumns: Column<GuarantorRequestItem>[] = [
        {
            key: "borrower",
            header: "Borrower",
            render: (row) => row.borrower?.full_name || row.loan_application?.id || "Unknown"
        },
        {
            key: "amount",
            header: "Guaranteed Amount",
            render: (row) => formatCurrency(row.guaranteed_amount)
        },
        {
            key: "application_status",
            header: "Application",
            render: (row) => row.loan_application?.status?.replace(/_/g, " ") || "Unknown"
        },
        {
            key: "consent_status",
            header: "Your Consent",
            render: (row) => row.consent_status.replace(/_/g, " ")
        },
        {
            key: "actions",
            header: "Actions",
            render: (row) =>
                row.consent_status === "pending" ? (
                    <Stack direction="row" spacing={1}>
                        <Button
                            size="small"
                            variant="contained"
                            onClick={() => void respondGuarantorRequest(row, "accepted")}
                            disabled={processingGuarantorRequestId === row.id}
                        >
                            Accept
                        </Button>
                        <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={() => void respondGuarantorRequest(row, "rejected")}
                            disabled={processingGuarantorRequestId === row.id}
                        >
                            Reject
                        </Button>
                    </Stack>
                ) : (
                    <Chip size="small" label={row.consent_status.toUpperCase()} />
                )
        }
    ];

    const getApplicationTone = (status: LoanApplication["status"]) => {
        if (status === "approved") {
            return {
                icon: ApprovalRoundedIcon,
                color: brandColors.success,
                bg: alpha(brandColors.success, 0.12),
                label: "Approved"
            };
        }

        if (status === "appraised") {
            return {
                icon: TaskAltRoundedIcon,
                color: memberAccent,
                bg: alpha(memberAccent, 0.14),
                label: "Appraised"
            };
        }

        if (status === "rejected") {
            return {
                icon: HighlightOffRoundedIcon,
                color: brandColors.danger,
                bg: alpha(brandColors.danger, 0.12),
                label: "Rejected"
            };
        }

        if (status === "disbursed") {
            return {
                icon: CreditScoreRoundedIcon,
                color: memberAccent,
                bg: alpha(memberAccent, 0.14),
                label: "Disbursed"
            };
        }

        return {
            icon: HourglassTopRoundedIcon,
            color: brandColors.warning,
            bg: alpha(brandColors.warning, 0.12),
            label: status === "submitted" ? "Submitted" : "In progress"
        };
    };

    const loanProductOptions = loanProducts.map((product) => ({
        value: product.id,
        label: product.name,
        secondary: `${product.annual_interest_rate}% · ${formatCurrency(product.min_amount)} min · ${product.max_term_count || "Open"} term`
    }));

    const canApplyForLoan = true;

    const reloadLoanApplications = async (tenantId: string) => {
        const { data: applicationsResponse } = await api.get<LoanApplicationsResponse>(endpoints.loanApplications.list(), {
            params: { tenant_id: tenantId, page: 1, limit: 100 }
        });
        setLoanApplications(applicationsResponse.data || []);
    };

    const openLoanApplicationEditor = (application?: LoanApplication | null) => {
        setLoanFormStep(0);

        if (application) {
            setEditingLoanApplicationId(application.id);
            setRequestedAmountInput(formatWholeNumber(application.requested_amount));
            loanApplicationForm.reset({
                product_id: application.product_id,
                purpose: application.purpose,
                requested_amount: application.requested_amount,
                requested_term_count: application.requested_term_count,
                requested_repayment_frequency: application.requested_repayment_frequency,
                requested_interest_rate: application.requested_interest_rate ?? 0,
                external_reference: application.external_reference || "",
                confirmation_checked: false
            });
        } else {
            setEditingLoanApplicationId(null);
            setRequestedAmountInput("");
            loanApplicationForm.reset({
                product_id: "",
                purpose: "",
                requested_amount: 0,
                requested_term_count: 12,
                requested_repayment_frequency: "monthly",
                requested_interest_rate: 0,
                external_reference: "",
                confirmation_checked: false
            });
        }

        setShowApplyDialog(true);
    };

    const openLoanApplicationDraft = () => {
        if (selectedLoanDraft) {
            openLoanApplicationEditor(selectedLoanDraft);
            return;
        }

        openLoanApplicationEditor();
    };

    const closeLoanApplicationDialog = () => {
        setShowApplyDialog(false);
        setEditingLoanApplicationId(null);
        setPendingDraftDeletion(null);
        setRequestedAmountInput("");
        setLoanFormStep(0);
        loanApplicationForm.reset();
    };

    const confirmDeleteLoanApplicationDraft = async () => {
        if (!profile || !pendingDraftDeletion || pendingDraftDeletion.status !== "draft") {
            return;
        }

        setDeletingLoanApplicationId(pendingDraftDeletion.id);
        try {
            await api.delete(endpoints.loanApplications.detail(pendingDraftDeletion.id));
            if (editingLoanApplicationId === pendingDraftDeletion.id) {
                closeLoanApplicationDialog();
            }
            setPendingDraftDeletion(null);
            await reloadLoanApplications(profile.tenant_id);
            pushToast({
                type: "success",
                title: "Draft loan application deleted",
                message: "The draft was removed from your loan applications."
            });
        } catch (deleteError) {
            pushToast({
                type: "error",
                title: "Unable to delete draft",
                message: getApiErrorMessage(deleteError)
            });
        } finally {
            setDeletingLoanApplicationId(null);
        }
    };

    const handleAdvanceLoanFormStep = async () => {
        if (isLoanProductStep) {
            if (!loanApplicationForm.watch("product_id")) {
                loanApplicationForm.setError("product_id", { message: "Select a loan product." });
                return;
            }

            setLoanFormStep(1);
            return;
        }

        if (isLoanEligibilityStep) {
            setLoanFormStep(2);
            return;
        }

        if (isLoanDetailsStep) {
            const detailsValid = await loanApplicationForm.trigger([
                "purpose",
                "requested_amount",
                "requested_term_count",
                "requested_repayment_frequency"
            ]);

            if (detailsValid) {
                setLoanFormStep(3);
            }
        }
    };

    const handleRetreatLoanFormStep = () => {
        setLoanFormStep((current) => Math.max(0, current - 1));
    };

    const persistLoanApplication = async (
        values: z.infer<typeof loanApplicationSchema>,
        options: { submitAfterSave: boolean }
    ) => {
        if (!profile) {
            return;
        }

        const sanitizedPurpose = sanitizeLoanPurpose(values.purpose);
        const selectedProduct = loanProducts.find((product) => product.id === values.product_id) || null;
        const selectedFrequencies = resolveLoanAllowedFrequencies(selectedProduct);
        let hasClientValidationError = false;

        loanApplicationForm.clearErrors();

        if (!selectedProduct) {
            loanApplicationForm.setError("product_id", { message: "Select a loan product." });
            return;
        }

        if (options.submitAfterSave && memberRecord?.status !== "active") {
            pushToast({
                type: "error",
                title: "Member not eligible",
                message: "Only active members can submit loan applications."
            });
            return;
        }

        if (options.submitAfterSave && memberHasProblemLoan) {
            pushToast({
                type: "error",
                title: "Loan blocked",
                message: "You cannot submit a new loan application while you have in-arrears or written-off loans."
            });
            return;
        }

        if (options.submitAfterSave && selectedLoanConflict) {
            pushToast({
                type: "error",
                title: "Existing application in progress",
                message: "You already have another open loan application. Complete or resolve it before starting a new one."
            });
            return;
        }

        if (sanitizedPurpose.length < 20) {
            loanApplicationForm.setError("purpose", { message: "Loan purpose must be at least 20 characters" });
            hasClientValidationError = true;
        } else if (sanitizedPurpose.length > 500) {
            loanApplicationForm.setError("purpose", { message: "Loan purpose cannot exceed 500 characters" });
            hasClientValidationError = true;
        } else if (!loanPurposePattern.test(sanitizedPurpose)) {
            loanApplicationForm.setError("purpose", { message: "Loan purpose may contain only letters, numbers, spaces, commas, and periods" });
            hasClientValidationError = true;
        }

        if (values.requested_amount < selectedLoanMinimumAmount) {
            loanApplicationForm.setError("requested_amount", {
                message: `Requested amount must be at least ${formatCurrency(selectedLoanMinimumAmount)}`
            });
            hasClientValidationError = true;
        }

        if (values.requested_term_count < selectedLoanMinimumTerm || (selectedLoanMaximumTerm && values.requested_term_count > selectedLoanMaximumTerm)) {
            loanApplicationForm.setError("requested_term_count", {
                message: `Loan term must be between ${selectedLoanMinimumTerm} and ${selectedLoanMaximumTerm || selectedLoanMinimumTerm} months`
            });
            hasClientValidationError = true;
        }

        if (!selectedFrequencies.includes(values.requested_repayment_frequency)) {
            loanApplicationForm.setError("requested_repayment_frequency", {
                message: "Selected repayment frequency is not available for this loan product."
            });
            hasClientValidationError = true;
        }

        if (hasClientValidationError) {
            return;
        }

        setSubmittingApplication(true);
        try {
            const payload: CreateLoanApplicationRequest = {
                tenant_id: profile.tenant_id,
                branch_id: profile.branch_id || undefined,
                product_id: values.product_id,
                purpose: sanitizedPurpose,
                requested_amount: values.requested_amount,
                requested_term_count: values.requested_term_count,
                requested_repayment_frequency: values.requested_repayment_frequency,
                requested_interest_rate: selectedProduct.annual_interest_rate
            };

            const applicationId = editingLoanApplicationId
                ? (
                    await api.patch<LoanApplicationResponse>(
                        endpoints.loanApplications.update(editingLoanApplicationId),
                        payload as UpdateLoanApplicationRequest
                    )
                ).data.data.id
                : (
                    await api.post<LoanApplicationResponse>(endpoints.loanApplications.list(), payload)
                ).data.data.id;

            if (options.submitAfterSave) {
                await api.post<LoanApplicationResponse>(endpoints.loanApplications.submit(applicationId), {});
            }

            pushToast({
                type: "success",
                title: options.submitAfterSave
                    ? editingLoanApplicationId
                        ? "Loan application updated"
                        : "Loan application submitted"
                    : "Draft loan application saved",
                message: options.submitAfterSave
                    ? editingLoanApplicationId
                        ? "Your corrected application has been resubmitted for appraisal."
                        : "Your application is now waiting for appraisal."
                    : "Your draft changes were saved. You can submit the application once the current lock is cleared."
            });
            closeLoanApplicationDialog();
            await reloadLoanApplications(profile.tenant_id);
        } catch (loanApplicationError) {
            const errorCode = getApiErrorCode(loanApplicationError);
            const errorDetails = getApiErrorDetails<Record<string, unknown>>(loanApplicationError);
            const allowedLimit = getNumericDetail(errorDetails, "allowed_limit");
            const minimumAmount = getNumericDetail(errorDetails, "minimum_amount");
            let errorMessage = getApiErrorMessage(loanApplicationError);

            if (errorCode === "LOAN_BORROW_LIMIT_EXCEEDED" && allowedLimit !== null) {
                const formattedLimit = formatCurrency(allowedLimit);
                loanApplicationForm.setError("requested_amount", {
                    message: `Requested amount exceeds your current borrow limit of ${formattedLimit}`
                });
                errorMessage = `Requested amount exceeds your current borrow limit of ${formattedLimit}.`;
            } else if (errorCode === "LOAN_AMOUNT_BELOW_MINIMUM" && minimumAmount !== null) {
                loanApplicationForm.setError("requested_amount", {
                    message: `Requested amount must be at least ${formatCurrency(minimumAmount)}`
                });
                errorMessage = `Requested amount must be at least ${formatCurrency(minimumAmount)}.`;
            } else if (errorCode === "LOAN_POOL_TEMPORARILY_EXHAUSTED") {
                errorMessage = "SACCO loan pool temporarily exhausted. Please try again later.";
            }

            pushToast({
                type: "error",
                title: options.submitAfterSave
                    ? editingLoanApplicationId
                        ? "Unable to resubmit application"
                        : "Unable to submit application"
                    : "Unable to save draft",
                message: errorMessage
            });
        } finally {
            setSubmittingApplication(false);
        }
    };

    const submitLoanApplication = loanApplicationForm.handleSubmit(async (values) => {
        await persistLoanApplication(values, { submitAfterSave: true });
    });

    const saveLoanApplicationDraft = loanApplicationForm.handleSubmit(async (values) => {
        await persistLoanApplication(values, { submitAfterSave: false });
    });

    const respondGuarantorRequest = async (request: GuarantorRequestItem, decision: "accepted" | "rejected") => {
        if (!profile) {
            return;
        }

        setProcessingGuarantorRequestId(request.id);
        try {
            const payload: GuarantorConsentRequest = {
                tenant_id: profile.tenant_id,
                decision
            };

            await api.post<LoanApplicationResponse>(
                endpoints.loanApplications.guarantorConsent(request.application_id),
                payload
            );

            setGuarantorRequests((prev) =>
                prev.map((item) =>
                    item.id === request.id
                        ? {
                            ...item,
                            consent_status: decision,
                            consented_at: new Date().toISOString()
                        }
                        : item
                )
            );

            pushToast({
                type: "success",
                title: decision === "accepted" ? "Guarantor request accepted" : "Guarantor request rejected",
                message: decision === "accepted"
                    ? "Branch loan officers can now continue processing this application once all guarantors accept."
                    : "The application team has been notified that you rejected this guarantee request."
            });
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to update guarantor response",
                message: getApiErrorMessage(error)
            });
        } finally {
            setProcessingGuarantorRequestId(null);
        }
    };

    const handleSectionSelect = (sectionId: PortalSectionId) => {
        setActiveSection(sectionId);

        if (!isDesktop) {
            setMobileMenuOpen(false);
        }
    };

    const handleDownloadStatement = () => {
        if (!statements.length) {
            pushToast({
                type: "error",
                title: "No statement data",
                message: "No posted transactions are available to export yet."
            });
            return;
        }

        downloadMemberStatementPdf({
            memberName: profile?.full_name || "Member",
            memberEmail: user?.email || null,
            tenantName: selectedTenantName,
            branchName: selectedBranchName,
            generatedBy: profile?.full_name || user?.email || "Member Portal",
            totalSavings,
            shareCapital: totalShareCapital,
            outstandingLoan: totalOutstandingLoans,
            netPosition,
            statements
        });
    };

    const handleDownloadFilteredStatement = (rows: StatementRow[], title: string) => {
        if (!rows.length) {
            pushToast({
                type: "error",
                title: "No records to export",
                message: `No ${title.toLowerCase()} records available in the selected range.`
            });
            return;
        }

        downloadMemberStatementPdf({
            memberName: profile?.full_name || "Member",
            memberEmail: user?.email || null,
            tenantName: selectedTenantName,
            branchName: selectedBranchName,
            generatedBy: profile?.full_name || user?.email || "Member Portal",
            totalSavings,
            shareCapital: totalShareCapital,
            outstandingLoan: totalOutstandingLoans,
            netPosition,
            statements: rows
        });
    };

    const handleDownloadLoanStatement = () => {
        if (!selectedLoan) {
            pushToast({
                type: "error",
                title: "No loan selected",
                message: "Select a loan facility before exporting the statement."
            });
            return;
        }

        const selectedLoanTransactions = loanTransactions
            .filter((transaction) => transaction.loan_id === selectedLoan.id && isWithinDateRange(transaction.created_at, loansRange))
            .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());

        if (!filteredLoanSchedules.length && !selectedLoanTransactions.length) {
            pushToast({
                type: "error",
                title: "No loan statement data",
                message: "No schedules or loan transactions are available for the selected loan in the current range."
            });
            return;
        }

        downloadLoanStatementPdf({
            memberName: profile?.full_name || "Member",
            memberEmail: user?.email || null,
            tenantName: selectedTenantName,
            branchName: selectedBranchName,
            generatedBy: profile?.full_name || user?.email || "Member Portal",
            loan: selectedLoan,
            schedules: filteredLoanSchedules,
            transactions: selectedLoanTransactions
        });
    };

    const renderStatGrid = () => (
        <Box
            sx={{
                width: { xs: "calc(100vw - 20px)", sm: "100%" },
                maxWidth: { xs: "calc(100vw - 20px)", sm: "100%" },
                minWidth: 0,
                display: "grid",
                gap: 2,
                gridTemplateColumns: {
                    xs: "minmax(0, 1fr)",
                    sm: "repeat(2, minmax(0, 1fr))",
                    xl: "repeat(4, minmax(0, 1fr))"
                }
            }}
        >
            <Box sx={{ minWidth: 0 }}>
                <MetricCard
                    icon={WalletRoundedIcon}
                    label="Accounts Live"
                    value={accounts.length.toString().padStart(2, "0")}
                    helper={`${transactionCount} posted entries visible`}
                    tone="primary"
                    delta={hasNoVisibleFinancialData ? "New" : "Active"}
                />
            </Box>
            <Box sx={{ minWidth: 0 }}>
                <MetricCard
                    icon={TrendingUpRoundedIcon}
                    label="Total Bal"
                    value={formatCurrency(totalVisibleCapital)}
                    helper={`Latest visible balance ${formatCurrency(latestBalance)}`}
                    tone="success"
                    delta={totalVisibleCapital > 0 ? "Growing" : "Pending"}
                />
            </Box>
            <Box sx={{ minWidth: 0 }}>
                <MetricCard
                    icon={SavingsRoundedIcon}
                    label="Share Cap"
                    value={formatCurrency(totalShareCapital)}
                    helper={`${contributionHistory.length} share/dividend entries`}
                    tone="warning"
                    delta={totalDividends > 0 ? "Credited" : "Building"}
                />
            </Box>
            <Box sx={{ minWidth: 0 }}>
                <MetricCard
                    icon={CreditScoreRoundedIcon}
                    label="Loans"
                    value={formatCurrency(totalOutstandingLoans)}
                    helper={activeLoanCount ? `${activeLoanCount} active facility` : "No active loan exposure"}
                    tone="danger"
                    delta={activeLoanCount ? "Monitor" : "Clear"}
                />
            </Box>
        </Box>
    );

    const renderBorrowingCapacityCard = () => (
        <MotionCard
            variant="outlined"
            sx={{
                ...contentCardSx,
                borderRadius: 4
            }}
        >
            <CardContent sx={{ p: { xs: 2.4, md: 2.8 }, display: "grid", gap: 2 }}>
                <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={1.5}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", md: "center" }}
                >
                    <Box>
                        <Typography variant="overline" sx={{ letterSpacing: "0.18em", color: "text.secondary" }}>
                            Your Borrowing Capacity
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.35 }}>
                            {dashboardLoanCapacityLoading
                                ? "Refreshing current limits..."
                                : dashboardLoanProduct?.name
                                    ? `Based on ${dashboardLoanProduct.name}`
                                    : "Current lending position"}
                        </Typography>
                    </Box>
                    <Chip
                        label={
                            dashboardLiquidityStatus
                                ? dashboardLiquidityStatus
                                : dashboardLoanCapacityError
                                    ? "Capacity unavailable"
                                    : "Live capacity"
                        }
                        sx={{
                            borderRadius: 1.4,
                            fontWeight: 700,
                            bgcolor: dashboardLiquidityStatus === "Healthy"
                                ? alpha(brandColors.success, 0.14)
                                : dashboardLiquidityStatus === "Warning"
                                    ? alpha(brandColors.warning, 0.18)
                                    : dashboardLiquidityStatus === "Risk" || dashboardLiquidityStatus === "Frozen"
                                        ? alpha(brandColors.danger, 0.14)
                                        : alpha(memberAccent, 0.12),
                            color: dashboardLiquidityStatus === "Healthy"
                                ? brandColors.success
                                : dashboardLiquidityStatus === "Warning"
                                    ? "#9A6700"
                                    : dashboardLiquidityStatus === "Risk" || dashboardLiquidityStatus === "Frozen"
                                        ? brandColors.danger
                                        : memberAccent
                        }}
                    />
                </Stack>
                <Box
                    sx={{
                        display: "grid",
                        gap: 2,
                        gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(3, minmax(0, 1fr))" }
                    }}
                >
                    <Box sx={{ minWidth: 0 }}>
                        <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 2.5, height: "100%" }}>
                            <Typography variant="caption" color="text.secondary">
                                Maximum Loan Available
                            </Typography>
                            <Typography variant="h6" sx={{ mt: 0.5, fontWeight: 800 }}>
                                {formatCurrency(dashboardMaximumBorrowable)}
                            </Typography>
                        </Paper>
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                        <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 2.5, height: "100%" }}>
                            <Typography variant="caption" color="text.secondary">
                                Current Loan Exposure
                            </Typography>
                            <Typography variant="h6" sx={{ mt: 0.5, fontWeight: 800 }}>
                                {formatCurrency(dashboardCurrentLoanExposure)}
                            </Typography>
                        </Paper>
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                        <Paper
                            variant="outlined"
                            sx={{
                                p: 1.75,
                                borderRadius: 2.5,
                                height: "100%",
                                bgcolor: alpha(memberAccent, isDarkMode ? 0.14 : 0.06),
                                borderColor: alpha(memberAccent, 0.24)
                            }}
                        >
                            <Typography variant="caption" color="text.secondary">
                                Remaining Borrow Capacity
                            </Typography>
                            <Typography variant="h6" sx={{ mt: 0.5, fontWeight: 800 }}>
                                {formatCurrency(dashboardRemainingBorrowCapacity)}
                            </Typography>
                        </Paper>
                    </Box>
                </Box>
                <Typography variant="body2" color="text.secondary">
                    {dashboardLoanCapacityError
                        ? dashboardLoanCapacityError
                        : "This view is informational. Final approval still goes through branch appraisal and approval workflow."}
                </Typography>
            </CardContent>
        </MotionCard>
    );

    const renderHero = () => (
        <MotionCard
            sx={{
                width: { xs: "calc(100vw - 20px)", sm: "100%" },
                minWidth: 0,
                maxWidth: { xs: "calc(100vw - 20px)", sm: "100%" },
                borderRadius: { xs: 3, md: 4 },
                height: "100%",
                color: theme.palette.mode === "dark" ? "#fff" : brandColors.neutral.textPrimary,
                overflow: "hidden",
                border: theme.palette.mode === "dark"
                    ? "1px solid rgba(255,255,255,0.06)"
                    : `1px solid ${alpha(brandColors.primary[300], 0.34)}`,
                position: "relative",
                background: theme.palette.mode === "dark"
                    ? `linear-gradient(135deg, ${darkThemeColors.elevated}, ${alpha(memberAccentStrong, 0.54)})`
                    : `linear-gradient(135deg, ${alpha("#FFFFFF", 0.99)} 0%, ${alpha("#F8FBFF", 0.98)} 56%, ${alpha("#EEF4FF", 0.96)} 100%)`,
                boxShadow: theme.palette.mode === "dark"
                    ? `0 18px 40px ${alpha(memberAccentStrong, 0.22)}`
                    : `0 18px 40px ${alpha(brandColors.primary[300], 0.18)}`,
                "&::before": {
                    content: '""',
                    position: "absolute",
                    inset: 0,
                    background: theme.palette.mode === "dark"
                        ? `radial-gradient(circle at 18% 18%, ${alpha("#FFFFFF", 0.16)} 0%, transparent 34%),
                            radial-gradient(circle at 82% 24%, ${alpha(memberAccentAlt, 0.3)} 0%, transparent 28%),
                            radial-gradient(circle at 75% 78%, ${alpha("#6EA8FF", 0.22)} 0%, transparent 30%)`
                        : `radial-gradient(circle at 14% 18%, ${alpha(brandColors.primary[100], 0.9)} 0%, transparent 34%),
                            radial-gradient(circle at 84% 20%, ${alpha(brandColors.accent[100], 0.82)} 0%, transparent 28%),
                            radial-gradient(circle at 74% 80%, ${alpha(brandColors.primary[300], 0.18)} 0%, transparent 28%)`,
                    pointerEvents: "none"
                }
            }}
        >
            <CardContent sx={{ position: "relative", p: { xs: 2.25, sm: 2.5, md: 4 }, height: "100%" }}>
                <Stack direction={{ xs: "column", xl: "row" }} spacing={3} justifyContent="space-between" sx={{ height: "100%" }}>
                    <Stack spacing={1.25} sx={{ maxWidth: 640, minWidth: 0 }}>
                        <Typography
                            variant="overline"
                            sx={{
                                color: theme.palette.mode === "dark" ? alpha("#FFFFFF", 0.72) : alpha(brandColors.neutral.textSecondary, 0.9),
                                letterSpacing: "0.22em"
                            }}
                        >
                            Member Dashboard
                        </Typography>
                        <Typography
                            variant="h3"
                            sx={{
                                fontWeight: 800,
                                letterSpacing: "-0.03em",
                                lineHeight: 1.05,
                                fontSize: { xs: "2.55rem", sm: "3rem", md: undefined },
                                overflowWrap: "anywhere"
                            }}
                        >
                            Welcome back, {profile?.full_name?.split(" ")[0] || "Member"}.
                        </Typography>
                        <Typography
                            variant="body1"
                            sx={{
                                color: theme.palette.mode === "dark" ? alpha("#FFFFFF", 0.78) : brandColors.neutral.textSecondary,
                                maxWidth: 560,
                                overflowWrap: "anywhere"
                            }}
                        >
                            Track your savings, share capital, loan obligations, and contribution history from one secure workspace tied to {selectedTenantName || "your SACCOS"}.
                        </Typography>
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ pt: 0.85, minWidth: 0 }}>
                            <Chip
                                label={selectedBranchName || "Assigned branch"}
                                sx={{
                                    maxWidth: "100%",
                                    bgcolor: theme.palette.mode === "dark" ? alpha("#FFFFFF", 0.12) : alpha(brandColors.primary[100], 0.92),
                                    color: theme.palette.mode === "dark" ? "#fff" : brandColors.primary[900],
                                    borderRadius: 1.5,
                                    backdropFilter: "blur(10px)",
                                    border: theme.palette.mode === "dark" ? "none" : `1px solid ${alpha(brandColors.primary[300], 0.36)}`,
                                    fontWeight: 700,
                                    "& .MuiChip-label": {
                                        display: "block",
                                        whiteSpace: "normal"
                                    }
                                }}
                            />
                            <Chip
                                label={hasNoVisibleFinancialData ? "Awaiting first posted activity" : "Financial activity visible"}
                                sx={{
                                    maxWidth: "100%",
                                    bgcolor: theme.palette.mode === "dark"
                                        ? hasNoVisibleFinancialData ? alpha("#FFFFFF", 0.08) : alpha(brandColors.success, 0.18)
                                        : hasNoVisibleFinancialData ? alpha(brandColors.warning, 0.12) : alpha(brandColors.success, 0.12),
                                    color: theme.palette.mode === "dark"
                                        ? "#fff"
                                        : hasNoVisibleFinancialData ? "#9A6700" : brandColors.success,
                                    borderRadius: 1.5,
                                    "& .MuiChip-label": {
                                        display: "block",
                                        whiteSpace: "normal"
                                    }
                                }}
                            />
                        </Stack>
                    </Stack>
                    <Paper
                        variant="outlined"
                        sx={{
                            width: "100%",
                            minWidth: 0,
                            maxWidth: { xs: "100%", xl: 360 },
                            p: { xs: 1.5, sm: 2 },
                            borderRadius: { xs: 2.2, md: 3 },
                            bgcolor: theme.palette.mode === "dark" ? alpha("#030712", 0.2) : alpha("#FFFFFF", 0.9),
                            borderColor: theme.palette.mode === "dark"
                                ? alpha("#FFFFFF", 0.12)
                                : alpha(brandColors.primary[300], 0.34),
                            backdropFilter: "blur(16px)",
                            boxShadow: theme.palette.mode === "dark"
                                ? "none"
                                : `0 12px 28px ${alpha(brandColors.primary[300], 0.12)}`
                        }}
                    >
                        <Stack spacing={1.6}>
                            <Stack
                                direction={{ xs: "column", sm: "row" }}
                                justifyContent="space-between"
                                alignItems={{ xs: "flex-start", sm: "center" }}
                                spacing={1}
                            >
                                <Typography
                                    variant="overline"
                                    sx={{
                                        color: theme.palette.mode === "dark" ? alpha("#FFFFFF", 0.68) : alpha(brandColors.neutral.textSecondary, 0.9),
                                        letterSpacing: "0.18em"
                                    }}
                                >
                                    Today
                                </Typography>
                                <Chip
                                    size="small"
                                    label={standing.label}
                                    sx={{
                                        maxWidth: "100%",
                                        bgcolor: theme.palette.mode === "dark" ? alpha("#FFFFFF", 0.12) : alpha(brandColors.primary[100], 0.9),
                                        color: theme.palette.mode === "dark" ? "#fff" : brandColors.primary[900],
                                        fontWeight: 700,
                                        alignSelf: { xs: "flex-start", sm: "auto" },
                                        "& .MuiChip-label": {
                                            px: { xs: 1.2, sm: 1.5 }
                                        }
                                    }}
                                />
                            </Stack>
                            <Box>
                                <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.15 }}>
                                    {nextPaymentDue ? formatDate(nextPaymentDue) : "No installment due"}
                                </Typography>
                                <Typography
                                    variant="body2"
                                    sx={{
                                        color: theme.palette.mode === "dark" ? alpha("#FFFFFF", 0.72) : brandColors.neutral.textSecondary,
                                        mt: 0.75
                                    }}
                                >
                                    {nextPaymentDue
                                        ? `Next scheduled loan repayment is ${formatCurrency(monthlyInstallment)}.`
                                        : "Use this portal to keep savings, contributions, and loan activity moving without visiting the branch."}
                                </Typography>
                            </Box>
                            <Box
                                sx={{
                                    display: "grid",
                                    gap: 1.2,
                                    gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }
                                }}
                            >
                                <Box sx={{ minWidth: 0 }}>
                                    <Paper
                                        sx={{
                                            p: 1.25,
                                            borderRadius: 2,
                                            bgcolor: theme.palette.mode === "dark" ? alpha("#FFFFFF", 0.08) : alpha(brandColors.primary[100], 0.54),
                                            border: theme.palette.mode === "dark"
                                                ? `1px solid ${alpha("#FFFFFF", 0.1)}`
                                                : `1px solid ${alpha(brandColors.primary[300], 0.28)}`
                                        }}
                                    >
                                        <Typography
                                            variant="caption"
                                            sx={{ color: theme.palette.mode === "dark" ? alpha("#FFFFFF", 0.68) : brandColors.neutral.textSecondary }}
                                        >
                                            Pending payments
                                        </Typography>
                                        <Typography variant="h5" sx={{ mt: 0.45, fontWeight: 800 }}>
                                            {pendingPaymentCount}
                                        </Typography>
                                    </Paper>
                                </Box>
                                <Box sx={{ minWidth: 0 }}>
                                    <Paper
                                        sx={{
                                            p: 1.25,
                                            borderRadius: 2,
                                            bgcolor: theme.palette.mode === "dark" ? alpha("#FFFFFF", 0.08) : alpha(brandColors.primary[100], 0.54),
                                            border: theme.palette.mode === "dark"
                                                ? `1px solid ${alpha("#FFFFFF", 0.1)}`
                                                : `1px solid ${alpha(brandColors.primary[300], 0.28)}`
                                        }}
                                    >
                                        <Typography
                                            variant="caption"
                                            sx={{ color: theme.palette.mode === "dark" ? alpha("#FFFFFF", 0.68) : brandColors.neutral.textSecondary }}
                                        >
                                            Active loans
                                        </Typography>
                                        <Typography variant="h5" sx={{ mt: 0.45, fontWeight: 800 }}>
                                            {activeLoanCount}
                                        </Typography>
                                    </Paper>
                                </Box>
                            </Box>
                            <Stack
                                direction={{ xs: "column", sm: "row" }}
                                spacing={1.25}
                                useFlexGap
                                sx={{ "& > *": { width: { xs: "100%", sm: "auto" } } }}
                            >
                                <Button
                                    variant="contained"
                                    onClick={() => handleSectionSelect("member-accounts")}
                                    endIcon={<EastRoundedIcon />}
                                    sx={{
                                        borderRadius: 1.8,
                                        px: 2.4,
                                        py: 1.1,
                                        bgcolor: theme.palette.mode === "dark" ? memberAccent : brandColors.primary[700],
                                        color: "#fff",
                                        boxShadow: "none",
                                        fontWeight: 700,
                                        minHeight: 44,
                                        "&:hover": {
                                            bgcolor: theme.palette.mode === "dark" ? memberAccentAlt : brandColors.primary[900],
                                            boxShadow: "none"
                                        }
                                    }}
                                >
                                    View Accounts
                                </Button>
                                <Button
                                    variant="outlined"
                                    onClick={() => handleSectionSelect("member-loans")}
                                    endIcon={<NorthEastRoundedIcon />}
                                    sx={{
                                        borderRadius: 1.8,
                                        px: 2.4,
                                        py: 1.1,
                                        color: theme.palette.mode === "dark" ? "#fff" : brandColors.primary[900],
                                        borderColor: theme.palette.mode === "dark"
                                            ? alpha("#FFFFFF", 0.2)
                                            : alpha(brandColors.primary[300], 0.42),
                                        fontWeight: 700,
                                        minHeight: 44,
                                        "&:hover": {
                                            borderColor: theme.palette.mode === "dark"
                                                ? alpha("#FFFFFF", 0.38)
                                                : alpha(brandColors.primary[700], 0.46),
                                            bgcolor: theme.palette.mode === "dark"
                                                ? alpha("#FFFFFF", 0.05)
                                                : alpha(brandColors.primary[100], 0.55)
                                        }
                                    }}
                                >
                                    Review Loans
                                </Button>
                            </Stack>
                        </Stack>
                    </Paper>
                </Stack>
            </CardContent>
        </MotionCard>
    );

    const renderSpotlightCard = () => (
        <MotionCard
            sx={{
                width: { xs: "calc(100vw - 20px)", sm: "100%" },
                minWidth: 0,
                maxWidth: { xs: "calc(100vw - 20px)", sm: "100%" },
                borderRadius: { xs: 3, md: 4 },
                height: "100%",
                overflow: "hidden",
                color: theme.palette.mode === "dark" ? "#fff" : brandColors.neutral.textPrimary,
                background: theme.palette.mode === "dark"
                    ? "linear-gradient(180deg, #030712 0%, #101828 100%)"
                    : `linear-gradient(180deg, ${alpha("#FFFFFF", 0.99)} 0%, ${alpha("#F8FAFF", 0.98)} 100%)`,
                border: theme.palette.mode === "dark"
                    ? "none"
                    : `1px solid ${alpha(brandColors.primary[300], 0.28)}`,
                boxShadow: theme.palette.mode === "dark"
                    ? `0 20px 38px ${alpha("#020617", 0.24)}`
                    : `0 20px 38px ${alpha(brandColors.primary[300], 0.14)}`
            }}
        >
            <CardContent sx={{ p: { xs: 2.25, sm: 2.5, md: 3 }, height: "100%" }}>
                    <Stack spacing={{ xs: 1.6, md: 2.25 }} sx={{ height: "100%" }}>
                    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={1}>
                        <Stack direction="row" spacing={0.8} alignItems="center" sx={{ minWidth: 0 }}>
                            <Box sx={{ display: "flex", gap: 0.9 }}>
                                {[0, 1, 2].map((index) => (
                                    <Box
                                        key={index}
                                        sx={{
                                            width: 9,
                                            height: 9,
                                            borderRadius: "50%",
                                            bgcolor: index === 2
                                                ? brandColors.success
                                                : theme.palette.mode === "dark"
                                                    ? alpha("#FFFFFF", 0.22)
                                                    : alpha(brandColors.neutral.textMuted, 0.42)
                                        }}
                                    />
                                ))}
                            </Box>
                            <Typography
                                variant="overline"
                                sx={{
                                    color: theme.palette.mode === "dark" ? alpha("#FFFFFF", 0.7) : alpha(brandColors.neutral.textSecondary, 0.86),
                                    letterSpacing: "0.16em"
                                }}
                            >
                                Member feed
                            </Typography>
                        </Stack>
                        <Chip
                            size="small"
                            label={failedPaymentCount ? `${failedPaymentCount} issue${failedPaymentCount === 1 ? "" : "s"}` : "Stable"}
                            sx={{
                                maxWidth: "100%",
                                bgcolor: failedPaymentCount ? alpha(brandColors.danger, 0.22) : alpha(brandColors.success, 0.18),
                                color: theme.palette.mode === "dark" ? "#fff" : failedPaymentCount ? brandColors.danger : brandColors.success,
                                fontWeight: 700,
                                alignSelf: { xs: "flex-start", sm: "auto" },
                                "& .MuiChip-label": {
                                    display: "block",
                                    whiteSpace: "normal"
                                }
                            }}
                        />
                    </Stack>

                    <Box>
                        <Typography
                            variant="overline"
                            sx={{
                                color: theme.palette.mode === "dark" ? alpha(memberAccentAlt, 0.92) : brandColors.accent[700],
                                letterSpacing: "0.18em"
                            }}
                        >
                            Featured status
                        </Typography>
                        <Typography
                            variant="h4"
                            sx={{
                                mt: 1.2,
                                fontWeight: 800,
                                lineHeight: 1.08,
                                fontSize: { xs: "2.1rem", sm: "2.45rem", md: undefined },
                                overflowWrap: "anywhere"
                            }}
                        >
                            {hasOverdueLoan
                                ? "Repayment attention is needed."
                                : activeLoanCount
                                    ? "Your active lending position is live."
                                    : "Your self-service workspace is ready."}
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                mt: 1.15,
                                color: theme.palette.mode === "dark" ? alpha("#FFFFFF", 0.72) : brandColors.neutral.textSecondary,
                                overflowWrap: "anywhere"
                            }}
                        >
                            {hasOverdueLoan
                                ? "An installment is overdue. Use the portal or branch team to settle the due amount quickly."
                                : activeLoanCount
                                    ? "Track obligations, see repayment due dates, and keep collections current from your member dashboard."
                                    : "Start deposits, contributions, and membership actions from one secure member portal session."}
                        </Typography>
                    </Box>

                    <Stack spacing={1.15} sx={{ mt: "auto" }}>
                        {[
                            {
                                icon: EventRoundedIcon,
                                label: "Next due",
                                value: nextPaymentDue ? `${formatDate(nextPaymentDue)} · ${formatCurrency(monthlyInstallment)}` : "No due installment"
                            },
                            {
                                icon: WorkspacesRoundedIcon,
                                label: "Pending mobile money",
                                value: pendingPaymentCount ? `${pendingPaymentCount} order${pendingPaymentCount === 1 ? "" : "s"} awaiting completion` : "No pending order"
                            },
                            {
                                icon: ApprovalRoundedIcon,
                                label: "Loan workflow",
                                value: pendingLoanApplications.length
                                    ? `${pendingLoanApplications.length} application${pendingLoanApplications.length === 1 ? "" : "s"} in progress`
                                    : pendingGuarantorRequests.length
                                        ? `${pendingGuarantorRequests.length} guarantor request${pendingGuarantorRequests.length === 1 ? "" : "s"} awaiting action`
                                        : "No open loan workflow"
                            }
                        ].map((item) => {
                            const Icon = item.icon;

                            return (
                                <Paper
                                    key={item.label}
                                    variant="outlined"
                                    sx={{
                                        p: { xs: 1.1, md: 1.35 },
                                        borderRadius: { xs: 1.6, md: 2.2 },
                                        bgcolor: theme.palette.mode === "dark" ? alpha("#FFFFFF", 0.04) : alpha(brandColors.primary[100], 0.42),
                                        borderColor: theme.palette.mode === "dark"
                                            ? alpha("#FFFFFF", 0.08)
                                            : alpha(brandColors.primary[300], 0.24)
                                    }}
                                >
                                    <Stack direction="row" spacing={1.1} alignItems="center">
                                        <Box
                                            sx={{
                                                width: 34,
                                                height: 34,
                                                borderRadius: 1.6,
                                                display: "grid",
                                                placeItems: "center",
                                                bgcolor: theme.palette.mode === "dark" ? alpha(memberAccentAlt, 0.16) : alpha(brandColors.accent[500], 0.12),
                                                color: theme.palette.mode === "dark" ? memberAccentAlt : brandColors.accent[700]
                                            }}
                                        >
                                            <Icon fontSize="small" />
                                        </Box>
                                        <Box sx={{ minWidth: 0 }}>
                                            <Typography
                                                variant="caption"
                                                sx={{ color: theme.palette.mode === "dark" ? alpha("#FFFFFF", 0.58) : brandColors.neutral.textSecondary }}
                                            >
                                                {item.label}
                                            </Typography>
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    color: theme.palette.mode === "dark" ? "#fff" : brandColors.neutral.textPrimary,
                                                    fontWeight: 600,
                                                    overflowWrap: "anywhere"
                                                }}
                                            >
                                                {item.value}
                                            </Typography>
                                        </Box>
                                    </Stack>
                                </Paper>
                            );
                        })}
                    </Stack>
                </Stack>
            </CardContent>
        </MotionCard>
    );

    const renderSectionLead = () => (
        <MotionCard
            variant="outlined"
            sx={{
                ...contentCardSx,
                borderRadius: 3,
                background: theme.palette.mode === "dark"
                    ? `linear-gradient(135deg, ${alpha(darkThemeColors.elevated, 0.92)}, ${alpha(memberAccentStrong, 0.18)})`
                    : `linear-gradient(135deg, ${alpha("#FFFFFF", 0.98)}, ${alpha(brandColors.primary[100], 0.76)})`
            }}
        >
            <CardContent sx={{ p: { xs: 2.25, md: 2.75 } }}>
                <Stack direction={{ xs: "column", lg: "row" }} spacing={2} justifyContent="space-between" alignItems={{ lg: "center" }}>
                    <Box sx={{ maxWidth: 720 }}>
                        <Typography variant="overline" sx={{ color: memberAccent, letterSpacing: "0.16em" }}>
                            Current section
                        </Typography>
                        <Typography variant="h5" sx={{ mt: 0.7, fontWeight: 800, letterSpacing: "-0.02em" }}>
                            {currentView.label}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.8 }}>
                            {currentView.subtitle}
                        </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ "& > *": { maxWidth: "100%" } }}>
                        <Chip label={selectedBranchName || "Assigned branch"} variant="outlined" />
                        <Chip label={standing.label} variant="outlined" />
                        <Chip label={`${pendingPaymentCount} pending payment${pendingPaymentCount === 1 ? "" : "s"}`} variant="outlined" />
                        <Chip label={`${activeLoanCount} active loan${activeLoanCount === 1 ? "" : "s"}`} variant="outlined" />
                    </Stack>
                </Stack>
            </CardContent>
        </MotionCard>
    );

    const renderOverviewView = () => (
        <MemberOverview
            summary={{
                totalSavings,
                totalShareCapital,
                outstandingLoan: totalOutstandingLoans,
                availableToWithdraw: availableSavings,
                netPosition
            }}
            standing={standing}
            savingsCard={{
                totalSavings,
                availableBalance: availableSavings,
                lockedAmount: lockedSavings
            }}
            shareCard={{
                totalShares: totalShareCapital,
                dividendEarned: totalDividends,
                lastContributionDate: lastContribution?.transaction_date || null
            }}
            loanExposure={{
                outstandingAmount: totalOutstandingLoans,
                nextInstallmentDueDate: nextPaymentDue,
                monthlyInstallment,
                loanProgressPercent,
                activeLoans: activeLoanCount
            }}
            recentActivity={{
                lastTransactionDate: statements[0]?.transaction_date || null,
                lastContribution,
                lastLoanPayment
            }}
            alerts={memberAlerts}
            savingsTrend={{
                labels: savingsTrendLabels.length ? savingsTrendLabels : chartLabels,
                values: savingsTrendValues.length ? savingsTrendValues : chartValues
            }}
            transactions={statements}
            onApplyLoan={() => {
                handleSectionSelect("member-loans");
                if (canApplyForLoan) {
                    openLoanApplicationDraft();
                }
            }}
            onMakeContribution={() => handleSectionSelect("member-contributions")}
            onDownloadStatement={handleDownloadStatement}
            onViewFullStatement={() => handleSectionSelect("member-transactions")}
        />
    );

    const renderAccountsView = () => (
        <Stack spacing={3}>
            <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                    <AccountSummaryCard
                        icon={SavingsRoundedIcon}
                        label="Savings Balance"
                        value={formatCurrency(totalSavings)}
                        helper="Visible savings accounts combined."
                        tone="primary"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                    <AccountSummaryCard
                        icon={AccountBalanceWalletRoundedIcon}
                        label="Share Capital"
                        value={formatCurrency(totalShareCapital)}
                        helper="Visible paid-in shares and capital contributions."
                        tone="warning"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                    <AccountSummaryCard
                        icon={WalletRoundedIcon}
                        label="Visible Accounts"
                        value={filteredAccounts.length}
                        helper="Savings and share products in selected range."
                        tone="success"
                    />
                </Grid>
            </Grid>

            {canUsePortalDeposits ? (
                <MotionCard variant="outlined" sx={contentCardSx}>
                    <CardContent sx={{ p: { xs: 2.25, md: 2.75 } }}>
                        <Grid container spacing={2.5} alignItems="center">
                            <Grid size={{ xs: 12, md: 7 }}>
                                <Stack spacing={1.15}>
                                    <Typography variant="overline" sx={{ color: memberAccent, letterSpacing: 1.4 }}>
                                        Mobile Money Deposit
                                    </Typography>
                                    <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: "-0.02em" }}>
                                        Deposit into savings or contributions from one portal flow.
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Start one Mobile Money deposit request, choose whether it goes to savings or share contributions, approve it on your phone, and the backend will post it automatically after confirmation.
                                    </Typography>
                                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                        <Chip label={`${savingsAccounts.length} savings account(s)`} variant="outlined" />
                                        <Chip label={`${shareAccounts.length} share account(s)`} variant="outlined" />
                                        <Chip
                                            label={
                                                latestSavingsPaymentOrder || latestSharePaymentOrder
                                                    ? `Latest activity ${(latestSavingsPaymentOrder || latestSharePaymentOrder)?.status.replace(/_/g, " ")}`
                                                    : "No active deposit"
                                            }
                                            variant="outlined"
                                        />
                                    </Stack>
                                </Stack>
                            </Grid>
                            <Grid size={{ xs: 12, md: 5 }}>
                                <Stack spacing={1.1} alignItems={{ xs: "stretch", md: "flex-end" }}>
                                    <Button
                                        variant="contained"
                                        onClick={() => openDepositDialog("savings_deposit")}
                                        disabled={submittingContribution}
                                        sx={
                                            isDarkMode
                                                ? { bgcolor: memberAccent, color: "#1a1a1a", "&:hover": { bgcolor: memberAccentAlt } }
                                                : undefined
                                        }
                                    >
                                        Make Deposit
                                    </Button>
                                    {latestSavingsPaymentOrder?.status === "paid" && !latestSavingsPaymentOrder.posted_at ? (
                                        <Button
                                            variant="outlined"
                                            onClick={() => void handleReconcilePaymentOrder()}
                                            disabled={reconcilingPayment}
                                        >
                                            {reconcilingPayment ? "Reconciling..." : "Reconcile Payment"}
                                        </Button>
                                    ) : null}
                                </Stack>
                            </Grid>
                        </Grid>
                        {!savingsAccounts.length && !shareAccounts.length ? (
                            <Alert severity="info" variant="outlined" sx={{ mt: 2 }}>
                                A branch manager must provision at least one savings or share account before this portal can start member deposits.
                            </Alert>
                        ) : null}
                        {latestSavingsPaymentOrder ? (
                            <Alert
                                severity={
                                    latestSavingsPaymentOrder.status === "posted"
                                        ? "success"
                                        : latestSavingsPaymentOrder.status === "failed"
                                            ? "error"
                                            : latestSavingsPaymentOrder.status === "expired"
                                                ? "warning"
                                                : "info"
                                }
                                variant="outlined"
                                sx={{ mt: 2, alignItems: "flex-start" }}
                            >
                                <Stack spacing={0.5}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                        {latestSavingsPaymentOrder.status === "posted"
                                            ? "Savings deposit completed"
                                            : latestSavingsPaymentOrder.status === "paid"
                                                ? "Payment received, posting in progress"
                                                : latestSavingsPaymentOrder.status === "pending"
                                                ? "Awaiting member approval"
                                                : latestSavingsPaymentOrder.status === "failed"
                                                    ? "Payment failed"
                                                    : latestSavingsPaymentOrder.status === "expired"
                                                        ? "Payment expired"
                                                        : `Order ${latestSavingsPaymentOrder.status.replace(/_/g, " ")}`}
                                </Typography>
                                <Typography variant="body2">
                                    {formatCurrency(latestSavingsPaymentOrder.amount)} via {latestSavingsPaymentOrder.provider.toUpperCase()} · Ref {latestSavingsPaymentOrder.provider_ref || latestSavingsPaymentOrder.external_id}
                                </Typography>
                                {latestSavingsPaymentOrder.journal_id ? (
                                    <Typography variant="body2">Journal posted: {latestSavingsPaymentOrder.journal_id}</Typography>
                                ) : null}
                                {latestSavingsPaymentOrder.error_message ? (
                                    <Typography variant="body2">{latestSavingsPaymentOrder.error_message}</Typography>
                                ) : null}
                            </Stack>
                            </Alert>
                        ) : null}
                    </CardContent>
                </MotionCard>
            ) : null}

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                    <MotionCard variant="outlined" sx={contentCardSx}>
                        <CardContent sx={{ p: 2.25 }}>
                            <Stack spacing={1.5}>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Box
                                        sx={{
                                            width: 30,
                                            height: 30,
                                            borderRadius: 1.25,
                                            display: "grid",
                                            placeItems: "center",
                                            bgcolor: memberAccentSoftBg,
                                            color: memberAccent
                                        }}
                                    >
                                        <ShieldRoundedIcon fontSize="small" />
                                    </Box>
                                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                        Product Rules Visibility
                                    </Typography>
                                </Stack>

                                <Stack spacing={1}>
                                    {[
                                        "Savings minimum balance: TSh 50,000 (tenant policy)",
                                        "Withdrawal limit: branch policy with teller review threshold",
                                        "Dormant accounts: no qualifying movement in policy period"
                                    ].map((rule) => (
                                        <Paper
                                            key={rule}
                                            variant="outlined"
                                            sx={{
                                                p: 1.1,
                                                borderRadius: 1.4,
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                                borderColor: alpha(memberAccent, 0.24),
                                                bgcolor: alpha(memberAccent, 0.08)
                                            }}
                                        >
                                            <TaskAltRoundedIcon sx={{ fontSize: 16, color: memberAccent }} />
                                            <Typography variant="body2" color="text.secondary">
                                                {rule}
                                            </Typography>
                                        </Paper>
                                    ))}
                                </Stack>
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <MotionCard variant="outlined" sx={contentCardSx}>
                        <CardContent sx={{ p: 2.25 }}>
                            <Stack spacing={1.5}>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Box
                                        sx={{
                                            width: 30,
                                            height: 30,
                                            borderRadius: 1.25,
                                            display: "grid",
                                            placeItems: "center",
                                            bgcolor: alpha(brandColors.success, 0.12),
                                            color: brandColors.success
                                        }}
                                    >
                                        <TrendingUpRoundedIcon fontSize="small" />
                                    </Box>
                                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                        Account Health
                                    </Typography>
                                </Stack>

                                <Box
                                    sx={{
                                        display: "grid",
                                        gap: 1,
                                        gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(4, minmax(0, 1fr))" }
                                    }}
                                >
                                    <Paper variant="outlined" sx={{ p: 1.15, borderRadius: 1.4, textAlign: "center" }}>
                                        <Typography variant="h6" sx={{ fontWeight: 800, color: brandColors.success }}>
                                            {Math.max(filteredAccounts.length - accountDormancyCount, 0)}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            active
                                        </Typography>
                                    </Paper>
                                    <Paper variant="outlined" sx={{ p: 1.15, borderRadius: 1.4, textAlign: "center" }}>
                                        <Typography variant="h6" sx={{ fontWeight: 800, color: accountDormancyCount ? "#9A6700" : "text.primary" }}>
                                            {accountDormancyCount}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            dormant
                                        </Typography>
                                    </Paper>
                                    <Paper variant="outlined" sx={{ p: 1.15, borderRadius: 1.4, textAlign: "center" }}>
                                        <Typography variant="h6" sx={{ fontWeight: 800, color: memberAccent }}>
                                            {filteredInterestHistory.length}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            interest postings
                                        </Typography>
                                    </Paper>
                                    <Paper variant="outlined" sx={{ p: 1.15, borderRadius: 1.4, textAlign: "center" }}>
                                        <Typography variant="h6" sx={{ fontWeight: 800, color: memberAccentAlt }}>
                                            {filteredDividendMapping.length}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            dividend mappings
                                        </Typography>
                                    </Paper>
                                </Box>

                                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ pt: 0.5 }}>
                                    <Button variant="outlined" startIcon={<DownloadRoundedIcon />} onClick={handleDownloadStatement}>
                                        Export Savings Statement
                                    </Button>
                                    <Button variant="outlined" startIcon={<PrintRoundedIcon />} onClick={() => window.print()}>
                                        Printable View
                                    </Button>
                                </Stack>
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>
            </Grid>

            <ChartPanel
                title="Savings History"
                subtitle="Posted running balance trend across your visible member transactions."
                data={{
                    labels: chartLabels,
                    datasets: [
                        {
                            label: "Running balance",
                            data: chartValues,
                            borderColor: memberAccent,
                            backgroundColor: alpha(memberAccent, 0.14),
                            fill: true,
                            tension: 0.35
                        }
                    ]
                }}
                options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: "bottom" } }
                }}
            />

            <MotionCard variant="outlined" sx={contentCardSx}>
                <CardContent>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        My Accounts
                    </Typography>
                    <DataTable rows={paginatedAccounts} columns={accountColumns} emptyMessage="No accounts linked yet. Contact branch support to activate your products." />
                    <TablePagination
                        component="div"
                        count={filteredAccounts.length}
                        page={accountsPage}
                        onPageChange={(_, value) => setAccountsPage(value)}
                        rowsPerPage={accountsRowsPerPage}
                        onRowsPerPageChange={(event) => {
                            setAccountsRowsPerPage(Number(event.target.value));
                            setAccountsPage(0);
                        }}
                        rowsPerPageOptions={[5, 10, 20]}
                    />
                </CardContent>
            </MotionCard>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                    <MotionCard variant="outlined" sx={contentCardSx}>
                        <CardContent>
                            <Typography variant="h6" sx={{ mb: 2 }}>
                                Interest Posting History
                            </Typography>
                            <DataTable
                                rows={filteredInterestHistory.slice(0, 8)}
                                columns={statementColumns}
                                emptyMessage="No interest postings in the selected period."
                            />
                        </CardContent>
                    </MotionCard>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <MotionCard variant="outlined" sx={contentCardSx}>
                        <CardContent>
                            <Typography variant="h6" sx={{ mb: 2 }}>
                                Dividend Allocation Mapping
                            </Typography>
                            <DataTable
                                rows={filteredDividendMapping.slice(0, 8)}
                                columns={statementColumns}
                                emptyMessage="No dividend allocations posted in the selected period."
                            />
                        </CardContent>
                    </MotionCard>
                </Grid>
            </Grid>
        </Stack>
    );

    const renderLoansView = () => (
        <Stack spacing={3}>
            <MotionCard
                variant="outlined"
                sx={{
                    ...contentCardSx,
                    background: theme.palette.mode === "dark"
                        ? `linear-gradient(135deg, ${alpha(memberAccentStrong, 0.44)}, ${alpha(memberAccentAlt, 0.24)})`
                        : `linear-gradient(135deg, ${alpha(brandColors.primary[900], 0.96)}, ${alpha(brandColors.accent[500], 0.86)})`,
                    color: "#fff",
                    borderColor: "transparent",
                    boxShadow: `0 18px 38px ${alpha(memberAccentStrong, 0.22)}`
                }}
            >
                <CardContent sx={{ p: { xs: 2.1, sm: 2.5, md: 3.25 } }}>
                    <Grid container spacing={2.5} alignItems="stretch">
                        <Grid size={{ xs: 12, lg: 8 }}>
                            <Stack spacing={1.5}>
                                <Typography variant="overline" sx={{ color: alpha("#FFFFFF", 0.76), letterSpacing: 1.4 }}>
                                    Lending workspace
                                </Typography>
                                <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.08, maxWidth: 680, fontSize: { xs: "2rem", sm: "2.35rem", md: undefined } }}>
                                    Track applications, repayment exposure, and loan readiness from one member view.
                                </Typography>
                                <Typography variant="body2" sx={{ color: alpha("#FFFFFF", 0.78), maxWidth: 620 }}>
                                    Review approved facilities, watch outstanding balances, and submit new borrowing requests into the SACCO approval workflow.
                                </Typography>
                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ pt: 0.5 }}>
                                    <Chip
                                        label={filteredActiveLoanCount ? `${filteredActiveLoanCount} active loan(s)` : "No active loans"}
                                        sx={{
                                            borderRadius: 1.5,
                                            bgcolor: alpha("#FFFFFF", 0.14),
                                            color: "#fff",
                                            border: `1px solid ${alpha("#FFFFFF", 0.2)}`
                                        }}
                                    />
                                    <Chip
                                        label={`${pendingLoanApplications.length} open application(s)`}
                                        sx={{
                                            borderRadius: 1.5,
                                            bgcolor: alpha("#FFFFFF", 0.1),
                                            color: "#fff",
                                            border: `1px solid ${alpha("#FFFFFF", 0.16)}`
                                        }}
                                    />
                                </Stack>
                            </Stack>
                        </Grid>
                        <Grid size={{ xs: 12, lg: 4 }}>
                            <Box
                                sx={{
                                    height: "100%",
                                    p: 2.25,
                                    borderRadius: 2,
                                    bgcolor: alpha("#FFFFFF", theme.palette.mode === "dark" ? 0.05 : 0.12),
                                    border: `1px solid ${alpha("#FFFFFF", 0.16)}`,
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "space-between",
                                    gap: 2
                                }}
                            >
                                <Stack spacing={1}>
                                    <Typography variant="subtitle2" sx={{ color: alpha("#FFFFFF", 0.72) }}>
                                        Application access
                                    </Typography>
                                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                        {canApplyForLoan ? "Apply for a new facility" : "Applications unavailable"}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: alpha("#FFFFFF", 0.72) }}>
                                        {canApplyForLoan
                                            ? "Your request will move through appraisal, approval, and controlled disbursement."
                                            : "Loan applications are currently unavailable."}
                                    </Typography>
                                </Stack>
                                {canApplyForLoan ? (
                                    <Button
                                        variant="contained"
                                        onClick={openLoanApplicationDraft}
                                        sx={{
                                            alignSelf: "flex-start",
                                            width: { xs: "100%", sm: "auto" },
                                            bgcolor: "#fff",
                                            color: memberAccentStrong,
                                            fontWeight: 700,
                                            "&:hover": {
                                                bgcolor: alpha("#FFFFFF", 0.92)
                                            }
                                        }}
                                    >
                                        {selectedLoanDraft ? "Continue Draft Application" : "Apply for Loan"}
                                    </Button>
                                ) : null}
                            </Box>
                        </Grid>
                    </Grid>
                </CardContent>
            </MotionCard>

            {canApplyForLoan ? (
                <MotionCard variant="outlined" sx={contentCardSx}>
                    <CardContent>
                        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
                            <Box>
                                <Typography variant="h6">My Loan Applications</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Track applications through appraisal, approval, and disbursement readiness.
                                </Typography>
                            </Box>
                            <Chip label={`${pendingLoanApplications.length} open application(s)`} variant="outlined" />
                        </Stack>
                        <Grid container spacing={2} sx={{ mb: 2.5 }}>
                            {loanApplications.slice(0, 3).map((application) => {
                                const tone = getApplicationTone(application.status);
                                const StatusIcon = tone.icon;

                                return (
                                    <Grid key={application.id} size={{ xs: 12, md: 4 }}>
                                        <Box
                                            sx={{
                                                p: 2,
                                                borderRadius: 2,
                                                border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                                                bgcolor: theme.palette.mode === "dark" ? alpha("#FFFFFF", 0.02) : alpha("#FFFFFF", 0.8)
                                            }}
                                        >
                                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
                                                <Box
                                                    sx={{
                                                        width: 40,
                                                        height: 40,
                                                        borderRadius: 2,
                                                        display: "grid",
                                                        placeItems: "center",
                                                        bgcolor: tone.bg,
                                                        color: tone.color
                                                    }}
                                                >
                                                    <StatusIcon fontSize="small" />
                                                </Box>
                                                <Chip
                                                    size="small"
                                                    label={tone.label}
                                                    sx={{
                                                        borderRadius: 1.25,
                                                        color: tone.color,
                                                        bgcolor: tone.bg,
                                                        border: `1px solid ${alpha(tone.color, 0.2)}`
                                                    }}
                                                />
                                            </Stack>
                                            <Typography variant="subtitle2" sx={{ mt: 2, fontWeight: 700 }}>
                                                {application.loan_products?.name || "Loan application"}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                {formatCurrency(application.requested_amount)} · {application.requested_term_count} term(s)
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.25 }}>
                                                Updated {formatDate(application.updated_at)}
                                            </Typography>
                                            {application.status === "rejected" ? (
                                                <Stack
                                                    spacing={0.65}
                                                    sx={{
                                                        mt: 1.5,
                                                        p: 1.25,
                                                        borderRadius: 1.5,
                                                        bgcolor: alpha(brandColors.danger, 0.08),
                                                        border: `1px solid ${alpha(brandColors.danger, 0.18)}`
                                                    }}
                                                >
                                                    {application.rejection_reason ? (
                                                        <Typography variant="body2" sx={{ fontWeight: 700, color: "error.main" }}>
                                                            Reason: {application.rejection_reason}
                                                        </Typography>
                                                    ) : null}
                                                    {application.approval_notes ? (
                                                        <Typography variant="caption" color="text.secondary">
                                                            Notes: {application.approval_notes}
                                                        </Typography>
                                                    ) : null}
                                                </Stack>
                                            ) : null}
                                            {application.status === "rejected" ? (
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{ mt: 1.5 }}
                                                    onClick={() => openLoanApplicationEditor(application)}
                                                >
                                                    Edit & Resubmit
                                                </Button>
                                            ) : application.status === "draft" ? (
                                                <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} useFlexGap flexWrap="wrap">
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        onClick={() => openLoanApplicationEditor(application)}
                                                    >
                                                        Continue Draft
                                                    </Button>
                                                    <Button
                                                        size="small"
                                                        variant="text"
                                                        color="error"
                                                        onClick={() => setPendingDraftDeletion(application)}
                                                        disabled={deletingLoanApplicationId === application.id}
                                                    >
                                                        {deletingLoanApplicationId === application.id ? "Deleting..." : "Delete Draft"}
                                                    </Button>
                                                </Stack>
                                            ) : null}
                                        </Box>
                                    </Grid>
                                );
                            })}
                        </Grid>
                        <DataTable rows={loanApplications} columns={loanApplicationColumns} emptyMessage="No loan applications submitted yet." />
                    </CardContent>
                </MotionCard>
            ) : (
                <Alert severity="info" variant="outlined">
                    Loan applications are currently unavailable.
                </Alert>
            )}

            {guarantorRequests.length ? (
                <MotionCard variant="outlined" sx={contentCardSx}>
                    <CardContent>
                        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
                            <Box>
                                <Typography variant="h6">Guarantor Requests</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Respond to guarantee requests before borrower loan processing can continue.
                                </Typography>
                            </Box>
                            <Chip label={`${pendingGuarantorRequests.length} pending`} color={pendingGuarantorRequests.length ? "warning" : "default"} variant="outlined" />
                        </Stack>
                        <DataTable
                            rows={guarantorRequests}
                            columns={guarantorRequestColumns}
                            emptyMessage="No guarantor requests assigned to your member profile."
                        />
                    </CardContent>
                </MotionCard>
            ) : null}

            <MotionCard variant="outlined" sx={contentCardSx}>
                <CardContent>
                    <Stack direction={{ xs: "column", lg: "row" }} spacing={2} justifyContent="space-between">
                        <Stack spacing={1} sx={{ minWidth: { lg: 320 } }}>
                            <TextField
                                select
                                size="small"
                                label="Loan Facility"
                                value={selectedLoan?.id || ""}
                                onChange={(event) => setLoanDetailId(event.target.value)}
                            >
                                {filteredLoans.length ? (
                                    filteredLoans.map((loan) => (
                                        <MenuItem key={loan.id} value={loan.id}>
                                            {loan.loan_number} • {formatCurrency(loan.principal_amount)}
                                        </MenuItem>
                                    ))
                                ) : (
                                    <MenuItem value="" disabled>
                                        No loans in selected range
                                    </MenuItem>
                                )}
                            </TextField>
                            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                <Chip label={`Rate ${selectedLoan?.annual_interest_rate || 0}%`} variant="outlined" />
                                <Chip
                                    label={`Progress ${filteredLoanProgressPercent.toFixed(0)}%`}
                                    variant="outlined"
                                    sx={{ borderColor: alpha(memberAccent, 0.38), color: memberAccent, fontWeight: 700 }}
                                />
                                <Chip label={`Penalty est. ${formatCurrency(selectedLoanPenaltyEstimate)}`} color={selectedLoanPenaltyEstimate > 0 ? "warning" : "default"} variant="outlined" />
                            </Stack>
                            <Box sx={{ pt: 0.5 }}>
                                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                                    <Typography variant="caption" color="text.secondary">
                                        Repayment progress
                                    </Typography>
                                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                        {filteredLoanProgressPercent.toFixed(0)}%
                                    </Typography>
                                </Stack>
                                <LinearProgress
                                    variant="determinate"
                                    value={Math.min(Math.max(filteredLoanProgressPercent, 0), 100)}
                                    sx={{
                                        height: 8,
                                        borderRadius: 999,
                                        bgcolor: alpha(memberAccent, 0.14),
                                        "& .MuiLinearProgress-bar": {
                                            borderRadius: 999,
                                            bgcolor: memberAccent
                                        }
                                    }}
                                />
                                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.65 }}>
                                    {selectedLoanNextDue
                                        ? `Next due ${formatDate(selectedLoanNextDue.due_date)} (${Math.max(getDaysUntil(selectedLoanNextDue.due_date) || 0, 0)} day(s))`
                                        : "No pending installments in selected range."}
                                </Typography>
                            </Box>
                        </Stack>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                            {canShowLoanRepaymentOption ? (
                                <Button
                                    variant="contained"
                                    onClick={() => openDepositDialog("loan_repayment", selectedLoan?.id || portalRepaymentLoans[0]?.id || null)}
                                    disabled={submittingContribution || !portalRepaymentLoans.length}
                                    sx={
                                        isDarkMode
                                            ? { bgcolor: memberAccent, color: "#1a1a1a", "&:hover": { bgcolor: memberAccentAlt } }
                                            : undefined
                                    }
                                >
                                    Repay with Mobile Money
                                </Button>
                            ) : null}
                            <Button
                                variant="outlined"
                                startIcon={<DownloadRoundedIcon />}
                                onClick={handleDownloadLoanStatement}
                            >
                                Download Loan Statement PDF
                            </Button>
                            <Button variant="outlined" startIcon={<PrintRoundedIcon />} onClick={() => window.print()}>
                                Printable View
                            </Button>
                        </Stack>
                    </Stack>
                    {latestLoanRepaymentPaymentOrder ? (
                        <Alert
                            severity={
                                latestLoanRepaymentPaymentOrder.status === "posted"
                                    ? "success"
                                    : latestLoanRepaymentPaymentOrder.status === "failed"
                                        ? "error"
                                        : latestLoanRepaymentPaymentOrder.status === "expired"
                                            ? "warning"
                                            : "info"
                            }
                            variant="outlined"
                            sx={{ mt: 2, alignItems: "flex-start" }}
                        >
                            <Stack spacing={0.5}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                    {latestLoanRepaymentPaymentOrder.status === "posted"
                                        ? "Latest repayment posted"
                                        : latestLoanRepaymentPaymentOrder.status === "paid"
                                            ? "Payment received, posting in progress"
                                            : latestLoanRepaymentPaymentOrder.status === "pending"
                                                ? "Awaiting member approval"
                                                : latestLoanRepaymentPaymentOrder.status === "failed"
                                                    ? "Repayment failed"
                                                    : latestLoanRepaymentPaymentOrder.status === "expired"
                                                        ? "Repayment expired"
                                                        : `Order ${latestLoanRepaymentPaymentOrder.status.replace(/_/g, " ")}`}
                                </Typography>
                                <Typography variant="body2">
                                    {formatCurrency(latestLoanRepaymentPaymentOrder.amount)} via {latestLoanRepaymentPaymentOrder.provider.toUpperCase()} · Ref {latestLoanRepaymentPaymentOrder.provider_ref || latestLoanRepaymentPaymentOrder.external_id}
                                </Typography>
                                <Typography variant="body2">
                                    Loan: {latestLoanRepaymentPaymentOrder.loan_number || latestLoanRepaymentPaymentOrder.loan_id || "Unknown loan"}
                                </Typography>
                                {latestLoanRepaymentPaymentOrder.journal_id ? (
                                    <Typography variant="body2">Journal posted: {latestLoanRepaymentPaymentOrder.journal_id}</Typography>
                                ) : null}
                                {latestLoanRepaymentPaymentOrder.error_message ? (
                                    <Typography variant="body2">{latestLoanRepaymentPaymentOrder.error_message}</Typography>
                                ) : null}
                            </Stack>
                        </Alert>
                    ) : null}
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <MetricCard
                                icon={EventRoundedIcon}
                                label="Next Due"
                                value={formatDate(selectedLoanNextDue?.due_date || null)}
                                helper={`Amount due ${formatCurrency(selectedLoanNextDueAmount)} in ${Math.max(getDaysUntil(selectedLoanNextDue?.due_date || null) || 0, 0)} day(s).`}
                                tone={selectedLoanNextDueAmount > 0 ? "warning" : "success"}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <MetricCard
                                icon={CreditScoreRoundedIcon}
                                label="Installment Split"
                                value={formatCurrency(Math.max((selectedLoanNextDue?.principal_due || 0) - (selectedLoanNextDue?.principal_paid || 0), 0))}
                                helper={`Interest ${formatCurrency(Math.max((selectedLoanNextDue?.interest_due || 0) - (selectedLoanNextDue?.interest_paid || 0), 0))} | Penalty ${formatCurrency(selectedLoanPenaltyEstimate)}`}
                                tone="primary"
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <MotionCard variant="outlined" sx={{ ...contentCardSx, height: "100%" }}>
                                <CardContent>
                                    <Typography variant="subtitle2">Prepayment Simulation</Typography>
                                    <Stack direction="row" spacing={1} sx={{ mt: 1.25 }} alignItems="center">
                                        <TextField
                                            size="small"
                                            type="number"
                                            label="Prepay amount"
                                            value={prepaymentAmount}
                                            onChange={(event) => setPrepaymentAmount(Number(event.target.value) || 0)}
                                            fullWidth
                                        />
                                    </Stack>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                        Projected outstanding: {formatCurrency(prepaymentProjection?.newOutstanding || (selectedLoan?.outstanding_principal || 0))}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Estimated terms reduced: {prepaymentProjection?.termsReduced || 0}
                                    </Typography>
                                </CardContent>
                            </MotionCard>
                        </Grid>
                    </Grid>
                </CardContent>
            </MotionCard>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                    <MetricCard
                        icon={CreditScoreRoundedIcon}
                        label="Active Loans"
                        value={filteredActiveLoanCount}
                        helper="Facilities active/in arrears in selected range."
                        tone="danger"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                    <MetricCard
                        icon={TrendingUpRoundedIcon}
                        label="Outstanding Balance"
                        value={formatCurrency(filteredLoansOutstanding)}
                        helper="Principal plus accrued interest in selected range."
                        tone="primary"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                    <MetricCard
                        icon={TimelineRoundedIcon}
                        label="Next Due Reference"
                        value={formatDate(selectedLoanNextDue?.due_date || null)}
                        helper={selectedLoanNextDue ? "Upcoming installment in selected range." : "No due installment in selected range."}
                        tone="warning"
                    />
                </Grid>
            </Grid>

            <Grid container spacing={2.5}>
                <Grid size={{ xs: 12, lg: 4 }}>
                    <ChartPanel
                        title="Loan Status"
                        type="doughnut"
                        subtitle="Outstanding versus visible capital buffer."
                        data={{
                            labels: ["Outstanding", "Capital Buffer"],
                            datasets: [
                                {
                                    data: [Math.max(filteredLoansOutstanding, 0), Math.max(totalVisibleCapital - filteredLoansOutstanding, 0)],
                                    backgroundColor: [brandColors.danger, memberAccent],
                                    borderWidth: 0
                                }
                            ]
                        }}
                        options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { position: "bottom" } },
                            cutout: "68%"
                        }}
                    />
                </Grid>
                <Grid size={{ xs: 12, lg: 8 }}>
                    <MotionCard variant="outlined" sx={contentCardSx}>
                        <CardContent>
                            <Typography variant="h6" sx={{ mb: 2 }}>
                                My Loans
                            </Typography>
                            <DataTable rows={filteredLoans} columns={loanColumns} emptyMessage="No loan records found for selected date range." />
                        </CardContent>
                    </MotionCard>
                </Grid>
            </Grid>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, lg: 8 }}>
                    <MotionCard variant="outlined" sx={contentCardSx}>
                        <CardContent>
                            <Typography variant="h6" sx={{ mb: 2 }}>
                                Amortization Schedule
                            </Typography>
                            <DataTable
                                rows={paginatedLoanSchedules.map((schedule) => ({
                                    ...schedule,
                                    penalty_estimate: estimatePenaltyForSchedule(schedule)
                                }))}
                                columns={[
                                    { key: "no", header: "Installment", render: (row) => String(row.installment_number) },
                                    { key: "due", header: "Due Date", render: (row) => formatDate(row.due_date) },
                                    { key: "principal", header: "Principal", render: (row) => formatCurrency(row.principal_due) },
                                    { key: "interest", header: "Interest", render: (row) => formatCurrency(row.interest_due) },
                                    { key: "penalty", header: "Penalty", render: (row: LoanSchedule & { penalty_estimate: number }) => formatCurrency(row.penalty_estimate) },
                                    { key: "status", header: "Status", render: (row) => row.status }
                                ]}
                                emptyMessage="No amortization lines available for the selected loan and period."
                            />
                            <TablePagination
                                component="div"
                                count={filteredLoanSchedules.length}
                                page={loanSchedulePage}
                                onPageChange={(_, value) => setLoanSchedulePage(value)}
                                rowsPerPage={loanScheduleRowsPerPage}
                                onRowsPerPageChange={(event) => {
                                    setLoanScheduleRowsPerPage(Number(event.target.value));
                                    setLoanSchedulePage(0);
                                }}
                                rowsPerPageOptions={[5, 10, 20]}
                            />
                        </CardContent>
                    </MotionCard>
                </Grid>
                <Grid size={{ xs: 12, lg: 4 }}>
                    <MotionCard variant="outlined" sx={contentCardSx}>
                        <CardContent>
                            <Typography variant="h6" sx={{ mb: 2 }}>
                                Loan Document Vault
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Agreement copies and annex documents are linked by branch operations for audit-ready access.
                            </Typography>
                            <Button variant="outlined" fullWidth disabled>
                                Agreement copy unavailable
                            </Button>
                            <Button variant="text" fullWidth sx={{ mt: 1 }}>
                                Request document from branch
                            </Button>
                        </CardContent>
                    </MotionCard>
                </Grid>
            </Grid>

            <MotionCard variant="outlined" sx={contentCardSx}>
                <CardContent>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        Repayment History (Partial payments included)
                    </Typography>
                    <DataTable rows={loanRepaymentHistory.slice(0, 20)} columns={statementColumns} emptyMessage="No repayments posted in the selected period." />
                </CardContent>
            </MotionCard>
        </Stack>
    );

    const renderTransactionsView = () => (
        <Stack spacing={3}>
            <MotionCard variant="outlined" sx={contentCardSx}>
                <CardContent sx={{ p: 2.25 }}>
                    <Stack spacing={1.5}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <Box
                                    sx={{
                                        width: 30,
                                        height: 30,
                                        borderRadius: 1.25,
                                        display: "grid",
                                        placeItems: "center",
                                        bgcolor: alpha(memberAccent, 0.14),
                                        color: memberAccent
                                    }}
                                >
                                    <TimelineRoundedIcon fontSize="small" />
                                </Box>
                                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                    Transactions
                                </Typography>
                            </Stack>
                            <Chip
                                size="small"
                                label={`${filteredTransactions.length} visible`}
                                sx={{
                                    borderRadius: 1.25,
                                    bgcolor: alpha(memberAccent, 0.12),
                                    color: memberAccent,
                                    fontWeight: 700
                                }}
                            />
                        </Stack>

                        <Stack direction={{ xs: "column", md: "row" }} spacing={1.25}>
                            <TextField
                                select
                                size="small"
                                label="Type"
                                value={transactionTypeFilter}
                                onChange={(event) => setTransactionTypeFilter(event.target.value)}
                                sx={{ minWidth: { xs: 0, md: 200 } }}
                            >
                                <MenuItem value="all">All types</MenuItem>
                                <MenuItem value="deposit">Deposit</MenuItem>
                                <MenuItem value="withdrawal">Withdrawal</MenuItem>
                                <MenuItem value="contribution">Contribution</MenuItem>
                                <MenuItem value="dividend">Dividend</MenuItem>
                                <MenuItem value="loan">Loan</MenuItem>
                            </TextField>
                            <TextField
                                size="small"
                                label="Reference"
                                placeholder="Search by reference"
                                value={transactionSearch}
                                onChange={(event) => setTransactionSearch(event.target.value)}
                                sx={{ minWidth: { xs: 0, md: 220 } }}
                            />
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                                <Button
                                    variant="outlined"
                                    startIcon={<DownloadRoundedIcon />}
                                    onClick={() => handleDownloadFilteredStatement(filteredTransactions, "Transaction statement")}
                                >
                                    Export Statement PDF
                                </Button>
                                <Button variant="outlined" startIcon={<PrintRoundedIcon />} onClick={() => window.print()}>
                                    Printable View
                                </Button>
                            </Stack>
                        </Stack>
                    </Stack>
                </CardContent>
            </MotionCard>

            <Grid container spacing={2} alignItems="stretch">
                <Grid size={{ xs: 12, sm: 6, lg: 3 }} sx={{ display: "flex" }}>
                    <AccountSummaryCard
                        icon={TimelineRoundedIcon}
                        label="Filtered Transactions"
                        value={filteredTransactions.length}
                        helper="Rows currently visible after filters."
                        tone="primary"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }} sx={{ display: "flex" }}>
                    <AccountSummaryCard
                        icon={WalletRoundedIcon}
                        label="Latest Balance"
                        value={formatCurrency(latestFilteredTransaction?.running_balance || 0)}
                        helper="Most recent running balance in filtered statements."
                        tone="success"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }} sx={{ display: "flex" }}>
                    <AccountSummaryCard
                        icon={FlagRoundedIcon}
                        label="Disputed Flags"
                        value={disputedTransactionIds.length}
                        helper="Marked for branch follow-up without altering ledger."
                        tone={disputedTransactionIds.length ? "warning" : "primary"}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }} sx={{ display: "flex" }}>
                    <MotionCard variant="outlined" sx={{ ...contentCardSx, height: "100%", width: 1 }}>
                        <CardContent sx={{ p: 2.25, height: "100%", display: "flex" }}>
                            <Stack spacing={1.4} sx={{ width: 1 }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                    <Box
                                        sx={{
                                            width: 38,
                                            height: 38,
                                            borderRadius: 1.5,
                                            display: "grid",
                                            placeItems: "center",
                                            bgcolor: alpha(runningBalanceMismatches ? brandColors.warning : brandColors.success, 0.14),
                                            color: runningBalanceMismatches ? "#9A6700" : brandColors.success
                                        }}
                                    >
                                        <TaskAltRoundedIcon fontSize="small" />
                                    </Box>
                                    <Chip
                                        label={runningBalanceMismatches ? "Check required" : "Validated"}
                                        color={runningBalanceMismatches ? "warning" : "success"}
                                        variant={runningBalanceMismatches ? "filled" : "outlined"}
                                        size="small"
                                        sx={{ fontWeight: 700 }}
                                    />
                                </Stack>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                    Running Balance Validation
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {runningBalanceMismatches
                                        ? `${runningBalanceMismatches} mismatch(es) detected`
                                        : "No mismatches detected in current filter."}
                                </Typography>
                                <Box sx={{ mt: "auto", height: 4, borderRadius: 999, bgcolor: alpha(runningBalanceMismatches ? brandColors.warning : brandColors.success, 0.16) }}>
                                    <Box
                                        sx={{
                                            height: 1,
                                            width: runningBalanceMismatches ? "42%" : "100%",
                                            borderRadius: 999,
                                            bgcolor: runningBalanceMismatches ? brandColors.warning : brandColors.success
                                        }}
                                    />
                                </Box>
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>
            </Grid>

            <ChartPanel
                title="Transaction Balance Trend"
                subtitle="Running balance trend from the selected transaction window."
                data={{
                    labels: transactionTrendLabels.length ? transactionTrendLabels : chartLabels,
                    datasets: [
                        {
                            label: "Running balance",
                            data: transactionTrendValues.length ? transactionTrendValues : chartValues,
                            borderColor: memberAccent,
                            backgroundColor: alpha(memberAccent, 0.14),
                            fill: true,
                            tension: 0.35
                        }
                    ]
                }}
                options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: "bottom" } }
                }}
            />

            <MotionCard variant="outlined" sx={contentCardSx}>
                <CardContent>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        Posted Transactions
                    </Typography>
                    <DataTable
                        rows={paginatedTransactions}
                        columns={statementColumns}
                        emptyMessage="No transactions match the selected filters. Adjust date range or type filter."
                    />
                    <TablePagination
                        component="div"
                        count={filteredTransactions.length}
                        page={transactionsPage}
                        onPageChange={(_, value) => setTransactionsPage(value)}
                        rowsPerPage={transactionsRowsPerPage}
                        onRowsPerPageChange={(event) => {
                            setTransactionsRowsPerPage(Number(event.target.value));
                            setTransactionsPage(0);
                        }}
                        rowsPerPageOptions={[10, 25, 50]}
                    />
                </CardContent>
            </MotionCard>
        </Stack>
    );

    const renderContributionsView = () => {
        const complianceCapped = Math.min(Math.max(contributionComplianceRatio, 0), 100);
        const scheduleToneColor = contributionScheduleStatus === "Overdue"
            ? brandColors.danger
            : contributionScheduleStatus === "Due soon"
                ? "#9A6700"
                : contributionScheduleStatus === "Scheduled"
                    ? brandColors.success
                    : memberAccent;

        return (
            <Stack spacing={3}>
                <MotionCard
                    variant="outlined"
                    sx={{
                        ...contentCardSx,
                        background: theme.palette.mode === "dark"
                            ? `linear-gradient(135deg, ${alpha(memberAccentStrong, 0.42)}, ${alpha(memberAccentAlt, 0.2)})`
                            : `linear-gradient(135deg, ${alpha(brandColors.primary[900], 0.96)}, ${alpha(brandColors.warning, 0.86)})`,
                        color: "#fff",
                        borderColor: "transparent",
                        boxShadow: "0 18px 38px rgba(10, 5, 115, 0.16)"
                    }}
                >
                    <CardContent sx={{ p: { xs: 2.5, md: 3.25 } }}>
                        <Grid container spacing={2.5} alignItems="center">
                            <Grid size={{ xs: 12, lg: 8 }}>
                                <Stack spacing={1.2}>
                                    <Typography variant="overline" sx={{ color: alpha("#FFFFFF", 0.74), letterSpacing: 1.4 }}>
                                        Member contributions workspace
                                    </Typography>
                                    <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.08, maxWidth: 760 }}>
                                        Track contribution discipline and dividend credit transparency in one audited view.
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: alpha("#FFFFFF", 0.84), maxWidth: 780 }}>
                                        Monitor expected vs posted contribution performance, schedule health, annual dividends, and
                                        detailed journal-linked references for every entry.
                                    </Typography>
                                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ pt: 0.5 }}>
                                        <Chip
                                            size="small"
                                            label={`${filteredContributions.length} visible entries`}
                                            sx={{ bgcolor: alpha("#FFFFFF", 0.16), color: "#fff", fontWeight: 700 }}
                                        />
                                        <Chip
                                            size="small"
                                            label={`${contributionEntriesCount} contributions`}
                                            sx={{ bgcolor: alpha("#FFFFFF", 0.16), color: "#fff", fontWeight: 700 }}
                                        />
                                        <Chip
                                            size="small"
                                            label={`${dividendEntriesCount} dividends`}
                                            sx={{ bgcolor: alpha("#FFFFFF", 0.16), color: "#fff", fontWeight: 700 }}
                                        />
                                    </Stack>
                                </Stack>
                            </Grid>
                            <Grid size={{ xs: 12, lg: 4 }}>
                                <Stack spacing={1.2}>
                                    <Button
                                        variant="contained"
                                        startIcon={<DownloadRoundedIcon />}
                                        onClick={() => handleDownloadFilteredStatement(filteredContributions, "Contribution statement")}
                                        sx={{
                                            bgcolor: "#fff",
                                            color: memberAccentStrong,
                                            fontWeight: 700,
                                            "&:hover": { bgcolor: alpha("#fff", 0.92) }
                                        }}
                                    >
                                        Download Contribution PDF
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        startIcon={<PrintRoundedIcon />}
                                        onClick={() => window.print()}
                                        sx={{ borderColor: alpha("#fff", 0.44), color: "#fff" }}
                                    >
                                        Printable View
                                    </Button>
                                </Stack>
                            </Grid>
                        </Grid>
                    </CardContent>
                </MotionCard>

                {canUsePortalDeposits ? (
                    <MotionCard variant="outlined" sx={contentCardSx}>
                    <CardContent sx={{ p: { xs: 2.25, md: 2.75 } }}>
                        <Grid container spacing={2.5} alignItems="center">
                            <Grid size={{ xs: 12, md: 7 }}>
                                <Stack spacing={1.15}>
                                    <Typography variant="overline" sx={{ color: memberAccent, letterSpacing: 1.4 }}>
                                        Mobile Money Deposits
                                    </Typography>
                                    <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: "-0.02em" }}>
                                        Use one deposit flow for contributions and savings.
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Choose whether the money should land in your share contribution account or your savings account, approve on your phone, and let the backend post it automatically after Mobile Money confirms success.
                                    </Typography>
                                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                        <Chip label={`${shareAccounts.length} share account(s)`} variant="outlined" />
                                        <Chip label={`${savingsAccounts.length} savings account(s)`} variant="outlined" />
                                        <Chip
                                            label={
                                                latestSharePaymentOrder || latestSavingsPaymentOrder
                                                    ? `Latest order ${(latestSharePaymentOrder || latestSavingsPaymentOrder)?.status.replace(/_/g, " ")}`
                                                    : "No active deposit order"
                                            }
                                            variant="outlined"
                                        />
                                    </Stack>
                                </Stack>
                            </Grid>
                            <Grid size={{ xs: 12, md: 5 }}>
                                <Stack spacing={1.1} alignItems={{ xs: "stretch", md: "flex-end" }}>
                                    <Button
                                        variant="contained"
                                        onClick={() => openDepositDialog("share_contribution")}
                                        disabled={submittingContribution}
                                        sx={
                                            isDarkMode
                                                ? { bgcolor: memberAccent, color: "#1a1a1a", "&:hover": { bgcolor: memberAccentAlt } }
                                                : undefined
                                        }
                                    >
                                        Open Deposit
                                    </Button>
                                    {latestSharePaymentOrder?.status === "paid" && !latestSharePaymentOrder.posted_at ? (
                                        <Button
                                            variant="outlined"
                                            onClick={() => void handleReconcilePaymentOrder()}
                                            disabled={reconcilingPayment}
                                        >
                                            {reconcilingPayment ? "Reconciling..." : "Reconcile Payment"}
                                        </Button>
                                    ) : null}
                                </Stack>
                            </Grid>
                        </Grid>
                        {!shareAccounts.length ? (
                            <Alert severity="info" variant="outlined" sx={{ mt: 2 }}>
                                No share account is linked to this portal login yet. A branch manager must provision a share account before members can contribute from the portal.
                            </Alert>
                        ) : null}
                        {latestSharePaymentOrder ? (
                            <Alert
                                severity={
                                    latestSharePaymentOrder.status === "posted"
                                        ? "success"
                                        : latestSharePaymentOrder.status === "failed"
                                            ? "error"
                                            : latestSharePaymentOrder.status === "expired"
                                                ? "warning"
                                                : "info"
                                }
                                variant="outlined"
                                sx={{ mt: 2, alignItems: "flex-start" }}
                            >
                                <Stack spacing={0.5}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                        {latestSharePaymentOrder.status === "posted"
                                            ? "Contribution completed"
                                            : latestSharePaymentOrder.status === "paid"
                                                ? "Payment received, posting in progress"
                                                : latestSharePaymentOrder.status === "pending"
                                                    ? "Awaiting member approval"
                                                    : latestSharePaymentOrder.status === "failed"
                                                        ? "Payment failed"
                                                        : latestSharePaymentOrder.status === "expired"
                                                            ? "Payment expired"
                                                            : `Order ${latestSharePaymentOrder.status.replace(/_/g, " ")}`}
                                    </Typography>
                                    <Typography variant="body2">
                                        {formatCurrency(latestSharePaymentOrder.amount)} via {latestSharePaymentOrder.provider.toUpperCase()} · Ref {latestSharePaymentOrder.provider_ref || latestSharePaymentOrder.external_id}
                                    </Typography>
                                    {latestSharePaymentOrder.journal_id ? (
                                        <Typography variant="body2">Journal posted: {latestSharePaymentOrder.journal_id}</Typography>
                                    ) : null}
                                    {latestSharePaymentOrder.error_message ? (
                                        <Typography variant="body2">{latestSharePaymentOrder.error_message}</Typography>
                                    ) : null}
                                </Stack>
                            </Alert>
                        ) : null}
                    </CardContent>
                    </MotionCard>
                ) : null}

                <Grid container spacing={2} alignItems="stretch">
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }} sx={{ display: "flex" }}>
                        <AccountSummaryCard
                            icon={SavingsRoundedIcon}
                            label="Share Capital"
                            value={formatCurrency(totalShareCapital)}
                            helper="Current visible share capital balance."
                            tone="warning"
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }} sx={{ display: "flex" }}>
                        <AccountSummaryCard
                            icon={TrendingUpRoundedIcon}
                            label="Period Contributions"
                            value={formatCurrency(contributionActual)}
                            helper={`Expected ${formatCurrency(contributionExpected)} for selected period.`}
                            tone={contributionComplianceRatio >= 100 ? "success" : "warning"}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }} sx={{ display: "flex" }}>
                        <AccountSummaryCard
                            icon={AccountBalanceWalletRoundedIcon}
                            label="Dividend Credits"
                            value={formatCurrency(filteredContributions.filter((row) => row.transaction_type === "dividend_allocation").reduce((sum, row) => sum + row.amount, 0))}
                            helper={`Effective rate ${effectiveDividendRate.toFixed(2)}% on capital base.`}
                            tone="success"
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }} sx={{ display: "flex" }}>
                        <MotionCard variant="outlined" sx={{ ...contentCardSx, height: "100%", width: 1 }}>
                            <CardContent sx={{ p: 2.25, height: "100%", display: "flex" }}>
                                <Stack spacing={1.4} sx={{ width: 1 }}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                        <Box
                                            sx={{
                                                width: 38,
                                                height: 38,
                                                borderRadius: 1.5,
                                                display: "grid",
                                                placeItems: "center",
                                                bgcolor: alpha(scheduleToneColor, 0.14),
                                                color: scheduleToneColor
                                            }}
                                        >
                                            <TaskAltRoundedIcon fontSize="small" />
                                        </Box>
                                        <Chip
                                            size="small"
                                            label={contributionComplianceStatus}
                                            sx={{
                                                borderRadius: 1.2,
                                                bgcolor: alpha(contributionComplianceRatio >= 100 ? brandColors.success : "#9A6700", 0.14),
                                                color: contributionComplianceRatio >= 100 ? brandColors.success : "#9A6700",
                                                fontWeight: 700
                                            }}
                                        />
                                    </Stack>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                        Compliance & Schedule
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {contributionComplianceRatio.toFixed(1)}% target coverage
                                    </Typography>
                                    <LinearProgress
                                        variant="determinate"
                                        value={contributionExpected > 0 ? complianceCapped : 0}
                                        sx={{
                                            height: 8,
                                            borderRadius: 999,
                                            bgcolor: alpha(memberAccent, 0.14),
                                            "& .MuiLinearProgress-bar": {
                                                bgcolor: contributionComplianceRatio >= 100 ? brandColors.success : brandColors.warning
                                            }
                                        }}
                                    />
                                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: "auto" }}>
                                        Schedule: <Box component="span" sx={{ color: scheduleToneColor, fontWeight: 700 }}>{contributionScheduleStatus}</Box>
                                        {nextContributionDue ? ` • next due ${formatDate(nextContributionDue)}` : ""}
                                    </Typography>
                                </Stack>
                            </CardContent>
                        </MotionCard>
                    </Grid>
                </Grid>

                <ChartPanel
                    title="Contribution vs Dividend Trend"
                    subtitle="Monthly posted share contributions against credited dividends in this filtered window."
                    data={{
                        labels: contributionTrendLabels.length ? contributionTrendLabels : chartLabels,
                        datasets: [
                            {
                                label: "Contributions",
                                data: contributionTrendLabels.length ? contributionTrendContributions : new Array(chartLabels.length).fill(0),
                                borderColor: memberAccent,
                                backgroundColor: alpha(memberAccent, 0.14),
                                fill: true,
                                tension: 0.35
                            },
                            {
                                label: "Dividends",
                                data: contributionTrendLabels.length ? contributionTrendDividends : new Array(chartLabels.length).fill(0),
                                borderColor: memberAccentAlt,
                                backgroundColor: alpha(memberAccentAlt, 0.12),
                                fill: true,
                                tension: 0.35
                            }
                        ]
                    }}
                    options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { position: "bottom" } }
                    }}
                />

                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <MotionCard variant="outlined" sx={contentCardSx}>
                            <CardContent sx={{ p: 2.25 }}>
                                <Stack spacing={1.4}>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <Box
                                            sx={{
                                                width: 30,
                                                height: 30,
                                                borderRadius: 1.25,
                                                display: "grid",
                                                placeItems: "center",
                                                bgcolor: memberAccentSoftBg,
                                                color: memberAccent
                                            }}
                                        >
                                            <TimelineRoundedIcon fontSize="small" />
                                        </Box>
                                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                            Running Total Summary
                                        </Typography>
                                    </Stack>
                                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                        <Chip label={`${contributionEntriesCount} contributions`} variant="outlined" />
                                        <Chip label={`${dividendEntriesCount} dividend entries`} variant="outlined" />
                                        <Chip
                                            label={`Total posted ${formatCurrency(contributionRunningTotal)}`}
                                            variant="outlined"
                                            sx={{
                                                borderColor: alpha(memberAccent, 0.32),
                                                color: memberAccent
                                            }}
                                        />
                                    </Stack>
                                    <Typography variant="body2" color="text.secondary">
                                        Expected contribution base: {formatCurrency(contributionExpected)} (baseline {formatCurrency(contributionBaselineMonthly)} per month).
                                    </Typography>
                                </Stack>
                            </CardContent>
                        </MotionCard>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <MotionCard variant="outlined" sx={contentCardSx}>
                            <CardContent sx={{ p: 2.25 }}>
                                <Stack spacing={1.4}>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <Box
                                            sx={{
                                                width: 30,
                                                height: 30,
                                                borderRadius: 1.25,
                                                display: "grid",
                                                placeItems: "center",
                                                bgcolor: alpha(brandColors.success, 0.12),
                                                color: brandColors.success
                                            }}
                                        >
                                            <StarRoundedIcon fontSize="small" />
                                        </Box>
                                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                            Dividend Calculation Transparency
                                        </Typography>
                                    </Stack>
                                    <Stack spacing={1}>
                                        <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 1.4 }}>
                                            <Typography variant="caption" color="text.secondary">
                                                Base capital used
                                            </Typography>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                                {formatCurrency(totalShareCapital)}
                                            </Typography>
                                        </Paper>
                                        <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 1.4 }}>
                                            <Typography variant="caption" color="text.secondary">
                                                Dividend credits posted
                                            </Typography>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                                {formatCurrency(totalDividends)}
                                            </Typography>
                                        </Paper>
                                        <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 1.4 }}>
                                            <Typography variant="caption" color="text.secondary">
                                                Effective dividend rate
                                            </Typography>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                                {effectiveDividendRate.toFixed(2)}%
                                            </Typography>
                                        </Paper>
                                    </Stack>
                                </Stack>
                            </CardContent>
                        </MotionCard>
                    </Grid>
                </Grid>

                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <MotionCard variant="outlined" sx={contentCardSx}>
                            <CardContent>
                                <Typography variant="h6" sx={{ mb: 2 }}>
                                    Dividend History by Year
                                </Typography>
                                <DataTable
                                    rows={dividendHistoryByYear}
                                    columns={[
                                        { key: "year", header: "Year", render: (row) => row.year },
                                        { key: "amount", header: "Amount", render: (row) => formatCurrency(row.amount) }
                                    ]}
                                    emptyMessage="No dividend entries for selected period."
                                />
                            </CardContent>
                        </MotionCard>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <MotionCard variant="outlined" sx={contentCardSx}>
                            <CardContent sx={{ p: 2.25 }}>
                                <Stack spacing={1.2}>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <Box
                                            sx={{
                                                width: 30,
                                                height: 30,
                                                borderRadius: 1.25,
                                                display: "grid",
                                                placeItems: "center",
                                                bgcolor: alpha(scheduleToneColor, 0.12),
                                                color: scheduleToneColor
                                            }}
                                        >
                                            <EventRoundedIcon fontSize="small" />
                                        </Box>
                                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                            Contribution Schedule
                                        </Typography>
                                    </Stack>
                                    <Typography variant="body2" color="text.secondary">
                                        Status: <Box component="span" sx={{ color: scheduleToneColor, fontWeight: 700 }}>{contributionScheduleStatus}</Box>
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Next expected contribution: {formatDate(nextContributionDue)}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Monthly baseline: {formatCurrency(contributionBaselineMonthly)}
                                    </Typography>
                                </Stack>
                            </CardContent>
                        </MotionCard>
                    </Grid>
                </Grid>

                <MotionCard variant="outlined" sx={contentCardSx}>
                    <CardContent>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.2} sx={{ mb: 2 }}>
                            <Typography variant="h6">
                                Share Contributions & Dividends
                            </Typography>
                            <Chip
                                size="small"
                                label={`${filteredContributions.length} records`}
                                sx={{
                                    borderRadius: 1.2,
                                    bgcolor: alpha(memberAccent, 0.12),
                                    color: memberAccent,
                                    fontWeight: 700
                                }}
                            />
                        </Stack>
                        <DataTable
                            rows={paginatedContributions}
                            columns={statementColumns}
                            emptyMessage="No share contributions or dividends posted in this period."
                        />
                        <TablePagination
                            component="div"
                            count={filteredContributions.length}
                            page={contributionsPage}
                            onPageChange={(_, value) => setContributionsPage(value)}
                            rowsPerPage={contributionsRowsPerPage}
                            onRowsPerPageChange={(event) => {
                                setContributionsRowsPerPage(Number(event.target.value));
                                setContributionsPage(0);
                            }}
                            rowsPerPageOptions={[10, 25, 50]}
                        />
                    </CardContent>
                </MotionCard>
            </Stack>
        );
    };

    const renderPaymentsView = () => (
        <Stack spacing={3}>
            <MotionCard
                variant="outlined"
                sx={{
                    ...contentCardSx,
                    background: theme.palette.mode === "dark"
                        ? `linear-gradient(135deg, ${alpha(memberAccentStrong, 0.4)}, ${alpha("#0B5E55", 0.28)})`
                        : `linear-gradient(135deg, ${alpha(brandColors.primary[900], 0.96)}, ${alpha(brandColors.success, 0.82)})`,
                    color: "#fff",
                    borderColor: "transparent"
                }}
            >
                <CardContent sx={{ p: { xs: 2.5, md: 3.25 } }}>
                    <Stack spacing={1.2}>
                        <Typography variant="overline" sx={{ color: alpha("#FFFFFF", 0.74), letterSpacing: 1.4 }}>
                            Member payment history
                        </Typography>
                        <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.08, maxWidth: 760 }}>
                            Review every Mobile Money request like a receipt ledger, including failed and expired attempts.
                        </Typography>
                        <Typography variant="body2" sx={{ color: alpha("#FFFFFF", 0.84), maxWidth: 780 }}>
                            Track initiated amounts, approval outcomes, posted journals, timeout cases, and payment references in one member-facing timeline.
                        </Typography>
                    </Stack>
                </CardContent>
            </MotionCard>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <AccountSummaryCard
                        icon={WalletRoundedIcon}
                        label="Total Attempts"
                        value={normalizedPaymentOrders.length}
                        helper="All mobile money payment requests."
                        tone="primary"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <AccountSummaryCard
                        icon={TaskAltRoundedIcon}
                        label="Posted"
                        value={successfulPaymentCount}
                        helper="Payments fully posted into the ledger."
                        tone="success"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <AccountSummaryCard
                        icon={HourglassTopRoundedIcon}
                        label="In Progress"
                        value={pendingPaymentCount}
                        helper="Still waiting for approval or posting."
                        tone="warning"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <AccountSummaryCard
                        icon={HighlightOffRoundedIcon}
                        label="Failed / Expired"
                        value={failedPaymentCount}
                        helper={`Tracked amount ${formatCurrency(totalMobileMoneyAmount)}.`}
                        tone="danger"
                    />
                </Grid>
            </Grid>

            <MotionCard variant="outlined" sx={contentCardSx}>
                <CardContent>
                    <Stack spacing={2}>
                        <Stack
                            direction={{ xs: "column", md: "row" }}
                            spacing={1.5}
                            justifyContent="space-between"
                            alignItems={{ xs: "stretch", md: "center" }}
                        >
                            <Box>
                                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                    Payment Receipts
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Every mobile money attempt is visible here, whether it posted successfully or not.
                                </Typography>
                            </Box>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                                <TextField
                                    select
                                    label="Purpose"
                                    value={paymentPurposeFilter}
                                    onChange={(event) => setPaymentPurposeFilter(event.target.value)}
                                    sx={{ minWidth: { xs: 0, sm: 180 } }}
                                >
                                    <MenuItem value="all">All payments</MenuItem>
                                    <MenuItem value="share_contribution">Share contributions</MenuItem>
                                    <MenuItem value="savings_deposit">Savings deposits</MenuItem>
                                    <MenuItem value="membership_fee">Membership fees</MenuItem>
                                    <MenuItem value="loan_repayment">Loan repayments</MenuItem>
                                </TextField>
                                <TextField
                                    select
                                    label="Status"
                                    value={paymentStatusFilter}
                                    onChange={(event) => setPaymentStatusFilter(event.target.value)}
                                    sx={{ minWidth: { xs: 0, sm: 180 } }}
                                >
                                    <MenuItem value="all">All statuses</MenuItem>
                                    <MenuItem value="posted">Posted</MenuItem>
                                    <MenuItem value="pending">Pending</MenuItem>
                                    <MenuItem value="paid">Paid</MenuItem>
                                    <MenuItem value="failed">Failed</MenuItem>
                                    <MenuItem value="expired">Expired</MenuItem>
                                </TextField>
                            </Stack>
                        </Stack>
                        <DataTable
                            rows={paginatedPaymentOrders}
                            columns={paymentOrderColumns}
                            emptyMessage="No payment receipts match the selected filters."
                        />
                        <TablePagination
                            component="div"
                            count={filteredPaymentOrders.length}
                            page={paymentsPage}
                            onPageChange={(_, value) => setPaymentsPage(value)}
                            rowsPerPage={paymentsRowsPerPage}
                            onRowsPerPageChange={(event) => {
                                setPaymentsRowsPerPage(Number(event.target.value));
                                setPaymentsPage(0);
                            }}
                            rowsPerPageOptions={[10, 25, 50]}
                        />
                    </Stack>
                </CardContent>
            </MotionCard>
        </Stack>
    );

    const renderActiveView = () => {
        switch (activeSection) {
            case "member-accounts":
                return renderAccountsView();
            case "member-loans":
                return renderLoansView();
            case "member-transactions":
                return renderTransactionsView();
            case "member-contributions":
                return renderContributionsView();
            case "member-payments":
                return renderPaymentsView();
            default:
                return renderOverviewView();
        }
    };

    const renderSidebarContent = (collapsed: boolean, mobile = false) => (
        <Box
            sx={{
                width: "100%",
                minWidth: 0,
                flex: 1,
                height: "100%",
                display: "flex",
                flexDirection: "column",
                background: theme.palette.mode === "dark"
                    ? `linear-gradient(180deg, ${alpha("#091224", 0.98)} 0%, ${alpha(darkThemeColors.paper, 0.98)} 44%, ${alpha("#0B1324", 0.98)} 100%)`
                    : "linear-gradient(180deg, #FFFFFF 0%, #F6FAFF 46%, #F3F7FF 100%)",
                borderRight: mobile ? "none" : `1px solid ${alpha(theme.palette.divider, 0.72)}`,
                boxShadow: mobile ? "none" : "inset -1px 0 0 rgba(15, 23, 42, 0.04)"
            }}
        >
            <Box
                sx={{
                    px: collapsed ? 1.5 : 2.1,
                    py: collapsed ? 1.75 : 2.2,
                    minHeight: 88,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: collapsed ? "center" : "space-between",
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.68)}`
                }}
            >
                {collapsed ? (
                    <Box
                        sx={{
                            width: 44,
                            height: 44,
                            borderRadius: 2,
                            display: "grid",
                            placeItems: "center",
                            p: 0.45,
                            bgcolor: "#fff",
                            border: `1px solid ${alpha(theme.palette.divider, 0.68)}`,
                            boxShadow: `0 10px 22px ${alpha(memberAccentStrong, 0.2)}`
                        }}
                    >
                        <Box
                            component="img"
                            src={portalLogoSrc}
                            alt="SACCOS logo"
                            sx={{
                                width: "100%",
                                height: "100%",
                                objectFit: "contain"
                            }}
                        />
                    </Box>
                ) : (
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box
                            sx={{
                                width: 46,
                                height: 46,
                                borderRadius: 2,
                                display: "grid",
                                placeItems: "center",
                                p: 0.45,
                                bgcolor: "#fff",
                                border: `1px solid ${alpha(theme.palette.divider, 0.68)}`,
                                boxShadow: `0 10px 22px ${alpha(memberAccentStrong, 0.18)}`
                            }}
                        >
                            <Box
                                component="img"
                                src={portalLogoSrc}
                                alt="SACCOS logo"
                                sx={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "contain"
                                }}
                            />
                        </Box>
                        <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                                {selectedTenantName || "Member Portal"}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 0.2 }}>
                                Digital member workspace
                            </Typography>
                        </Box>
                    </Stack>
                )}
                {mobile ? (
                    <IconButton onClick={() => setMobileMenuOpen(false)}>
                        <ChevronLeftRoundedIcon />
                    </IconButton>
                ) : null}
            </Box>

            {!collapsed ? (
                <Box sx={{ px: 1.35, pt: 1.55 }}>
                    <Paper
                        variant="outlined"
                        sx={{
                            p: 1.45,
                            borderRadius: 3,
                            bgcolor: theme.palette.mode === "dark"
                                ? alpha("#0F1A2B", 0.62)
                                : alpha("#FFFFFF", 0.94),
                            borderColor: alpha(theme.palette.divider, 0.72),
                            boxShadow: `0 14px 28px ${alpha(memberAccentStrong, 0.08)}`
                        }}
                    >
                        <Stack direction="row" spacing={1.1} alignItems="center">
                            <Avatar
                                sx={{
                                    width: 42,
                                    height: 42,
                                    borderRadius: 1.6,
                                    bgcolor: alpha(memberAccent, 0.16),
                                    color: memberAccentStrong,
                                    fontWeight: 800
                                }}
                            >
                                {(profile?.full_name || "M").slice(0, 1).toUpperCase()}
                            </Avatar>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 800 }} noWrap>
                                    {profile?.full_name || "Member"}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" noWrap>
                                    {selectedBranchName || "Assigned branch"}
                                </Typography>
                            </Box>
                        </Stack>
                        <Stack direction="row" spacing={0.9} useFlexGap flexWrap="wrap" sx={{ mt: 1.35 }}>
                            <Chip label={formatRole(profile?.role || "member")} size="small" variant="outlined" />
                            <Chip
                                label={hasNoVisibleFinancialData ? "Awaiting activity" : "Live activity"}
                                size="small"
                                sx={{
                                    bgcolor: hasNoVisibleFinancialData ? alpha(theme.palette.info.main, 0.1) : alpha(brandColors.success, 0.12),
                                    color: hasNoVisibleFinancialData ? theme.palette.info.main : brandColors.success,
                                    border: "none",
                                    fontWeight: 700
                                }}
                            />
                        </Stack>
                    </Paper>
                </Box>
            ) : null}

            <Box sx={{ px: collapsed ? 0.85 : 1.35, py: 1.7 }}>
                {!collapsed ? (
                    <Typography
                        variant="overline"
                        color="text.secondary"
                        sx={{ px: 1.2, display: "block", mb: 1, letterSpacing: 1.1, fontWeight: 700 }}
                    >
                        Workspace
                    </Typography>
                ) : null}
                <Paper
                    sx={{
                        p: collapsed ? 0.65 : 0.85,
                        borderRadius: 3.2,
                        border: "none",
                        boxShadow: "none",
                        bgcolor: theme.palette.mode === "dark"
                            ? alpha("#0F1A2B", 0.54)
                            : alpha("#F8FBFF", 0.96)
                    }}
                >
                    <List disablePadding>
                        {visiblePortalSections.map((section) => {
                            const Icon = section.icon;
                            const active = activeSection === section.id;

                            return (
                                <Box key={section.id}>
                                    <ListItemButton
                                        selected={active}
                                        onClick={() => handleSectionSelect(section.id)}
                                        sx={{
                                            position: "relative",
                                            overflow: "hidden",
                                            mb: 0.7,
                                            minHeight: collapsed ? 48 : 58,
                                            borderRadius: 2.4,
                                            justifyContent: collapsed ? "center" : "flex-start",
                                            px: collapsed ? 0.85 : 1.15,
                                            transition: "all 180ms ease",
                                            "&::before": {
                                                content: '""',
                                                position: "absolute",
                                                left: 0,
                                                top: 8,
                                                bottom: 8,
                                                width: 3,
                                                borderRadius: "0 6px 6px 0",
                                                bgcolor: "#fff",
                                                opacity: active ? 0.95 : 0
                                            },
                                            "&:hover": {
                                                bgcolor: active
                                                    ? undefined
                                                    : theme.palette.mode === "dark"
                                                        ? alpha(memberAccent, 0.14)
                                                        : alpha(brandColors.primary[500], 0.1),
                                                transform: collapsed ? "none" : "translateX(2px)"
                                            },
                                            "&.Mui-selected": {
                                                background: theme.palette.mode === "dark"
                                                    ? `linear-gradient(135deg, ${alpha(memberAccentStrong, 0.9)}, ${alpha(memberAccentAlt, 0.68)})`
                                                    : `linear-gradient(135deg, ${brandColors.primary[900]}, ${brandColors.accent[700]})`,
                                                color: "#fff",
                                                boxShadow: `0 12px 22px ${alpha(memberAccentStrong, 0.26)}`
                                            }
                                        }}
                                    >
                                        <ListItemIcon
                                            sx={{
                                                minWidth: collapsed ? 0 : 38,
                                                justifyContent: "center"
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    width: 30,
                                                    height: 30,
                                                    borderRadius: 1.25,
                                                    display: "grid",
                                                    placeItems: "center",
                                                    bgcolor: active
                                                        ? alpha("#FFFFFF", 0.22)
                                                        : theme.palette.mode === "dark"
                                                            ? alpha("#FFFFFF", 0.1)
                                                            : alpha(brandColors.primary[500], 0.1),
                                                    color: active
                                                        ? "#fff"
                                                        : theme.palette.mode === "dark"
                                                            ? alpha("#FFFFFF", 0.9)
                                                            : memberAccent
                                                }}
                                            >
                                                <Icon fontSize="small" />
                                            </Box>
                                        </ListItemIcon>
                                        {!collapsed ? (
                                            <ListItemText
                                                primary={section.label}
                                                secondary={section.subtitle}
                                                primaryTypographyProps={{
                                                    fontSize: 14,
                                                    fontWeight: active ? 700 : 600,
                                                    color: active ? "#FFFFFF" : undefined
                                                }}
                                                secondaryTypographyProps={{
                                                    fontSize: 11.5,
                                                    lineHeight: 1.25,
                                                    mt: 0.25,
                                                    color: active ? alpha("#FFFFFF", 0.8) : "text.secondary"
                                                }}
                                            />
                                        ) : null}
                                    </ListItemButton>
                                </Box>
                            );
                        })}
                    </List>
                </Paper>
            </Box>

            <Box sx={{ mt: "auto", px: collapsed ? 0.85 : 1.35, pb: 1.7 }}>
                <MotionCard
                    variant="outlined"
                    sx={{
                        ...contentCardSx,
                        borderRadius: 3,
                        borderColor: alpha(theme.palette.divider, 0.75),
                        bgcolor: theme.palette.mode === "dark"
                            ? alpha("#0E1727", 0.64)
                            : alpha("#FFFFFF", 0.96)
                    }}
                >
                    <CardContent sx={{ p: collapsed ? 1.05 : 1.35 }}>
                        {collapsed ? (
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: "block", textAlign: "center", lineHeight: 1.5, fontSize: 10 }}
                            >
                                ©26
                            </Typography>
                        ) : (
                            <Stack spacing={0.8}>
                                <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="center">
                                    <ShieldRoundedIcon sx={{ fontSize: 14, color: brandColors.success }} />
                                    <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
                                        Secure member session
                                    </Typography>
                                </Stack>
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ display: "block", textAlign: "center", lineHeight: 1.45, fontSize: 11 }}
                                >
                                    Real-time balances, loan tracking, and self-service payments in one place.
                                </Typography>
                            </Stack>
                        )}
                    </CardContent>
                </MotionCard>
            </Box>
        </Box>
    );

    if (loading) {
        return <AppLoader message="Loading member portal..." />;
    }

    if (error) {
        return (
            <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", px: 3 }}>
                <Alert severity="error" sx={{ borderRadius: 2 }}>
                    {error}
                </Alert>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                minHeight: "100vh",
                width: "100%",
                maxWidth: { xs: "100vw", lg: "none" },
                boxSizing: "border-box",
                overflowX: "clip",
                bgcolor: theme.palette.mode === "dark" ? darkThemeColors.background : brandColors.neutral.background,
                backgroundImage: theme.palette.mode === "dark"
                    ? `radial-gradient(circle at 14% 18%, ${alpha(memberAccentStrong, 0.18)} 0%, transparent 30%),
                        radial-gradient(circle at 84% 10%, ${alpha("#1FA8E6", 0.14)} 0%, transparent 24%)`
                    : `radial-gradient(circle at 12% 12%, ${alpha(brandColors.primary[100], 0.95)} 0%, transparent 28%),
                        radial-gradient(circle at 88% 8%, ${alpha(brandColors.accent[100], 0.86)} 0%, transparent 24%)`,
                backgroundAttachment: { xs: "scroll", lg: "fixed" },
                color: "text.primary",
                ...(isDarkMode
                    ? {
                        "& .MuiButton-containedPrimary": {
                            bgcolor: memberAccent,
                            color: "#1a1a1a",
                            "&:hover": { bgcolor: memberAccentAlt }
                        },
                        "& .MuiButton-outlinedPrimary": {
                            borderColor: alpha(memberAccent, 0.42),
                            color: memberAccent
                        }
                    }
                    : {})
            }}
        >
            <Box
                component="aside"
                sx={{
                    display: { xs: "none", lg: "flex" },
                    position: "fixed",
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: drawerWidth,
                    transition: "width 220ms ease",
                    zIndex: theme.zIndex.drawer,
                    bgcolor: theme.palette.mode === "dark" ? darkThemeColors.paper : "#fff"
                }}
            >
                <Box sx={{ width: "100%", display: "flex" }}>
                    {renderSidebarContent(!sidebarOpen)}
                </Box>
            </Box>

            <Drawer
                open={mobileMenuOpen}
                onClose={() => setMobileMenuOpen(false)}
                PaperProps={{
                    sx: {
                        width: 320,
                        bgcolor: theme.palette.mode === "dark" ? darkThemeColors.paper : "#fff"
                    }
                }}
                sx={{ display: { xs: "block", lg: "none" } }}
            >
                {renderSidebarContent(false, true)}
            </Drawer>

            <Box
                component="main"
                sx={{
                    minHeight: "100vh",
                    minWidth: 0,
                    width: "auto",
                    maxWidth: { xs: "100vw", lg: "none" },
                    boxSizing: "border-box",
                    overflowX: "clip",
                    ml: { lg: `${drawerWidth}px` },
                    transition: "margin-left 220ms ease"
                }}
            >
                <Box
                    sx={{
                        position: "sticky",
                        top: 0,
                        zIndex: theme.zIndex.appBar,
                        boxSizing: "border-box",
                        px: { xs: 1.25, sm: 1.5, md: 3.5 },
                        py: 1.35,
                        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.72)}`,
                        bgcolor: theme.palette.mode === "dark"
                            ? alpha(darkThemeColors.paper, 0.94)
                            : alpha("#FFFFFF", 0.92),
                        backdropFilter: "blur(18px)"
                    }}
                >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                            <IconButton
                                onClick={() => {
                                    if (isDesktop) {
                                        setSidebarOpen((current) => !current);
                                    } else {
                                        setMobileMenuOpen(true);
                                    }
                                }}
                                sx={{
                                    borderRadius: 1.5,
                                    border: `1px solid ${alpha(theme.palette.divider, 0.9)}`
                                }}
                            >
                                <MenuRoundedIcon />
                            </IconButton>
                            <Typography variant="overline" sx={{ color: "text.secondary", letterSpacing: "0.18em", fontWeight: 700 }}>
                                Member Workspace
                            </Typography>
                        </Stack>

                        <Stack direction="row" spacing={1.25} alignItems="center">
                            <Paper
                                variant="outlined"
                                sx={{
                                    display: { xs: "none", md: "flex" },
                                    alignItems: "center",
                                    gap: 1,
                                    px: 1.5,
                                    py: 0.5,
                                    borderRadius: 99,
                                    minWidth: 240,
                                    bgcolor: theme.palette.mode === "dark" ? alpha("#FFFFFF", 0.02) : "#fff"
                                }}
                            >
                                <SearchRoundedIcon fontSize="small" sx={{ color: "text.secondary" }} />
                                <InputBase placeholder="Search member workspace..." sx={{ flex: 1, fontSize: 14 }} />
                            </Paper>
                            {!twoFactorSetupRequired ? (
                                <NotificationBell
                                    tenantId={profile?.tenant_id || null}
                                    buttonSx={{
                                        borderRadius: 1.5,
                                        border: `1px solid ${alpha(theme.palette.divider, 0.9)}`
                                    }}
                                    menuPaperSx={{
                                        borderRadius: 2
                                    }}
                                />
                            ) : null}
                            <IconButton
                                onClick={handleProfileMenuOpen}
                                sx={{
                                    borderRadius: 1.5,
                                    border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                                    p: 0.4
                                }}
                            >
                                <Avatar
                                    sx={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: 1.3,
                                        bgcolor: alpha(memberAccent, 0.14),
                                        color: memberAccentStrong,
                                        fontWeight: 800,
                                        fontSize: 14
                                    }}
                                >
                                    {(profile?.full_name || "M").slice(0, 1).toUpperCase()}
                                </Avatar>
                            </IconButton>
                        </Stack>
                    </Stack>
                </Box>

                <Menu
                    anchorEl={profileMenuAnchor}
                    open={profileMenuOpen}
                    onClose={handleProfileMenuClose}
                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                    transformOrigin={{ vertical: "top", horizontal: "right" }}
                    PaperProps={{
                        elevation: 3,
                        sx: {
                            mt: 1,
                            width: 360,
                            maxWidth: "calc(100vw - 20px)",
                            borderRadius: m3MenuTokens.shapeExtraLarge,
                            border: `1px solid ${theme.palette.divider}`,
                            backgroundColor: m3MenuTokens.surfaceContainerHighest,
                            p: 0.25
                        }
                    }}
                >
                    <Box sx={{ px: 1, py: 0.5 }}>
                        <List dense disablePadding>
                            <ListItem
                                sx={{
                                    px: 1.25,
                                    py: 1.25,
                                    borderRadius: 0.5
                                }}
                                secondaryAction={
                                    <Stack direction="row" spacing={0.5}>
                                        <Chip label="Active" size="small" variant="outlined" sx={{ borderRadius: 0.5, fontWeight: 600 }} />
                                        {Boolean((user as { email_confirmed_at?: string | null } | null)?.email_confirmed_at) ? (
                                            <Chip
                                                label="Verified"
                                                size="small"
                                                variant="outlined"
                                                sx={{
                                                    borderRadius: 0.5,
                                                    fontWeight: 600,
                                                    borderColor: alpha(memberAccent, 0.36),
                                                    color: memberAccent
                                                }}
                                            />
                                        ) : null}
                                    </Stack>
                                }
                            >
                                <ListItemAvatar>
                                    <Avatar
                                        sx={{
                                            width: 42,
                                            height: 42,
                                            bgcolor: alpha(memberAccent, 0.14),
                                            color: memberAccent,
                                            fontWeight: 700
                                        }}
                                    >
                                        {(profile?.full_name || "M").slice(0, 1).toUpperCase()}
                                    </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                    primary={
                                        <Typography variant="subtitle1" sx={{ fontSize: 16, fontWeight: 700 }} noWrap>
                                            {profile?.full_name || "Member"}
                                        </Typography>
                                    }
                                    secondary={
                                        <Typography variant="caption" sx={{ fontSize: 12 }} color="text.secondary" noWrap>
                                            {user?.email || "No email"}
                                        </Typography>
                                    }
                                />
                            </ListItem>
                        </List>

                        <Box
                            sx={{
                                mt: 0.75,
                                p: 0.5,
                                borderRadius: 0.5,
                                bgcolor: m3MenuTokens.surfaceVariant
                            }}
                        >
                            <List dense disablePadding>
                                <ListItem sx={{ py: 0.35, px: 1.25 }}>
                                    <ListItemIcon sx={{ minWidth: 34 }}>
                                        <WorkspacesRoundedIcon fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={<Typography variant="body2">Role</Typography>}
                                        secondary={<Typography variant="caption">{formatRole(profile?.role || "member")}</Typography>}
                                    />
                                </ListItem>
                                <ListItem sx={{ py: 0.35, px: 1.25 }}>
                                    <ListItemIcon sx={{ minWidth: 34 }}>
                                        <ApartmentRoundedIcon fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={<Typography variant="body2">Branch</Typography>}
                                        secondary={<Typography variant="caption">{selectedBranchName || "Assigned branch"}</Typography>}
                                    />
                                </ListItem>
                                <ListItem sx={{ py: 0.35, px: 1.25 }}>
                                    <ListItemIcon sx={{ minWidth: 34 }}>
                                        <StarRoundedIcon fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={<Typography variant="body2">Deployment</Typography>}
                                        secondary={<Typography variant="caption">SINGLE-TENANT WORKSPACE</Typography>}
                                    />
                                </ListItem>
                                <ListItem sx={{ py: 0.35, px: 1.25 }}>
                                    <ListItemIcon sx={{ minWidth: 34 }}>
                                        <EventRoundedIcon fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={<Typography variant="body2">Membership Since</Typography>}
                                        secondary={<Typography variant="caption">{formatDate(profile?.created_at || user?.created_at || null)}</Typography>}
                                    />
                                </ListItem>
                            </List>
                        </Box>

                        <List dense disablePadding sx={{ mt: 0.75 }}>
                            <ListItemButton sx={{ borderRadius: 0.5, minHeight: 42 }} onClick={() => handleProfileMenuAction(handleDownloadStatement)}>
                                <ListItemIcon sx={{ minWidth: 34 }}>
                                    <DownloadRoundedIcon fontSize="small" />
                                </ListItemIcon>
                                <ListItemText primary="Download Statement" />
                            </ListItemButton>
                            <ListItem
                                sx={{ py: 0.25, px: 1.25 }}
                                secondaryAction={
                                    <Switch
                                        edge="end"
                                        checked={Boolean(profile?.two_factor_enabled && profile?.two_factor_verified)}
                                        onChange={() =>
                                            handleProfileMenuAction(() =>
                                                navigate(
                                                    Boolean(profile?.two_factor_enabled && profile?.two_factor_verified)
                                                        ? "/security"
                                                        : "/security?intent=setup"
                                                )
                                            )
                                        }
                                        inputProps={{ "aria-label": "Manage two-factor authentication" }}
                                    />
                                }
                            >
                                <ListItemIcon sx={{ minWidth: 34 }}>
                                    <ShieldRoundedIcon fontSize="small" />
                                </ListItemIcon>
                                <ListItemText
                                    primary="Two-Factor Authentication"
                                    secondary={Boolean(profile?.two_factor_enabled && profile?.two_factor_verified) ? "Enabled" : "Tap to enable"}
                                />
                            </ListItem>
                            <ListItemButton sx={{ borderRadius: 0.5, minHeight: 42 }} onClick={() => handleProfileMenuAction(() => navigate("/change-password"))}>
                                <ListItemIcon sx={{ minWidth: 34 }}>
                                    <ShieldRoundedIcon fontSize="small" />
                                </ListItemIcon>
                                <ListItemText primary="Change Password" />
                            </ListItemButton>
                        </List>

                        <List dense disablePadding sx={{ mt: 0.75 }}>
                            <ListItem
                                sx={{ py: 0.25, px: 1.25 }}
                                secondaryAction={
                                    <Switch
                                        edge="end"
                                        checked={themeMode === "dark"}
                                        onChange={() => toggleTheme()}
                                        inputProps={{ "aria-label": "Toggle dark mode" }}
                                    />
                                }
                            >
                                <ListItemIcon sx={{ minWidth: 34 }}>
                                    {themeMode === "dark" ? <LightModeRoundedIcon fontSize="small" /> : <DarkModeRoundedIcon fontSize="small" />}
                                </ListItemIcon>
                                <ListItemText primary="Dark Mode" />
                            </ListItem>
                        </List>

                        <Divider sx={{ my: 1 }} />

                        <List dense disablePadding>
                            <ListItemButton
                                sx={{
                                    borderRadius: 0.5,
                                    minHeight: 42,
                                    color: "error.main",
                                    "& .MuiListItemIcon-root": {
                                        color: "error.main"
                                    }
                                }}
                                onClick={() => {
                                    handleProfileMenuClose();
                                    void signOut();
                                }}
                            >
                                <ListItemIcon sx={{ minWidth: 34 }}>
                                    <LogoutRoundedIcon fontSize="small" />
                                </ListItemIcon>
                                <ListItemText primary="Sign Out" />
                            </ListItemButton>
                        </List>
                    </Box>
                </Menu>

                <Box
                    sx={{
                        width: "100%",
                        minWidth: 0,
                        boxSizing: "border-box",
                        overflowX: "clip",
                        px: { xs: 1.25, sm: 1.5, md: 3.5 },
                        py: { xs: 2.5, md: 3.5 },
                        pb: { xs: 10, lg: 4 },
                        maxWidth: { xs: "100vw", lg: 1600 },
                        mx: "auto"
                    }}
                >
                    <Stack spacing={3}>
                        {warning ? (
                            <Alert severity="warning" sx={{ borderRadius: 2 }}>
                                {warning}
                            </Alert>
                        ) : null}
                        {hasNoVisibleFinancialData ? (
                            <Alert severity="info" sx={{ borderRadius: 2 }}>
                                No posted member financial activity is visible yet for this login. The dashboard will populate after this member has linked accounts with deposits, share contributions, loans, or statement activity.
                            </Alert>
                        ) : null}
                        {memberApplication && (!memberRecord || memberApplication.status === "approved_pending_payment") ? (
                            <MotionCard variant="outlined" sx={contentCardSx}>
                                <CardContent>
                                    <Stack spacing={1.25}>
                                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                            <Box>
                                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                                    Membership Application Status
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    Application {memberApplication.application_no}
                                                </Typography>
                                            </Box>
                                            <Chip
                                                size="small"
                                                label={memberApplicationStatusLabels[memberApplication.status]}
                                                sx={{ borderRadius: 1.25 }}
                                            />
                                        </Stack>
                                        <Divider />
                                        <Stack spacing={0.35}>
                                            <Typography variant="body2">
                                                <strong>Status:</strong> {memberApplicationStatusLabels[memberApplication.status]}
                                            </Typography>
                                            <Typography variant="body2">
                                                <strong>Branch:</strong>{" "}
                                                {memberApplication.branch_name || selectedBranchName || "Branch pending"}
                                            </Typography>
                                            <Typography variant="body2">
                                                <strong>Membership Fee:</strong> {formatCurrency(memberApplication.membership_fee_amount || 0)}
                                            </Typography>
                                            {memberApplication.membership_fee_paid ? (
                                                <Typography variant="body2">
                                                    <strong>Paid:</strong> {formatCurrency(memberApplication.membership_fee_paid)}
                                                </Typography>
                                            ) : null}
                                        </Stack>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                            {getMemberApplicationMessage(memberApplication.status)}
                                        </Typography>
                                        {memberApplication.status === "approved_pending_payment" ? (
                                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.1} sx={{ pt: 0.5 }}>
                                                <Button
                                                    variant="contained"
                                                    onClick={() => openDepositDialog("membership_fee")}
                                                    disabled={submittingContribution || membershipFeeOutstanding <= 0}
                                                >
                                                    Pay Membership Fee
                                                </Button>
                                                <Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center" }}>
                                                    Outstanding: {formatCurrency(membershipFeeOutstanding)}
                                                </Typography>
                                            </Stack>
                                        ) : null}
                                    </Stack>
                                </CardContent>
                            </MotionCard>
                        ) : null}
                        <Box sx={{ display: "grid", gap: 3, width: { xs: "calc(100vw - 20px)", sm: "100%" }, maxWidth: { xs: "calc(100vw - 20px)", sm: "100%" }, minWidth: 0 }}>
                                {activeSection === "member-overview" ? (
                                    <>
                                        <Box
                                            sx={{
                                                display: "grid",
                                                gap: 2.5,
                                                gridTemplateColumns: {
                                                    xs: "minmax(0, 1fr)",
                                                    xl: "minmax(0, 2fr) minmax(0, 1fr)"
                                                },
                                                alignItems: "stretch"
                                            }}
                                        >
                                            <Box sx={{ display: "flex", minWidth: 0 }}>
                                                {renderHero()}
                                            </Box>
                                            <Box sx={{ display: "flex", minWidth: 0 }}>
                                                {renderSpotlightCard()}
                                            </Box>
                                        </Box>
                                        {renderStatGrid()}
                                        {renderBorrowingCapacityCard()}
                                    </>
                                ) : null}
                                {activeSection !== "member-overview" ? renderSectionLead() : null}
                                {renderActiveView()}
                        </Box>
                    </Stack>
                </Box>
            </Box>

            <MotionModal open={showContributionDialog} onClose={submittingContribution ? undefined : () => setShowContributionDialog(false)} maxWidth="md" fullWidth>
                <DialogTitle sx={{ pb: 1.25 }}>
                    <Stack spacing={0.6}>
                        <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: "-0.02em" }}>
                            {contributionFlowState ? `${activePaymentCopy.title} Payment Progress` : `Start ${activePaymentCopy.title}`}
                        </Typography>
                        {!contributionFlowState ? (
                            <Typography variant="body2" color="text.secondary">
                                {paymentFlowPurpose === "membership_fee"
                                    ? "Approve the mobile money prompt and let the system post the membership fee automatically after confirmation."
                                    : paymentFlowPurpose === "loan_repayment"
                                        ? "Choose the loan, review the repayment split, approve the mobile money prompt, and let the system post the repayment automatically."
                                    : "Choose where the money should land, approve the mobile money prompt, and let the system post it automatically."}
                            </Typography>
                        ) : null}
                    </Stack>
                </DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2} sx={{ pt: 0.5 }}>
                        <Alert severity={contributionFlowTone} variant="outlined">
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.4 }}>
                                {contributionFlowTitle}
                            </Typography>
                            <Typography variant="body2">{contributionFlowMessage}</Typography>
                        </Alert>
                        {paymentFlowPurpose !== "loan_repayment" && !paymentTargetAccounts.length ? (
                            <Alert severity="info" variant="outlined">
                                {activePaymentCopy.emptyAccountMessage}
                            </Alert>
                        ) : null}
                        {paymentFlowPurpose === "loan_repayment" && !portalRepaymentLoans.length ? (
                            <Alert severity="info" variant="outlined">
                                {activePaymentCopy.emptyAccountMessage}
                            </Alert>
                        ) : null}
                        {contributionFlowState ? (
                            <Stack spacing={1.5}>
                                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
                                    <Stack spacing={1.2}>
                                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                            <Chip
                                                label={submittingContribution ? "1. Contacting gateway" : "1. Request created"}
                                                color={contributionRequestStepState === "complete" ? "success" : contributionRequestStepState === "active" ? "primary" : "default"}
                                                variant={contributionRequestStepState === "idle" ? "outlined" : "filled"}
                                            />
                                            <Chip
                                                label="2. Member approves on phone"
                                                color={contributionApprovalStepState === "complete" ? "success" : contributionApprovalStepState === "active" ? "primary" : "default"}
                                                variant={contributionApprovalStepState === "idle" ? "outlined" : "filled"}
                                            />
                                            <Chip
                                                label={
                                                    activePaymentPurpose === "membership_fee"
                                                        ? "3. System posts fee"
                                                        : activePaymentPurpose === "loan_repayment"
                                                            ? "3. System posts repayment"
                                                            : "3. System posts deposit"
                                                }
                                                color={contributionPostingStepState === "complete" ? "success" : contributionPostingStepState === "active" ? "primary" : "default"}
                                                variant={contributionPostingStepState === "idle" ? "outlined" : "filled"}
                                            />
                                        </Stack>
                                        <LinearProgress
                                            variant={contributionFlowState === "pending" || contributionFlowState === "paid" ? "indeterminate" : "determinate"}
                                            value={contributionFlowProgress}
                                            sx={{ height: 9, borderRadius: 999 }}
                                        />
                                        {showBackgroundActivity ? (
                                            <Stack direction="row" spacing={1} alignItems="center" sx={{ color: "text.secondary" }}>
                                                <CircularProgress size={16} thickness={5} />
                                                <Typography variant="body2">
                                                    {backgroundActivityMessage}
                                                </Typography>
                                            </Stack>
                                        ) : null}
                                        {paymentApprovalTakingLongerThanExpected ? (
                                            <Alert severity="warning" variant="outlined">
                                                This approval is taking longer than expected. The provider can keep the request open for several more minutes, but you can safely close this dialog and check it later from Payments.
                                            </Alert>
                                        ) : null}
                                        {trackedContributionOrder ? (
                                            <Stack spacing={0.6}>
                                                <Typography variant="body2" color="text.secondary">
                                                    Amount: {formatCurrency(trackedContributionOrder.amount)} via {trackedContributionOrder.provider.toUpperCase()}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    Reference: {trackedContributionOrder.provider_ref || trackedContributionOrder.external_id}
                                                </Typography>
                                                {trackedContributionOrder.status === "pending" && trackedContributionOrder.expires_at ? (
                                                    <Typography variant="body2" color={phoneCancellationRequested ? "warning.main" : "text.secondary"}>
                                                        {phoneCancellationRequested ? "Fallback expiry if no callback arrives" : "Provider window closes"}: {formatDate(trackedContributionOrder.expires_at)}
                                                        {pendingOrderMinutesRemaining !== null ? ` · about ${pendingOrderMinutesRemaining} minute(s) remaining` : ""}
                                                    </Typography>
                                                ) : null}
                                                {trackedContributionOrder.purpose === "loan_repayment" ? (
                                                    <Typography variant="body2" color="text.secondary">
                                                        Loan: {trackedContributionOrder.loan_number || trackedContributionOrder.loan_id || "Unknown loan"}
                                                    </Typography>
                                                ) : null}
                                                {trackedContributionOrder.journal_id ? (
                                                    <Typography variant="body2" color="text.secondary">
                                                        Journal: {trackedContributionOrder.journal_id}
                                                    </Typography>
                                                ) : null}
                                                {trackedContributionOrder.error_message ? (
                                                    <Typography variant="body2" color="error.main">
                                                        {trackedContributionOrder.error_message}
                                                    </Typography>
                                                ) : null}
                                            </Stack>
                                        ) : null}
                                    </Stack>
                                </Paper>
                            </Stack>
                        ) : (
                            <Box component="form" id="member-contribution-form" onSubmit={submitContributionPayment} sx={{ display: "grid", gap: 2 }}>
                                <Paper
                                    variant="outlined"
                                    sx={{
                                        p: { xs: 1.5, md: 1.75 },
                                        borderRadius: 2,
                                        bgcolor: alpha(memberAccent, isDarkMode ? 0.08 : 0.04),
                                        borderColor: alpha(memberAccent, isDarkMode ? 0.3 : 0.16)
                                    }}
                                >
                                    <Grid container spacing={2} alignItems="start">
                                        <Grid size={{ xs: 12, md: 4 }}>
                                            <TextField
                                                select
                                                label="Payment Type"
                                                fullWidth
                                                size="small"
                                                value={paymentFlowPurpose}
                                                onChange={(event) => {
                                                    const nextPurpose = event.target.value as MemberPaymentPurpose;
                                                    setPaymentFlowPurpose(nextPurpose);
                                                    setActiveContributionOrderId(null);
                                                    if (nextPurpose === "membership_fee") {
                                                        contributionPaymentForm.setValue("amount", membershipFeeOutstanding, { shouldValidate: true });
                                                        contributionPaymentForm.setValue("description", "Membership fee payment", { shouldValidate: true });
                                                        contributionPaymentForm.setValue("loan_id", "", { shouldValidate: false });
                                                    } else if (nextPurpose === "loan_repayment") {
                                                        const nextLoan = selectedLoan || portalRepaymentLoans[0] || null;
                                                        const nextSchedules = loanSchedules.filter((schedule) => schedule.loan_id === nextLoan?.id && schedule.status !== "paid");
                                                        const nextInsights = buildRepaymentInsights(nextLoan, nextSchedules, 0);
                                                        contributionPaymentForm.setValue("account_id", "", { shouldValidate: false });
                                                        contributionPaymentForm.setValue("loan_id", nextLoan?.id || "", { shouldValidate: true });
                                                        contributionPaymentForm.setValue("amount", Number(nextInsights.recommendedAmount.toFixed(2)), { shouldValidate: true });
                                                        contributionPaymentForm.setValue("description", nextLoan ? `Loan repayment for ${nextLoan.loan_number}` : "", { shouldValidate: true });
                                                    }
                                                }}
                                            >
                                                <MenuItem value="share_contribution">Contribution</MenuItem>
                                                <MenuItem value="savings_deposit">Savings</MenuItem>
                                                {canShowMembershipFeePaymentOption ? (
                                                    <MenuItem value="membership_fee">Membership fee</MenuItem>
                                                ) : null}
                                                {canShowLoanRepaymentOption ? (
                                                    <MenuItem value="loan_repayment">Loan repayment</MenuItem>
                                                ) : null}
                                            </TextField>
                                        </Grid>
                                        <Grid size={{ xs: 12, md: 8 }}>
                                            {paymentFlowPurpose === "loan_repayment" ? (
                                                !repaymentLoanOptions.length ? (
                                                    <Alert severity="info" variant="outlined" sx={{ height: "100%", display: "flex", alignItems: "center" }}>
                                                        No active or in-arrears loan is available for self-service repayment right now.
                                                    </Alert>
                                                ) : (
                                                    <SearchableSelect
                                                        value={contributionPaymentForm.watch("loan_id") || ""}
                                                        options={repaymentLoanOptions}
                                                        onChange={(value) => {
                                                            const nextLoan = portalRepaymentLoans.find((loan) => loan.id === value) || null;
                                                            const nextSchedules = loanSchedules.filter((schedule) => schedule.loan_id === nextLoan?.id && schedule.status !== "paid");
                                                            const nextInsights = buildRepaymentInsights(nextLoan, nextSchedules, 0);
                                                            contributionPaymentForm.setValue("loan_id", value, { shouldValidate: true });
                                                            contributionPaymentForm.setValue("amount", Number(nextInsights.recommendedAmount.toFixed(2)), { shouldValidate: true });
                                                            contributionPaymentForm.setValue("description", nextLoan ? `Loan repayment for ${nextLoan.loan_number}` : "", { shouldValidate: true });
                                                        }}
                                                        label={activePaymentCopy.accountLabel}
                                                        size="small"
                                                        error={Boolean(contributionPaymentForm.formState.errors.loan_id)}
                                                        helperText={
                                                            contributionPaymentForm.formState.errors.loan_id?.message
                                                            || "Choose the loan that should receive this repayment."
                                                        }
                                                        placeholder="Search loan facility..."
                                                    />
                                                )
                                            ) : !paymentAccountOptions.length ? (
                                                <Alert severity="info" variant="outlined" sx={{ height: "100%", display: "flex", alignItems: "center" }}>
                                                    {paymentFlowPurpose === "membership_fee"
                                                        ? "The backend will resolve or create the savings account for this membership-fee payment automatically."
                                                        : paymentFlowPurpose === "savings_deposit"
                                                            ? "The backend will resolve or create the savings account for this deposit automatically."
                                                            : "The backend will resolve or create the share account for this contribution automatically."}
                                                </Alert>
                                            ) : (
                                                <SearchableSelect
                                                    value={contributionPaymentForm.watch("account_id") || ""}
                                                    options={paymentAccountOptions}
                                                    onChange={(value) => contributionPaymentForm.setValue("account_id", value, { shouldValidate: true })}
                                                    label={activePaymentCopy.accountLabel}
                                                    size="small"
                                                    error={Boolean(contributionPaymentForm.formState.errors.account_id)}
                                                    helperText={
                                                        contributionPaymentForm.formState.errors.account_id?.message
                                                        || (paymentFlowPurpose === "membership_fee"
                                                            ? "Choose the savings account used to anchor this membership fee payment."
                                                            : paymentFlowPurpose === "savings_deposit"
                                                                ? "Choose the exact savings account that should receive this deposit."
                                                                : "Choose the exact share account that should receive this contribution.")
                                                    }
                                                    placeholder={`Search ${activePaymentCopy.accountLabel.toLowerCase()}...`}
                                                />
                                            )}
                                        </Grid>
                                        {paymentFlowPurpose === "loan_repayment" && selectedRepaymentLoan ? (
                                            <Grid size={{ xs: 12 }}>
                                                <Stack spacing={1.4}>
                                                    <Stack
                                                        direction={{ xs: "column", sm: "row" }}
                                                        spacing={1}
                                                        useFlexGap
                                                        sx={{
                                                            mt: 0.5,
                                                            p: 1.5,
                                                            borderRadius: 2,
                                                            background: isDarkMode
                                                                ? `linear-gradient(135deg, ${alpha(DARK_MEMBER_ACCENT, 0.28)}, ${alpha(theme.palette.background.paper, 0.82)})`
                                                                : `linear-gradient(135deg, ${alpha(memberAccent, 0.12)}, ${alpha("#ffffff", 0.95)})`,
                                                            border: `1px solid ${alpha(memberAccent, isDarkMode ? 0.28 : 0.18)}`
                                                        }}
                                                    >
                                                        <Chip
                                                            size="small"
                                                            label={selectedRepaymentLoan.status === "in_arrears" ? "In arrears" : "Active loan"}
                                                            color={selectedRepaymentLoan.status === "in_arrears" ? "warning" : "default"}
                                                            sx={{
                                                                fontWeight: 800,
                                                                alignSelf: "flex-start",
                                                                bgcolor: alpha(memberAccent, isDarkMode ? 0.2 : 0.14),
                                                                color: memberAccentStrong
                                                            }}
                                                        />
                                                        <Stack spacing={0.15} sx={{ minWidth: 0, flex: 1 }}>
                                                            <Typography
                                                                variant="subtitle1"
                                                                sx={{
                                                                    fontWeight: 800,
                                                                    color: memberAccentStrong,
                                                                    lineHeight: 1.15
                                                                }}
                                                            >
                                                                {selectedRepaymentLoan.loan_number}
                                                            </Typography>
                                                            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                                                                Outstanding principal {formatCurrency(selectedRepaymentLoan.outstanding_principal)} · Accrued interest {formatCurrency(selectedRepaymentLoan.accrued_interest)}
                                                            </Typography>
                                                        </Stack>
                                                        <Box
                                                            sx={{
                                                                px: 1.4,
                                                                py: 0.9,
                                                                borderRadius: 1.5,
                                                                minWidth: { xs: "100%", sm: 210 },
                                                                bgcolor: alpha(memberAccentStrong, isDarkMode ? 0.18 : 0.1),
                                                                border: `1px solid ${alpha(memberAccentStrong, isDarkMode ? 0.3 : 0.16)}`
                                                            }}
                                                        >
                                                            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, letterSpacing: 0.4 }}>
                                                                OUTSTANDING
                                                            </Typography>
                                                            <Typography
                                                                variant="h6"
                                                                sx={{
                                                                    fontWeight: 900,
                                                                    color: memberAccentStrong,
                                                                    lineHeight: 1.1
                                                                }}
                                                            >
                                                                {formatCurrency(repaymentInsights.outstandingBalance)}
                                                            </Typography>
                                                        </Box>
                                                    </Stack>
                                                    <Grid container spacing={1.25}>
                                                        <Grid size={{ xs: 12, md: 4 }}>
                                                            <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 1.5, height: "100%" }}>
                                                                <Typography variant="caption" color="text.secondary">Due now</Typography>
                                                                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                                                    {formatCurrency(repaymentInsights.dueNowAmount)}
                                                                </Typography>
                                                                <Typography variant="body2" color="text.secondary">
                                                                    Next due {formatDate(repaymentInsights.nextDueSchedule?.due_date || null)}
                                                                </Typography>
                                                            </Paper>
                                                        </Grid>
                                                        <Grid size={{ xs: 12, md: 4 }}>
                                                            <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 1.5, height: "100%" }}>
                                                                <Typography variant="caption" color="text.secondary">Interest to clear first</Typography>
                                                                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                                                    {formatCurrency(repaymentInsights.payableInterest)}
                                                                </Typography>
                                                                <Typography variant="body2" color="text.secondary">
                                                                    Principal outstanding {formatCurrency(selectedRepaymentLoan.outstanding_principal)}
                                                                </Typography>
                                                            </Paper>
                                                        </Grid>
                                                        <Grid size={{ xs: 12, md: 4 }}>
                                                            <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 1.5, height: "100%" }}>
                                                                <Typography variant="caption" color="text.secondary">Recommended amount</Typography>
                                                                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                                                    {formatCurrency(repaymentInsights.recommendedAmount)}
                                                                </Typography>
                                                                <Stack direction="row" spacing={0.75} sx={{ mt: 0.8 }}>
                                                                    <Button
                                                                        size="small"
                                                                        variant="outlined"
                                                                        onClick={() => contributionPaymentForm.setValue("amount", Number(repaymentInsights.dueNowAmount.toFixed(2)), { shouldValidate: true })}
                                                                        disabled={repaymentInsights.dueNowAmount <= 0}
                                                                    >
                                                                        Use Due Now
                                                                    </Button>
                                                                    <Button
                                                                        size="small"
                                                                        variant="outlined"
                                                                        onClick={() => contributionPaymentForm.setValue("amount", Number(repaymentInsights.outstandingBalance.toFixed(2)), { shouldValidate: true })}
                                                                    >
                                                                        Clear Loan
                                                                    </Button>
                                                                </Stack>
                                                            </Paper>
                                                        </Grid>
                                                    </Grid>
                                                </Stack>
                                            </Grid>
                                        ) : selectedContributionAccount ? (
                                            <Grid size={{ xs: 12 }}>
                                                <Stack
                                                    direction={{ xs: "column", sm: "row" }}
                                                    spacing={1}
                                                    useFlexGap
                                                    sx={{
                                                        mt: 0.5,
                                                        p: 1.5,
                                                        borderRadius: 2,
                                                        background: isDarkMode
                                                            ? `linear-gradient(135deg, ${alpha(DARK_MEMBER_ACCENT, 0.28)}, ${alpha(theme.palette.background.paper, 0.82)})`
                                                            : `linear-gradient(135deg, ${alpha(memberAccent, 0.12)}, ${alpha("#ffffff", 0.95)})`,
                                                        border: `1px solid ${alpha(memberAccent, isDarkMode ? 0.28 : 0.18)}`
                                                    }}
                                                >
                                                    <Chip
                                                        size="small"
                                                        label={activePaymentCopy.title}
                                                        sx={{
                                                            fontWeight: 800,
                                                            alignSelf: "flex-start",
                                                            bgcolor: alpha(memberAccent, isDarkMode ? 0.2 : 0.14),
                                                            color: memberAccentStrong
                                                        }}
                                                    />
                                                    <Stack spacing={0.15} sx={{ minWidth: 0, flex: 1 }}>
                                                        <Typography
                                                            variant="subtitle1"
                                                            sx={{
                                                                fontWeight: 800,
                                                                color: memberAccentStrong,
                                                                lineHeight: 1.15
                                                            }}
                                                        >
                                                            {selectedContributionAccount.account_name}
                                                        </Typography>
                                                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                                                            {selectedContributionAccount.account_number}
                                                        </Typography>
                                                    </Stack>
                                                    <Box
                                                        sx={{
                                                            px: 1.4,
                                                            py: 0.9,
                                                            borderRadius: 1.5,
                                                            minWidth: { xs: "100%", sm: 210 },
                                                            bgcolor: alpha(memberAccentStrong, isDarkMode ? 0.18 : 0.1),
                                                            border: `1px solid ${alpha(memberAccentStrong, isDarkMode ? 0.3 : 0.16)}`
                                                        }}
                                                    >
                                                        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, letterSpacing: 0.4 }}>
                                                            BALANCE
                                                        </Typography>
                                                        <Typography
                                                            variant="h6"
                                                            sx={{
                                                                fontWeight: 900,
                                                                color: memberAccentStrong,
                                                                lineHeight: 1.1
                                                            }}
                                                        >
                                                            {formatCurrency(selectedContributionAccount.available_balance + selectedContributionAccount.locked_balance)}
                                                        </Typography>
                                                    </Box>
                                                </Stack>
                                            </Grid>
                                        ) : null}
                                    </Grid>
                                </Paper>
                                <Grid container spacing={2}>
                                    <Grid size={{ xs: 12, md: 4 }}>
                                        <TextField
                                            label={activePaymentCopy.amountLabel}
                                            type="number"
                                            fullWidth
                                            {...contributionPaymentForm.register("amount")}
                                            disabled={paymentFlowPurpose === "membership_fee"}
                                            error={Boolean(contributionPaymentForm.formState.errors.amount)}
                                            helperText={
                                                contributionPaymentForm.formState.errors.amount?.message
                                                || (paymentFlowPurpose === "loan_repayment"
                                                    ? repaymentInsights.excessOverOutstanding > 0
                                                        ? `Entered amount exceeds the outstanding balance by ${formatCurrency(repaymentInsights.excessOverOutstanding)}.`
                                                        : activePaymentCopy.helperText
                                                    : activePaymentCopy.helperText)
                                            }
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 4 }}>
                                        <TextField
                                            select
                                            label="Mobile Provider"
                                            fullWidth
                                            value={contributionPaymentForm.watch("provider")}
                                            onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                                contributionPaymentForm.setValue(
                                                    "provider",
                                                    event.target.value as ContributionPaymentValues["provider"],
                                                    { shouldValidate: true }
                                                )
                                            }
                                        >
                                            {contributionProviderOptions.map((option) => (
                                                <MenuItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 4 }}>
                                        <TextField
                                            label="Phone Number"
                                            fullWidth
                                            {...contributionPaymentForm.register("msisdn")}
                                            error={Boolean(contributionPaymentForm.formState.errors.msisdn)}
                                            helperText={contributionPaymentForm.formState.errors.msisdn?.message || "Number that receives the payment prompt."}
                                        />
                                    </Grid>
                                </Grid>
                                {paymentFlowPurpose === "loan_repayment" && selectedRepaymentLoan ? (
                                    <Paper
                                        variant="outlined"
                                        sx={{
                                            p: 1.25,
                                            borderRadius: 1.5,
                                            bgcolor: alpha(theme.palette.info.main, isDarkMode ? 0.1 : 0.04),
                                            borderColor: alpha(theme.palette.info.main, isDarkMode ? 0.24 : 0.14)
                                        }}
                                    >
                                        <Stack spacing={1}>
                                            <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} useFlexGap>
                                                <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 140 }}>
                                                    Repayment allocation
                                                </Typography>
                                                <Stack spacing={0.45}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Interest component: {formatCurrency(repaymentInsights.interestAllocation)}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Principal component: {formatCurrency(repaymentInsights.principalAllocation)}
                                                    </Typography>
                                                    {repaymentInsights.shortfallAmount > 0 ? (
                                                        <Typography variant="body2" color="warning.main">
                                                            Shortfall against current due amount: {formatCurrency(repaymentInsights.shortfallAmount)}
                                                        </Typography>
                                                    ) : null}
                                                    {repaymentInsights.extraAmount > 0 && repaymentInsights.excessOverOutstanding <= 0 ? (
                                                        <Typography variant="body2" color="success.main">
                                                            Extra over current due: {formatCurrency(repaymentInsights.extraAmount)} and it will reduce principal early.
                                                        </Typography>
                                                    ) : null}
                                                    {repaymentInsights.matchesDueNow && repaymentInsights.dueNowAmount > 0 ? (
                                                        <Typography variant="body2" color="success.main">
                                                            Entered amount matches the amount currently due.
                                                        </Typography>
                                                    ) : null}
                                                </Stack>
                                            </Stack>
                                        </Stack>
                                    </Paper>
                                ) : null}
                                <Paper
                                    variant="outlined"
                                    sx={{
                                        p: 1.25,
                                        borderRadius: 1.5,
                                        bgcolor: alpha(theme.palette.info.main, isDarkMode ? 0.12 : 0.05),
                                        borderColor: alpha(theme.palette.info.main, isDarkMode ? 0.28 : 0.14)
                                    }}
                                >
                                    <Stack direction={{ xs: "column", sm: "row" }} spacing={0.8} useFlexGap>
                                        <Typography variant="caption" sx={{ fontWeight: 800, color: "info.main", minWidth: 92 }}>
                                            Provider note
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {selectedContributionProvider.helper}
                                        </Typography>
                                    </Stack>
                                </Paper>
                                <TextField
                                    label="Narration (optional)"
                                    fullWidth
                                    multiline
                                    minRows={1}
                                    {...contributionPaymentForm.register("description")}
                                    error={Boolean(contributionPaymentForm.formState.errors.description)}
                                    helperText={contributionPaymentForm.formState.errors.description?.message || `Optional note shown on the posted ${activePaymentCopy.noun}.`}
                                />
                            </Box>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    {contributionFlowState ? (
                        <>
                            {trackedContributionOrder?.status === "pending" && !phoneCancellationRequested ? (
                                <Button onClick={handleMarkCancelledOnPhone} disabled={checkingPaymentStatus}>
                                    I Cancelled on Phone
                                </Button>
                            ) : null}
                            {trackedContributionOrder?.status === "pending" ? (
                                <Button
                                    variant={paymentApprovalTakingLongerThanExpected ? "contained" : "text"}
                                    onClick={() => void refreshTrackedPaymentOrder(true)}
                                    disabled={checkingPaymentStatus}
                                >
                                    {checkingPaymentStatus ? "Checking..." : "Check Status"}
                                </Button>
                            ) : null}
                            {trackedContributionOrder?.status === "pending" ? (
                                <Button
                                    variant={paymentApprovalTakingLongerThanExpected ? "outlined" : "text"}
                                    onClick={handleStopTrackingPayment}
                                    disabled={checkingPaymentStatus || submittingContribution}
                                >
                                    {paymentApprovalTakingLongerThanExpected ? "Close and Track Later" : "Stop Tracking"}
                                </Button>
                            ) : null}
                            {trackedContributionOrder?.status === "paid" && !trackedContributionOrder.posted_at ? (
                                <Button onClick={() => void handleReconcilePaymentOrder()} disabled={reconcilingPayment}>
                                    {reconcilingPayment ? "Reconciling..." : "Reconcile Payment"}
                                </Button>
                            ) : null}
                            {trackedContributionOrder && ["posted", "failed", "expired"].includes(trackedContributionOrder.status) ? (
                                <Button onClick={prepareAnotherContribution}>Start Another</Button>
                            ) : null}
                            <Button onClick={() => setShowContributionDialog(false)} disabled={submittingContribution}>
                                {trackedContributionOrder?.status === "posted" ? "Done" : "Close"}
                            </Button>
                        </>
                    ) : (
                        <>
                                <Button onClick={() => setShowContributionDialog(false)}>Cancel</Button>
                            <Button
                                variant="contained"
                                type="submit"
                                form="member-contribution-form"
                                disabled={
                                    submittingContribution
                                    || (paymentFlowPurpose === "loan_repayment" && (!selectedRepaymentLoan || repaymentInsights.excessOverOutstanding > 0))
                                }
                                sx={
                                    isDarkMode
                                        ? { bgcolor: memberAccent, color: "#1a1a1a", "&:hover": { bgcolor: memberAccentAlt } }
                                        : undefined
                                }
                            >
                                {submittingContribution
                                    ? "Starting..."
                                    : paymentFlowPurpose === "membership_fee"
                                        ? "Start Membership Fee Payment"
                                        : paymentFlowPurpose === "loan_repayment"
                                            ? "Start Loan Repayment"
                                        : paymentFlowPurpose === "savings_deposit"
                                            ? "Start Savings Deposit"
                                            : "Start Share Contribution"}
                            </Button>
                        </>
                    )}
                </DialogActions>
            </MotionModal>

            <MotionModal open={Boolean(selectedPaymentReceipt)} onClose={() => setSelectedPaymentReceipt(null)} maxWidth="sm" fullWidth>
                <DialogTitle>Payment Receipt</DialogTitle>
                <DialogContent dividers>
                    {selectedPaymentReceipt ? (
                        <Stack spacing={2}>
                            <Alert
                                severity={
                                    selectedPaymentReceipt.status === "posted"
                                        ? "success"
                                        : selectedPaymentReceipt.status === "failed"
                                            ? "error"
                                            : selectedPaymentReceipt.status === "expired"
                                                ? "warning"
                                                : "info"
                                }
                                variant="outlined"
                            >
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.4 }}>
                                    {formatPaymentPurpose(selectedPaymentReceipt.purpose)}
                                </Typography>
                                <Typography variant="body2">
                                    Status: {formatPaymentStatus(selectedPaymentReceipt.status)}
                                </Typography>
                            </Alert>

                            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                                <Stack spacing={1.15}>
                                    <Typography variant="h5" sx={{ fontWeight: 800 }}>
                                        {formatCurrency(selectedPaymentReceipt.amount)}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {selectedPaymentReceipt.provider.toUpperCase()} · {selectedPaymentReceipt.currency}
                                    </Typography>
                                    <Divider />
                                    <Typography variant="body2">
                                        <strong>{selectedPaymentReceipt.purpose === "loan_repayment" ? "Loan" : "Account"}:</strong>{" "}
                                        {selectedPaymentReceipt.purpose === "loan_repayment"
                                            ? selectedPaymentReceipt.loan_number || selectedPaymentReceipt.loan_id
                                            : selectedPaymentReceipt.account_name || selectedPaymentReceipt.account_number || selectedPaymentReceipt.account_id}
                                    </Typography>
                                    <Typography variant="body2"><strong>Reference:</strong> {selectedPaymentReceipt.provider_ref || selectedPaymentReceipt.external_id}</Typography>
                                    <Typography variant="body2"><strong>Initiated:</strong> {formatDate(selectedPaymentReceipt.created_at)}</Typography>
                                    {selectedPaymentReceipt.paid_at ? (
                                        <Typography variant="body2"><strong>Paid:</strong> {formatDate(selectedPaymentReceipt.paid_at)}</Typography>
                                    ) : null}
                                    {selectedPaymentReceipt.posted_at ? (
                                        <Typography variant="body2"><strong>Posted:</strong> {formatDate(selectedPaymentReceipt.posted_at)}</Typography>
                                    ) : null}
                                    {selectedPaymentReceipt.journal_id ? (
                                        <Typography variant="body2"><strong>Journal:</strong> {selectedPaymentReceipt.journal_id}</Typography>
                                    ) : null}
                                    {selectedPaymentReceipt.description ? (
                                        <Typography variant="body2"><strong>Description:</strong> {selectedPaymentReceipt.description}</Typography>
                                    ) : null}
                                    {selectedPaymentReceipt.error_message ? (
                                        <Typography variant="body2" color="error.main"><strong>Issue:</strong> {selectedPaymentReceipt.error_message}</Typography>
                                    ) : null}
                                </Stack>
                            </Paper>
                        </Stack>
                    ) : null}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => window.print()} startIcon={<PrintRoundedIcon />}>
                        Print
                    </Button>
                    <Button onClick={() => setSelectedPaymentReceipt(null)}>
                        Close
                    </Button>
                </DialogActions>
            </MotionModal>

            <MotionModal
                open={showApplyDialog}
                onClose={submittingApplication || deletingLoanApplicationId === editingLoanApplicationId ? undefined : closeLoanApplicationDialog}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: {
                        width: "100%",
                        maxWidth: { xs: "calc(100vw - 16px)", sm: "calc(100vw - 32px)", md: "960px" },
                        maxHeight: { xs: "calc(100vh - 16px)", md: "calc(100vh - 32px)" },
                        minHeight: { md: 620 },
                        display: "flex",
                        overflow: "hidden"
                    }
                }}
            >
                <DialogTitle>
                    {isEditingDraftLoanApplication
                        ? "Continue Draft Loan Application"
                        : isEditingRejectedLoanApplication
                            ? "Edit Rejected Loan Application"
                            : "Apply for Loan"}
                </DialogTitle>
                <DialogContent
                    dividers
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                        py: 1.5
                    }}
                >
                    <Stack spacing={1.25} sx={{ pt: 0.25, minHeight: 0 }}>
                        <Alert severity="info" variant="outlined" sx={{ py: 0.35 }}>
                            {isEditingDraftLoanApplication
                                ? "Continue updating your saved draft. You can save draft changes now and submit later once any submission lock is cleared."
                                : isEditingRejectedLoanApplication
                                    ? "Update the rejected application details, then resubmit it back into appraisal workflow."
                                    : "This submits a loan application into appraisal and approval workflow. No money movement happens until a teller or loan officer disburses an approved application."}
                        </Alert>
                        {memberRecord?.status !== "active" ? (
                            <Alert severity="warning" variant="outlined" sx={{ py: 0.35 }}>
                                Your member profile is not active. Only active members can submit a loan application.
                            </Alert>
                        ) : null}
                        {memberHasProblemLoan ? (
                            <Alert severity="warning" variant="outlined" sx={{ py: 0.35 }}>
                                You currently have in-arrears or written-off loans. Clear them first before applying again.
                            </Alert>
                        ) : null}
                        {selectedLoanConflict ? (
                            <Alert severity="warning" variant="outlined" sx={{ py: 0.35 }}>
                                Another loan application is already in progress. Complete or resolve it before submitting a new one.
                            </Alert>
                        ) : null}
                        {loanSubmissionLocks.length ? (
                            <Alert severity="warning" variant="outlined" sx={{ py: 0.35 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                                    Submission is currently locked
                                </Typography>
                                <Stack spacing={0.35}>
                                    {loanSubmissionLocks.map((reason) => (
                                        <Typography key={reason} variant="body2">
                                            • {reason}
                                        </Typography>
                                    ))}
                                </Stack>
                                {selectedLoanDraft && !isEditingDraftLoanApplication ? (
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        sx={{ mt: 1.25, alignSelf: "flex-start" }}
                                        onClick={() => openLoanApplicationEditor(selectedLoanDraft)}
                                    >
                                        Continue Existing Draft
                                    </Button>
                                ) : null}
                            </Alert>
                        ) : null}
                        {loanCapacityWarnings.length ? (
                            <Alert severity="warning" variant="outlined" sx={{ py: 0.35 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                                    Borrowing capacity advisory
                                </Typography>
                                <Stack spacing={0.35}>
                                    {loanCapacityWarnings.map((reason) => (
                                        <Typography key={reason} variant="body2">
                                            • {reason}
                                        </Typography>
                                    ))}
                                </Stack>
                            </Alert>
                        ) : null}
                        {loanLiquidityNotice ? (
                            <Alert severity="info" variant="outlined" sx={{ py: 0.35 }}>
                                {loanLiquidityNotice}
                            </Alert>
                        ) : null}
                        <Box
                            component="form"
                            id="member-loan-application-form"
                            onSubmit={submitLoanApplication}
                            sx={{ display: "grid", gap: 1.35, minHeight: 0 }}
                        >
                            <Paper
                                variant="outlined"
                                sx={{
                                    p: { xs: 0.95, sm: 1.1, md: 1.4 },
                                    borderRadius: 1.25,
                                    bgcolor: alpha(memberAccent, isDarkMode ? 0.08 : 0.03),
                                    borderColor: alpha(memberAccent, 0.2)
                                }}
                            >
                                <Stack spacing={0.9}>
                                    {isMobile ? (
                                        <Stack spacing={0.85}>
                                            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                                                <Chip
                                                    size="small"
                                                    label={`Step ${loanFormStep + 1} of ${loanApplicationSteps.length}`}
                                                    sx={{
                                                        borderRadius: 1.15,
                                                        fontWeight: 700,
                                                        bgcolor: alpha(memberAccent, 0.12),
                                                        color: memberAccent
                                                    }}
                                                />
                                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                                    {Math.round(loanStepProgressPercent)}%
                                                </Typography>
                                            </Stack>
                                            <Stack direction="row" spacing={0.75} sx={{ overflowX: "auto", pb: 0.25, "&::-webkit-scrollbar": { display: "none" }, scrollbarWidth: "none" }}>
                                                {loanApplicationSteps.map((step, index) => {
                                                    const isActive = index === loanFormStep;
                                                    const isCompleted = index < loanFormStep;

                                                    return (
                                                        <Chip
                                                            key={step.label}
                                                            label={`${index + 1}. ${step.label}`}
                                                            size="small"
                                                            variant={isActive ? "filled" : "outlined"}
                                                            sx={{
                                                                flexShrink: 0,
                                                                borderRadius: 1.1,
                                                                fontWeight: 700,
                                                                bgcolor: isActive ? memberAccent : isCompleted ? alpha(memberAccentStrong, 0.1) : "transparent",
                                                                color: isActive ? "#fff" : isCompleted ? memberAccentStrong : "text.secondary",
                                                                borderColor: isActive ? memberAccent : alpha(memberAccent, 0.2)
                                                            }}
                                                        />
                                                    );
                                                })}
                                            </Stack>
                                        </Stack>
                                    ) : (
                                        <Stepper
                                            activeStep={loanFormStep}
                                            alternativeLabel
                                            sx={{
                                                "& .MuiStepLabel-root": {
                                                    px: 0
                                                },
                                                "& .MuiStepConnector-line": {
                                                    borderColor: alpha(memberAccent, 0.2)
                                                },
                                                "& .MuiStepLabel-label": {
                                                    fontWeight: 700,
                                                    mt: 0.35,
                                                    fontSize: { xs: "0.82rem", sm: "0.9rem" }
                                                },
                                                "& .MuiStepLabel-label.Mui-active": {
                                                    color: "text.primary"
                                                },
                                                "& .MuiStepLabel-label.Mui-completed": {
                                                    color: "text.secondary"
                                                },
                                                "& .MuiStepIcon-root": {
                                                    color: alpha(memberAccent, 0.2),
                                                    fontSize: "1.55rem"
                                                },
                                                "& .MuiStepIcon-root.Mui-active": {
                                                    color: memberAccent
                                                },
                                                "& .MuiStepIcon-root.Mui-completed": {
                                                    color: memberAccentStrong
                                                }
                                            }}
                                        >
                                            {loanApplicationSteps.map((step) => (
                                                <Step key={step.label}>
                                                    <StepLabel>{step.label}</StepLabel>
                                                </Step>
                                            ))}
                                        </Stepper>
                                    )}
                                    <Box>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                            {loanApplicationSteps[loanFormStep].label}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
                                            {loanApplicationSteps[loanFormStep].description}
                                        </Typography>
                                    </Box>
                                    <Box
                                        sx={{
                                            height: 4,
                                            borderRadius: 999,
                                            bgcolor: alpha(memberAccent, 0.12),
                                            overflow: "hidden"
                                        }}
                                    >
                                        <Box
                                            component={motion.div}
                                            animate={{ width: `${loanStepProgressPercent}%` }}
                                            transition={prefersReducedMotion ? easeOutFast : springSoft}
                                            sx={{
                                                height: "100%",
                                                borderRadius: 999,
                                                bgcolor: memberAccent
                                            }}
                                        />
                                    </Box>
                                </Stack>
                            </Paper>

                            <AnimatePresence mode="wait" initial={false}>
                                <Box
                                    key={loanFormStep}
                                    component={motion.div}
                                    initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.992 }}
                                    animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.992 }}
                                    transition={prefersReducedMotion ? easeOutFast : springSoft}
                                    style={{ width: "100%" }}
                                >
                                    {isLoanProductStep ? (
                                        <Stack spacing={2} sx={{ width: "100%", minWidth: 0 }}>
                                    <Box>
                                        <Typography variant="body2" fontWeight={600} sx={{ mb: 0.75 }}>
                                            Loan Product
                                        </Typography>
                                        <SearchableSelect
                                            value={loanApplicationForm.watch("product_id")}
                                            options={loanProductOptions}
                                            onChange={(value) => loanApplicationForm.setValue("product_id", value, { shouldValidate: true })}
                                            placeholder="Search loan product..."
                                            dropdownDirection="up"
                                        />
                                        {loanApplicationForm.formState.errors.product_id ? (
                                            <Typography variant="caption" color="error.main">
                                                {loanApplicationForm.formState.errors.product_id.message}
                                            </Typography>
                                        ) : null}
                                    </Box>
                                    {selectedLoanProduct ? (
                                        <Card
                                            variant="outlined"
                                            sx={{
                                                width: "100%",
                                                minWidth: 0,
                                                maxWidth: "100%",
                                                boxSizing: "border-box",
                                                borderRadius: 1.1,
                                                borderColor: alpha(memberAccent, 0.24),
                                                bgcolor: alpha(memberAccent, isDarkMode ? 0.14 : 0.05)
                                            }}
                                        >
                                            <CardContent sx={{ display: "grid", gap: 1.5, minWidth: 0 }}>
                                                <Stack
                                                    direction={{ xs: "column", md: "row" }}
                                                    spacing={1.5}
                                                    justifyContent="space-between"
                                                    alignItems={{ xs: "flex-start", md: "center" }}
                                                    sx={{ minWidth: 0 }}
                                                >
                                                    <Box sx={{ minWidth: 0 }}>
                                                        <Typography variant="h6" sx={{ fontWeight: 800, overflowWrap: "anywhere" }}>
                                                            {selectedLoanProduct.name}
                                                        </Typography>
                                                        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                                                            {selectedLoanProduct.description || "Configured limits and eligibility rules apply automatically to this application."}
                                                        </Typography>
                                                    </Box>
                                                    <Chip
                                                        label={`${selectedLoanProduct.annual_interest_rate}% per year`}
                                                        color="primary"
                                                        variant={isDarkMode ? "filled" : "outlined"}
                                                        sx={{
                                                            maxWidth: "100%",
                                                            fontWeight: 700,
                                                            alignSelf: { xs: "flex-start", md: "auto" },
                                                            "& .MuiChip-label": {
                                                                display: "block",
                                                                whiteSpace: "normal"
                                                            }
                                                        }}
                                                    />
                                                </Stack>
                                                <Grid container spacing={1.5} sx={{ minWidth: 0 }}>
                                                    <Grid size={{ xs: 12, md: 6 }}>
                                                        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1, width: "100%", minWidth: 0, boxSizing: "border-box" }}>
                                                            <Typography variant="caption" color="text.secondary">
                                                                Product range
                                                            </Typography>
                                                            <Typography variant="body1" sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>
                                                                {formatCurrency(selectedLoanMinimumAmount)} to {selectedLoanProduct.max_amount ? formatCurrency(selectedLoanProduct.max_amount) : "No capped max"}
                                                            </Typography>
                                                        </Paper>
                                                    </Grid>
                                                    <Grid size={{ xs: 12, md: 6 }}>
                                                        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1, width: "100%", minWidth: 0, boxSizing: "border-box" }}>
                                                            <Typography variant="caption" color="text.secondary">
                                                                Allowed frequency
                                                            </Typography>
                                                            <Typography variant="body1" sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>
                                                                {selectedLoanPolicy.allowedRepaymentFrequencies.map((frequency) => getRepaymentFrequencyLabel(frequency)).join(", ")}
                                                            </Typography>
                                                        </Paper>
                                                    </Grid>
                                                </Grid>
                                            </CardContent>
                                        </Card>
                                    ) : null}
                                        </Stack>
                                    ) : null}

                                    {isLoanEligibilityStep ? (
                                        selectedLoanProduct ? (
                                            <Box
                                                component={motion.div}
                                                initial={prefersReducedMotion ? false : { opacity: 0.96, y: 6 }}
                                                animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                                                transition={prefersReducedMotion ? undefined : springSoft}
                                            >
                                                <LoanEligibilitySummary
                                                    summary={loanCapacity}
                                                    loading={loanCapacityLoading}
                                                    error={loanCapacityError}
                                                    title="Loan Eligibility"
                                                    compact
                                                />
                                            </Box>
                                        ) : (
                                            <Alert severity="info" variant="outlined">
                                                Select a loan product first to view your live eligibility summary.
                                            </Alert>
                                        )
                                    ) : null}

                                    {isLoanDetailsStep ? (
                                        <Stack spacing={2}>
                                    <TextField
                                        label="Loan Purpose *"
                                        placeholder="Explain how the loan will be used (e.g., farming inputs, business expansion, school fees)"
                                        fullWidth
                                        multiline
                                        minRows={2}
                                        maxRows={4}
                                        {...loanApplicationForm.register("purpose")}
                                        error={Boolean(loanApplicationForm.formState.errors.purpose)}
                                        helperText={loanApplicationForm.formState.errors.purpose?.message || "20 to 500 characters. Letters, numbers, commas, and periods only."}
                                    />
                                    <Grid container spacing={2}>
                                        <Grid size={{ xs: 12, md: 4 }}>
                                            <TextField
                                                label="Requested Amount (TZS) *"
                                                fullWidth
                                                value={requestedAmountInput}
                                                onChange={(event) => {
                                                    const digits = event.target.value.replace(/[^\d]/g, "");
                                                    setRequestedAmountInput(formatWholeNumber(digits));
                                                    loanApplicationForm.setValue("requested_amount", digits ? Number(digits) : 0, { shouldValidate: true, shouldDirty: true });
                                                }}
                                                error={Boolean(loanApplicationForm.formState.errors.requested_amount)}
                                                helperText={
                                                    loanApplicationForm.formState.errors.requested_amount?.message
                                                    || (selectedLoanProduct
                                                        ? `Maximum recommended amount: ${formatCurrency(selectedLoanBorrowLimit)} · Product minimum ${formatCurrency(selectedLoanMinimumAmount)}`
                                                        : "Use Tanzanian Shillings only.")
                                                }
                                                inputProps={{ inputMode: "numeric" }}
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 12, md: 4 }}>
                                            <TextField
                                                label="Requested Loan Term (Months) *"
                                                type="number"
                                                fullWidth
                                                {...loanApplicationForm.register("requested_term_count")}
                                                error={Boolean(loanApplicationForm.formState.errors.requested_term_count)}
                                                helperText={
                                                    loanApplicationForm.formState.errors.requested_term_count?.message
                                                    || (selectedLoanProduct
                                                        ? `Min ${selectedLoanMinimumTerm} month(s)${selectedLoanMaximumTerm ? ` · Max ${selectedLoanMaximumTerm} month(s)` : ""}`
                                                        : "Enter a whole number of months.")
                                                }
                                                inputProps={{ min: 1, step: 1 }}
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 12, md: 4 }}>
                                            <TextField
                                                label="Interest Rate (% per year)"
                                                fullWidth
                                                value={selectedLoanProduct?.annual_interest_rate ?? 0}
                                                helperText="Automatically pulled from the selected loan product."
                                                InputProps={{ readOnly: true }}
                                            />
                                        </Grid>
                                        {selectedLoanProduct && requestedBorrowUtilizationPercent !== null && requestedLoanAmount > 0 ? (
                                            <Grid size={{ xs: 12 }}>
                                                <Paper
                                                    variant="outlined"
                                                    sx={{
                                                        p: 1.6,
                                                        borderRadius: 1,
                                                        bgcolor: alpha(requestedBorrowUtilizationTone, isDarkMode ? 0.12 : 0.05),
                                                        borderColor: alpha(requestedBorrowUtilizationTone, 0.22)
                                                    }}
                                                >
                                                    <Stack spacing={1}>
                                                        <Stack
                                                            direction={{ xs: "column", sm: "row" }}
                                                            justifyContent="space-between"
                                                            spacing={0.75}
                                                        >
                                                            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                                                Borrow Utilization
                                                            </Typography>
                                                            <Typography variant="body2" sx={{ fontWeight: 700, color: requestedBorrowUtilizationTone }}>
                                                                {Math.round(requestedBorrowUtilizationPercent)}% of your borrowing capacity
                                                            </Typography>
                                                        </Stack>
                                                        <LinearProgress
                                                            variant="determinate"
                                                            value={Math.min(requestedBorrowUtilizationPercent, 100)}
                                                            sx={{
                                                                height: 10,
                                                                borderRadius: 999,
                                                                bgcolor: alpha(requestedBorrowUtilizationTone, 0.16),
                                                                "& .MuiLinearProgress-bar": {
                                                                    borderRadius: 999,
                                                                    bgcolor: requestedBorrowUtilizationTone
                                                                }
                                                            }}
                                                        />
                                                    </Stack>
                                                </Paper>
                                            </Grid>
                                        ) : null}
                                        {requestedAmountCapacityWarning ? (
                                            <Grid size={{ xs: 12 }}>
                                                <Alert severity="warning" variant="outlined">
                                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.4 }}>
                                                        Requested amount exceeds your recommended borrowing capacity.
                                                    </Typography>
                                                    <Typography variant="body2">
                                                        Recommended maximum: {formatCurrency(selectedLoanBorrowLimit)}
                                                    </Typography>
                                                </Alert>
                                            </Grid>
                                        ) : null}
                                        <Grid size={{ xs: 12, md: 6 }}>
                                            <TextField
                                                select
                                                label="Repayment Frequency *"
                                                fullWidth
                                                value={loanApplicationForm.watch("requested_repayment_frequency")}
                                                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                                    loanApplicationForm.setValue(
                                                        "requested_repayment_frequency",
                                                        event.target.value as LoanApplicationValues["requested_repayment_frequency"],
                                                        { shouldValidate: true }
                                                    )
                                                }
                                                error={Boolean(loanApplicationForm.formState.errors.requested_repayment_frequency)}
                                                helperText={loanApplicationForm.formState.errors.requested_repayment_frequency?.message}
                                            >
                                                {selectedLoanPolicy.allowedRepaymentFrequencies.map((frequency) => (
                                                    <MenuItem key={frequency} value={frequency}>
                                                        {getRepaymentFrequencyLabel(frequency)}
                                                    </MenuItem>
                                                ))}
                                            </TextField>
                                        </Grid>
                                        <Grid size={{ xs: 12, md: 6 }}>
                                            <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 1, height: "100%" }}>
                                                <Typography variant="caption" color="text.secondary">
                                                    Application Reference
                                                </Typography>
                                                <Typography variant="body1" sx={{ fontWeight: 700, mt: 0.35 }}>
                                                    {editingLoanApplicationId && loanApplicationForm.getValues("external_reference")
                                                        ? loanApplicationForm.getValues("external_reference")
                                                        : "Generated automatically on save"}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                    The system creates a unique reference for every loan application.
                                                </Typography>
                                            </Paper>
                                        </Grid>
                                    </Grid>
                                        </Stack>
                                    ) : null}

                                    {isLoanReviewStep ? (
                                        <Stack spacing={2}>
                                    <Paper
                                        variant="outlined"
                                        sx={{
                                            p: 2,
                                            borderRadius: 1.1,
                                            bgcolor: isDarkMode ? alpha(memberAccent, 0.08) : alpha(memberAccent, 0.04)
                                        }}
                                    >
                                        <Stack spacing={0.9}>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                                Estimated Installment
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Principal: {formatCurrency(requestedLoanAmount || 0)} · Interest: {selectedLoanProduct?.annual_interest_rate ?? 0}% per year · Term: {requestedLoanTerm || 0} months
                                            </Typography>
                                            <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                                {getRepaymentFrequencyLabel(requestedLoanFrequency)} payment: {formatCurrency(installmentPreview?.installment || 0)}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Total repayment: {formatCurrency(installmentPreview?.totalRepayment || 0)}
                                            </Typography>
                                        </Stack>
                                    </Paper>
                                    <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 1.1 }}>
                                        <Grid container spacing={1.5}>
                                            <Grid size={{ xs: 12, sm: 6 }}>
                                                <Typography variant="caption" color="text.secondary">
                                                    Loan product
                                                </Typography>
                                                <Typography variant="body1" sx={{ fontWeight: 700, mt: 0.35 }}>
                                                    {selectedLoanProduct?.name || "Not selected"}
                                                </Typography>
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 6 }}>
                                                <Typography variant="caption" color="text.secondary">
                                                    Requested amount
                                                </Typography>
                                                <Typography variant="body1" sx={{ fontWeight: 700, mt: 0.35 }}>
                                                    {formatCurrency(requestedLoanAmount || 0)}
                                                </Typography>
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 6 }}>
                                                <Typography variant="caption" color="text.secondary">
                                                    Requested term
                                                </Typography>
                                                <Typography variant="body1" sx={{ fontWeight: 700, mt: 0.35 }}>
                                                    {requestedLoanTerm || 0} month(s)
                                                </Typography>
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 6 }}>
                                                <Typography variant="caption" color="text.secondary">
                                                    Repayment frequency
                                                </Typography>
                                                <Typography variant="body1" sx={{ fontWeight: 700, mt: 0.35 }}>
                                                    {getRepaymentFrequencyLabel(requestedLoanFrequency)}
                                                </Typography>
                                            </Grid>
                                            <Grid size={{ xs: 12 }}>
                                                <Typography variant="caption" color="text.secondary">
                                                    Purpose
                                                </Typography>
                                                <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.45 }}>
                                                    {loanApplicationForm.watch("purpose") || "No purpose entered yet."}
                                                </Typography>
                                            </Grid>
                                        </Grid>
                                    </Paper>
                                    {!loanSubmissionLocks.length && visibleLoanFormErrors.length ? (
                                        <Alert severity="info" variant="outlined">
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                                                Complete these items before submitting
                                            </Typography>
                                            <Stack spacing={0.35}>
                                                {visibleLoanFormErrors.map((message) => (
                                                    <Typography key={message} variant="body2">
                                                        • {message}
                                                    </Typography>
                                                ))}
                                            </Stack>
                                        </Alert>
                                    ) : null}
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={loanApplicationForm.watch("confirmation_checked")}
                                                onChange={(event) =>
                                                    loanApplicationForm.setValue("confirmation_checked", event.target.checked, { shouldValidate: true, shouldDirty: true })
                                                }
                                            />
                                        }
                                        label="I confirm the information provided in this loan application is accurate."
                                    />
                                    {loanApplicationForm.formState.errors.confirmation_checked ? (
                                        <Typography variant="caption" color="error.main">
                                            {loanApplicationForm.formState.errors.confirmation_checked.message}
                                        </Typography>
                                    ) : null}
                                        </Stack>
                                    ) : null}
                                </Box>
                            </AnimatePresence>
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions
                    sx={{
                        flexDirection: { xs: "column-reverse", sm: "row" },
                        alignItems: { xs: "stretch", sm: "center" },
                        gap: { xs: 1, sm: 0.5 },
                        px: { xs: 2, sm: 3 },
                        pb: { xs: 2, sm: 1.5 }
                    }}
                >
                    {isEditingDraftLoanApplication ? (
                        <Button
                            color="error"
                            onClick={() => editingLoanApplication && setPendingDraftDeletion(editingLoanApplication)}
                            disabled={submittingApplication || deletingLoanApplicationId === editingLoanApplicationId}
                        >
                            {deletingLoanApplicationId === editingLoanApplicationId ? "Deleting Draft..." : "Delete Draft"}
                        </Button>
                    ) : null}
                    <Button
                        onClick={closeLoanApplicationDialog}
                        disabled={deletingLoanApplicationId === editingLoanApplicationId}
                    >
                        Cancel
                    </Button>
                    {loanFormStep > 0 ? (
                        <Button
                            onClick={handleRetreatLoanFormStep}
                            startIcon={<ChevronLeftRoundedIcon />}
                            disabled={deletingLoanApplicationId === editingLoanApplicationId}
                        >
                            Back
                        </Button>
                    ) : null}
                    {isLoanReviewStep ? (
                        <>
                            {isEditingDraftLoanApplication ? (
                                <Button
                                    variant="outlined"
                                    onClick={() => void saveLoanApplicationDraft()}
                                    disabled={submittingApplication || deletingLoanApplicationId === editingLoanApplicationId}
                                    fullWidth={isMobile}
                                >
                                    {submittingApplication ? "Saving..." : "Save Draft Changes"}
                                </Button>
                            ) : null}
                            <Button
                                variant="contained"
                                type="submit"
                                form="member-loan-application-form"
                                disabled={submittingApplication || deletingLoanApplicationId === editingLoanApplicationId || loanSubmissionLocks.length > 0}
                                fullWidth={isMobile}
                                sx={
                                    isDarkMode
                                        ? { bgcolor: memberAccent, color: "#1a1a1a", "&:hover": { bgcolor: memberAccentAlt } }
                                        : undefined
                                }
                            >
                                {submittingApplication
                                    ? "Submitting..."
                                    : isEditingRejectedLoanApplication
                                        ? "Save & Resubmit"
                                        : "Submit Application"}
                            </Button>
                        </>
                    ) : (
                        <Button
                            variant="contained"
                            onClick={() => void handleAdvanceLoanFormStep()}
                            disabled={submittingApplication || deletingLoanApplicationId === editingLoanApplicationId || (isLoanProductStep && !selectedLoanProduct)}
                            fullWidth={isMobile}
                            sx={
                                isDarkMode
                                    ? { bgcolor: memberAccent, color: "#1a1a1a", "&:hover": { bgcolor: memberAccentAlt } }
                                    : undefined
                            }
                        >
                            Continue
                        </Button>
                    )}
                </DialogActions>
            </MotionModal>

            <ConfirmModal
                open={Boolean(pendingDraftDeletion)}
                title="Delete Draft Loan Application"
                summary={
                    <Stack spacing={1.25}>
                        <Alert severity="warning" variant="outlined">
                            This will permanently remove the draft loan application. Submitted or approved applications cannot be deleted here.
                        </Alert>
                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                            <Typography variant="body2" color="text.secondary">Product</Typography>
                            <Typography variant="body2" fontWeight={600}>
                                {pendingDraftDeletion?.loan_products?.name || "Loan application"}
                            </Typography>
                        </Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                            <Typography variant="body2" color="text.secondary">Requested amount</Typography>
                            <Typography variant="body2" fontWeight={600}>
                                {formatCurrency(pendingDraftDeletion?.requested_amount || 0)}
                            </Typography>
                        </Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                            <Typography variant="body2" color="text.secondary">Last updated</Typography>
                            <Typography variant="body2" fontWeight={600}>
                                {pendingDraftDeletion?.updated_at ? formatDate(pendingDraftDeletion.updated_at) : "Unknown"}
                            </Typography>
                        </Box>
                    </Stack>
                }
                confirmLabel="Delete Draft"
                cancelLabel="Keep Draft"
                loading={Boolean(pendingDraftDeletion && deletingLoanApplicationId === pendingDraftDeletion.id)}
                onCancel={() => setPendingDraftDeletion(null)}
                onConfirm={() => void confirmDeleteLoanApplicationDraft()}
            />

            {!mobileMenuOpen ? (
                <Paper
                    sx={{
                        display: { xs: "flex", lg: "none" },
                        position: "fixed",
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: theme.zIndex.drawer + 2,
                        borderRadius: 0,
                        borderTop: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                        justifyContent: "space-around",
                        py: 0.75,
                        px: 1
                    }}
                >
                    {visiblePortalSections.slice(0, 4).map((section) => {
                        const Icon = section.icon;
                        const active = activeSection === section.id;

                        return (
                            <Button
                                key={section.id}
                                onClick={() => handleSectionSelect(section.id)}
                                sx={{
                                    minWidth: 0,
                                    flexDirection: "column",
                                    gap: 0.25,
                                    color: active ? memberAccentStrong : "text.secondary",
                                    fontSize: 10,
                                    fontWeight: 700,
                                    textTransform: "none"
                                }}
                            >
                                <Icon fontSize="small" />
                                {section.label}
                            </Button>
                        );
                    })}
                    <Button
                        onClick={() => setMobileMenuOpen(true)}
                        sx={{
                            minWidth: 0,
                            flexDirection: "column",
                            gap: 0.25,
                            color: "text.secondary",
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: "none"
                        }}
                    >
                        <MoreHorizRoundedIcon fontSize="small" />
                        More
                    </Button>
                </Paper>
            ) : null}
        </Box>
    );
}
