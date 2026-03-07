import { MotionCard, MotionModal } from "../ui/motion";
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
    Divider,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Chip,
    Drawer,
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
    Switch,
    TablePagination,
    TextField,
    Typography,
    useMediaQuery
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useEffect, useMemo, useState, type ChangeEvent, type MouseEvent } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { useAuth } from "../auth/AuthProvider";
import { ChartPanel } from "../components/ChartPanel";
import { DataTable, type Column } from "../components/DataTable";
import { MemberOverview, type MemberAlertItem } from "../components/member-overview";
import { SearchableSelect } from "../components/SearchableSelect";
import { useToast } from "../components/Toast";
import { AppLoader } from "../components/AppLoader";
import { api, getApiErrorMessage } from "../lib/api";
import {
    endpoints,
    type CreateLoanApplicationRequest,
    type LoanApplicationResponse,
    type LoanApplicationsResponse,
    type LoanProductsResponse,
    type LoansResponse,
    type LoanSchedulesResponse,
    type MemberAccountsResponse,
    type MembersResponse,
    type StatementsResponse
} from "../lib/endpoints";
import { brandColors, darkThemeColors } from "../theme/colors";
import { useUI } from "../ui/UIProvider";
import type { Loan, LoanApplication, LoanProduct, LoanSchedule, Member, MemberAccount, StatementRow } from "../types/api";
import { downloadMemberStatementPdf } from "../utils/memberStatementPdf";
import { formatCurrency, formatDate, formatRole } from "../utils/format";

const loanApplicationSchema = z.object({
    product_id: z.string().uuid("Select a loan product."),
    purpose: z.string().trim().min(3, "Purpose is required.").max(500),
    requested_amount: z.coerce.number().positive("Requested amount is required."),
    requested_term_count: z.coerce.number().int().positive("Requested term is required."),
    requested_repayment_frequency: z.enum(["daily", "weekly", "monthly"]).default("monthly"),
    requested_interest_rate: z.union([z.coerce.number().min(0).max(100), z.nan()]).optional().transform((value) => (Number.isNaN(value) ? undefined : value)),
    external_reference: z.string().max(80).optional().or(z.literal(""))
});

type LoanApplicationValues = z.infer<typeof loanApplicationSchema>;
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

function getAuditReference(row: StatementRow) {
    return row.reference || `AUD-${row.transaction_id.slice(0, 8).toUpperCase()}`;
}

function estimatePenaltyForSchedule(schedule: LoanSchedule) {
    if (schedule.status !== "overdue") {
        return 0;
    }

    const outstanding = Math.max(schedule.principal_due - schedule.principal_paid, 0) + Math.max(schedule.interest_due - schedule.interest_paid, 0);
    return outstanding * 0.02;
}

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
    }
] as const;

const contentCardSx = {
    borderRadius: 2,
    borderColor: "divider",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)"
} as const;

type PortalSectionId = (typeof portalSections)[number]["id"];

interface MetricCardProps {
    icon: typeof WalletRoundedIcon;
    label: string;
    value: string | number;
    helper: string;
    tone: "primary" | "success" | "warning" | "danger";
    delta?: string;
}

function getToneStyles(tone: MetricCardProps["tone"]) {
    if (tone === "success") {
        return {
            color: brandColors.success,
            bg: alpha(brandColors.success, 0.1)
        };
    }

    if (tone === "warning") {
        return {
            color: brandColors.warning,
            bg: alpha(brandColors.warning, 0.12)
        };
    }

    if (tone === "danger") {
        return {
            color: brandColors.danger,
            bg: alpha(brandColors.danger, 0.1)
        };
    }

    return {
        color: brandColors.primary[700],
        bg: alpha(brandColors.primary[500], 0.1)
    };
}

