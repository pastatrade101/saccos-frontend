import { MotionCard, MotionModal } from "../ui/motion";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import ApprovalRoundedIcon from "@mui/icons-material/ApprovalRounded";
import AutoGraphRoundedIcon from "@mui/icons-material/AutoGraphRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import CreditScoreRoundedIcon from "@mui/icons-material/CreditScoreRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import EastRoundedIcon from "@mui/icons-material/EastRounded";
import HourglassTopRoundedIcon from "@mui/icons-material/HourglassTopRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import NorthEastRoundedIcon from "@mui/icons-material/NorthEastRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import SavingsRoundedIcon from "@mui/icons-material/SavingsRounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import HighlightOffRoundedIcon from "@mui/icons-material/HighlightOffRounded";
import WalletRoundedIcon from "@mui/icons-material/WalletRounded";
import {
    Alert,
    Avatar,
    Box,
    Button,
    Card,
    CardContent,
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
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Paper,
    Stack,
    TextField,
    Typography,
    useMediaQuery
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useEffect, useMemo, useState, type ChangeEvent, type MouseEvent } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { useAuth } from "../auth/AuthProvider";
import { ChartPanel } from "../components/ChartPanel";
import { DataTable, type Column } from "../components/DataTable";
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
    type MemberAccountsResponse,
    type MembersResponse,
    type StatementsResponse
} from "../lib/endpoints";
import { brandColors, darkThemeColors } from "../theme/colors";
import { useUI } from "../ui/UIProvider";
import type { Loan, LoanApplication, LoanProduct, Member, MemberAccount, StatementRow } from "../types/api";
import { formatCurrency, formatDate } from "../utils/format";

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
    const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
    const { profile, selectedTenantName, selectedBranchName, signOut, subscription, user } = useAuth();
    const { pushToast } = useToast();
    const { theme: themeMode, toggleTheme } = useUI();
    const [accounts, setAccounts] = useState<MemberAccount[]>([]);
    const [loans, setLoans] = useState<Loan[]>([]);
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

    const handleProfileMenuOpen = (event: MouseEvent<HTMLElement>) => {
        setProfileMenuAnchor(event.currentTarget);
    };

    const handleProfileMenuClose = () => {
        setProfileMenuAnchor(null);
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

                const [accountsResult, loansResult, productsResult, applicationsResult, statementsResult] = results;
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

    const totalSavings = useMemo(
        () => accounts.filter((account) => account.product_type === "savings").reduce((sum, account) => sum + account.available_balance, 0),
        [accounts]
    );
    const totalShareCapital = useMemo(
        () => accounts.filter((account) => account.product_type === "shares").reduce((sum, account) => sum + account.available_balance, 0),
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
    const nextPaymentDue = useMemo(
        () => loans.find((loan) => ["active", "in_arrears"].includes(loan.status))?.disbursed_at || null,
        [loans]
    );
    const activeLoanCount = useMemo(() => loans.filter((loan) => ["active", "in_arrears"].includes(loan.status)).length, [loans]);
    const pendingLoanApplications = useMemo(
        () => loanApplications.filter((application) => !["rejected", "cancelled", "disbursed"].includes(application.status)),
        [loanApplications]
    );
    const transactionCount = statements.length;
    const balanceTrend = groupBalances(statements);
    const currentView = portalSections.find((section) => section.id === activeSection) || portalSections[0];
    const latestBalance = statements[0]?.running_balance ?? 0;
    const totalVisibleCapital = totalSavings + totalShareCapital;
    const drawerWidth = sidebarOpen ? 272 : 88;
    const chartLabels = balanceTrend.map((entry) => entry.label);
    const chartValues = balanceTrend.map((entry) => entry.balance);

    const accountColumns: Column<MemberAccount>[] = [
        { key: "account", header: "Account", render: (row) => row.account_number },
        { key: "product", header: "Product", render: (row) => row.product_type },
        { key: "status", header: "Status", render: (row) => row.status },
        { key: "balance", header: "Balance", render: (row) => formatCurrency(row.available_balance) }
    ];

    const statementColumns: Column<StatementRow>[] = [
        { key: "date", header: "Date", render: (row) => formatDate(row.transaction_date) },
        { key: "type", header: "Type", render: (row) => row.transaction_type },
        { key: "amount", header: "Amount", render: (row) => formatCurrency(row.amount) },
        { key: "balance", header: "Running Balance", render: (row) => formatCurrency(row.running_balance) }
    ];

    const loanColumns: Column<Loan>[] = [
        { key: "loan", header: "Loan", render: (row) => row.loan_number },
        { key: "status", header: "Status", render: (row) => row.status },
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
        <Stack spacing={3}>
            {renderHero()}
            {renderStatGrid()}

            <Grid container spacing={2.5}>
                <Grid size={{ xs: 12, xl: 8 }}>
                    <ChartPanel
                        title="Capital Growth"
                        subtitle="Monthly visible running balance trend from posted member activity."
                        data={{
                            labels: chartLabels,
                            datasets: [
                                {
                                    label: "Savings",
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
                </Grid>
                <Grid size={{ xs: 12, xl: 4 }}>
                    <ChartPanel
                        title="Loan Status"
                        type="doughnut"
                        subtitle="Current comparison of visible savings position against loan exposure."
                        data={{
                            labels: ["Savings & Shares", "Outstanding Loans"],
                            datasets: [
                                {
                                    data: [Math.max(totalVisibleCapital, 0), Math.max(totalOutstandingLoans, 0)],
                                    backgroundColor: [brandColors.success, brandColors.danger],
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
            </Grid>
        </Stack>
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
                        value={accounts.length}
                        helper="Savings and share products linked to this membership."
                        tone="success"
                    />
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
                    <DataTable rows={accounts} columns={accountColumns} emptyMessage="No accounts linked yet." />
                </CardContent>
            </MotionCard>
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
                                        label={activeLoanCount ? `${activeLoanCount} active loan(s)` : "No active loans"}
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

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                    <MetricCard
                        icon={CreditScoreRoundedIcon}
                        label="Active Loans"
                        value={activeLoanCount}
                        helper="Facilities currently active or in arrears."
                        tone="danger"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                    <MetricCard
                        icon={TrendingUpRoundedIcon}
                        label="Outstanding Balance"
                        value={formatCurrency(totalOutstandingLoans)}
                        helper="Principal plus accrued interest currently visible."
                        tone="primary"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                    <MetricCard
                        icon={TimelineRoundedIcon}
                        label="Next Due Reference"
                        value={formatDate(nextPaymentDue)}
                        helper="Latest visible disbursement reference in your loan activity."
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
                                    data: [Math.max(totalOutstandingLoans, 0), Math.max(totalVisibleCapital - totalOutstandingLoans, 0)],
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
                            <DataTable rows={loans} columns={loanColumns} emptyMessage="No loan records found." />
                        </CardContent>
                    </MotionCard>
                </Grid>
            </Grid>
        </Stack>
    );

    const renderTransactionsView = () => (
        <Stack spacing={3}>
            <MotionCard variant="outlined" sx={contentCardSx}>
                <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                    <Typography variant="overline" color="text.secondary">
                        Transactions
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5 }}>
                        Posted Member Activity
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Review recent transactions that affect your savings, contributions, dividend allocations, and running balances.
                    </Typography>
                </CardContent>
            </MotionCard>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                    <MetricCard
                        icon={TimelineRoundedIcon}
                        label="Posted Transactions"
                        value={transactionCount}
                        helper="Visible member statement entries."
                        tone="primary"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                    <MetricCard
                        icon={WalletRoundedIcon}
                        label="Latest Balance"
                        value={formatCurrency(latestBalance)}
                        helper="Running balance from the latest visible statement."
                        tone="success"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                    <MetricCard
                        icon={TrendingUpRoundedIcon}
                        label="Latest Activity"
                        value={formatDate(statements[0]?.transaction_date)}
                        helper="Most recent posted activity date visible to this login."
                        tone="warning"
                    />
                </Grid>
            </Grid>

            <ChartPanel
                title="Transaction Balance Trend"
                subtitle="Recent running balances based on posted member transactions."
                data={{
                    labels: chartLabels,
                    datasets: [
                        {
                            label: "Running balance",
                            data: chartValues,
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
                        Recent Transactions
                    </Typography>
                    <DataTable rows={statements.slice(0, 20)} columns={statementColumns} emptyMessage="No transactions yet." />
                </CardContent>
            </MotionCard>
        </Stack>
    );

    const renderContributionsView = () => (
        <Stack spacing={3}>
            <MotionCard variant="outlined" sx={contentCardSx}>
                <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                    <Typography variant="overline" color="text.secondary">
                        Contributions
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5 }}>
                        Share Contributions & Dividend Credits
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Follow the contributions posted to your share account and the dividend allocations credited to your membership.
                    </Typography>
                </CardContent>
            </MotionCard>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                    <MetricCard
                        icon={SavingsRoundedIcon}
                        label="Share Capital"
                        value={formatCurrency(totalShareCapital)}
                        helper="Current visible balance on your share account."
                        tone="warning"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                    <MetricCard
                        icon={TrendingUpRoundedIcon}
                        label="Dividends Credited"
                        value={formatCurrency(totalDividends)}
                        helper="Total visible dividend allocations posted to you."
                        tone="success"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                    <MetricCard
                        icon={AccountBalanceWalletRoundedIcon}
                        label="Contribution Entries"
                        value={contributionHistory.length}
                        helper="Visible share contribution and dividend transactions."
                        tone="primary"
                    />
                </Grid>
            </Grid>

            <MotionCard variant="outlined" sx={contentCardSx}>
                <CardContent>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        Share Contributions & Dividends
                    </Typography>
                    <DataTable
                        rows={contributionHistory.slice(0, 20)}
                        columns={statementColumns}
                        emptyMessage="No share contributions or dividends posted yet."
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
                        sx: {
                            mt: 1,
                            minWidth: 280,
                            borderRadius: 2,
                            border: `1px solid ${alpha(theme.palette.divider, 0.9)}`
                        }
                    }}
                >
                    <Box sx={{ px: 1.75, pt: 1.5, pb: 1.25 }}>
                        <Stack direction="row" spacing={1.25} alignItems="center">
                            <Avatar
                                sx={{
                                    width: 38,
                                    height: 38,
                                    borderRadius: 1.5,
                                    bgcolor: alpha(brandColors.primary[500], 0.14),
                                    color: brandColors.primary[900],
                                    fontWeight: 800
                                }}
                            >
                                {(profile?.full_name || "M").slice(0, 1).toUpperCase()}
                            </Avatar>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant="subtitle2" noWrap sx={{ fontWeight: 700 }}>
                                    {profile?.full_name || "Member"}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" noWrap>
                                    {user?.email || "No email"}
                                </Typography>
                            </Box>
                        </Stack>
                        <Stack spacing={0.4} sx={{ mt: 1.25 }}>
                            <Typography variant="caption" color="text.secondary">
                                Role: Member
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>
                                Branch: {selectedBranchName || "Assigned branch"}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>
                                Plan: {(subscription?.plan || "N/A").toUpperCase()}
                            </Typography>
                        </Stack>
                    </Box>
                    <MenuItem
                        onClick={() => {
                            toggleTheme();
                            handleProfileMenuClose();
                        }}
                    >
                        <ListItemIcon>
                            {themeMode === "dark" ? <LightModeRoundedIcon fontSize="small" /> : <DarkModeRoundedIcon fontSize="small" />}
                        </ListItemIcon>
                        <ListItemText>{themeMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}</ListItemText>
                    </MenuItem>
                    <MenuItem
                        onClick={() => {
                            handleProfileMenuClose();
                            void signOut();
                        }}
                    >
                        <ListItemIcon>
                            <LogoutRoundedIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>Sign out</ListItemText>
                    </MenuItem>
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
