import AccountBalanceRoundedIcon from "@mui/icons-material/AccountBalanceRounded";
import ApprovalRoundedIcon from "@mui/icons-material/ApprovalRounded";
import AssignmentTurnedInRoundedIcon from "@mui/icons-material/AssignmentTurnedInRounded";
import CreditScoreRoundedIcon from "@mui/icons-material/CreditScoreRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import PendingActionsRoundedIcon from "@mui/icons-material/PendingActionsRounded";
import PlaylistAddCheckRoundedIcon from "@mui/icons-material/PlaylistAddCheckRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import {
    Alert,
    Box,
    Button,
    CardContent,
    Chip,
    Divider,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    MenuItem,
    Pagination,
    Stack,
    Tab,
    Tabs,
    TextField,
    Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { useAuth } from "../auth/AuthProvider";
import { ConfirmModal } from "../components/ConfirmModal";
import { DataTable, type Column } from "../components/DataTable";
import { SearchableSelect } from "../components/SearchableSelect";
import { useToast } from "../components/Toast";
import { api, getApiErrorMessage } from "../lib/api";
import {
    endpoints,
    type AppraiseLoanApplicationRequest,
    type CreateLoanApplicationRequest,
    type DisburseApprovedLoanRequest,
    type LoanApplicationResponse,
    type LoanApplicationsResponse,
    type LoanProductsResponse,
    type LoanRepaymentRequest,
    type LoansResponse,
    type LoanSchedulesResponse,
    type LoanTransactionsResponse,
    type MembersResponse,
    type ApproveLoanApplicationRequest,
    type RejectLoanApplicationRequest
} from "../lib/endpoints";
import type { Loan, LoanApplication, LoanProduct, LoanSchedule, LoanTransaction, Member } from "../types/api";
import { MotionCard, MotionModal } from "../ui/motion";
import { formatCurrency, formatDate } from "../utils/format";

const createApplicationSchema = z.object({
    member_id: z.string().uuid("Select a member."),
    product_id: z.string().uuid("Select a loan product."),
    external_reference: z.string().max(80).optional().or(z.literal("")),
    purpose: z.string().trim().min(3, "Purpose is required.").max(500),
    requested_amount: z.coerce.number().positive("Requested amount is required."),
    requested_term_count: z.coerce.number().int().positive("Requested term is required."),
    requested_repayment_frequency: z.enum(["daily", "weekly", "monthly"]).default("monthly"),
    requested_interest_rate: z.union([z.coerce.number().min(0).max(100), z.nan()]).optional().transform((value) => (Number.isNaN(value) ? undefined : value))
});

const appraiseSchema = z.object({
    recommended_amount: z.coerce.number().positive("Recommended amount is required."),
    recommended_term_count: z.coerce.number().int().positive("Recommended term is required."),
    recommended_interest_rate: z.coerce.number().min(0).max(100),
    recommended_repayment_frequency: z.enum(["daily", "weekly", "monthly"]).default("monthly"),
    risk_rating: z.enum(["low", "medium", "high"]).default("medium"),
    appraisal_notes: z.string().trim().min(3, "Appraisal notes are required.").max(1000)
});

const approveSchema = z.object({
    notes: z.string().max(1000).optional().or(z.literal(""))
});

const rejectSchema = z.object({
    reason: z.string().trim().min(3, "Rejection reason is required.").max(1000),
    notes: z.string().max(1000).optional().or(z.literal(""))
});

const disburseSchema = z.object({
    reference: z.string().max(80).optional().or(z.literal("")),
    description: z.string().max(255).optional().or(z.literal(""))
});

const repaySchema = z.object({
    loan_id: z.string().uuid("Select a loan."),
    amount: z.coerce.number().positive("Repayment amount is required."),
    reference: z.string().max(80).optional().or(z.literal("")),
    description: z.string().max(255).optional().or(z.literal(""))
});

type CreateApplicationValues = z.infer<typeof createApplicationSchema>;
type AppraiseValues = z.infer<typeof appraiseSchema>;
type ApproveValues = z.infer<typeof approveSchema>;
type RejectValues = z.infer<typeof rejectSchema>;
type DisburseValues = z.infer<typeof disburseSchema>;
type RepayValues = z.infer<typeof repaySchema>;

type PendingMoneyAction =
    | { type: "disburse"; application: LoanApplication; values: DisburseValues }
    | { type: "repay"; values: RepayValues }
    | null;

type LoanWorkspaceTab = "applications" | "portfolio" | "collections" | "activity";

function formatLoanTransactionType(transactionType: LoanTransaction["transaction_type"]) {
    if (transactionType === "loan_repayment") {
        return "Repayment";
    }
    if (transactionType === "loan_disbursement") {
        return "Disbursement";
    }
    return "Interest Accrual";
}

function MetricCard({
    title,
    value,
    helper,
    icon
}: {
    title: string;
    value: string;
    helper: string;
    icon: React.ReactNode;
}) {
    return (
        <MotionCard variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                    <Box>
                        <Typography variant="overline" color="text.secondary">
                            {title}
                        </Typography>
                        <Typography variant="h5" sx={{ mt: 0.5 }}>
                            {value}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                            {helper}
                        </Typography>
                    </Box>
                    <Box
                        sx={{
                            width: 42,
                            height: 42,
                            borderRadius: 2,
                            display: "grid",
                            placeItems: "center",
                            bgcolor: "action.hover",
                            color: "text.primary"
                        }}
                    >
                        {icon}
                    </Box>
                </Stack>
            </CardContent>
        </MotionCard>
    );
}