function MetricCard({ icon: Icon, label, value, helper, tone, delta }: MetricCardProps) {
    const toneStyles = getToneStyles(tone);

    return (
        <MotionCard variant="outlined" sx={contentCardSx}>
            <CardContent sx={{ p: 2.25 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
                    <Box
                        sx={{
                            width: 42,
                            height: 42,
                            borderRadius: 2,
                            display: "grid",
                            placeItems: "center",
                            bgcolor: toneStyles.bg,
                            color: toneStyles.color
                        }}
                    >
                        <Icon fontSize="small" />
                    </Box>
                    <Typography
                        variant="caption"
                        sx={{
                            fontWeight: 700,
                            color: toneStyles.color
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

export function MemberPortalPage() {
    const theme = useTheme();
    const navigate = useNavigate();
    const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
    const { profile, selectedTenantName, selectedBranchName, signOut, subscription, user } = useAuth();
    const { pushToast } = useToast();
    const { theme: themeMode, toggleTheme } = useUI();
    const [accounts, setAccounts] = useState<MemberAccount[]>([]);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [loanSchedules, setLoanSchedules] = useState<LoanSchedule[]>([]);
    const [loanProducts, setLoanProducts] = useState<LoanProduct[]>([]);
    const [loanApplications, setLoanApplications] = useState<LoanApplication[]>([]);
    const [statements, setStatements] = useState<StatementRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [warning, setWarning] = useState<string | null>(null);
    const [showApplyDialog, setShowApplyDialog] = useState(false);
    const [submittingApplication, setSubmittingApplication] = useState(false);
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
    const [accountsPage, setAccountsPage] = useState(0);
    const [accountsRowsPerPage, setAccountsRowsPerPage] = useState(10);
    const [loanSchedulePage, setLoanSchedulePage] = useState(0);
    const [loanScheduleRowsPerPage, setLoanScheduleRowsPerPage] = useState(10);
    const [loanDetailId, setLoanDetailId] = useState<string>("");
    const [prepaymentAmount, setPrepaymentAmount] = useState<number>(0);
    const loanApplicationForm = useForm<LoanApplicationValues>({
        resolver: zodResolver(loanApplicationSchema),
        defaultValues: {
            product_id: "",
            purpose: "",
            requested_amount: 0,
            requested_term_count: 12,
            requested_repayment_frequency: "monthly",
            external_reference: ""
        }
    });

    const getSupabaseErrorMessage = (value: unknown, fallback: string) => {
        if (value && typeof value === "object" && "message" in value && typeof value.message === "string") {
            return value.message;
        }

        return fallback;
    };

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
                const { data: membersResponse } = await api.get<MembersResponse>(endpoints.members.list());
                const memberRecord =
                    (membersResponse.data || []).find((member: Member) => member.user_id === (user?.id || "")) ||
                    membersResponse.data?.[0];

                if (!memberRecord?.id) {
                    setAccounts([]);
                    setLoans([]);
                    setLoanSchedules([]);
                    setLoanProducts([]);
                    setLoanApplications([]);
                    setStatements([]);
                    return;
                }

                const results = await Promise.allSettled([
                    api.get<MemberAccountsResponse>(endpoints.members.accounts(), {
                        params: {
                            tenant_id: profile.tenant_id
                        }
                    }),
                    api.get<LoansResponse>(endpoints.finance.loanPortfolio(), {
                        params: {
                            tenant_id: profile.tenant_id,
                            member_id: memberRecord.id
                        }
                    }),
                    api.get<LoanSchedulesResponse>(endpoints.finance.loanSchedules(), {
                        params: {
                            tenant_id: profile.tenant_id
                        }
                    }),
                    api.get<LoanProductsResponse>(endpoints.products.loans()),
                    api.get<LoanApplicationsResponse>(endpoints.loanApplications.list(), {
                        params: {
                            tenant_id: profile.tenant_id
                        }
                    }),
                    api.get<StatementsResponse>(endpoints.finance.statements(), {
                        params: { tenant_id: profile.tenant_id, member_id: memberRecord.id }
                    })
                ]);

                const [accountsResult, loansResult, schedulesResult, productsResult, applicationsResult, statementsResult] = results;
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

                if (statementsResult.status === "fulfilled") {
                    setStatements(statementsResult.value.data.data || []);
                } else {
                    setStatements([]);
                    issues.push(getApiErrorMessage(statementsResult.reason, "Transactions unavailable."));
                }

                if (issues.length) {
                    setWarning(issues[0]);
                }
            } catch (portalError) {
                setError(getApiErrorMessage(portalError));
            } finally {
                setLoading(false);
            }
        };

        void loadPortal();
    }, [profile, user?.id]);

    useEffect(() => {
        if (!isDesktop) {
            setSidebarOpen(true);
        } else {
            setMobileMenuOpen(false);
        }
    }, [isDesktop]);

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
    const transactionCount = statements.length;
    const balanceTrend = groupBalances(statements);
    const monthlySavingsTrend = useMemo(() => groupSavingsByMonth(statements), [statements]);
    const currentView = portalSections.find((section) => section.id === activeSection) || portalSections[0];
    const latestBalance = statements[0]?.running_balance ?? 0;
    const totalVisibleCapital = totalSavings + totalShareCapital;
    const netPosition = totalVisibleCapital - totalOutstandingLoans;
    const hasOverdueLoan = useMemo(() => loans.some((loan) => loan.status === "in_arrears"), [loans]);
    const drawerWidth = sidebarOpen ? 272 : 88;
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
                details: "Your account currently has no active loan obligations."
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
        const from = new Date(contributionsRange.from);
        const to = new Date(contributionsRange.to);
        const months = Math.max((to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1, 1);
        return months * contributionBaselineMonthly;
    }, [contributionBaselineMonthly, contributionsRange]);
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
    const contributionEntriesCount = filteredContributions.filter((row) => row.transaction_type === "share_contribution").length;
    const dividendEntriesCount = filteredContributions.filter((row) => row.transaction_type === "dividend_allocation").length;
    const paginatedContributions = useMemo(
        () =>
            filteredContributions.slice(
                contributionsPage * contributionsRowsPerPage,
                contributionsPage * contributionsRowsPerPage + contributionsRowsPerPage
            ),
        [contributionsPage, contributionsRowsPerPage, filteredContributions]
    );

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
        setTransactionsPage(0);
    }, [transactionSearch, transactionTypeFilter, transactionsRange.from, transactionsRange.to]);

    useEffect(() => {
        setContributionsPage(0);
    }, [contributionsRange.from, contributionsRange.to]);

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
                    color={disputedTransactionIds.includes(row.transaction_id) ? "warning" : "primary"}
                    onClick={() => toggleDisputeFlag(row.transaction_id)}
                    startIcon={<FlagRoundedIcon fontSize="small" />}
                >
                    {disputedTransactionIds.includes(row.transaction_id) ? "Flagged" : "Flag"}
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
            render: (row) => row.status.replace(/_/g, " ")
        },
        {
            key: "updated",
            header: "Last Update",
            render: (row) => formatDate(row.updated_at)
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
                color: brandColors.info,
                bg: alpha(brandColors.info, 0.12),
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
                color: brandColors.primary[700],
                bg: alpha(brandColors.primary[500], 0.12),
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
        secondary: `${product.annual_interest_rate}% · ${formatCurrency(product.min_amount)} min`
    }));

    const canApplyForLoan = Boolean(subscription?.features?.loans_enabled ?? true);

    const submitLoanApplication = loanApplicationForm.handleSubmit(async (values) => {
        if (!profile) {
            return;
        }

        setSubmittingApplication(true);
        try {
            const payload: CreateLoanApplicationRequest = {
                tenant_id: profile.tenant_id,
                branch_id: profile.branch_id || undefined,
                product_id: values.product_id,
                purpose: values.purpose,
                requested_amount: values.requested_amount,
                requested_term_count: values.requested_term_count,
                requested_repayment_frequency: values.requested_repayment_frequency,
                requested_interest_rate: values.requested_interest_rate ?? null,
                external_reference: values.external_reference || null
            };

            const { data } = await api.post<LoanApplicationResponse>(endpoints.loanApplications.list(), payload);
            await api.post<LoanApplicationResponse>(endpoints.loanApplications.submit(data.data.id), {});

            pushToast({
                type: "success",
                title: "Loan application submitted",
                message: "Your application is now waiting for appraisal."
            });
            loanApplicationForm.reset();
            setShowApplyDialog(false);
            await (async () => {
                const { data: applicationsResponse } = await api.get<LoanApplicationsResponse>(endpoints.loanApplications.list(), {
                    params: { tenant_id: profile.tenant_id }
                });
                setLoanApplications(applicationsResponse.data || []);
            })();
        } catch (loanApplicationError) {
            pushToast({
                type: "error",
                title: "Unable to submit application",
                message: getApiErrorMessage(loanApplicationError)
            });
        } finally {
            setSubmittingApplication(false);
        }
    });

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

    const renderStatGrid = () => (
        <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                <MetricCard
                    icon={WalletRoundedIcon}
                    label="Savings Accounts"
                    value={accounts.length.toString().padStart(2, "0")}
                    helper={`${transactionCount} posted entries visible`}
                    tone="primary"
                    delta={hasNoVisibleFinancialData ? "New" : "Active"}
                />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                <MetricCard
                    icon={TrendingUpRoundedIcon}
                    label="Total Bal"
                    value={formatCurrency(totalVisibleCapital)}
                    helper={`Latest visible balance ${formatCurrency(latestBalance)}`}
                    tone="success"
                    delta={totalVisibleCapital > 0 ? "Growing" : "Pending"}
                />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                <MetricCard
                    icon={SavingsRoundedIcon}
                    label="Share Cap"
                    value={formatCurrency(totalShareCapital)}
                    helper={`${contributionHistory.length} share/dividend entries`}
                    tone="warning"
                    delta={totalDividends > 0 ? "Credited" : "Building"}
                />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                <MetricCard
                    icon={CreditScoreRoundedIcon}
                    label="Loans"
                    value={formatCurrency(totalOutstandingLoans)}
                    helper={activeLoanCount ? `${activeLoanCount} active facility` : "No active loan exposure"}
                    tone="danger"
                    delta={activeLoanCount ? "Monitor" : "Clear"}
                />
            </Grid>
        </Grid>
    );

    const renderHero = () => (
        <MotionCard
            sx={{
                borderRadius: 2,
                color: "#fff",
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.06)",
                background: theme.palette.mode === "dark"
                    ? `linear-gradient(135deg, ${darkThemeColors.elevated}, ${brandColors.primary[900]})`
                    : "linear-gradient(135deg, #0F172A 0%, #0A0573 58%, #1A0FA3 100%)",
                boxShadow: "0 18px 40px rgba(10, 5, 115, 0.24)"
            }}
        >
            <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                <Stack direction={{ xs: "column", xl: "row" }} spacing={3} justifyContent="space-between">
                    <Stack spacing={1.25} sx={{ maxWidth: 640 }}>
                        <Typography variant="overline" sx={{ color: alpha("#FFFFFF", 0.72), letterSpacing: "0.22em" }}>
                            Member Dashboard
                        </Typography>
                        <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05 }}>
                            Welcome back, {profile?.full_name?.split(" ")[0] || "Member"}.
                        </Typography>
                        <Typography variant="body1" sx={{ color: alpha("#FFFFFF", 0.78), maxWidth: 560 }}>
                            Track your savings, share capital, loan obligations, and contribution history from one secure workspace tied to {selectedTenantName || "your SACCOS"}.
                        </Typography>
                        <Stack direction="row" spacing={1.25} useFlexGap flexWrap="wrap" sx={{ pt: 1 }}>
                            <Chip
                                label={selectedBranchName || "Assigned branch"}
                                sx={{
                                    bgcolor: alpha("#FFFFFF", 0.12),
                                    color: "#fff",
                                    borderRadius: 1.5,
                                    backdropFilter: "blur(10px)"
                                }}
                            />
                            <Chip
                                label={hasNoVisibleFinancialData ? "Awaiting first posted activity" : "Financial activity visible"}
                                sx={{
                                    bgcolor: hasNoVisibleFinancialData ? alpha("#FFFFFF", 0.08) : alpha(brandColors.success, 0.18),
                                    color: "#fff",
                                    borderRadius: 1.5
                                }}
                            />
                        </Stack>
                    </Stack>
                    <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1.5}
                        alignItems={{ xs: "stretch", sm: "center" }}
                        justifyContent={{ sm: "flex-start", xl: "flex-end" }}
                        useFlexGap
                    >
                        <Button
                            variant="contained"
                            onClick={() => handleSectionSelect("member-accounts")}
                            endIcon={<EastRoundedIcon />}
                            sx={{
                                borderRadius: 1.5,
                                px: 3,
                                py: 1.25,
                                bgcolor: brandColors.accent[500],
                                color: "#fff",
                                boxShadow: "none",
                                fontWeight: 700,
                                minHeight: 46,
                                "&:hover": { bgcolor: brandColors.accent[700], boxShadow: "none" }
                            }}
                        >
                            View Accounts
                        </Button>
                        <Button
                            variant="outlined"
                            onClick={() => handleSectionSelect("member-loans")}
                            endIcon={<NorthEastRoundedIcon />}
                            sx={{
                                borderRadius: 1.5,
                                px: 3,
                                py: 1.25,
                                color: "#fff",
                                borderColor: alpha("#FFFFFF", 0.2),
                                fontWeight: 700,
                                minHeight: 46,
                                "&:hover": { borderColor: alpha("#FFFFFF", 0.38), bgcolor: alpha("#FFFFFF", 0.05) }
                            }}
                        >
                            Review Loans
                        </Button>
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
                    setShowApplyDialog(true);
                }
            }}
            onMakeContribution={() => handleSectionSelect("member-contributions")}
            onDownloadStatement={handleDownloadStatement}
            onPayInstallment={() => handleSectionSelect("member-loans")}
            onViewFullStatement={() => handleSectionSelect("member-transactions")}
        />
    );

    const renderAccountsView = () => (
        <Stack spacing={3}>
            <MotionCard variant="outlined" sx={contentCardSx}>
                <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
                        <Box>
                            <Typography variant="overline" color="text.secondary">
                                Accounts
                            </Typography>
                            <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5 }}>
                                Member Account Position
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                Review all linked savings and share accounts, including current balances and active product status.
                            </Typography>
                        </Box>
                        <Stack direction="row" spacing={1.25} useFlexGap flexWrap="wrap">
                            <Chip label={`Savings ${formatCurrency(totalSavings)}`} sx={{ borderRadius: 1.5 }} />
                            <Chip label={`Shares ${formatCurrency(totalShareCapital)}`} sx={{ borderRadius: 1.5 }} />
                            <Chip label={`Interest earned ${formatCurrency(interestEarned)}`} sx={{ borderRadius: 1.5 }} />
                        </Stack>
                    </Stack>
                </CardContent>
            </MotionCard>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                    <MetricCard
                        icon={SavingsRoundedIcon}
                        label="Savings Balance"
                        value={formatCurrency(totalSavings)}
                        helper="Visible savings accounts combined."
                        tone="primary"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                    <MetricCard
                        icon={AccountBalanceWalletRoundedIcon}
                        label="Share Capital"
                        value={formatCurrency(totalShareCapital)}
                        helper="Visible paid-in shares and capital contributions."
                        tone="warning"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                    <MetricCard
                        icon={WalletRoundedIcon}
                        label="Visible Accounts"
                        value={filteredAccounts.length}
                        helper="Savings and share products in selected range."
                        tone="success"
                    />
                </Grid>
            </Grid>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                    <MotionCard variant="outlined" sx={contentCardSx}>
                        <CardContent>
                            <Typography variant="h6" sx={{ mb: 1.5 }}>
                                Product Rules Visibility
                            </Typography>
                            <Stack spacing={1.1}>
                                <Typography variant="body2" color="text.secondary">Savings minimum balance: TSh 50,000 (tenant policy)</Typography>
                                <Typography variant="body2" color="text.secondary">Withdrawal limit: branch policy with teller review threshold</Typography>
                                <Typography variant="body2" color="text.secondary">Dormant accounts: no qualifying movement in policy period</Typography>
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <MotionCard variant="outlined" sx={contentCardSx}>
                        <CardContent>
                            <Typography variant="h6" sx={{ mb: 1.5 }}>
                                Account Health
                            </Typography>
                            <Stack spacing={1} direction="row" useFlexGap flexWrap="wrap">
                                <Chip label={`${Math.max(filteredAccounts.length - accountDormancyCount, 0)} active`} color="success" variant="outlined" />
                                <Chip label={`${accountDormancyCount} dormant`} color={accountDormancyCount ? "warning" : "default"} variant="outlined" />
                                <Chip label={`${filteredInterestHistory.length} interest postings`} color="primary" variant="outlined" />
                                <Chip label={`${filteredDividendMapping.length} dividend mappings`} color="secondary" variant="outlined" />
                            </Stack>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ mt: 2 }}>
                                <Button variant="outlined" startIcon={<DownloadRoundedIcon />} onClick={handleDownloadStatement}>
                                    Export Savings Statement
                                </Button>
                                <Button variant="outlined" startIcon={<PrintRoundedIcon />} onClick={() => window.print()}>
                                    Printable View
                                </Button>
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
                            borderColor: brandColors.primary[500],
                            backgroundColor: alpha(brandColors.primary[500], 0.14),
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
                        ? `linear-gradient(135deg, ${alpha(brandColors.primary[900], 0.72)}, ${alpha(brandColors.accent[700], 0.2)})`
                        : `linear-gradient(135deg, ${alpha(brandColors.primary[900], 0.96)}, ${alpha(brandColors.accent[500], 0.86)})`,
                    color: "#fff",
                    borderColor: "transparent",
                    boxShadow: "0 18px 38px rgba(10, 5, 115, 0.18)"
                }}
            >
                <CardContent sx={{ p: { xs: 2.5, md: 3.25 } }}>
                    <Grid container spacing={2.5} alignItems="stretch">
                        <Grid size={{ xs: 12, lg: 8 }}>
                            <Stack spacing={1.5}>
                                <Typography variant="overline" sx={{ color: alpha("#FFFFFF", 0.76), letterSpacing: 1.4 }}>
                                    Lending workspace
                                </Typography>
                                <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.08, maxWidth: 680 }}>
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
                                            : "Loan applications are disabled on the current subscription plan."}
                                    </Typography>
                                </Stack>
                                {canApplyForLoan ? (
                                    <Button
                                        variant="contained"
                                        onClick={() => setShowApplyDialog(true)}
                                        sx={{
                                            alignSelf: "flex-start",
                                            bgcolor: "#fff",
                                            color: brandColors.primary[900],
                                            fontWeight: 700,
                                            "&:hover": {
                                                bgcolor: alpha("#FFFFFF", 0.92)
                                            }
                                        }}
                                    >
                                        Apply for Loan
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
                    Loan applications are disabled on your current subscription plan.
                </Alert>
            )}

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
                                <Chip label={`Progress ${filteredLoanProgressPercent.toFixed(0)}%`} color="primary" variant="outlined" />
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
                                        bgcolor: alpha(brandColors.primary[500], 0.12),
                                        "& .MuiLinearProgress-bar": {
                                            borderRadius: 999,
                                            bgcolor: brandColors.primary[700]
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
                            <Button
                                variant="outlined"
                                startIcon={<DownloadRoundedIcon />}
                                onClick={() => handleDownloadFilteredStatement(loanRepaymentHistory, "Loan statement")}
                            >
                                Download Loan Statement PDF
                            </Button>
                            <Button variant="outlined" startIcon={<PrintRoundedIcon />} onClick={() => window.print()}>
                                Printable View
                            </Button>
                        </Stack>
                    </Stack>
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
                                    backgroundColor: [brandColors.danger, brandColors.primary[700]],
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
                <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                    <Stack spacing={2}>
                        <Box>
                            <Typography variant="overline" color="text.secondary">
                                Transactions
                            </Typography>
                            <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5 }}>
                                Bank-Grade Statement View
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                Filter by date and type, verify running balances, and review transaction references for audit traceability.
                            </Typography>
                        </Box>
                        <Stack direction={{ xs: "column", md: "row" }} spacing={1.25}>
                            <TextField
                                select
                                size="small"
                                label="Type"
                                value={transactionTypeFilter}
                                onChange={(event) => setTransactionTypeFilter(event.target.value)}
                                sx={{ minWidth: 220 }}
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
                                sx={{ minWidth: 240 }}
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

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MetricCard
                        icon={TimelineRoundedIcon}
                        label="Filtered Transactions"
                        value={filteredTransactions.length}
                        helper="Rows currently visible after filters."
                        tone="primary"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MetricCard
                        icon={WalletRoundedIcon}
                        label="Latest Balance"
                        value={formatCurrency(latestFilteredTransaction?.running_balance || 0)}
                        helper="Most recent running balance in filtered statements."
                        tone="success"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MetricCard
                        icon={FlagRoundedIcon}
                        label="Disputed Flags"
                        value={disputedTransactionIds.length}
                        helper="Marked for branch follow-up without altering ledger."
                        tone={disputedTransactionIds.length ? "warning" : "primary"}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MotionCard variant="outlined" sx={{ ...contentCardSx, height: "100%" }}>
                        <CardContent>
                            <Typography variant="subtitle2">Running Balance Validation</Typography>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                                <Chip
                                    label={runningBalanceMismatches ? "Check required" : "Validated"}
                                    color={runningBalanceMismatches ? "warning" : "success"}
                                    variant={runningBalanceMismatches ? "filled" : "outlined"}
                                    size="small"
                                />
                                <Typography variant="body2" color="text.secondary">
                                    {runningBalanceMismatches
                                        ? `${runningBalanceMismatches} mismatch(es) detected`
                                        : "No mismatches detected in current filter."}
                                </Typography>
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
                            borderColor: brandColors.accent[500],
                            backgroundColor: alpha(brandColors.accent[500], 0.14),
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

    const renderContributionsView = () => (
        <Stack spacing={3}>
            <MotionCard variant="outlined" sx={contentCardSx}>
                <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
                        <Box>
                            <Typography variant="overline" color="text.secondary">
                                Contributions
                            </Typography>
                            <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5 }}>
                                Contribution Compliance & Dividend Transparency
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                See expected versus posted contributions, dividend allocations by year, and auditable references for each entry.
                            </Typography>
                        </Box>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                            <Button
                                variant="outlined"
                                startIcon={<DownloadRoundedIcon />}
                                onClick={() => handleDownloadFilteredStatement(filteredContributions, "Contribution statement")}
                            >
                                Download Contribution PDF
                            </Button>
                            <Button variant="outlined" startIcon={<PrintRoundedIcon />} onClick={() => window.print()}>
                                Printable View
                            </Button>
                        </Stack>
                    </Stack>
                </CardContent>
            </MotionCard>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MetricCard
                        icon={SavingsRoundedIcon}
                        label="Share Capital"
                        value={formatCurrency(totalShareCapital)}
                        helper="Current visible share capital balance."
                        tone="warning"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MetricCard
                        icon={TrendingUpRoundedIcon}
                        label="Period Contributions"
                        value={formatCurrency(contributionActual)}
                        helper={`Expected ${formatCurrency(contributionExpected)} for selected period.`}
                        tone={contributionComplianceRatio >= 100 ? "success" : "warning"}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MetricCard
                        icon={AccountBalanceWalletRoundedIcon}
                        label="Dividend Credits"
                        value={formatCurrency(filteredContributions.filter((row) => row.transaction_type === "dividend_allocation").reduce((sum, row) => sum + row.amount, 0))}
                        helper={`Effective rate ${effectiveDividendRate.toFixed(2)}% on base capital.`}
                        tone="success"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MotionCard variant="outlined" sx={{ ...contentCardSx, height: "100%" }}>
                        <CardContent>
                            <Typography variant="subtitle2">Compliance Badge</Typography>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.25 }}>
                                <Chip
                                    label={contributionComplianceStatus}
                                    color={contributionComplianceRatio >= 100 ? "success" : "warning"}
                                    variant={contributionComplianceRatio >= 100 ? "filled" : "outlined"}
                                    size="small"
                                />
                                <Typography variant="body2" color="text.secondary">
                                    {contributionComplianceRatio.toFixed(1)}% achieved
                                </Typography>
                            </Stack>
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.9 }}>
                                Schedule: {contributionScheduleStatus} {nextContributionDue ? `• next due ${formatDate(nextContributionDue)}` : ""}
                            </Typography>
                        </CardContent>
                    </MotionCard>
                </Grid>
            </Grid>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                    <MotionCard variant="outlined" sx={contentCardSx}>
                        <CardContent>
                            <Typography variant="h6" sx={{ mb: 1.5 }}>
                                Running Total Summary (Period)
                            </Typography>
                            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                <Chip label={`${contributionEntriesCount} contributions`} variant="outlined" />
                                <Chip label={`${dividendEntriesCount} dividend entries`} variant="outlined" />
                                <Chip label={`Total posted ${formatCurrency(contributionRunningTotal)}`} color="primary" variant="outlined" />
                            </Stack>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
                                Expected contribution base: {formatCurrency(contributionExpected)} (baseline {formatCurrency(contributionBaselineMonthly)} per month).
                            </Typography>
                        </CardContent>
                    </MotionCard>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <MotionCard variant="outlined" sx={contentCardSx}>
                        <CardContent>
                            <Typography variant="h6" sx={{ mb: 1.5 }}>
                                Dividend Calculation Transparency
                            </Typography>
                            <Stack spacing={0.75}>
                                <Typography variant="body2" color="text.secondary">
                                    Base capital used: {formatCurrency(totalShareCapital)}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Dividend credits posted: {formatCurrency(totalDividends)}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Effective rate: {effectiveDividendRate.toFixed(2)}%
                                </Typography>
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
                        <CardContent>
                            <Typography variant="h6" sx={{ mb: 2 }}>
                                Contribution Schedule
                            </Typography>
                            <Stack spacing={1}>
                                <Typography variant="body2" color="text.secondary">
                                    Status: {contributionScheduleStatus}
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
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        Share Contributions & Dividends
                    </Typography>
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
            default:
                return renderOverviewView();
        }
    };

    const renderSidebarContent = (collapsed: boolean, mobile = false) => (
        <Box
            sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                bgcolor: theme.palette.mode === "dark" ? darkThemeColors.paper : "#fff",
                borderRight: mobile ? "none" : `1px solid ${alpha(theme.palette.divider, 0.8)}`
            }}
        >
            <Box
                sx={{
                    px: collapsed ? 1.5 : 2.5,
                    py: 2,
                    minHeight: 76,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: collapsed ? "center" : "space-between",
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.8)}`
                }}
            >
                {collapsed ? (
                    <Avatar
                        sx={{
                            width: 40,
                            height: 40,
                            bgcolor: brandColors.primary[900],
                            borderRadius: 2,
                            fontWeight: 800
                        }}
                    >
                        {(selectedTenantName || "S").slice(0, 1).toUpperCase()}
                    </Avatar>
                ) : (
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box
                            sx={{
                                width: 40,
                                height: 40,
                                borderRadius: 2,
                                display: "grid",
                                placeItems: "center",
                                bgcolor: brandColors.primary[900],
                                color: "#fff",
                                fontWeight: 800
                            }}
                        >
                            M
                        </Box>
                        <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                                {selectedTenantName || "Member Portal"}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Personal finance workspace
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

            <Box sx={{ px: collapsed ? 1 : 2, py: 2 }}>
                {!collapsed ? (
                    <Typography variant="overline" color="text.secondary" sx={{ px: 1.5, display: "block", mb: 0.75 }}>
                        Workspace
                    </Typography>
                ) : null}
                <List disablePadding>
                    {portalSections.map((section) => {
                        const Icon = section.icon;
                        const active = activeSection === section.id;

                        return (
                            <ListItemButton
                                key={section.id}
                                selected={active}
                                onClick={() => handleSectionSelect(section.id)}
                                sx={{
                                    mb: 0.5,
                                    minHeight: 46,
                                    borderRadius: 1.5,
                                    justifyContent: collapsed ? "center" : "flex-start",
                                    px: collapsed ? 1 : 1.5,
                                    "&:hover": {
                                        bgcolor: active
                                            ? brandColors.primary[900]
                                            : theme.palette.mode === "dark"
                                                ? alpha(brandColors.accent[500], 0.14)
                                                : alpha(brandColors.primary[500], 0.1),
                                        color: active ? "#fff" : "text.primary",
                                        "& .MuiListItemIcon-root": {
                                            color: active
                                                ? "#fff"
                                                : theme.palette.mode === "dark"
                                                    ? alpha("#FFFFFF", 0.92)
                                                    : brandColors.primary[700]
                                        }
                                    },
                                    "&.Mui-selected": {
                                        bgcolor: brandColors.primary[900],
                                        color: "#fff",
                                        "& .MuiListItemIcon-root": {
                                            color: "#fff"
                                        }
                                    }
                                }}
                            >
                                <ListItemIcon
                                    sx={{
                                        minWidth: collapsed ? 0 : 36,
                                        color: active ? "#fff" : "text.secondary",
                                        justifyContent: "center"
                                    }}
                                >
                                    <Icon fontSize="small" />
                                </ListItemIcon>
                                {!collapsed ? (
                                    <ListItemText
                                        primary={section.label}
                                        primaryTypographyProps={{
                                            fontSize: 14,
                                            fontWeight: active ? 700 : 600,
                                            color: active ? "#FFFFFF" : undefined
                                        }}
                                    />
                                ) : null}
                            </ListItemButton>
                        );
                    })}
                </List>
            </Box>

            <Box sx={{ mt: "auto", px: collapsed ? 1 : 2, pb: 2 }}>
                <MotionCard variant="outlined" sx={{ ...contentCardSx, borderRadius: 2 }}>
                    <CardContent sx={{ p: collapsed ? 1.15 : 1.5 }}>
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                                display: "block",
                                textAlign: "center",
                                lineHeight: 1.5,
                                fontSize: collapsed ? 10 : 11
                            }}
                        >
                            © 2026 All rights reserved.
                        </Typography>
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
                bgcolor: theme.palette.mode === "dark" ? darkThemeColors.background : brandColors.neutral.background,
                color: "text.primary"
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
                    width: sidebarOpen ? 272 : 88,
                    transition: "width 220ms ease",
                    zIndex: theme.zIndex.drawer,
                    bgcolor: theme.palette.mode === "dark" ? darkThemeColors.paper : "#fff"
                }}
            >
                {renderSidebarContent(!sidebarOpen)}
            </Box>

            <Drawer
                open={mobileMenuOpen}
                onClose={() => setMobileMenuOpen(false)}
                PaperProps={{
                    sx: {
                        width: 304,
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
                    ml: { lg: `${drawerWidth}px` },
                    transition: "margin-left 220ms ease"
                }}
            >
                <Box
                    sx={{
                        position: "sticky",
                        top: 0,
                        zIndex: theme.zIndex.appBar,
                        px: { xs: 2, md: 3.5 },
                        py: 1.5,
                        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
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
                            <Box>
                                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                    {currentView.label}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {currentView.subtitle}
                                </Typography>
                            </Box>
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
                                    borderRadius: 1.5,
                                    minWidth: 220,
                                    bgcolor: theme.palette.mode === "dark" ? alpha("#FFFFFF", 0.02) : "#fff"
                                }}
                            >
                                <SearchRoundedIcon fontSize="small" sx={{ color: "text.secondary" }} />
                                <InputBase placeholder="Search member workspace..." sx={{ flex: 1, fontSize: 14 }} />
                            </Paper>
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
                                        bgcolor: alpha(brandColors.primary[500], 0.14),
                                        color: brandColors.primary[900],
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
                                                color="primary"
                                                sx={{ borderRadius: 0.5, fontWeight: 600 }}
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
                                            bgcolor: alpha(theme.palette.primary.main, 0.14),
                                            color: theme.palette.primary.main,
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
                                        primary={<Typography variant="body2">Plan</Typography>}
                                        secondary={<Typography variant="caption">{(subscription?.plan || "N/A").toUpperCase()}</Typography>}
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

                <Box sx={{ px: { xs: 2, md: 3.5 }, py: { xs: 2.5, md: 3.5 }, pb: { xs: 10, lg: 4 } }}>
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
                        {renderActiveView()}
                    </Stack>
                </Box>
            </Box>

            <MotionModal open={showApplyDialog} onClose={submittingApplication ? undefined : () => setShowApplyDialog(false)} maxWidth="md" fullWidth>
                <DialogTitle>Apply for Loan</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2} sx={{ pt: 0.5 }}>
                        <Alert severity="info" variant="outlined">
                            This submits a loan application into appraisal and approval workflow. No money movement happens until a teller or loan officer disburses an approved application.
                        </Alert>
                        <Box component="form" id="member-loan-application-form" onSubmit={submitLoanApplication} sx={{ display: "grid", gap: 2 }}>
                            <Box>
                                <Typography variant="body2" fontWeight={600} sx={{ mb: 0.75 }}>
                                    Loan Product
                                </Typography>
                                <SearchableSelect
                                    value={loanApplicationForm.watch("product_id")}
                                    options={loanProductOptions}
                                    onChange={(value) => loanApplicationForm.setValue("product_id", value, { shouldValidate: true })}
                                    placeholder="Search loan product..."
                                />
                                {loanApplicationForm.formState.errors.product_id ? (
                                    <Typography variant="caption" color="error.main">
                                        {loanApplicationForm.formState.errors.product_id.message}
                                    </Typography>
                                ) : null}
                            </Box>
                            <TextField
                                label="Purpose"
                                fullWidth
                                multiline
                                minRows={3}
                                {...loanApplicationForm.register("purpose")}
                                error={Boolean(loanApplicationForm.formState.errors.purpose)}
                                helperText={loanApplicationForm.formState.errors.purpose?.message}
                            />
                            <Grid container spacing={2}>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <TextField
                                        label="Requested Amount"
                                        type="number"
                                        fullWidth
                                        {...loanApplicationForm.register("requested_amount")}
                                        error={Boolean(loanApplicationForm.formState.errors.requested_amount)}
                                        helperText={loanApplicationForm.formState.errors.requested_amount?.message}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <TextField
                                        label="Requested Term"
                                        type="number"
                                        fullWidth
                                        {...loanApplicationForm.register("requested_term_count")}
                                        error={Boolean(loanApplicationForm.formState.errors.requested_term_count)}
                                        helperText={loanApplicationForm.formState.errors.requested_term_count?.message}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <TextField
                                        label="Requested Interest %"
                                        type="number"
                                        fullWidth
                                        {...loanApplicationForm.register("requested_interest_rate")}
                                        error={Boolean(loanApplicationForm.formState.errors.requested_interest_rate)}
                                        helperText={loanApplicationForm.formState.errors.requested_interest_rate?.message}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField
                                        select
                                        label="Repayment Frequency"
                                        fullWidth
                                        value={loanApplicationForm.watch("requested_repayment_frequency")}
                                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                            loanApplicationForm.setValue(
                                                "requested_repayment_frequency",
                                                event.target.value as LoanApplicationValues["requested_repayment_frequency"],
                                                { shouldValidate: true }
                                            )
                                        }
                                    >
                                        <MenuItem value="monthly">Monthly</MenuItem>
                                        <MenuItem value="weekly">Weekly</MenuItem>
                                        <MenuItem value="daily">Daily</MenuItem>
                                    </TextField>
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField label="Reference" fullWidth {...loanApplicationForm.register("external_reference")} />
                                </Grid>
                            </Grid>
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowApplyDialog(false)}>Cancel</Button>
                    <Button variant="contained" type="submit" form="member-loan-application-form" disabled={submittingApplication || !canApplyForLoan}>
                        {submittingApplication ? "Submitting..." : "Submit Application"}
                    </Button>
                </DialogActions>
            </MotionModal>

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
                    {portalSections.slice(0, 4).map((section) => {
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
                                    color: active ? brandColors.primary[900] : "text.secondary",
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