function ProfessionalStatCard({
    label,
    value,
    helper,
    status,
    tone,
    icon,
    featured = false
}: {
    label: string;
    value: string;
    helper: string;
    status: string;
    tone: "positive" | "negative" | "neutral";
    icon: React.ReactNode;
    featured?: boolean;
}) {
    const theme = useTheme();
    const neutralAccent = theme.palette.mode === "dark" ? "#D9B273" : theme.palette.primary.main;
    const toneMap = {
        positive: {
            main: theme.palette.success.main,
            soft: alpha(theme.palette.success.main, 0.12)
        },
        negative: {
            main: theme.palette.error.main,
            soft: alpha(theme.palette.error.main, 0.12)
        },
        neutral: {
            main: neutralAccent,
            soft: alpha(neutralAccent, 0.12)
        }
    }[tone];

    return (
        <MotionCard
            variant="outlined"
            sx={{
                height: "100%",
                borderColor: alpha(toneMap.main, featured ? 0.3 : 0.2),
                background: featured
                    ? `linear-gradient(135deg, ${alpha(toneMap.main, 0.08)}, ${theme.palette.background.paper})`
                    : theme.palette.background.paper,
                boxShadow: featured ? `0 14px 30px ${alpha(toneMap.main, 0.08)}` : "none"
            }}
        >
            <CardContent sx={{ height: "100%" }}>
                <Stack spacing={1.75} sx={{ height: "100%" }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
                        <Stack spacing={0.5}>
                            <Typography variant="overline" color="text.secondary">
                                {label}
                            </Typography>
                            <Typography variant={featured ? "h4" : "h5"} sx={{ lineHeight: 1 }}>
                                {value}
                            </Typography>
                        </Stack>
                        <Box
                            sx={{
                                width: featured ? 46 : 40,
                                height: featured ? 46 : 40,
                                borderRadius: 2,
                                bgcolor: toneMap.soft,
                                color: toneMap.main,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0
                            }}
                        >
                            {icon}
                        </Box>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                        {helper}
                    </Typography>
                    <Chip
                        label={status}
                        size="small"
                        variant="outlined"
                        sx={{
                            width: "fit-content",
                            fontWeight: 700,
                            color: toneMap.main,
                            borderColor: alpha(toneMap.main, 0.24),
                            bgcolor: toneMap.soft
                        }}
                    />
                </Stack>
            </CardContent>
        </MotionCard>
    );
}

export function LoansPage() {
    const theme = useTheme();
    const navigate = useNavigate();
    const { pushToast } = useToast();
    const { profile, selectedTenantId, selectedBranchId, subscriptionInactive } = useAuth();
    const [members, setMembers] = useState<Member[]>([]);
    const [loanProducts, setLoanProducts] = useState<LoanProduct[]>([]);
    const [applications, setApplications] = useState<LoanApplication[]>([]);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [schedules, setSchedules] = useState<LoanSchedule[]>([]);
    const [transactions, setTransactions] = useState<LoanTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [reviewTarget, setReviewTarget] = useState<LoanApplication | null>(null);
    const [appraisalTarget, setAppraisalTarget] = useState<LoanApplication | null>(null);
    const [approvalTarget, setApprovalTarget] = useState<LoanApplication | null>(null);
    const [rejectionTarget, setRejectionTarget] = useState<LoanApplication | null>(null);
    const [disbursementTarget, setDisbursementTarget] = useState<LoanApplication | null>(null);
    const [showRepayModal, setShowRepayModal] = useState(false);
    const [pendingMoneyAction, setPendingMoneyAction] = useState<PendingMoneyAction>(null);
    const [applicationPage, setApplicationPage] = useState(1);
    const [loanPage, setLoanPage] = useState(1);
    const [applicationTotal, setApplicationTotal] = useState(0);
    const [loanTotal, setLoanTotal] = useState(0);
    const [activeTab, setActiveTab] = useState<LoanWorkspaceTab>("applications");
    const [referencesLoaded, setReferencesLoaded] = useState(false);
    const [referencesLoading, setReferencesLoading] = useState(false);
    const [activityLoaded, setActivityLoaded] = useState(false);
    const [activityLoading, setActivityLoading] = useState(false);
    const pageSize = 8;

    const role = profile?.role || "loan_officer";
    const canCreateApplications = ["branch_manager", "loan_officer", "teller"].includes(role);
    const canAppraise = role === "loan_officer";
    const canApprove = role === "branch_manager";
    const canDisburse = role === "loan_officer" || role === "teller";
    const canRepay = role === "loan_officer" || role === "teller";

    const createForm = useForm<CreateApplicationValues>({
        resolver: zodResolver(createApplicationSchema),
        defaultValues: {
            member_id: "",
            product_id: "",
            external_reference: "",
            purpose: "",
            requested_amount: 0,
            requested_term_count: 12,
            requested_repayment_frequency: "monthly"
        }
    });

    const appraiseForm = useForm<AppraiseValues>({
        resolver: zodResolver(appraiseSchema),
        defaultValues: {
            recommended_amount: 0,
            recommended_term_count: 12,
            recommended_interest_rate: 18,
            recommended_repayment_frequency: "monthly",
            risk_rating: "medium",
            appraisal_notes: ""
        }
    });

    const approveForm = useForm<ApproveValues>({
        resolver: zodResolver(approveSchema),
        defaultValues: { notes: "" }
    });

    const rejectForm = useForm<RejectValues>({
        resolver: zodResolver(rejectSchema),
        defaultValues: { reason: "", notes: "" }
    });

    const disburseForm = useForm<DisburseValues>({
        resolver: zodResolver(disburseSchema),
        defaultValues: { reference: "", description: "" }
    });

    const repayForm = useForm<RepayValues>({
        resolver: zodResolver(repaySchema),
        defaultValues: {
            loan_id: "",
            amount: 0,
            reference: "",
            description: ""
        }
    });

    const loadWorkspace = async () => {
        if (!selectedTenantId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const [{ data: applicationsResponse }, { data: loansResponse }, { data: schedulesResponse }] = await Promise.all([
                api.get<LoanApplicationsResponse>(endpoints.loanApplications.list(), {
                    params: { tenant_id: selectedTenantId, page: applicationPage, limit: pageSize }
                }),
                api.get<LoansResponse>(endpoints.finance.loanPortfolio(), {
                    params: { tenant_id: selectedTenantId, page: loanPage, limit: pageSize }
                }),
                api.get<LoanSchedulesResponse>(endpoints.finance.loanSchedules(), {
                    params: { tenant_id: selectedTenantId, page: 1, limit: 100 }
                })
            ]);

            setApplications(applicationsResponse.data || []);
            setLoans(loansResponse.data || []);
            setApplicationTotal(
                Number((applicationsResponse as unknown as { pagination?: { total?: number } }).pagination?.total || 0) ||
                (applicationsResponse.data || []).length
            );
            setLoanTotal(
                Number((loansResponse as unknown as { pagination?: { total?: number } }).pagination?.total || 0) ||
                (loansResponse.data || []).length
            );
            setSchedules((schedulesResponse.data || []).filter((schedule) => ["pending", "partial", "overdue"].includes(schedule.status)));
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to load loan workspace",
                message: getApiErrorMessage(error)
            });
        } finally {
            setLoading(false);
        }
    };

    const loadReferenceData = async (options?: { silent?: boolean; force?: boolean }) => {
        if (!selectedTenantId) {
            return;
        }

        if (referencesLoading) {
            return;
        }

        if (referencesLoaded && !options?.force) {
            return;
        }

        setReferencesLoading(true);
        try {
            const [{ data: membersResponse }, { data: productsResponse }] = await Promise.all([
                api.get<MembersResponse>(endpoints.members.list(), { params: { tenant_id: selectedTenantId, page: 1, limit: 100 } }),
                api.get<LoanProductsResponse>(endpoints.products.loans())
            ]);
            setMembers(membersResponse.data || []);
            setLoanProducts(productsResponse.data || []);
            setReferencesLoaded(true);
        } catch (error) {
            if (!options?.silent) {
                pushToast({
                    type: "error",
                    title: "Unable to load members and products",
                    message: getApiErrorMessage(error)
                });
            }
        } finally {
            setReferencesLoading(false);
        }
    };

    const loadActivityData = async (options?: { silent?: boolean; force?: boolean }) => {
        if (!selectedTenantId) {
            return;
        }

        if (activityLoading) {
            return;
        }

        if (activityLoaded && !options?.force) {
            return;
        }

        setActivityLoading(true);
        try {
            const [{ data: transactionsResponse }] = await Promise.all([
                api.get<LoanTransactionsResponse>(endpoints.finance.loanTransactions(), {
                    params: { tenant_id: selectedTenantId, limit: 100, page: 1 }
                }),
                loadReferenceData({ silent: true })
            ]);
            setTransactions(transactionsResponse.data || []);
            setActivityLoaded(true);
        } catch (error) {
            if (!options?.silent) {
                pushToast({
                    type: "error",
                    title: "Unable to load loan activity",
                    message: getApiErrorMessage(error)
                });
            }
        } finally {
            setActivityLoading(false);
        }
    };

    useEffect(() => {
        setMembers([]);
        setLoanProducts([]);
        setTransactions([]);
        setApplications([]);
        setLoans([]);
        setSchedules([]);
        setApplicationTotal(0);
        setLoanTotal(0);
        setApplicationPage(1);
        setLoanPage(1);
        setReferencesLoaded(false);
        setReferencesLoading(false);
        setActivityLoaded(false);
        setActivityLoading(false);
        setActiveTab("applications");
    }, [selectedTenantId]);

    useEffect(() => {
        if (!selectedTenantId) {
            return;
        }

        void loadWorkspace();
    }, [applicationPage, loanPage, selectedTenantId]);

    useEffect(() => {
        if (activeTab === "activity" && !activityLoaded && !activityLoading) {
            void loadActivityData({ silent: true });
        }
    }, [activeTab, activityLoaded, activityLoading]);

    useEffect(() => {
        if ((showCreateModal || showRepayModal) && !referencesLoaded && !referencesLoading) {
            void loadReferenceData({ silent: true });
        }
    }, [referencesLoaded, referencesLoading, showCreateModal, showRepayModal]);

    const memberOptions = useMemo(
        () =>
            members.map((member) => ({
                value: member.id,
                label: member.full_name,
                secondary: member.member_no || member.phone || undefined
            })),
        [members]
    );

    const productOptions = useMemo(
        () =>
            loanProducts.map((product) => ({
                value: product.id,
                label: product.name,
                secondary: `${product.annual_interest_rate}% · ${formatCurrency(product.min_amount)} min`
            })),
        [loanProducts]
    );

    const loanOptions = useMemo(
        () =>
            loans.map((loan) => {
                const member = members.find((entry) => entry.id === loan.member_id);
                return {
                    value: loan.id,
                    label: `${loan.loan_number} · ${member?.full_name || "Unknown member"}`,
                    secondary: `Outstanding ${formatCurrency(loan.outstanding_principal + loan.accrued_interest)}`
                };
            }),
        [loans, members]
    );

    const nextDueByLoan = useMemo(() => {
        const map = new Map<string, string>();
        schedules.forEach((schedule) => {
            if (!map.has(schedule.loan_id)) {
                map.set(schedule.loan_id, schedule.due_date);
            }
        });
        return map;
    }, [schedules]);

    const metrics = useMemo(() => {
        const outstandingPrincipal = loans.reduce((sum, loan) => sum + loan.outstanding_principal, 0);
        const activeLoans = loans.filter((loan) => loan.status === "active").length;
        const arrearsLoans = loans.filter((loan) => loan.status === "in_arrears").length;
        const awaitingAppraisal = applications.filter((application) => application.status === "submitted").length;
        const awaitingApproval = applications.filter((application) => application.status === "appraised" || (application.status === "approved" && application.approval_count < application.required_approval_count)).length;
        const readyToDisburse = applications.filter((application) => application.status === "approved" && !application.loan_id).length;

        return {
            outstandingPrincipal,
            activeLoans,
            arrearsLoans,
            awaitingAppraisal,
            awaitingApproval,
            readyToDisburse
        };
    }, [applications, loans]);
    const dashboardAccent = theme.palette.mode === "dark" ? "#D9B273" : theme.palette.primary.main;
    const dashboardAccentStrong = theme.palette.mode === "dark" ? "#C89B52" : theme.palette.primary.dark;
    const darkAccentContainedSx = theme.palette.mode === "dark"
        ? { bgcolor: dashboardAccent, color: "#1a1a1a", "&:hover": { bgcolor: dashboardAccentStrong } }
        : undefined;
    const darkAccentOutlinedSx = theme.palette.mode === "dark"
        ? { borderColor: alpha(dashboardAccent, 0.44), color: dashboardAccent, "&:hover": { borderColor: alpha(dashboardAccent, 0.78), bgcolor: alpha(dashboardAccent, 0.1) } }
        : undefined;
    const darkAccentChipSx = theme.palette.mode === "dark"
        ? { borderColor: alpha(dashboardAccent, 0.44), color: dashboardAccent, bgcolor: alpha(dashboardAccent, 0.1) }
        : undefined;
    const darkAccentPaginationSx = theme.palette.mode === "dark"
        ? {
            "& .MuiPaginationItem-root": { color: dashboardAccent },
            "& .MuiPaginationItem-root.Mui-selected": {
                bgcolor: alpha(dashboardAccent, 0.22),
                borderColor: alpha(dashboardAccent, 0.52),
                color: dashboardAccent
            },
            "& .MuiPaginationItem-root:hover": {
                bgcolor: alpha(dashboardAccent, 0.12)
            }
        }
        : undefined;
    const darkAccentInfoAlertSx = theme.palette.mode === "dark"
        ? {
            borderColor: alpha(dashboardAccent, 0.45),
            color: dashboardAccent,
            bgcolor: alpha(dashboardAccent, 0.1),
            "& .MuiAlert-icon": { color: dashboardAccent }
        }
        : undefined;
    const arrearsRate = loans.length ? (metrics.arrearsLoans / loans.length) * 100 : 0;
    const overdueScheduleCount = useMemo(
        () => schedules.filter((schedule) => schedule.status === "overdue").length,
        [schedules]
    );
    const pendingAmountForSchedule = (schedule: LoanSchedule) =>
        Math.max(schedule.principal_due - schedule.principal_paid, 0) + Math.max(schedule.interest_due - schedule.interest_paid, 0);
    const overdueExposure = useMemo(
        () =>
            schedules
                .filter((schedule) => schedule.status === "overdue")
                .reduce((sum, schedule) => sum + pendingAmountForSchedule(schedule), 0),
        [schedules]
    );
    const dueWithin7DaysCount = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return schedules.filter((schedule) => {
            const dueDate = new Date(schedule.due_date);
            const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
            const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            return diffDays >= 0 && diffDays <= 7;
        }).length;
    }, [schedules]);
    const loanOfficerPriorityItems = useMemo(() => {
        return schedules
            .map((schedule) => {
                const loan = loans.find((entry) => entry.id === schedule.loan_id);
                const member = members.find((entry) => entry.id === loan?.member_id);
                const dueDate = new Date(schedule.due_date);
                const daysToDue = Math.floor((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return {
                    id: schedule.id,
                    loanId: schedule.loan_id,
                    loanNumber: loan?.loan_number || "Unknown loan",
                    borrower: member?.full_name || "Unknown member",
                    dueDate: schedule.due_date,
                    amount: pendingAmountForSchedule(schedule),
                    status: schedule.status,
                    daysToDue
                };
            })
            .sort((left, right) => {
                const leftPriority = left.status === "overdue" ? 0 : left.status === "partial" ? 1 : 2;
                const rightPriority = right.status === "overdue" ? 0 : right.status === "partial" ? 1 : 2;
                if (leftPriority !== rightPriority) {
                    return leftPriority - rightPriority;
                }

                if (left.daysToDue !== right.daysToDue) {
                    return left.daysToDue - right.daysToDue;
                }

                return right.amount - left.amount;
            })
            .slice(0, 6);
    }, [schedules, loans, members]);
    const loanOfficerQueue = [
        {
            id: "queue-appraisal",
            label: "Awaiting appraisal",
            count: metrics.awaitingAppraisal,
            helper: "Submitted applications requiring your recommendation and risk notes.",
            route: "/loans",
            tone: metrics.awaitingAppraisal > 0 ? "warning" : "success"
        },
        {
            id: "queue-disbursement",
            label: "Ready to disburse",
            count: metrics.readyToDisburse,
            helper: "Approved applications waiting final disbursement posting.",
            route: "/loans",
            tone: metrics.readyToDisburse > 0 ? "warning" : "success"
        },
        {
            id: "queue-overdue",
            label: "Overdue schedules",
            count: overdueScheduleCount,
            helper: "Installments past due requiring immediate member outreach.",
            route: "/follow-ups",
            tone: overdueScheduleCount > 0 ? "error" : "success"
        },
        {
            id: "queue-arrears",
            label: "Loans in arrears",
            count: metrics.arrearsLoans,
            helper: "Loan accounts already in arrears and under collections pressure.",
            route: "/loans",
            tone: metrics.arrearsLoans > 0 ? "warning" : "success"
        }
    ] as const;
    const orderedTransactions = useMemo(
        () =>
            [...transactions].sort(
                (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
            ),
        [transactions]
    );
    const activitySummary = useMemo(() => {
        const repayments = orderedTransactions.filter((entry) => entry.transaction_type === "loan_repayment");
        const disbursements = orderedTransactions.filter((entry) => entry.transaction_type === "loan_disbursement");
        const accruals = orderedTransactions.filter((entry) => entry.transaction_type === "interest_accrual");
        const repaymentVolume = repayments.reduce((sum, entry) => sum + entry.amount, 0);
        const disbursementVolume = disbursements.reduce((sum, entry) => sum + entry.amount, 0);
        const accrualVolume = accruals.reduce((sum, entry) => sum + entry.amount, 0);
        const repaymentAverageTicket = repayments.length ? repaymentVolume / repayments.length : 0;

        const movementByLoan = new Map<string, number>();
        orderedTransactions.forEach((entry) => {
            movementByLoan.set(entry.loan_id, (movementByLoan.get(entry.loan_id) || 0) + Math.abs(entry.amount));
        });
        const totalMovementVolume = [...movementByLoan.values()].reduce((sum, amount) => sum + amount, 0);
        const topLoans = [...movementByLoan.entries()]
            .map(([loanId, totalAmount]) => {
                const loan = loans.find((entry) => entry.id === loanId);
                const borrower = loan ? members.find((entry) => entry.id === loan.member_id)?.full_name : null;
                return {
                    loanId,
                    loanNumber: loan?.loan_number || loanId,
                    borrower: borrower || "Unknown member",
                    totalAmount
                };
            })
            .sort((left, right) => right.totalAmount - left.totalAmount)
            .slice(0, 5);

        return {
            repaymentCount: repayments.length,
            disbursementCount: disbursements.length,
            accrualCount: accruals.length,
            repaymentVolume,
            disbursementVolume,
            accrualVolume,
            repaymentAverageTicket,
            latestActivityAt: orderedTransactions[0]?.created_at || null,
            totalMovementVolume,
            topLoans
        };
    }, [loans, members, orderedTransactions]);
    const workspaceTabs = useMemo(
        () =>
            role === "loan_officer"
                ? [
                    { value: "applications" as const, label: "Applications", count: applicationTotal },
                    { value: "portfolio" as const, label: "Portfolio", count: loanTotal },
                    { value: "collections" as const, label: "Collections", count: overdueScheduleCount },
                    { value: "activity" as const, label: "Activity", count: transactions.length }
                ]
                : [
                    { value: "applications" as const, label: "Applications", count: applicationTotal },
                    { value: "portfolio" as const, label: "Portfolio", count: loanTotal },
                    { value: "activity" as const, label: "Activity", count: transactions.length }
                ],
        [applicationTotal, loanTotal, overdueScheduleCount, role, transactions.length]
    );

    const paginatedApplications = applications;
    const applicationTotalPages = Math.max(1, Math.ceil((applicationTotal || 0) / pageSize));

    const paginatedLoans = loans;
    const loanTotalPages = Math.max(1, Math.ceil((loanTotal || 0) / pageSize));

    useEffect(() => {
        if (!workspaceTabs.some((tab) => tab.value === activeTab)) {
            setActiveTab(workspaceTabs[0]?.value || "applications");
        }
    }, [activeTab, workspaceTabs]);

    const openAppraisalDialog = (application: LoanApplication) => {
        setAppraisalTarget(application);
        appraiseForm.reset({
            recommended_amount: application.recommended_amount ?? application.requested_amount,
            recommended_term_count: application.recommended_term_count ?? application.requested_term_count,
            recommended_interest_rate: application.recommended_interest_rate ?? application.requested_interest_rate ?? 18,
            recommended_repayment_frequency: application.recommended_repayment_frequency ?? application.requested_repayment_frequency,
            risk_rating: (application.risk_rating as AppraiseValues["risk_rating"]) || "medium",
            appraisal_notes: application.appraisal_notes || ""
        });
    };

    const createApplication = createForm.handleSubmit(async (values) => {
        setProcessing(true);
        try {
            const payload: CreateLoanApplicationRequest = {
                tenant_id: selectedTenantId || undefined,
                branch_id: selectedBranchId || undefined,
                member_id: values.member_id,
                product_id: values.product_id,
                external_reference: values.external_reference || null,
                purpose: values.purpose,
                requested_amount: values.requested_amount,
                requested_term_count: values.requested_term_count,
                requested_repayment_frequency: values.requested_repayment_frequency,
                requested_interest_rate: values.requested_interest_rate ?? null
            };

            const { data } = await api.post<LoanApplicationResponse>(endpoints.loanApplications.list(), payload);
            await api.post<LoanApplicationResponse>(endpoints.loanApplications.submit(data.data.id), {});

            pushToast({
                type: "success",
                title: "Application submitted",
                message: "The loan application has been submitted into the workflow."
            });
            setShowCreateModal(false);
            createForm.reset();
            await loadWorkspace();
            if (activityLoaded) {
                await loadActivityData({ silent: true, force: true });
            }
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to create application",
                message: getApiErrorMessage(error)
            });
        } finally {
            setProcessing(false);
        }
    });

    const submitDraftApplication = async (application: LoanApplication) => {
        setProcessing(true);
        try {
            await api.post<LoanApplicationResponse>(endpoints.loanApplications.submit(application.id), {});
            pushToast({
                type: "success",
                title: "Application submitted",
                message: `${application.members?.full_name || "Loan application"} is now awaiting appraisal.`
            });
            await loadWorkspace();
            if (activityLoaded) {
                await loadActivityData({ silent: true, force: true });
            }
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to submit application",
                message: getApiErrorMessage(error)
            });
        } finally {
            setProcessing(false);
        }
    };

    const saveAppraisal = appraiseForm.handleSubmit(async (values) => {
        if (!appraisalTarget) {
            return;
        }

        setProcessing(true);
        try {
            const payload: AppraiseLoanApplicationRequest = {
                ...values
            };
            await api.post<LoanApplicationResponse>(endpoints.loanApplications.appraise(appraisalTarget.id), payload);
            pushToast({
                type: "success",
                title: "Application appraised",
                message: "The branch manager can now review this recommendation."
            });
            setAppraisalTarget(null);
            await loadWorkspace();
            if (activityLoaded) {
                await loadActivityData({ silent: true, force: true });
            }
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to save appraisal",
                message: getApiErrorMessage(error)
            });
        } finally {
            setProcessing(false);
        }
    });

    const saveApproval = approveForm.handleSubmit(async (values) => {
        if (!approvalTarget) {
            return;
        }

        setProcessing(true);
        try {
            const payload: ApproveLoanApplicationRequest = {
                notes: values.notes || null
            };
            const { data } = await api.post<LoanApplicationResponse>(endpoints.loanApplications.approve(approvalTarget.id), payload);
            const complete = data.data.approval_count >= data.data.required_approval_count;
            pushToast({
                type: "success",
                title: complete ? "Application approved" : "Approval recorded",
                message: complete
                    ? "The loan is now ready for disbursement by an authorized user."
                    : "This approval has been recorded and the application remains in approval flow."
            });
            setApprovalTarget(null);
            approveForm.reset();
            await loadWorkspace();
            if (activityLoaded) {
                await loadActivityData({ silent: true, force: true });
            }
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to approve application",
                message: getApiErrorMessage(error)
            });
        } finally {
            setProcessing(false);
        }
    });

    const saveRejection = rejectForm.handleSubmit(async (values) => {
        if (!rejectionTarget) {
            return;
        }

        setProcessing(true);
        try {
            const payload: RejectLoanApplicationRequest = {
                reason: values.reason,
                notes: values.notes || null
            };
            await api.post<LoanApplicationResponse>(endpoints.loanApplications.reject(rejectionTarget.id), payload);
            pushToast({
                type: "success",
                title: "Application rejected",
                message: "The application has been returned out of the approval flow."
            });
            setRejectionTarget(null);
            rejectForm.reset();
            await loadWorkspace();
            if (activityLoaded) {
                await loadActivityData({ silent: true, force: true });
            }
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to reject application",
                message: getApiErrorMessage(error)
            });
        } finally {
            setProcessing(false);
        }
    });

    const launchDisbursement = disburseForm.handleSubmit((values) => {
        if (!disbursementTarget) {
            return;
        }
        setPendingMoneyAction({ type: "disburse", application: disbursementTarget, values });
    });

    const launchRepayment = repayForm.handleSubmit((values) => {
        setPendingMoneyAction({ type: "repay", values });
    });

    const confirmMoneyAction = async () => {
        if (!pendingMoneyAction) {
            return;
        }

        setProcessing(true);
        try {
            if (pendingMoneyAction.type === "disburse") {
                const payload: DisburseApprovedLoanRequest = {
                    reference: pendingMoneyAction.values.reference || null,
                    description: pendingMoneyAction.values.description || null
                };
                await api.post<LoanApplicationResponse>(
                    endpoints.loanApplications.disburse(pendingMoneyAction.application.id),
                    payload
                );
                pushToast({
                    type: "success",
                    title: "Loan disbursed",
                    message: `${pendingMoneyAction.application.members?.full_name || "The borrower"} has been disbursed successfully.`
                });
                setDisbursementTarget(null);
                disburseForm.reset();
            } else {
                const payload: LoanRepaymentRequest = {
                    tenant_id: selectedTenantId || undefined,
                    loan_id: pendingMoneyAction.values.loan_id,
                    amount: pendingMoneyAction.values.amount,
                    reference: pendingMoneyAction.values.reference || null,
                    description: pendingMoneyAction.values.description || null
                };
                await api.post(endpoints.finance.loanRepay(), payload);
                pushToast({
                    type: "success",
                    title: "Repayment posted",
                    message: "The repayment has been applied to the selected loan."
                });
                setShowRepayModal(false);
                repayForm.reset();
            }

            setPendingMoneyAction(null);
            await loadWorkspace();
            if (activityLoaded) {
                await loadActivityData({ silent: true, force: true });
            }
        } catch (error) {
            pushToast({
                type: "error",
                title: "Loan action failed",
                message: getApiErrorMessage(error)
            });
        } finally {
            setProcessing(false);
        }
    };

    const applicationColumns: Column<LoanApplication>[] = [
        {
            key: "member",
            header: "Borrower",
            render: (row) => (
                <Stack spacing={0.25}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {row.members?.full_name || "Unknown member"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {row.loan_products?.name || "Product not resolved"}
                    </Typography>
                </Stack>
            )
        },
        {
            key: "amount",
            header: "Requested",
            render: (row) => formatCurrency(row.requested_amount)
        },
        {
            key: "recommendation",
            header: "Appraisal",
            render: (row) => row.recommended_amount ? formatCurrency(row.recommended_amount) : "Pending"
        },
        {
            key: "status",
            header: "Status",
            render: (row) => {
                const color =
                    row.status === "approved" || row.status === "disbursed"
                        ? "success"
                        : row.status === "rejected"
                            ? "error"
                            : row.status === "appraised"
                                ? "default"
                                : "warning";
                const label = row.status === "approved" && row.approval_count < row.required_approval_count
                    ? `awaiting ${row.required_approval_count - row.approval_count} approval(s)`
                    : row.status;

                return (
                    <Chip
                        size="small"
                        color={color}
                        variant={row.status === "rejected" ? "outlined" : "filled"}
                        label={label}
                        sx={row.status === "appraised" ? darkAccentChipSx : undefined}
                    />
                );
            }
        },
        {
            key: "approvals",
            header: "Approvals",
            render: (row) => `${row.approval_count}/${row.required_approval_count}`
        },
        {
            key: "actions",
            header: "Actions",
            render: (row) => (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Button
                        size="small"
                        variant="outlined"
                        color="inherit"
                        startIcon={<VisibilityRoundedIcon />}
                        onClick={() => setReviewTarget(row)}
                        sx={darkAccentOutlinedSx}
                    >
                        View Details
                    </Button>
                    {(row.status === "draft" || row.status === "rejected") && canCreateApplications ? (
                        <Button size="small" variant="outlined" color="inherit" onClick={() => void submitDraftApplication(row)} sx={darkAccentOutlinedSx}>
                            Submit
                        </Button>
                    ) : null}
                    {row.status === "submitted" && canAppraise ? (
                        <Button size="small" variant="outlined" color="inherit" onClick={() => openAppraisalDialog(row)} sx={darkAccentOutlinedSx}>
                            Appraise
                        </Button>
                    ) : null}
                    {(row.status === "appraised" || (row.status === "approved" && row.approval_count < row.required_approval_count)) && canApprove ? (
                        <>
                            <Button
                                size="small"
                                variant="contained"
                                onClick={() => {
                                    setApprovalTarget(row);
                                    approveForm.reset({ notes: "" });
                                }}
                                sx={darkAccentContainedSx}
                            >
                                Approve
                            </Button>
                            <Button
                                size="small"
                                variant="outlined"
                                color="inherit"
                                onClick={() => {
                                    setRejectionTarget(row);
                                    rejectForm.reset({ reason: "", notes: "" });
                                }}
                                sx={darkAccentOutlinedSx}
                            >
                                Reject
                            </Button>
                        </>
                    ) : null}
                    {row.status === "approved" && !row.loan_id && canDisburse ? (
                        <Button
                            size="small"
                            variant="contained"
                            color="success"
                            onClick={() => {
                                setDisbursementTarget(row);
                                disburseForm.reset({
                                    reference: row.external_reference || "",
                                    description: row.purpose || ""
                                });
                            }}
                        >
                            Disburse
                        </Button>
                    ) : null}
                </Stack>
            )
        }
    ];

    const loanColumns: Column<Loan>[] = [
        {
            key: "loan",
            header: "Loan",
            render: (row) => {
                const member = members.find((entry) => entry.id === row.member_id);

                return (
                    <Stack spacing={0.25}>
                        <Button
                            variant="text"
                            color="inherit"
                            onClick={() => navigate(`/loans/${row.id}`)}
                            sx={{ p: 0, minWidth: 0, justifyContent: "flex-start", fontWeight: 700 }}
                        >
                            {row.loan_number}
                        </Button>
                        <Typography variant="caption" color="text.secondary">
                            {member?.full_name || "Unknown member"}
                        </Typography>
                    </Stack>
                );
            }
        },
        {
            key: "status",
            header: "Status",
            render: (row) => (
                <Chip
                    size="small"
                    label={row.status}
                    color={row.status === "active" ? "success" : row.status === "in_arrears" ? "warning" : "default"}
                    variant={row.status === "active" ? "filled" : "outlined"}
                />
            )
        },
        { key: "principal", header: "Outstanding", render: (row) => formatCurrency(row.outstanding_principal) },
        { key: "interest", header: "Accrued Interest", render: (row) => formatCurrency(row.accrued_interest) },
        { key: "frequency", header: "Frequency", render: (row) => row.repayment_frequency },
        { key: "nextDue", header: "Next Due", render: (row) => formatDate(nextDueByLoan.get(row.id) || null) }
    ];

    const transactionColumns: Column<LoanTransaction>[] = [
        {
            key: "created",
            header: "Date",
            render: (row) => (
                <Stack spacing={0.2}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {formatDate(row.created_at)}
                    </Typography>
                </Stack>
            )
        },
        {
            key: "loan",
            header: "Loan",
            render: (row) => {
                const loan = loans.find((entry) => entry.id === row.loan_id);
                const borrower = loan ? members.find((entry) => entry.id === loan.member_id)?.full_name : null;

                return (
                    <Stack spacing={0.2}>
                        <Button
                            variant="text"
                            color="inherit"
                            onClick={() => navigate(`/loans/${row.loan_id}`)}
                            sx={{ p: 0, minWidth: 0, justifyContent: "flex-start", fontWeight: 700, textTransform: "none" }}
                        >
                            {loan?.loan_number || row.loan_id}
                        </Button>
                        <Typography variant="caption" color="text.secondary">
                            {borrower || "Unknown member"}
                        </Typography>
                    </Stack>
                );
            }
        },
        {
            key: "type",
            header: "Type",
            render: (row) => (
                <Chip
                    size="small"
                    label={formatLoanTransactionType(row.transaction_type)}
                    color={row.transaction_type === "loan_repayment" ? "success" : row.transaction_type === "loan_disbursement" ? "warning" : "default"}
                    variant={row.transaction_type === "interest_accrual" ? "outlined" : "filled"}
                    sx={row.transaction_type === "interest_accrual" ? darkAccentChipSx : undefined}
                />
            )
        },
        {
            key: "amount",
            header: "Amount",
            render: (row) => (
                <Typography
                    variant="body2"
                    sx={{
                        fontWeight: 700,
                        color: row.transaction_type === "loan_repayment"
                            ? "success.main"
                            : row.transaction_type === "loan_disbursement"
                                ? "warning.main"
                                : "text.primary"
                    }}
                >
                    {formatCurrency(row.amount)}
                </Typography>
            )
        },
        {
            key: "components",
            header: "Components",
            render: (row) => (
                <Stack spacing={0.1}>
                    <Typography variant="caption" color="text.secondary">
                        Principal {formatCurrency(row.principal_component)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        Interest {formatCurrency(row.interest_component)}
                    </Typography>
                </Stack>
            )
        },
        {
            key: "reference",
            header: "Reference",
            render: (row) => row.reference ? (
                <Chip size="small" variant="outlined" label={row.reference} sx={darkAccentChipSx} />
            ) : (
                <Typography variant="caption" color="text.secondary">N/A</Typography>
            )
        }
    ];

    const pendingRepaymentLoan =
        pendingMoneyAction?.type === "repay"
            ? loans.find((loan) => loan.id === pendingMoneyAction.values.loan_id)
            : null;
    const pendingRepaymentAmount =
        pendingMoneyAction?.type === "repay" ? pendingMoneyAction.values.amount : 0;
    const netOperationalFlow = activitySummary.repaymentVolume - activitySummary.disbursementVolume;
    const topMovementLoan = activitySummary.topLoans[0] || null;
    const topMovementShare = activitySummary.totalMovementVolume && topMovementLoan
        ? (topMovementLoan.totalAmount / activitySummary.totalMovementVolume) * 100
        : 0;
    const openCreateApplicationModal = () => {
        setShowCreateModal(true);
        void loadReferenceData({ silent: true });
    };
    const openRepaymentModal = () => {
        setShowRepayModal(true);
        void loadReferenceData({ silent: true });
    };

    return (
        <Stack spacing={3}>
            {role === "loan_officer" ? (
                <MotionCard
                    variant="outlined"
                    sx={{
                        borderRadius: 2,
                        color: "text.primary",
                        background: theme.palette.mode === "dark"
                            ? `linear-gradient(135deg, ${alpha("#1B2535", 0.92)}, ${alpha("#D9B273", 0.16)})`
                            : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)}, ${alpha(theme.palette.background.paper, 0.97)})`
                    }}
                >
                    <CardContent sx={{ p: { xs: 2.25, md: 2.75 } }}>
                        <Stack spacing={2}>
                            <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5}>
                                <Box>
                                    <Typography variant="overline" color="text.secondary">
                                        Loan officer workspace
                                    </Typography>
                                    <Typography variant="h5" sx={{ mt: 0.5 }}>
                                        Appraise pipeline, disburse responsibly, and protect collections
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 760 }}>
                                        Run your full lending cycle from intake through collections with clear risk cues, prioritized follow-up, and fast operational actions.
                                    </Typography>
                                </Box>
                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="flex-start">
                                    <Chip
                                        label={`Arrears ratio ${arrearsRate.toFixed(1)}%`}
                                        color={arrearsRate >= 15 ? "error" : arrearsRate >= 8 ? "warning" : "success"}
                                        variant="outlined"
                                    />
                                    <Chip
                                        label={`${overdueScheduleCount} overdue schedule(s)`}
                                        color={overdueScheduleCount > 0 ? "warning" : "success"}
                                        variant="outlined"
                                    />
                                </Stack>
                            </Stack>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap flexWrap="wrap">
                                {canCreateApplications ? (
                                    <Button
                                        variant="contained"
                                        startIcon={<AssignmentTurnedInRoundedIcon />}
                                        onClick={openCreateApplicationModal}
                                        disabled={subscriptionInactive}
                                        sx={darkAccentContainedSx}
                                    >
                                        New Loan Application
                                    </Button>
                                ) : null}
                                {canRepay ? (
                                    <Button
                                        variant="outlined"
                                        startIcon={<PaymentsRoundedIcon />}
                                        onClick={openRepaymentModal}
                                        disabled={subscriptionInactive}
                                        sx={darkAccentOutlinedSx}
                                    >
                                        Post Repayment
                                    </Button>
                                ) : null}
                                <Button
                                    variant="outlined"
                                    startIcon={<PendingActionsRoundedIcon />}
                                    onClick={() => navigate("/follow-ups")}
                                    sx={darkAccentOutlinedSx}
                                >
                                    Open Collections Queue
                                </Button>
                            </Stack>
                        </Stack>
                    </CardContent>
                </MotionCard>
            ) : (
                <MotionCard
                    variant="outlined"
                    sx={{
                        background: theme.palette.mode === "dark"
                            ? `linear-gradient(135deg, ${alpha("#1B2535", 0.92)}, ${alpha("#D9B273", 0.16)})`
                            : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)}, ${alpha(theme.palette.background.paper, 0.92)})`
                    }}
                >
                    <CardContent>
                        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2.5}>
                            <Box>
                                <Typography variant="h5">Loan Workflow</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 760 }}>
                                    Origination now runs through application, appraisal, approval, and controlled disbursement. The loan disbursement procedure remains the final posting step and cannot run until the workflow reaches approved status.
                                </Typography>
                            </Box>
                            <Stack
                                direction="row"
                                spacing={1}
                                sx={{
                                    width: { xs: "100%", md: "auto" },
                                    justifyContent: { xs: "flex-start", md: "flex-end" },
                                    alignItems: "center",
                                    flexWrap: "nowrap"
                                }}
                            >
                                {canCreateApplications ? (
                                    <Button
                                        variant="contained"
                                        startIcon={<AssignmentTurnedInRoundedIcon />}
                                        onClick={openCreateApplicationModal}
                                        disabled={subscriptionInactive}
                                        sx={{
                                            flex: { xs: 1, sm: "0 0 auto" },
                                            minWidth: { sm: 220 },
                                            borderRadius: 1.5,
                                            fontWeight: 700,
                                            ...(darkAccentContainedSx || {})
                                        }}
                                    >
                                        New Loan Application
                                    </Button>
                                ) : null}
                                {canRepay ? (
                                    <Button
                                        variant="outlined"
                                        color="inherit"
                                        startIcon={<PaymentsRoundedIcon />}
                                        onClick={openRepaymentModal}
                                        disabled={subscriptionInactive}
                                        sx={{
                                            flex: { xs: 1, sm: "0 0 auto" },
                                            minWidth: { sm: 220 },
                                            borderRadius: 1.5,
                                            fontWeight: 700
                                        }}
                                    >
                                        Loan Repayment
                                    </Button>
                                ) : null}
                            </Stack>
                        </Stack>
                    </CardContent>
                </MotionCard>
            )}

            {subscriptionInactive ? (
                <Alert severity="warning" variant="outlined">
                    Loan actions are blocked while the tenant subscription is inactive.
                </Alert>
            ) : null}

            {role === "loan_officer" ? (
                <Stack spacing={2}>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                            <ProfessionalStatCard
                                label="Awaiting Appraisal"
                                value={String(metrics.awaitingAppraisal)}
                                helper="Submitted applications waiting for your recommendation."
                                status={metrics.awaitingAppraisal > 0 ? "Needs review" : "Queue clear"}
                                tone={metrics.awaitingAppraisal > 0 ? "neutral" : "positive"}
                                icon={<PendingActionsRoundedIcon fontSize="small" />}
                                featured
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                            <ProfessionalStatCard
                                label="Awaiting Approval"
                                value={String(metrics.awaitingApproval)}
                                helper="Appraised facilities pending branch-level approval decision."
                                status={metrics.awaitingApproval > 0 ? "In approval flow" : "No pending approvals"}
                                tone={metrics.awaitingApproval > 0 ? "neutral" : "positive"}
                                icon={<ApprovalRoundedIcon fontSize="small" />}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                            <ProfessionalStatCard
                                label="Ready to Disburse"
                                value={String(metrics.readyToDisburse)}
                                helper="Approved applications waiting final disbursement posting."
                                status={metrics.readyToDisburse > 0 ? "Execution required" : "No disbursement backlog"}
                                tone={metrics.readyToDisburse > 0 ? "neutral" : "positive"}
                                icon={<PlaylistAddCheckRoundedIcon fontSize="small" />}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                            <ProfessionalStatCard
                                label="Outstanding Principal"
                                value={formatCurrency(metrics.outstandingPrincipal)}
                                helper={`${metrics.activeLoans} active loans under your current supervision.`}
                                status={`${metrics.arrearsLoans} in arrears`}
                                tone={metrics.arrearsLoans > 0 ? "negative" : "positive"}
                                icon={<AccountBalanceRoundedIcon fontSize="small" />}
                            />
                        </Grid>
                    </Grid>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                            <MetricCard
                                title="Arrears Ratio"
                                value={`${arrearsRate.toFixed(1)}%`}
                                helper="Share of the current portfolio already in arrears."
                                icon={<CreditScoreRoundedIcon fontSize="small" />}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                            <MetricCard
                                title="Overdue Exposure"
                                value={formatCurrency(overdueExposure)}
                                helper={`${overdueScheduleCount} overdue schedule(s) requiring collection follow-up.`}
                                icon={<PendingActionsRoundedIcon fontSize="small" />}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                            <MetricCard
                                title="Due in 7 Days"
                                value={String(dueWithin7DaysCount)}
                                helper="Installments due this week that should be pre-emptively engaged."
                                icon={<AssignmentTurnedInRoundedIcon fontSize="small" />}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                            <MetricCard
                                title="Loans in Arrears"
                                value={String(metrics.arrearsLoans)}
                                helper="Accounts already in arrears and requiring close monitoring."
                                icon={<AccountBalanceRoundedIcon fontSize="small" />}
                            />
                        </Grid>
                    </Grid>
                </Stack>
            ) : (
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                        <MetricCard
                            title="Awaiting Appraisal"
                            value={String(metrics.awaitingAppraisal)}
                            helper="Submitted applications waiting for loan officer review."
                            icon={<PendingActionsRoundedIcon fontSize="small" />}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                        <MetricCard
                            title="Awaiting Approval"
                            value={String(metrics.awaitingApproval)}
                            helper="Appraised applications pending branch approval."
                            icon={<ApprovalRoundedIcon fontSize="small" />}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                        <MetricCard
                            title="Ready to Disburse"
                            value={String(metrics.readyToDisburse)}
                            helper="Approved applications waiting for teller or loan officer execution."
                            icon={<PlaylistAddCheckRoundedIcon fontSize="small" />}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                        <MetricCard
                            title="Outstanding Principal"
                            value={formatCurrency(metrics.outstandingPrincipal)}
                            helper={`${metrics.activeLoans} active loans · ${metrics.arrearsLoans} in arrears`}
                            icon={<AccountBalanceRoundedIcon fontSize="small" />}
                        />
                    </Grid>
                </Grid>
            )}

            <MotionCard variant="outlined">
                <CardContent sx={{ pb: 1 }}>
                    <Tabs
                        value={activeTab}
                        onChange={(_, value: LoanWorkspaceTab) => setActiveTab(value)}
                        variant="scrollable"
                        allowScrollButtonsMobile
                        sx={theme.palette.mode === "dark"
                            ? {
                                "& .MuiTabs-indicator": { backgroundColor: dashboardAccent },
                                "& .MuiTab-root.Mui-selected": { color: dashboardAccent }
                            }
                            : undefined}
                    >
                        {workspaceTabs.map((tab) => (
                            <Tab
                                key={tab.value}
                                value={tab.value}
                                sx={{ textTransform: "none", minHeight: 46 }}
                                label={(
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <span>{tab.label}</span>
                                        <Chip label={tab.count} size="small" variant="outlined" sx={darkAccentChipSx} />
                                    </Stack>
                                )}
                            />
                        ))}
                    </Tabs>
                </CardContent>
            </MotionCard>

            {activeTab === "applications" ? (
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, lg: 8 }}>
                        <MotionCard variant="outlined">
                            <CardContent>
                                <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
                                    <Box>
                                        <Typography variant="h6">Loan Applications</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Review every step before the final disbursement posting occurs.
                                        </Typography>
                                    </Box>
                                    <Chip
                                        label={`${applicationTotal} application(s)`}
                                        color="primary"
                                        variant="outlined"
                                        sx={darkAccentChipSx}
                                    />
                                </Stack>
                                <DataTable rows={paginatedApplications} columns={applicationColumns} emptyMessage={loading ? "Loading applications..." : "No loan applications found."} />
                                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        Showing {applicationTotal ? (applicationPage - 1) * pageSize + 1 : 0}-{Math.min(applicationPage * pageSize, applicationTotal)} of {applicationTotal}
                                    </Typography>
                                    <Pagination
                                        page={applicationPage}
                                        count={applicationTotalPages}
                                        onChange={(_, value) => setApplicationPage(value)}
                                        color="primary"
                                        sx={darkAccentPaginationSx}
                                    />
                                </Stack>
                            </CardContent>
                        </MotionCard>
                    </Grid>
                    <Grid size={{ xs: 12, lg: 4 }}>
                        <MotionCard variant="outlined" sx={{ height: "100%" }}>
                            <CardContent>
                                {role === "loan_officer" ? (
                                    <Stack spacing={2}>
                                        <Box>
                                            <Typography variant="h6">Officer Action Queue</Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                Keep pipeline, disbursement, and collections actions visible in one place.
                                            </Typography>
                                        </Box>
                                        <Stack spacing={1.1}>
                                            {loanOfficerQueue.map((item) => (
                                                <Button
                                                    key={item.id}
                                                    fullWidth
                                                    variant="outlined"
                                                    color="inherit"
                                                    onClick={() => navigate(item.route)}
                                                    sx={{ justifyContent: "space-between", textTransform: "none", borderStyle: "dashed" }}
                                                >
                                                    <Stack spacing={0.25} sx={{ textAlign: "left", flex: 1 }}>
                                                        <Typography variant="subtitle2">{item.label}</Typography>
                                                        <Typography variant="caption" color="text.secondary">{item.helper}</Typography>
                                                    </Stack>
                                                    <Chip
                                                        label={String(item.count)}
                                                        size="small"
                                                        color={item.tone === "error" ? "error" : item.tone === "warning" ? "warning" : "success"}
                                                    />
                                                </Button>
                                            ))}
                                        </Stack>
                                    </Stack>
                                ) : (
                                    <>
                                        <Typography variant="h6">Workflow Guardrails</Typography>
                                        <Stack spacing={1.5} sx={{ mt: 2 }}>
                                        <Alert severity="info" variant="outlined" sx={darkAccentInfoAlertSx}>
                                            Members and staff originate applications. Drafts or rejected applications must be submitted before they can be appraised.
                                        </Alert>
                                            <Alert severity="warning" variant="outlined">
                                                Loan officers appraise. Branch managers approve. The maker cannot approve the same application.
                                            </Alert>
                                            <Alert severity="success" variant="outlined">
                                                Teller or loan officer disbursement is the only step that triggers the double-entry loan posting procedure.
                                            </Alert>
                                        </Stack>
                                    </>
                                )}
                            </CardContent>
                        </MotionCard>
                    </Grid>
                </Grid>
            ) : null}

            {activeTab === "portfolio" ? (
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, lg: 8 }}>
                        <MotionCard variant="outlined">
                            <CardContent>
                                <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
                                    <Box>
                                        <Typography variant="h6">Loan Portfolio</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Disbursed loans remain visible here with their repayment position and next due date.
                                        </Typography>
                                    </Box>
                                    <Chip label={`${loanTotal} disbursed loan(s)`} variant="outlined" />
                                </Stack>
                                <DataTable rows={paginatedLoans} columns={loanColumns} emptyMessage={loading ? "Loading loan portfolio..." : "No disbursed loans found."} />
                                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        Showing {loanTotal ? (loanPage - 1) * pageSize + 1 : 0}-{Math.min(loanPage * pageSize, loanTotal)} of {loanTotal}
                                    </Typography>
                                    <Pagination
                                        page={loanPage}
                                        count={loanTotalPages}
                                        onChange={(_, value) => setLoanPage(value)}
                                        color="primary"
                                        sx={darkAccentPaginationSx}
                                    />
                                </Stack>
                            </CardContent>
                        </MotionCard>
                    </Grid>
                    <Grid size={{ xs: 12, lg: 4 }}>
                        <MotionCard variant="outlined" sx={{ height: "100%" }}>
                            <CardContent>
                                {role === "loan_officer" ? (
                                    <Stack spacing={2}>
                                        <Box>
                                            <Typography variant="h6">Portfolio Health Snapshot</Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                At-a-glance repayment pressure indicators for your current book.
                                            </Typography>
                                        </Box>
                                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                            <Chip label={`${metrics.activeLoans} active`} color="success" variant="outlined" />
                                            <Chip label={`${metrics.arrearsLoans} in arrears`} color={metrics.arrearsLoans > 0 ? "warning" : "success"} variant="outlined" />
                                            <Chip label={`${dueWithin7DaysCount} due this week`} color={dueWithin7DaysCount > 0 ? "warning" : "success"} variant="outlined" />
                                        </Stack>
                                        <Divider />
                                        <Stack spacing={1.1}>
                                            <Stack direction="row" justifyContent="space-between">
                                                <Typography variant="body2" color="text.secondary">Outstanding principal</Typography>
                                                <Typography variant="subtitle2">{formatCurrency(metrics.outstandingPrincipal)}</Typography>
                                            </Stack>
                                            <Stack direction="row" justifyContent="space-between">
                                                <Typography variant="body2" color="text.secondary">Overdue exposure</Typography>
                                                <Typography variant="subtitle2">{formatCurrency(overdueExposure)}</Typography>
                                            </Stack>
                                            <Stack direction="row" justifyContent="space-between">
                                                <Typography variant="body2" color="text.secondary">Arrears ratio</Typography>
                                                <Typography variant="subtitle2">{arrearsRate.toFixed(1)}%</Typography>
                                            </Stack>
                                        </Stack>
                                        <Button
                                            variant="contained"
                                            onClick={() => setActiveTab("collections")}
                                            sx={darkAccentContainedSx}
                                        >
                                            Open Collections Tab
                                        </Button>
                                    </Stack>
                                ) : (
                                    <>
                                        <Typography variant="h6">Loan Activity</Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, mb: 2 }}>
                                            Repayments, disbursements, and interest accrual remain traceable after origination.
                                        </Typography>
                                        <DataTable
                                            rows={orderedTransactions.slice(0, 8)}
                                            columns={transactionColumns}
                                            emptyMessage={activityLoading ? "Loading activity..." : "No loan activity found."}
                                        />
                                    </>
                                )}
                            </CardContent>
                        </MotionCard>
                    </Grid>
                </Grid>
            ) : null}

            {activeTab === "collections" && role === "loan_officer" ? (
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, lg: 8 }}>
                        <MotionCard variant="outlined" sx={{ height: "100%" }}>
                            <CardContent sx={{ height: "100%" }}>
                                <Stack spacing={2}>
                                    <Box>
                                        <Typography variant="h6">Collections Priority Board</Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                            Highest-risk installment items to follow up immediately.
                                        </Typography>
                                    </Box>
                                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                        <Chip
                                            label={`${overdueScheduleCount} overdue`}
                                            color={overdueScheduleCount > 0 ? "error" : "success"}
                                            variant="outlined"
                                        />
                                        <Chip
                                            label={`${dueWithin7DaysCount} due this week`}
                                            color={dueWithin7DaysCount > 0 ? "warning" : "success"}
                                            variant="outlined"
                                        />
                                        <Chip
                                            label={`${formatCurrency(overdueExposure)} exposed`}
                                            color="primary"
                                            variant="outlined"
                                            sx={darkAccentChipSx}
                                        />
                                    </Stack>
                                    <Divider />
                                    {loanOfficerPriorityItems.length ? (
                                        <Stack spacing={1.1}>
                                            {loanOfficerPriorityItems.map((item) => (
                                                <Button
                                                    key={item.id}
                                                    fullWidth
                                                    variant="text"
                                                    color="inherit"
                                                    onClick={() => navigate(`/loans/${item.loanId}`)}
                                                    sx={{ justifyContent: "space-between", textTransform: "none", px: 0, py: 0.75 }}
                                                >
                                                    <Stack spacing={0.15} sx={{ textAlign: "left", flex: 1 }}>
                                                        <Typography variant="subtitle2">{item.loanNumber} · {item.borrower}</Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Due {formatDate(item.dueDate)} · {formatCurrency(item.amount)}
                                                        </Typography>
                                                    </Stack>
                                                    <Chip
                                                        size="small"
                                                        label={item.status}
                                                        color={item.status === "overdue" ? "error" : item.status === "partial" ? "warning" : "success"}
                                                        variant={item.status === "pending" ? "outlined" : "filled"}
                                                    />
                                                </Button>
                                            ))}
                                        </Stack>
                                    ) : (
                                        <Alert severity="success" variant="outlined">
                                            No pending or overdue schedules currently require follow-up.
                                        </Alert>
                                    )}
                                </Stack>
                            </CardContent>
                        </MotionCard>
                    </Grid>
                    <Grid size={{ xs: 12, lg: 4 }}>
                        <MotionCard variant="outlined" sx={{ height: "100%" }}>
                            <CardContent>
                                <Stack spacing={2}>
                                    <Box>
                                        <Typography variant="h6">Collections Actions</Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                            Move quickly between follow-up, portfolio, and repayment operations.
                                        </Typography>
                                    </Box>
                                    <Button
                                        variant="contained"
                                        startIcon={<PendingActionsRoundedIcon />}
                                        onClick={() => navigate("/follow-ups")}
                                        sx={darkAccentContainedSx}
                                    >
                                        Open Follow-ups
                                    </Button>
                                    <Button variant="outlined" onClick={() => setActiveTab("portfolio")} sx={darkAccentOutlinedSx}>
                                        Back to Portfolio Tab
                                    </Button>
                                    <Divider />
                                    <Stack spacing={1.1}>
                                        {loanOfficerQueue.map((item) => (
                                            <Stack key={item.id} direction="row" justifyContent="space-between" alignItems="center">
                                                <Typography variant="body2" color="text.secondary">{item.label}</Typography>
                                                <Chip
                                                    label={String(item.count)}
                                                    size="small"
                                                    color={item.tone === "error" ? "error" : item.tone === "warning" ? "warning" : "success"}
                                                />
                                            </Stack>
                                        ))}
                                    </Stack>
                                </Stack>
                            </CardContent>
                        </MotionCard>
                    </Grid>
                </Grid>
            ) : null}

            {activeTab === "activity" ? (
                <Stack spacing={2}>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                            <MetricCard
                                title="Repayment Volume"
                                value={formatCurrency(activitySummary.repaymentVolume)}
                                helper={`${activitySummary.repaymentCount} repayment transaction(s) posted.`}
                                icon={<PaymentsRoundedIcon fontSize="small" />}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                            <MetricCard
                                title="Disbursement Volume"
                                value={formatCurrency(activitySummary.disbursementVolume)}
                                helper={`${activitySummary.disbursementCount} disbursement posting(s) recorded.`}
                                icon={<AccountBalanceRoundedIcon fontSize="small" />}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                            <MetricCard
                                title="Interest Accrued"
                                value={formatCurrency(activitySummary.accrualVolume)}
                                helper={`${activitySummary.accrualCount} accrual event(s) in current view.`}
                                icon={<CreditScoreRoundedIcon fontSize="small" />}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
                            <MetricCard
                                title="Avg Repayment Ticket"
                                value={formatCurrency(activitySummary.repaymentAverageTicket)}
                                helper={activitySummary.latestActivityAt ? `Latest activity ${formatDate(activitySummary.latestActivityAt)}.` : "No latest activity yet."}
                                icon={<PendingActionsRoundedIcon fontSize="small" />}
                            />
                        </Grid>
                    </Grid>

                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, lg: 8 }}>
                            <MotionCard variant="outlined">
                                <CardContent>
                                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
                                        <Box>
                                            <Typography variant="h6">Loan Activity Ledger</Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                Chronological transaction ledger for repayments, disbursements, and accrual postings.
                                            </Typography>
                                        </Box>
                                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                            <Chip label={`${orderedTransactions.length} transaction(s)`} variant="outlined" sx={darkAccentChipSx} />
                                            <Chip label={`${activitySummary.repaymentCount} repayments`} color="success" variant="outlined" />
                                            <Chip label={`${activitySummary.disbursementCount} disbursements`} color="warning" variant="outlined" />
                                        </Stack>
                                    </Stack>
                                    <DataTable
                                        rows={orderedTransactions}
                                        columns={transactionColumns}
                                        emptyMessage={activityLoading ? "Loading activity..." : "No loan activity found."}
                                    />
                                </CardContent>
                            </MotionCard>
                        </Grid>
                        <Grid size={{ xs: 12, lg: 4 }}>
                            <MotionCard variant="outlined" sx={{ height: "100%" }}>
                                <CardContent>
                                    <Stack spacing={2}>
                                        <Box>
                                            <Typography variant="h6">Activity Intelligence</Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                Highlights where movement is concentrated and what needs immediate portfolio review.
                                            </Typography>
                                        </Box>
                                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                            <Chip label={`Net flow ${formatCurrency(netOperationalFlow)}`} color={netOperationalFlow >= 0 ? "success" : "warning"} variant="outlined" />
                                            <Chip label={`Top concentration ${topMovementShare.toFixed(1)}%`} variant="outlined" sx={darkAccentChipSx} />
                                        </Stack>
                                        <Grid container spacing={1.25}>
                                            <Grid size={{ xs: 12, sm: 6, lg: 12 }}>
                                                <Box
                                                    sx={{
                                                        p: 1.4,
                                                        borderRadius: 2,
                                                        border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                                                        bgcolor: theme.palette.mode === "dark" ? alpha(dashboardAccent, 0.08) : alpha(theme.palette.primary.main, 0.04)
                                                    }}
                                                >
                                                    <Typography variant="overline" color="text.secondary">Most Active Loan</Typography>
                                                    <Typography variant="subtitle2" sx={{ mt: 0.45 }}>
                                                        {topMovementLoan ? topMovementLoan.loanNumber : "N/A"}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {topMovementLoan ? `${topMovementLoan.borrower} · ${formatCurrency(topMovementLoan.totalAmount)}` : "No transaction movement recorded yet."}
                                                    </Typography>
                                                </Box>
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 6, lg: 12 }}>
                                                <Box
                                                    sx={{
                                                        p: 1.4,
                                                        borderRadius: 2,
                                                        border: `1px solid ${alpha(theme.palette.divider, 0.9)}`
                                                    }}
                                                >
                                                    <Typography variant="overline" color="text.secondary">Review Focus</Typography>
                                                    <Typography variant="subtitle2" sx={{ mt: 0.45 }}>
                                                        {activitySummary.topLoans.length >= 3 ? "High transaction concentration" : "Moderate activity spread"}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {activitySummary.topLoans.length >= 3
                                                            ? "Prioritize top 3 loans for reference and posting accuracy checks."
                                                            : "Movement is distributed; continue standard posting controls."}
                                                    </Typography>
                                                </Box>
                                            </Grid>
                                        </Grid>
                                        <Stack spacing={1.1}>
                                            {activitySummary.topLoans.length ? (
                                                activitySummary.topLoans.map((entry, index) => {
                                                    const share = activitySummary.totalMovementVolume
                                                        ? (entry.totalAmount / activitySummary.totalMovementVolume) * 100
                                                        : 0;

                                                    return (
                                                        <Button
                                                            key={entry.loanId}
                                                            fullWidth
                                                            variant="text"
                                                            color="inherit"
                                                            onClick={() => navigate(`/loans/${entry.loanId}`)}
                                                            sx={{
                                                                justifyContent: "space-between",
                                                                textTransform: "none",
                                                                p: 1.2,
                                                                border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                                                                borderRadius: 2,
                                                                bgcolor: theme.palette.mode === "dark" ? alpha(dashboardAccent, 0.06) : alpha(theme.palette.primary.main, 0.025)
                                                            }}
                                                        >
                                                            <Stack spacing={0.45} sx={{ textAlign: "left", flex: 1 }}>
                                                                <Stack direction="row" spacing={1} alignItems="center">
                                                                    <Chip
                                                                        label={`#${index + 1}`}
                                                                        size="small"
                                                                        variant="outlined"
                                                                        sx={darkAccentChipSx}
                                                                    />
                                                                    <Typography variant="subtitle2">{entry.loanNumber}</Typography>
                                                                </Stack>
                                                                <Typography variant="caption" color="text.secondary">{entry.borrower}</Typography>
                                                                <Box sx={{ width: "100%", height: 6, borderRadius: 999, bgcolor: alpha(theme.palette.text.primary, 0.1), overflow: "hidden" }}>
                                                                    <Box
                                                                        sx={{
                                                                            width: `${Math.max(Math.min(share, 100), 4)}%`,
                                                                            height: "100%",
                                                                            bgcolor: theme.palette.mode === "dark" ? dashboardAccent : theme.palette.primary.main
                                                                        }}
                                                                    />
                                                                </Box>
                                                            </Stack>
                                                            <Stack spacing={0.1} alignItems="flex-end">
                                                                <Typography variant="subtitle2">{formatCurrency(entry.totalAmount)}</Typography>
                                                                <Typography variant="caption" color="text.secondary">{share.toFixed(1)}%</Typography>
                                                            </Stack>
                                                        </Button>
                                                    );
                                                })
                                            ) : (
                                                <Alert severity="info" variant="outlined" sx={darkAccentInfoAlertSx}>
                                                    No transactions available yet to compute activity intelligence.
                                                </Alert>
                                            )}
                                        </Stack>
                                        <Divider />
                                        <Stack direction={{ xs: "column", sm: "row", lg: "column" }} spacing={1}>
                                            <Button variant="contained" onClick={() => setActiveTab("portfolio")} sx={darkAccentContainedSx}>
                                                Open Portfolio Tab
                                            </Button>
                                            <Button variant="outlined" onClick={() => navigate("/follow-ups")} sx={darkAccentOutlinedSx}>
                                                Open Follow-ups
                                            </Button>
                                        </Stack>
                                    </Stack>
                                </CardContent>
                            </MotionCard>
                        </Grid>
                    </Grid>
                </Stack>
            ) : null}

            <MotionModal open={showCreateModal} onClose={processing ? undefined : () => setShowCreateModal(false)} maxWidth="md" fullWidth>
                <DialogTitle>Create Loan Application</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2} sx={{ pt: 0.5 }}>
                        <Alert severity="info" variant="outlined" sx={darkAccentInfoAlertSx}>
                            This step originates the request only. No accounting entry is posted until an approved application is disbursed.
                        </Alert>
                        <Box component="form" id="loan-application-form" onSubmit={createApplication} sx={{ display: "grid", gap: 2 }}>
                            <Box>
                                <Typography variant="body2" fontWeight={600} sx={{ mb: 0.75 }}>
                                    Member
                                </Typography>
                                <SearchableSelect
                                    value={createForm.watch("member_id")}
                                    options={memberOptions}
                                    onChange={(value) => createForm.setValue("member_id", value, { shouldValidate: true })}
                                    placeholder="Search borrower..."
                                />
                                {createForm.formState.errors.member_id ? (
                                    <Typography variant="caption" color="error.main">
                                        {createForm.formState.errors.member_id.message}
                                    </Typography>
                                ) : null}
                            </Box>
                            <Box>
                                <Typography variant="body2" fontWeight={600} sx={{ mb: 0.75 }}>
                                    Loan Product
                                </Typography>
                                <SearchableSelect
                                    value={createForm.watch("product_id")}
                                    options={productOptions}
                                    onChange={(value) => createForm.setValue("product_id", value, { shouldValidate: true })}
                                    placeholder="Search loan product..."
                                />
                                {createForm.formState.errors.product_id ? (
                                    <Typography variant="caption" color="error.main">
                                        {createForm.formState.errors.product_id.message}
                                    </Typography>
                                ) : null}
                            </Box>
                            <TextField
                                label="Purpose"
                                fullWidth
                                multiline
                                minRows={3}
                                {...createForm.register("purpose")}
                                error={Boolean(createForm.formState.errors.purpose)}
                                helperText={createForm.formState.errors.purpose?.message}
                            />
                            <Grid container spacing={2}>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <TextField
                                        label="Requested Amount"
                                        type="number"
                                        fullWidth
                                        {...createForm.register("requested_amount")}
                                        error={Boolean(createForm.formState.errors.requested_amount)}
                                        helperText={createForm.formState.errors.requested_amount?.message}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <TextField
                                        label="Requested Term"
                                        type="number"
                                        fullWidth
                                        {...createForm.register("requested_term_count")}
                                        error={Boolean(createForm.formState.errors.requested_term_count)}
                                        helperText={createForm.formState.errors.requested_term_count?.message}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <TextField
                                        label="Requested Interest %"
                                        type="number"
                                        fullWidth
                                        {...createForm.register("requested_interest_rate")}
                                        error={Boolean(createForm.formState.errors.requested_interest_rate)}
                                        helperText={createForm.formState.errors.requested_interest_rate?.message}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField
                                        select
                                        label="Repayment Frequency"
                                        fullWidth
                                        value={createForm.watch("requested_repayment_frequency")}
                                        onChange={(event) => createForm.setValue("requested_repayment_frequency", event.target.value as CreateApplicationValues["requested_repayment_frequency"], { shouldValidate: true })}
                                    >
                                        <MenuItem value="monthly">Monthly</MenuItem>
                                        <MenuItem value="weekly">Weekly</MenuItem>
                                        <MenuItem value="daily">Daily</MenuItem>
                                    </TextField>
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField label="External Reference" fullWidth {...createForm.register("external_reference")} />
                                </Grid>
                            </Grid>
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowCreateModal(false)}>Cancel</Button>
                    <Button variant="contained" type="submit" form="loan-application-form" disabled={processing || subscriptionInactive} sx={darkAccentContainedSx}>
                        {processing ? "Submitting..." : "Create & Submit"}
                    </Button>
                </DialogActions>
            </MotionModal>

            <MotionModal open={Boolean(reviewTarget)} onClose={() => setReviewTarget(null)} maxWidth="md" fullWidth>
                <DialogTitle>Loan Application Details</DialogTitle>
                <DialogContent dividers>
                    {reviewTarget ? (
                        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
                            <Grid container spacing={2}>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <Box sx={{ p: 2, borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
                                        <Typography variant="overline" color="text.secondary">Borrower</Typography>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                            {reviewTarget.members?.full_name || "Unknown member"}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                            {reviewTarget.members?.member_no || "No member number"}
                                        </Typography>
                                    </Box>
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <Box sx={{ p: 2, borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
                                        <Typography variant="overline" color="text.secondary">Product</Typography>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                            {reviewTarget.loan_products?.name || "Loan product"}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                            Status: {reviewTarget.status.replace(/_/g, " ")}
                                        </Typography>
                                    </Box>
                                </Grid>
                            </Grid>

                            <Grid container spacing={2}>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <TextField
                                        label="Requested Amount"
                                        value={formatCurrency(reviewTarget.requested_amount)}
                                        fullWidth
                                        InputProps={{ readOnly: true }}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <TextField
                                        label="Requested Term"
                                        value={`${reviewTarget.requested_term_count}`}
                                        fullWidth
                                        InputProps={{ readOnly: true }}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <TextField
                                        label="Requested Interest %"
                                        value={reviewTarget.requested_interest_rate ?? "N/A"}
                                        fullWidth
                                        InputProps={{ readOnly: true }}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField
                                        label="Repayment Frequency"
                                        value={reviewTarget.requested_repayment_frequency}
                                        fullWidth
                                        InputProps={{ readOnly: true }}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField
                                        label="Reference"
                                        value={reviewTarget.external_reference || "N/A"}
                                        fullWidth
                                        InputProps={{ readOnly: true }}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12 }}>
                                    <TextField
                                        label="Purpose"
                                        value={reviewTarget.purpose}
                                        fullWidth
                                        multiline
                                        minRows={3}
                                        InputProps={{ readOnly: true }}
                                    />
                                </Grid>
                            </Grid>

                            <Grid container spacing={2}>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <TextField
                                        label="Guarantors"
                                        value={reviewTarget.loan_guarantors?.length || 0}
                                        fullWidth
                                        InputProps={{ readOnly: true }}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <TextField
                                        label="Collateral Items"
                                        value={reviewTarget.collateral_items?.length || 0}
                                        fullWidth
                                        InputProps={{ readOnly: true }}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <TextField
                                        label="Approval Progress"
                                        value={`${reviewTarget.approval_count}/${reviewTarget.required_approval_count}`}
                                        fullWidth
                                        InputProps={{ readOnly: true }}
                                    />
                                </Grid>
                            </Grid>
                        </Stack>
                    ) : null}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setReviewTarget(null)}>Close</Button>
                    {reviewTarget?.status === "submitted" && canAppraise ? (
                        <Button
                            variant="contained"
                            onClick={() => {
                                openAppraisalDialog(reviewTarget);
                                setReviewTarget(null);
                            }}
                            sx={darkAccentContainedSx}
                        >
                            Appraise This Application
                        </Button>
                    ) : null}
                </DialogActions>
            </MotionModal>

            <MotionModal open={Boolean(appraisalTarget)} onClose={processing ? undefined : () => setAppraisalTarget(null)} maxWidth="md" fullWidth>
                <DialogTitle>Appraise Loan Application</DialogTitle>
                <DialogContent dividers>
                    <Box component="form" id="loan-appraisal-form" onSubmit={saveAppraisal} sx={{ display: "grid", gap: 2, pt: 0.5 }}>
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 12, md: 4 }}>
                                <TextField
                                    label="Recommended Amount"
                                    type="number"
                                    fullWidth
                                    {...appraiseForm.register("recommended_amount")}
                                    error={Boolean(appraiseForm.formState.errors.recommended_amount)}
                                    helperText={appraiseForm.formState.errors.recommended_amount?.message}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, md: 4 }}>
                                <TextField
                                    label="Recommended Term"
                                    type="number"
                                    fullWidth
                                    {...appraiseForm.register("recommended_term_count")}
                                    error={Boolean(appraiseForm.formState.errors.recommended_term_count)}
                                    helperText={appraiseForm.formState.errors.recommended_term_count?.message}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, md: 4 }}>
                                <TextField
                                    label="Recommended Interest %"
                                    type="number"
                                    fullWidth
                                    {...appraiseForm.register("recommended_interest_rate")}
                                    error={Boolean(appraiseForm.formState.errors.recommended_interest_rate)}
                                    helperText={appraiseForm.formState.errors.recommended_interest_rate?.message}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <TextField
                                    select
                                    label="Repayment Frequency"
                                    fullWidth
                                    value={appraiseForm.watch("recommended_repayment_frequency")}
                                    onChange={(event) => appraiseForm.setValue("recommended_repayment_frequency", event.target.value as AppraiseValues["recommended_repayment_frequency"], { shouldValidate: true })}
                                >
                                    <MenuItem value="monthly">Monthly</MenuItem>
                                    <MenuItem value="weekly">Weekly</MenuItem>
                                    <MenuItem value="daily">Daily</MenuItem>
                                </TextField>
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <TextField
                                    select
                                    label="Risk Rating"
                                    fullWidth
                                    value={appraiseForm.watch("risk_rating")}
                                    onChange={(event) => appraiseForm.setValue("risk_rating", event.target.value as AppraiseValues["risk_rating"], { shouldValidate: true })}
                                >
                                    <MenuItem value="low">Low</MenuItem>
                                    <MenuItem value="medium">Medium</MenuItem>
                                    <MenuItem value="high">High</MenuItem>
                                </TextField>
                            </Grid>
                        </Grid>
                        <TextField
                            label="Appraisal Notes"
                            fullWidth
                            multiline
                            minRows={4}
                            {...appraiseForm.register("appraisal_notes")}
                            error={Boolean(appraiseForm.formState.errors.appraisal_notes)}
                            helperText={appraiseForm.formState.errors.appraisal_notes?.message}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAppraisalTarget(null)}>Cancel</Button>
                    <Button variant="contained" type="submit" form="loan-appraisal-form" disabled={processing} sx={darkAccentContainedSx}>
                        {processing ? "Saving..." : "Save Appraisal"}
                    </Button>
                </DialogActions>
            </MotionModal>

            <MotionModal open={Boolean(approvalTarget)} onClose={processing ? undefined : () => setApprovalTarget(null)} maxWidth="sm" fullWidth>
                <DialogTitle>Approve Loan Application</DialogTitle>
                <DialogContent dividers>
                    <Box component="form" id="loan-approve-form" onSubmit={saveApproval} sx={{ display: "grid", gap: 2, pt: 0.5 }}>
                        <Alert severity="info" variant="outlined" sx={darkAccentInfoAlertSx}>
                            Approval records governance consent only. The actual double-entry loan posting will occur later at disbursement.
                        </Alert>
                        <TextField label="Approval Notes" fullWidth multiline minRows={3} {...approveForm.register("notes")} />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setApprovalTarget(null)}>Cancel</Button>
                    <Button variant="contained" type="submit" form="loan-approve-form" disabled={processing} sx={darkAccentContainedSx}>
                        {processing ? "Approving..." : "Approve Application"}
                    </Button>
                </DialogActions>
            </MotionModal>

            <MotionModal open={Boolean(rejectionTarget)} onClose={processing ? undefined : () => setRejectionTarget(null)} maxWidth="sm" fullWidth>
                <DialogTitle>Reject Loan Application</DialogTitle>
                <DialogContent dividers>
                    <Box component="form" id="loan-reject-form" onSubmit={saveRejection} sx={{ display: "grid", gap: 2, pt: 0.5 }}>
                        <TextField
                            label="Reason"
                            fullWidth
                            multiline
                            minRows={3}
                            {...rejectForm.register("reason")}
                            error={Boolean(rejectForm.formState.errors.reason)}
                            helperText={rejectForm.formState.errors.reason?.message}
                        />
                        <TextField label="Notes" fullWidth multiline minRows={2} {...rejectForm.register("notes")} />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRejectionTarget(null)}>Cancel</Button>
                    <Button variant="contained" color="error" type="submit" form="loan-reject-form" disabled={processing}>
                        {processing ? "Rejecting..." : "Reject Application"}
                    </Button>
                </DialogActions>
            </MotionModal>

            <MotionModal open={Boolean(disbursementTarget)} onClose={processing ? undefined : () => setDisbursementTarget(null)} maxWidth="sm" fullWidth>
                <DialogTitle>Disburse Approved Application</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2} sx={{ pt: 0.5 }}>
                        <Alert severity="warning" variant="outlined">
                            This is the money-posting step. A balanced journal, loan account, and repayment schedule will be created when you confirm.
                        </Alert>
                        <Box component="form" id="loan-disburse-application-form" onSubmit={launchDisbursement} sx={{ display: "grid", gap: 2 }}>
                            <TextField label="Reference" fullWidth {...disburseForm.register("reference")} />
                            <TextField label="Description" fullWidth multiline minRows={3} {...disburseForm.register("description")} />
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDisbursementTarget(null)}>Cancel</Button>
                    <Button variant="contained" color="success" type="submit" form="loan-disburse-application-form" disabled={processing || subscriptionInactive}>
                        Review Disbursement
                    </Button>
                </DialogActions>
            </MotionModal>

            <MotionModal open={showRepayModal} onClose={processing ? undefined : () => setShowRepayModal(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Loan Repayment</DialogTitle>
                <DialogContent dividers>
                    <Box component="form" id="loan-repay-form" onSubmit={launchRepayment} sx={{ display: "grid", gap: 2, pt: 0.5 }}>
                        <Box>
                            <Typography variant="body2" fontWeight={600} sx={{ mb: 0.75 }}>
                                Loan
                            </Typography>
                            <SearchableSelect
                                value={repayForm.watch("loan_id")}
                                options={loanOptions}
                                onChange={(value) => repayForm.setValue("loan_id", value, { shouldValidate: true })}
                                placeholder="Search disbursed loan..."
                            />
                            {repayForm.formState.errors.loan_id ? (
                                <Typography variant="caption" color="error.main">
                                    {repayForm.formState.errors.loan_id.message}
                                </Typography>
                            ) : null}
                        </Box>
                        <TextField
                            label="Repayment Amount"
                            type="number"
                            fullWidth
                            {...repayForm.register("amount")}
                            error={Boolean(repayForm.formState.errors.amount)}
                            helperText={repayForm.formState.errors.amount?.message}
                        />
                        <TextField label="Reference" fullWidth {...repayForm.register("reference")} />
                        <TextField label="Description" fullWidth multiline minRows={3} {...repayForm.register("description")} />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowRepayModal(false)}>Cancel</Button>
                    <Button variant="contained" type="submit" form="loan-repay-form" disabled={processing || subscriptionInactive} sx={darkAccentContainedSx}>
                        Review Repayment
                    </Button>
                </DialogActions>
            </MotionModal>

            <ConfirmModal
                open={Boolean(pendingMoneyAction)}
                title={pendingMoneyAction?.type === "disburse" ? "Confirm Loan Disbursement" : "Confirm Loan Repayment"}
                summary={
                    pendingMoneyAction?.type === "disburse" ? (
                        <Stack spacing={1.25}>
                            <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Borrower</Typography><Typography variant="body2">{pendingMoneyAction.application.members?.full_name || "Unknown"}</Typography></Stack>
                            <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Approved Amount</Typography><Typography variant="body2">{formatCurrency(pendingMoneyAction.application.recommended_amount || pendingMoneyAction.application.requested_amount)}</Typography></Stack>
                            <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Reference</Typography><Typography variant="body2">{pendingMoneyAction.values.reference || "N/A"}</Typography></Stack>
                        </Stack>
                    ) : (
                        <Stack spacing={1.25}>
                            <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Loan</Typography><Typography variant="body2">{pendingRepaymentLoan?.loan_number || "Unknown"}</Typography></Stack>
                            <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Repayment Amount</Typography><Typography variant="body2">{formatCurrency(pendingRepaymentAmount)}</Typography></Stack>
                            <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Reference</Typography><Typography variant="body2">{pendingMoneyAction?.values.reference || "N/A"}</Typography></Stack>
                        </Stack>
                    )
                }
                loading={processing}
                confirmLabel={pendingMoneyAction?.type === "disburse" ? "Disburse Loan" : "Post Repayment"}
                onCancel={() => setPendingMoneyAction(null)}
                onConfirm={() => void confirmMoneyAction()}
            />
        </Stack>
    );
}
