import AccountBalanceRoundedIcon from "@mui/icons-material/AccountBalanceRounded";
import ApprovalRoundedIcon from "@mui/icons-material/ApprovalRounded";
import AssignmentTurnedInRoundedIcon from "@mui/icons-material/AssignmentTurnedInRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import CreditScoreRoundedIcon from "@mui/icons-material/CreditScoreRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import PendingActionsRoundedIcon from "@mui/icons-material/PendingActionsRounded";
import PlaylistAddCheckRoundedIcon from "@mui/icons-material/PlaylistAddCheckRounded";
import PersonAddAltRoundedIcon from "@mui/icons-material/PersonAddAltRounded";
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
    IconButton,
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

import { useAuth } from "../auth/AuthContext";
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
    type PendingApprovalPayload,
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
import type { ApiEnvelope, FinanceResult, Loan, LoanApplication, LoanGuarantor, LoanProduct, LoanSchedule, LoanTransaction, Member } from "../types/api";
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

type CreditRiskDefaultCase = {
    id: string;
    tenant_id: string;
    branch_id: string;
    loan_id: string;
    member_id: string;
    status: "delinquent" | "in_recovery" | "claim_ready" | "restructured" | "written_off" | "recovered";
    dpd_days: number;
    opened_at: string;
    closed_at?: string | null;
    reason_code: string;
    notes?: string | null;
    loans?: {
        id: string;
        loan_number?: string | null;
        status?: string | null;
    };
    members?: {
        id: string;
        full_name?: string | null;
        member_no?: string | null;
        phone?: string | null;
    };
};

type CollectionAction = {
    id: string;
    tenant_id: string;
    branch_id: string;
    default_case_id: string;
    loan_id: string;
    member_id: string;
    action_type: "call" | "visit" | "notice" | "legal_warning" | "settlement_offer";
    owner_user_id?: string | null;
    due_at: string;
    completed_at?: string | null;
    outcome_code?: "promised_to_pay" | "partial_paid" | "no_contact" | "refused" | "escalate" | null;
    status: "open" | "completed" | "overdue" | "cancelled";
    priority: number;
    escalated_at?: string | null;
    escalation_reason?: string | null;
    notes?: string | null;
    created_at: string;
    updated_at: string;
};

type CreditRiskListResponse<T> = {
    data: T[];
    pagination?: {
        page: number;
        limit: number;
        total: number;
    };
};

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

function buildLoanRepaymentReference(loanNumber?: string | null) {
    const compactLoanNumber = String(loanNumber || "LOAN")
        .replace(/[^A-Za-z0-9]/g, "")
        .slice(-12)
        .toUpperCase();
    const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
    return `LRP-${compactLoanNumber}-${stamp}`.slice(0, 80);
}

type DefaultDetectionRunResult = {
    tenant_id: string;
    branch_id: string | null;
    source: string;
    detection_enabled: boolean;
    dry_run: boolean;
    threshold_dpd_days: number;
    scanned_candidates: number;
    open_cases_existing: number;
    would_open_cases: number;
    created_cases: number;
    skipped_duplicates: number;
};

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
    const [defaultCases, setDefaultCases] = useState<CreditRiskDefaultCase[]>([]);
    const [collectionActions, setCollectionActions] = useState<CollectionAction[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [runningDefaultDetection, setRunningDefaultDetection] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [reviewTarget, setReviewTarget] = useState<LoanApplication | null>(null);
    const [appraisalTarget, setAppraisalTarget] = useState<LoanApplication | null>(null);
    const [appraisalGuarantors, setAppraisalGuarantors] = useState<Array<Pick<LoanGuarantor, "member_id" | "guaranteed_amount" | "notes">>>([]);
    const [approvalTarget, setApprovalTarget] = useState<LoanApplication | null>(null);
    const [rejectionTarget, setRejectionTarget] = useState<LoanApplication | null>(null);
    const [disbursementTarget, setDisbursementTarget] = useState<LoanApplication | null>(null);
    const [showRepayModal, setShowRepayModal] = useState(false);
    const [pendingMoneyAction, setPendingMoneyAction] = useState<PendingMoneyAction>(null);
    const [pendingApprovalNotice, setPendingApprovalNotice] = useState<{
        requestId: string;
        applicationId: string;
        reference?: string | null;
        description?: string | null;
    } | null>(null);
    const [applicationPage, setApplicationPage] = useState(1);
    const [loanPage, setLoanPage] = useState(1);
    const [applicationTotal, setApplicationTotal] = useState(0);
    const [loanTotal, setLoanTotal] = useState(0);
    const [activeTab, setActiveTab] = useState<LoanWorkspaceTab>("applications");
    const [referencesLoaded, setReferencesLoaded] = useState(false);
    const [referencesLoading, setReferencesLoading] = useState(false);
    const [activityLoaded, setActivityLoaded] = useState(false);
    const [activityLoading, setActivityLoading] = useState(false);
    const [creditRiskLoaded, setCreditRiskLoaded] = useState(false);
    const [creditRiskLoading, setCreditRiskLoading] = useState(false);
    const pageSize = 8;

    const role = profile?.role || "loan_officer";
    const canCreateApplications = ["loan_officer", "teller"].includes(role);
    const canAppraise = role === "loan_officer";
    const canApprove = role === "branch_manager";
    const canReject = role === "branch_manager" || role === "loan_officer";
    const canDisburse = role === "teller";
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
            const productsPromise = api.get<LoanProductsResponse>(endpoints.products.loans());
            const memberRows: Member[] = [];
            const perPage = 100;
            const maxPages = 10;

            for (let page = 1; page <= maxPages; page += 1) {
                const { data: membersResponse } = await api.get<MembersResponse>(endpoints.members.list(), {
                    params: { tenant_id: selectedTenantId, page, limit: perPage }
                });
                const batch = membersResponse.data || [];
                memberRows.push(...batch);
                if (batch.length < perPage) {
                    break;
                }
            }

            const { data: productsResponse } = await productsPromise;
            const uniqueMembers = Array.from(new Map(memberRows.map((member) => [member.id, member])).values());
            setMembers(uniqueMembers);
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

    const loadCreditRiskData = async (options?: { silent?: boolean; force?: boolean }) => {
        if (!selectedTenantId) {
            return;
        }

        if (creditRiskLoading) {
            return;
        }

        if (creditRiskLoaded && !options?.force) {
            return;
        }

        setCreditRiskLoading(true);
        try {
            const [{ data: defaultCasesResponse }, { data: collectionActionsResponse }] = await Promise.all([
                api.get<CreditRiskListResponse<CreditRiskDefaultCase>>("/credit-risk/default-cases", {
                    params: { tenant_id: selectedTenantId, page: 1, limit: 100 }
                }),
                api.get<CreditRiskListResponse<CollectionAction>>("/credit-risk/collection-actions", {
                    params: { tenant_id: selectedTenantId, page: 1, limit: 100 }
                })
            ]);

            setDefaultCases(defaultCasesResponse.data || []);
            setCollectionActions(collectionActionsResponse.data || []);
            setCreditRiskLoaded(true);
        } catch (error) {
            if (!options?.silent) {
                pushToast({
                    type: "error",
                    title: "Unable to load credit risk data",
                    message: getApiErrorMessage(error)
                });
            }
        } finally {
            setCreditRiskLoading(false);
        }
    };

    const runDefaultDetection = async () => {
        if (!selectedTenantId) {
            return;
        }

        setRunningDefaultDetection(true);
        try {
            const { data } = await api.post<{ data: DefaultDetectionRunResult }>("/credit-risk/default-detection/run", {
                tenant_id: selectedTenantId,
                dry_run: false,
                max_loans: 500
            });
            const result = data.data;
            pushToast({
                type: "success",
                title: "Default detection completed",
                message: result.created_cases > 0
                    ? `${result.created_cases} default case(s) opened automatically.`
                    : `No new default cases opened. ${result.open_cases_existing} already open.`
            });

            await loadCreditRiskData({ force: true, silent: true });
            await loadWorkspace();
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to run default detection",
                message: getApiErrorMessage(error)
            });
        } finally {
            setRunningDefaultDetection(false);
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
        setDefaultCases([]);
        setCollectionActions([]);
        setReferencesLoaded(false);
        setReferencesLoading(false);
        setActivityLoaded(false);
        setActivityLoading(false);
        setCreditRiskLoaded(false);
        setCreditRiskLoading(false);
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
        if (
            activeTab === "collections"
            && ["loan_officer", "branch_manager"].includes(role)
            && !creditRiskLoaded
            && !creditRiskLoading
        ) {
            void loadCreditRiskData({ silent: true });
        }
    }, [activeTab, creditRiskLoaded, creditRiskLoading, role]);

    useEffect(() => {
        if ((showCreateModal || showRepayModal || Boolean(appraisalTarget)) && !referencesLoaded && !referencesLoading) {
            void loadReferenceData({ silent: true });
        }
    }, [appraisalTarget, referencesLoaded, referencesLoading, showCreateModal, showRepayModal]);

    const memberOptions = useMemo(
        () =>
            members.map((member) => {
                const typedMember = member as Member & {
                    first_name?: string | null;
                    middle_name?: string | null;
                    last_name?: string | null;
                    phone_number?: string | null;
                    nin?: string | null;
                    tin_number?: string | null;
                };
                const fallbackName = [
                    typedMember.first_name,
                    typedMember.middle_name,
                    typedMember.last_name
                ]
                    .map((entry) => String(entry || "").trim())
                    .filter(Boolean)
                    .join(" ");
                const label = String(member.full_name || "").trim()
                    || fallbackName
                    || String(member.member_no || "").trim()
                    || String(member.phone || typedMember.phone_number || "").trim()
                    || `Member ${member.id.slice(0, 8)}`;
                const secondary = [
                    member.member_no,
                    member.phone,
                    member.email,
                    typedMember.nin,
                    typedMember.tin_number
                ]
                    .map((entry) => String(entry || "").trim())
                    .filter(Boolean)
                    .join(" · ");

                return {
                    value: member.id,
                    label,
                    secondary: secondary || undefined
                };
            }),
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
    const selectedRepaymentLoanId = repayForm.watch("loan_id");
    const selectedRepaymentAmount = Number(repayForm.watch("amount") || 0);
    const selectedRepaymentLoan = useMemo(
        () => loans.find((loan) => loan.id === selectedRepaymentLoanId) || null,
        [loans, selectedRepaymentLoanId]
    );
    const selectedRepaymentMember = useMemo(
        () => members.find((member) => member.id === selectedRepaymentLoan?.member_id) || null,
        [members, selectedRepaymentLoan?.member_id]
    );
    const selectedRepaymentSchedules = useMemo(
        () => schedules.filter((schedule) => schedule.loan_id === selectedRepaymentLoanId),
        [schedules, selectedRepaymentLoanId]
    );
    const selectedRepaymentInsights = useMemo(
        () => buildRepaymentInsights(selectedRepaymentLoan, selectedRepaymentSchedules, selectedRepaymentAmount),
        [selectedRepaymentAmount, selectedRepaymentLoan, selectedRepaymentSchedules]
    );

    useEffect(() => {
        if (!showRepayModal || !selectedRepaymentLoan) {
            return;
        }

        if (selectedRepaymentInsights.recommendedAmount > 0) {
            repayForm.setValue(
                "amount",
                Number(selectedRepaymentInsights.recommendedAmount.toFixed(2)),
                { shouldValidate: true }
            );
        }

        if (!repayForm.getValues("description")) {
            repayForm.setValue(
                "description",
                `Loan repayment for ${selectedRepaymentLoan.loan_number}`,
                { shouldValidate: false }
            );
        }
        if (!repayForm.getValues("reference")) {
            repayForm.setValue(
                "reference",
                buildLoanRepaymentReference(selectedRepaymentLoan.loan_number),
                { shouldValidate: false }
            );
        }
    }, [repayForm, selectedRepaymentInsights.recommendedAmount, selectedRepaymentLoan, showRepayModal]);

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
        const awaitingAppraisal = role === "branch_manager"
            ? 0
            : applications.filter((application) => application.status === "submitted").length;
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
    }, [applications, loans, role]);
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
    const darkAccentWarningAlertSx = theme.palette.mode === "dark"
        ? {
            borderColor: alpha(dashboardAccentStrong, 0.45),
            color: dashboardAccent,
            bgcolor: alpha(dashboardAccentStrong, 0.1),
            "& .MuiAlert-icon": { color: dashboardAccentStrong }
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
    const openDefaultCases = useMemo(
        () => defaultCases.filter((item) => ["delinquent", "in_recovery", "claim_ready"].includes(item.status)),
        [defaultCases]
    );
    const openDefaultCaseCount = openDefaultCases.length;
    const openCollectionActionCount = useMemo(
        () => collectionActions.filter((action) => action.status === "open").length,
        [collectionActions]
    );
    const overdueCollectionActionCount = useMemo(
        () => collectionActions.filter((action) => action.status === "overdue").length,
        [collectionActions]
    );
    const collectionPriorityCases = useMemo(() => {
        return openDefaultCases
            .map((item) => ({
                id: item.id,
                loanId: item.loan_id,
                loanNumber: item.loans?.loan_number || "Unknown loan",
                borrower: item.members?.full_name || "Unknown member",
                status: item.status,
                dpdDays: Number(item.dpd_days || 0),
                openedAt: item.opened_at,
                reasonCode: item.reason_code
            }))
            .sort((left, right) => {
                if (left.dpdDays !== right.dpdDays) {
                    return right.dpdDays - left.dpdDays;
                }

                return new Date(left.openedAt).getTime() - new Date(right.openedAt).getTime();
            })
            .slice(0, 6);
    }, [openDefaultCases]);
    const upcomingCollectionActions = useMemo(
        () =>
            collectionActions
                .filter((action) => ["open", "overdue"].includes(action.status))
                .sort((left, right) => new Date(left.due_at).getTime() - new Date(right.due_at).getTime())
                .slice(0, 6),
        [collectionActions]
    );
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
            id: "queue-default-cases",
            label: "Open default cases",
            count: openDefaultCaseCount,
            helper: "Detected loan defaults currently under collections workflow.",
            route: "/follow-ups",
            tone: openDefaultCaseCount > 0 ? "error" : "success"
        },
        {
            id: "queue-actions",
            label: "Open collection actions",
            count: openCollectionActionCount + overdueCollectionActionCount,
            helper: "Open and overdue collection tasks requiring execution.",
            route: "/loans",
            tone: openCollectionActionCount + overdueCollectionActionCount > 0 ? "warning" : "success"
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
            ["loan_officer", "branch_manager"].includes(role)
                ? [
                    { value: "applications" as const, label: "Applications", count: applicationTotal },
                    { value: "portfolio" as const, label: "Portfolio", count: loanTotal },
                    { value: "collections" as const, label: "Collections", count: openDefaultCaseCount || overdueScheduleCount },
                    { value: "activity" as const, label: "Activity", count: transactions.length }
                ]
                : [
                    { value: "applications" as const, label: "Applications", count: applicationTotal },
                    { value: "portfolio" as const, label: "Portfolio", count: loanTotal },
                    { value: "activity" as const, label: "Activity", count: transactions.length }
                ],
        [applicationTotal, loanTotal, openDefaultCaseCount, overdueScheduleCount, role, transactions.length]
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
        void loadReferenceData({ silent: true, force: true });
        setAppraisalGuarantors(
            (application.loan_guarantors || []).map((guarantor) => ({
                member_id: guarantor.member_id,
                guaranteed_amount: Number(guarantor.guaranteed_amount || 0),
                notes: guarantor.notes || ""
            }))
        );
        appraiseForm.reset({
            recommended_amount: application.recommended_amount ?? application.requested_amount,
            recommended_term_count: application.recommended_term_count ?? application.requested_term_count,
            recommended_interest_rate: application.recommended_interest_rate ?? application.requested_interest_rate ?? 18,
            recommended_repayment_frequency: application.recommended_repayment_frequency ?? application.requested_repayment_frequency,
            risk_rating: (application.risk_rating as AppraiseValues["risk_rating"]) || "medium",
            appraisal_notes: application.appraisal_notes || ""
        });
    };

    const closeAppraisalDialog = () => {
        setAppraisalTarget(null);
        setAppraisalGuarantors([]);
    };

    const updateAppraisalGuarantor = (
        index: number,
        patch: Partial<Pick<LoanGuarantor, "member_id" | "guaranteed_amount" | "notes">>
    ) => {
        setAppraisalGuarantors((prev) =>
            prev.map((entry, entryIndex) =>
                entryIndex === index
                    ? { ...entry, ...patch }
                    : entry
            )
        );
    };

    const removeAppraisalGuarantor = (index: number) => {
        setAppraisalGuarantors((prev) => prev.filter((_, entryIndex) => entryIndex !== index));
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
            if (creditRiskLoaded) {
                await loadCreditRiskData({ silent: true, force: true });
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
            if (creditRiskLoaded) {
                await loadCreditRiskData({ silent: true, force: true });
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
            const normalizedGuarantors = appraisalGuarantors
                .map((entry) => ({
                    member_id: String(entry.member_id || "").trim(),
                    guaranteed_amount: Number(entry.guaranteed_amount || 0),
                    notes: String(entry.notes || "").trim() || null
                }))
                .filter((entry) => entry.member_id && entry.guaranteed_amount > 0);

            const guarantorIds = normalizedGuarantors.map((entry) => entry.member_id);
            if (guarantorIds.some((memberId) => memberId === appraisalTarget.member_id)) {
                pushToast({
                    type: "error",
                    title: "Invalid guarantor selection",
                    message: "Borrower cannot be selected as guarantor."
                });
                setProcessing(false);
                return;
            }

            if (new Set(guarantorIds).size !== guarantorIds.length) {
                pushToast({
                    type: "error",
                    title: "Duplicate guarantors",
                    message: "Each guarantor member can only be added once."
                });
                setProcessing(false);
                return;
            }

            const payload: AppraiseLoanApplicationRequest = {
                ...values,
                guarantors: normalizedGuarantors
            };
            await api.post<LoanApplicationResponse>(endpoints.loanApplications.appraise(appraisalTarget.id), payload);
            pushToast({
                type: "success",
                title: "Application appraised",
                message: "The branch manager can now review this recommendation."
            });
            closeAppraisalDialog();
            await loadWorkspace();
            if (activityLoaded) {
                await loadActivityData({ silent: true, force: true });
            }
            if (creditRiskLoaded) {
                await loadCreditRiskData({ silent: true, force: true });
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

    const getUnresolvedGuarantorConsents = (application: LoanApplication | null | undefined) =>
        (application?.loan_guarantors || []).filter((guarantor) => guarantor.consent_status !== "accepted");

    const saveApproval = approveForm.handleSubmit(async (values) => {
        if (!approvalTarget) {
            return;
        }

        if (!canApprove) {
            pushToast({
                type: "error",
                title: "Approval not allowed",
                message: "Only branch managers can approve loan applications."
            });
            setApprovalTarget(null);
            return;
        }

        const unresolvedGuarantors = getUnresolvedGuarantorConsents(approvalTarget);
        if (unresolvedGuarantors.length) {
            pushToast({
                type: "error",
                title: "Guarantor consent pending",
                message: "All listed guarantors must accept before approval can proceed."
            });
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
            if (creditRiskLoaded) {
                await loadCreditRiskData({ silent: true, force: true });
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
            if (creditRiskLoaded) {
                await loadCreditRiskData({ silent: true, force: true });
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

        const unresolvedGuarantors = getUnresolvedGuarantorConsents(disbursementTarget);
        if (unresolvedGuarantors.length) {
            pushToast({
                type: "error",
                title: "Guarantor consent pending",
                message: "Loan disbursement is blocked until all guarantors accept."
            });
            return;
        }

        setPendingMoneyAction({ type: "disburse", application: disbursementTarget, values });
    });

    const launchRepayment = repayForm.handleSubmit((values) => {
        if (selectedRepaymentInsights.excessOverOutstanding > 0) {
            pushToast({
                type: "error",
                title: "Repayment amount too high",
                message: `The entered amount exceeds the outstanding balance by ${formatCurrency(selectedRepaymentInsights.excessOverOutstanding)}.`
            });
            return;
        }

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
                const { data } = await api.post<LoanApplicationResponse | ApiEnvelope<PendingApprovalPayload>>(
                    endpoints.loanApplications.disburse(pendingMoneyAction.application.id),
                    payload
                );
                const maybePending = data.data as Partial<PendingApprovalPayload>;
                if (maybePending.approval_required && maybePending.approval_request_id) {
                    pushToast({
                        type: "success",
                        title: "Sent for approval",
                        message: `Request ${maybePending.approval_request_id.slice(0, 8)}... is now waiting for checker approval.`
                    });
                    setPendingApprovalNotice({
                        requestId: maybePending.approval_request_id,
                        applicationId: pendingMoneyAction.application.id,
                        reference: pendingMoneyAction.values.reference || null,
                        description: pendingMoneyAction.values.description || null
                    });
                } else {
                    pushToast({
                        type: "success",
                        title: "Loan disbursed",
                        message: `${pendingMoneyAction.application.members?.full_name || "The borrower"} has been disbursed successfully.`
                    });
                }
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
                const { data } = await api.post<ApiEnvelope<FinanceResult>>(endpoints.finance.loanRepay(), payload);
                const repaymentResult = data.data;
                pushToast({
                    type: "success",
                    title: "Repayment posted",
                    message: `Interest ${formatCurrency(repaymentResult.interest_component || 0)} and principal ${formatCurrency(repaymentResult.principal_component || 0)} were posted successfully.`
                });
                setShowRepayModal(false);
                repayForm.reset();
            }

            setPendingMoneyAction(null);
            await loadWorkspace();
            if (activityLoaded) {
                await loadActivityData({ silent: true, force: true });
            }
            if (creditRiskLoaded) {
                await loadCreditRiskData({ silent: true, force: true });
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

    const executeApprovedDisbursement = async () => {
        if (!pendingApprovalNotice) {
            return;
        }

        setProcessing(true);
        try {
            const payload: DisburseApprovedLoanRequest = {
                reference: pendingApprovalNotice.reference || null,
                description: pendingApprovalNotice.description || null,
                approval_request_id: pendingApprovalNotice.requestId
            };

            await api.post<LoanApplicationResponse>(
                endpoints.loanApplications.disburse(pendingApprovalNotice.applicationId),
                payload
            );

            pushToast({
                type: "success",
                title: "Loan disbursed",
                message: "Approved disbursement request was executed successfully."
            });
            setPendingApprovalNotice(null);
            await loadWorkspace();
            if (activityLoaded) {
                await loadActivityData({ silent: true, force: true });
            }
            if (creditRiskLoaded) {
                await loadCreditRiskData({ silent: true, force: true });
            }
        } catch (error) {
            pushToast({
                type: "error",
                title: "Execution not ready",
                message: getApiErrorMessage(error, "Approval may still be pending or was rejected.")
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
            key: "guarantor_consent",
            header: "Guarantor Consent",
            render: (row) => {
                const guarantors = row.loan_guarantors || [];
                if (!guarantors.length) {
                    return "Not required";
                }

                const accepted = guarantors.filter((item) => item.consent_status === "accepted").length;
                const pending = guarantors.filter((item) => item.consent_status !== "accepted").length;
                return pending ? `${accepted}/${guarantors.length} accepted` : "All accepted";
            }
        },
        {
            key: "actions",
            header: "Actions",
            render: (row) => {
                const canSubmit = row.status === "draft" && canCreateApplications;
                const canRunAppraisal = ["submitted", "appraised"].includes(row.status) && canAppraise;
                const canRunApproval = (["submitted", "appraised"].includes(row.status) || (row.status === "approved" && row.approval_count < row.required_approval_count)) && canApprove;
                const canRunRejection = (["submitted", "appraised"].includes(row.status) || (row.status === "approved" && row.approval_count < row.required_approval_count)) && canReject;
                const canRunDisbursement = row.status === "approved" && !row.loan_id && canDisburse;

                const openApproval = () => {
                    const unresolvedGuarantors = getUnresolvedGuarantorConsents(row);
                    if (unresolvedGuarantors.length) {
                        pushToast({
                            type: "error",
                            title: "Guarantor consent pending",
                            message: "All listed guarantors must accept before approval can proceed."
                        });
                        return;
                    }
                    setApprovalTarget(row);
                    approveForm.reset({ notes: "" });
                };

                const openDisbursement = () => {
                    const unresolvedGuarantors = getUnresolvedGuarantorConsents(row);
                    if (unresolvedGuarantors.length) {
                        pushToast({
                            type: "error",
                            title: "Guarantor consent pending",
                            message: "Loan disbursement is blocked until all guarantors accept."
                        });
                        return;
                    }
                    setDisbursementTarget(row);
                    disburseForm.reset({
                        reference: row.external_reference || "",
                        description: row.purpose || ""
                    });
                };

                let primaryAction = (
                    <Button
                        size="small"
                        variant="outlined"
                        color="inherit"
                        startIcon={<VisibilityRoundedIcon />}
                        onClick={() => setReviewTarget(row)}
                        fullWidth
                        sx={darkAccentOutlinedSx}
                    >
                        View Details
                    </Button>
                );

                if (canRunDisbursement) {
                    primaryAction = (
                        <Button
                            size="small"
                            variant="contained"
                            color="success"
                            onClick={openDisbursement}
                            fullWidth
                        >
                            Disburse Loan
                        </Button>
                    );
                } else if (canRunApproval) {
                    primaryAction = (
                        <Button
                            size="small"
                            variant="contained"
                            onClick={openApproval}
                            fullWidth
                            sx={darkAccentContainedSx}
                        >
                            Approve Application
                        </Button>
                    );
                } else if (canRunAppraisal) {
                    primaryAction = (
                        <Button
                            size="small"
                            variant="contained"
                            onClick={() => openAppraisalDialog(row)}
                            fullWidth
                            sx={darkAccentContainedSx}
                        >
                            {row.status === "submitted" ? "Start Appraisal" : "Update Appraisal"}
                        </Button>
                    );
                } else if (canSubmit) {
                    primaryAction = (
                        <Button
                            size="small"
                            variant="contained"
                            onClick={() => void submitDraftApplication(row)}
                            fullWidth
                            sx={darkAccentContainedSx}
                        >
                            Submit Application
                        </Button>
                    );
                }

                return (
                    <Stack
                        spacing={0.9}
                        sx={{
                            minWidth: 190,
                            p: 1,
                            borderRadius: 2.5,
                            border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                            bgcolor: theme.palette.mode === "dark" ? alpha(dashboardAccent, 0.08) : alpha(theme.palette.primary.main, 0.03)
                        }}
                    >
                        <Typography variant="caption" sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }} color="text.secondary">
                            Next action
                        </Typography>
                        {primaryAction}
                        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                            <Button
                                size="small"
                                variant="text"
                                color="inherit"
                                startIcon={<VisibilityRoundedIcon />}
                                onClick={() => setReviewTarget(row)}
                                sx={{ minWidth: 0, px: 0.5 }}
                            >
                                Review
                            </Button>
                            {canRunRejection ? (
                                <Button
                                    size="small"
                                    variant="text"
                                    color="inherit"
                                    onClick={() => {
                                        setRejectionTarget(row);
                                        rejectForm.reset({ reason: "", notes: "" });
                                    }}
                                    sx={{ minWidth: 0, px: 0.5, color: theme.palette.error.main }}
                                >
                                    Reject
                                </Button>
                            ) : null}
                        </Stack>
                    </Stack>
                );
            }
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
            ? loans.find((loan) => loan.id === pendingMoneyAction.values.loan_id) || null
            : null;
    const pendingRepaymentAmount =
        pendingMoneyAction?.type === "repay" ? pendingMoneyAction.values.amount : 0;
    const pendingRepaymentSchedules =
        pendingRepaymentLoan
            ? schedules.filter((schedule) => schedule.loan_id === pendingRepaymentLoan.id)
            : [];
    const pendingRepaymentInsights = buildRepaymentInsights(
        pendingRepaymentLoan,
        pendingRepaymentSchedules,
        pendingRepaymentAmount
    );
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

            {pendingApprovalNotice ? (
                <Alert
                    severity="info"
                    variant="outlined"
                    action={
                        <Stack direction="row" spacing={1}>
                            <Button size="small" onClick={() => void executeApprovedDisbursement()} disabled={processing}>
                                Execute Approved
                            </Button>
                            <Button size="small" onClick={() => navigate("/approvals")}>
                                Open Queue
                            </Button>
                            <Button size="small" onClick={() => setPendingApprovalNotice(null)}>
                                Dismiss
                            </Button>
                        </Stack>
                    }
                >
                    Disbursement was sent for maker-checker approval. Request ID: {pendingApprovalNotice.requestId}
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
                            title="Approval Queue"
                            value={String(metrics.awaitingApproval)}
                            helper="Appraised applications currently waiting for branch approval."
                            icon={<ApprovalRoundedIcon fontSize="small" />}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                        <MetricCard
                            title="Ready to Disburse"
                            value={String(metrics.readyToDisburse)}
                            helper="Approved applications waiting for loan officer or teller execution."
                            icon={<PlaylistAddCheckRoundedIcon fontSize="small" />}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                        <MetricCard
                            title="Open Default Cases"
                            value={String(openDefaultCaseCount)}
                            helper="Detected default cases requiring branch follow-up."
                            icon={<PendingActionsRoundedIcon fontSize="small" />}
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
                <Stack spacing={2}>
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

                    <MotionCard variant="outlined">
                        <CardContent>
                            {role === "loan_officer" ? (
                                <Stack spacing={2}>
                                    <Box>
                                        <Typography variant="h6">Officer Action Queue</Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                            Keep pipeline, disbursement, and collections actions visible in one place.
                                        </Typography>
                                    </Box>
                                    <Grid container spacing={1.25}>
                                        {loanOfficerQueue.map((item) => (
                                            <Grid key={item.id} size={{ xs: 12, md: 6 }}>
                                                <Button
                                                    fullWidth
                                                    variant="outlined"
                                                    color="inherit"
                                                    onClick={() => navigate(item.route)}
                                                    sx={{ justifyContent: "space-between", textTransform: "none", borderStyle: "dashed", minHeight: 88 }}
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
                                            </Grid>
                                        ))}
                                    </Grid>
                                </Stack>
                            ) : (
                                <>
                                    <Typography variant="h6">Workflow Guardrails</Typography>
                                    <Stack spacing={1.5} sx={{ mt: 2 }}>
                                    <Alert severity="info" variant="outlined" sx={darkAccentInfoAlertSx}>
                                        Members and staff originate applications. Drafts or rejected applications must be submitted before they can be appraised.
                                    </Alert>
                                        <Alert severity="warning" variant="outlined">
                                            Loan officers appraise first. Loan officers or branch managers can reject for rework, while final approval remains with branch managers. The maker cannot approve the same application.
                                        </Alert>
                                        <Alert severity="success" variant="outlined">
                                            Teller or loan officer disbursement is the only step that triggers the double-entry loan posting procedure.
                                        </Alert>
                                    </Stack>
                                </>
                            )}
                        </CardContent>
                    </MotionCard>
                </Stack>
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

            {activeTab === "collections" && ["loan_officer", "branch_manager"].includes(role) ? (
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, lg: 8 }}>
                        <MotionCard variant="outlined" sx={{ height: "100%" }}>
                            <CardContent sx={{ height: "100%" }}>
                                <Stack spacing={2}>
                                    <Box>
                                        <Typography variant="h6">Collections Priority Board</Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                            Live default cases detected by credit-risk controls, ranked by delinquency pressure.
                                        </Typography>
                                    </Box>
                                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                        <Chip
                                            label={`${openDefaultCaseCount} open default case(s)`}
                                            color={openDefaultCaseCount > 0 ? "error" : "success"}
                                            variant="outlined"
                                        />
                                        <Chip
                                            label={`${openCollectionActionCount} open action(s)`}
                                            color={openCollectionActionCount > 0 ? "warning" : "success"}
                                            variant="outlined"
                                        />
                                        <Chip
                                            label={`${overdueCollectionActionCount} overdue action(s)`}
                                            color="primary"
                                            variant="outlined"
                                            sx={darkAccentChipSx}
                                        />
                                        {!openDefaultCaseCount && overdueScheduleCount ? (
                                            <Chip
                                                label={`${overdueScheduleCount} overdue schedule(s)`}
                                                color="warning"
                                                variant="outlined"
                                            />
                                        ) : null}
                                    </Stack>
                                    <Divider />
                                    {collectionPriorityCases.length ? (
                                        <Stack spacing={1.1}>
                                            {collectionPriorityCases.map((item) => (
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
                                                            DPD {item.dpdDays} days · {item.reasonCode.replace(/_/g, " ")}
                                                        </Typography>
                                                    </Stack>
                                                    <Chip
                                                        size="small"
                                                        label={item.status}
                                                        color={item.status === "claim_ready" ? "error" : item.status === "in_recovery" ? "warning" : "default"}
                                                        variant={item.status === "delinquent" ? "outlined" : "filled"}
                                                    />
                                                </Button>
                                            ))}
                                        </Stack>
                                    ) : (
                                        <Alert severity="info" variant="outlined" sx={darkAccentInfoAlertSx}>
                                            No open default cases yet. Run detection or wait for scheduler cycle.
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
                                            Trigger detection, review action backlog, and execute your recovery workflow.
                                        </Typography>
                                    </Box>
                                    <Button
                                        variant="contained"
                                        startIcon={<PendingActionsRoundedIcon />}
                                        onClick={() => void runDefaultDetection()}
                                        disabled={runningDefaultDetection || subscriptionInactive}
                                        sx={darkAccentContainedSx}
                                    >
                                        {runningDefaultDetection ? "Detecting defaults..." : "Run Default Detection"}
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        onClick={() => navigate("/follow-ups")}
                                        sx={darkAccentOutlinedSx}
                                    >
                                        Open Follow-ups
                                    </Button>
                                    <Button variant="outlined" onClick={() => setActiveTab("portfolio")} sx={darkAccentOutlinedSx}>
                                        Back to Portfolio Tab
                                    </Button>
                                    <Divider />
                                    <Stack spacing={1.1}>
                                        {upcomingCollectionActions.length ? (
                                            upcomingCollectionActions.map((action) => (
                                                <Button
                                                    key={action.id}
                                                    fullWidth
                                                    variant="text"
                                                    color="inherit"
                                                    onClick={() => navigate(`/loans/${action.loan_id}`)}
                                                    sx={{ justifyContent: "space-between", textTransform: "none", px: 0, py: 0.75 }}
                                                >
                                                    <Stack spacing={0.15} sx={{ textAlign: "left", flex: 1 }}>
                                                        <Typography variant="subtitle2">
                                                            {action.action_type.replace(/_/g, " ")} · due {formatDate(action.due_at)}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Priority {action.priority} · {action.notes || "No notes"}
                                                        </Typography>
                                                    </Stack>
                                                    <Chip
                                                        size="small"
                                                        label={action.status}
                                                        color={action.status === "overdue" ? "error" : "warning"}
                                                        variant={action.status === "open" ? "outlined" : "filled"}
                                                    />
                                                </Button>
                                            ))
                                        ) : (
                                            <Alert severity="info" variant="outlined" sx={darkAccentInfoAlertSx}>
                                                No open collection actions yet.
                                            </Alert>
                                        )}
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
                    {reviewTarget
                    && (["submitted", "appraised"].includes(reviewTarget.status) || (reviewTarget.status === "approved" && reviewTarget.approval_count < reviewTarget.required_approval_count))
                    && canReject ? (
                            <Button
                                variant="outlined"
                                color="inherit"
                                onClick={() => {
                                    setRejectionTarget(reviewTarget);
                                    rejectForm.reset({ reason: "", notes: "" });
                                    setReviewTarget(null);
                                }}
                                sx={darkAccentOutlinedSx}
                            >
                                Reject Application
                            </Button>
                        ) : null}
                    {reviewTarget && ["submitted", "appraised"].includes(reviewTarget.status) && canAppraise ? (
                        <Button
                            variant="contained"
                            onClick={() => {
                                openAppraisalDialog(reviewTarget);
                                setReviewTarget(null);
                            }}
                            sx={darkAccentContainedSx}
                        >
                            {reviewTarget.status === "submitted" ? "Appraise This Application" : "Update Appraisal"}
                        </Button>
                    ) : null}
                </DialogActions>
            </MotionModal>

            <MotionModal open={Boolean(appraisalTarget)} onClose={processing ? undefined : closeAppraisalDialog} maxWidth="md" fullWidth>
                <DialogTitle>{appraisalTarget?.status === "appraised" ? "Update Loan Appraisal" : "Appraise Loan Application"}</DialogTitle>
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
                        <Divider />
                        <Stack spacing={1.25}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Box>
                                    <Typography variant="subtitle2">Guarantors</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        Select guarantor members and committed amount. These values feed guarantor exposure controls.
                                    </Typography>
                                </Box>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<PersonAddAltRoundedIcon fontSize="small" />}
                                    onClick={() =>
                                        setAppraisalGuarantors((prev) => [
                                            ...prev,
                                            { member_id: "", guaranteed_amount: 0, notes: "" }
                                        ])
                                    }
                                    disabled={!memberOptions.length}
                                    sx={darkAccentOutlinedSx}
                                >
                                    Add guarantor
                                </Button>
                            </Stack>
                            {!memberOptions.length ? (
                                <Alert severity="info" variant="outlined" sx={darkAccentInfoAlertSx}>
                                    No member options loaded yet. Wait a moment or reopen this dialog after members sync.
                                </Alert>
                            ) : null}
                            {appraisalGuarantors.length ? (
                                appraisalGuarantors.map((guarantor, index) => {
                                    const selectedElsewhere = appraisalGuarantors
                                        .filter((_, entryIndex) => entryIndex !== index)
                                        .map((entry) => entry.member_id);
                                    const rowMemberOptions = memberOptions.filter((option) => {
                                        if (appraisalTarget && option.value === appraisalTarget.member_id) {
                                            return false;
                                        }
                                        if (option.value === guarantor.member_id) {
                                            return true;
                                        }
                                        return !selectedElsewhere.includes(option.value);
                                    });

                                    return (
                                        <Grid container spacing={1.5} key={`appraisal-guarantor-${index}`}>
                                            <Grid size={{ xs: 12, md: 5 }}>
                                                <Typography variant="body2" fontWeight={600} sx={{ mb: 0.75 }}>
                                                    Guarantor Member
                                                </Typography>
                                                <SearchableSelect
                                                    value={guarantor.member_id}
                                                    options={rowMemberOptions}
                                                    onChange={(value) => updateAppraisalGuarantor(index, { member_id: value })}
                                                    placeholder="Search guarantor member..."
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 3 }}>
                                                <TextField
                                                    label="Guaranteed Amount"
                                                    type="number"
                                                    fullWidth
                                                    value={guarantor.guaranteed_amount}
                                                    onChange={(event) =>
                                                        updateAppraisalGuarantor(index, {
                                                            guaranteed_amount: Number(event.target.value || 0)
                                                        })
                                                    }
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 3 }}>
                                                <TextField
                                                    label="Notes"
                                                    fullWidth
                                                    value={guarantor.notes || ""}
                                                    onChange={(event) => updateAppraisalGuarantor(index, { notes: event.target.value })}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 1 }}>
                                                <IconButton
                                                    color="error"
                                                    aria-label="Remove guarantor"
                                                    onClick={() => removeAppraisalGuarantor(index)}
                                                    sx={{ mt: { xs: 0, md: 2.25 } }}
                                                >
                                                    <DeleteOutlineRoundedIcon fontSize="small" />
                                                </IconButton>
                                            </Grid>
                                        </Grid>
                                    );
                                })
                            ) : (
                                <Alert severity="warning" variant="outlined" sx={darkAccentWarningAlertSx}>
                                    No guarantors added. Exposure controls will not evaluate until guarantors are provided.
                                </Alert>
                            )}
                        </Stack>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeAppraisalDialog}>Cancel</Button>
                    <Button variant="contained" type="submit" form="loan-appraisal-form" disabled={processing} sx={darkAccentContainedSx}>
                        {processing ? "Saving..." : "Save Appraisal"}
                    </Button>
                </DialogActions>
            </MotionModal>

            <MotionModal open={Boolean(approvalTarget) && canApprove} onClose={processing ? undefined : () => setApprovalTarget(null)} maxWidth="sm" fullWidth>
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
                        <Alert severity="info" variant="outlined">
                            The entered cash will be allocated to interest first, then principal. Extra cash above the due amount becomes an early principal repayment, while anything above the total outstanding balance is blocked.
                        </Alert>
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

                        {selectedRepaymentLoan ? (
                            <Box
                                sx={{
                                    borderRadius: 2,
                                    border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
                                    bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.12 : 0.04),
                                    p: 2
                                }}
                            >
                                <Stack spacing={1.5}>
                                    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
                                        <Box>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                                {selectedRepaymentLoan.loan_number}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {selectedRepaymentMember?.full_name || "Unknown borrower"}
                                            </Typography>
                                        </Box>
                                        <Chip
                                            label={selectedRepaymentInsights.overdueAmount > 0 ? "Overdue repayment" : "Current repayment"}
                                            color={selectedRepaymentInsights.overdueAmount > 0 ? "warning" : "success"}
                                            variant="outlined"
                                        />
                                    </Stack>
                                    <Grid container spacing={1.25}>
                                        <Grid size={{ xs: 6 }}>
                                            <Typography variant="caption" color="text.secondary">Due Now</Typography>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                                {formatCurrency(selectedRepaymentInsights.dueNowAmount)}
                                            </Typography>
                                        </Grid>
                                        <Grid size={{ xs: 6 }}>
                                            <Typography variant="caption" color="text.secondary">Outstanding Balance</Typography>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                                {formatCurrency(selectedRepaymentInsights.outstandingBalance)}
                                            </Typography>
                                        </Grid>
                                        <Grid size={{ xs: 6 }}>
                                            <Typography variant="caption" color="text.secondary">Interest / Revenue Due</Typography>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                                {formatCurrency(selectedRepaymentInsights.payableInterest)}
                                            </Typography>
                                        </Grid>
                                        <Grid size={{ xs: 6 }}>
                                            <Typography variant="caption" color="text.secondary">Principal Outstanding</Typography>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                                {formatCurrency(selectedRepaymentLoan.outstanding_principal)}
                                            </Typography>
                                        </Grid>
                                    </Grid>
                                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            onClick={() => repayForm.setValue("amount", Number(selectedRepaymentInsights.dueNowAmount.toFixed(2)), { shouldValidate: true })}
                                            disabled={selectedRepaymentInsights.dueNowAmount <= 0}
                                        >
                                            Use Due Now
                                        </Button>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            onClick={() => repayForm.setValue("amount", Number(selectedRepaymentInsights.outstandingBalance.toFixed(2)), { shouldValidate: true })}
                                            disabled={selectedRepaymentInsights.outstandingBalance <= 0}
                                        >
                                            Clear Loan
                                        </Button>
                                    </Stack>
                                    {selectedRepaymentInsights.nextDueSchedule ? (
                                        <Typography variant="caption" color="text.secondary">
                                            Next installment: #{selectedRepaymentInsights.nextDueSchedule.installment_number} due {formatDate(selectedRepaymentInsights.nextDueSchedule.due_date)}
                                        </Typography>
                                    ) : null}
                                </Stack>
                            </Box>
                        ) : null}

                        <TextField
                            label="Repayment Amount"
                            type="number"
                            fullWidth
                            {...repayForm.register("amount")}
                            error={Boolean(repayForm.formState.errors.amount) || selectedRepaymentInsights.excessOverOutstanding > 0}
                            helperText={
                                repayForm.formState.errors.amount?.message
                                || (selectedRepaymentInsights.excessOverOutstanding > 0
                                    ? `This exceeds the outstanding balance by ${formatCurrency(selectedRepaymentInsights.excessOverOutstanding)}.`
                                    : selectedRepaymentLoan
                                        ? `Recommended amount ${formatCurrency(selectedRepaymentInsights.recommendedAmount)}.`
                                        : undefined)
                            }
                        />

                        {selectedRepaymentLoan ? (
                            <Box
                                sx={{
                                    borderRadius: 2,
                                    border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                                    p: 2
                                }}
                            >
                                <Stack spacing={1.25}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                        Repayment Allocation Preview
                                    </Typography>
                                    <Stack direction="row" justifyContent="space-between">
                                        <Typography variant="body2" color="text.secondary">Interest component</Typography>
                                        <Typography variant="body2">{formatCurrency(selectedRepaymentInsights.interestAllocation)}</Typography>
                                    </Stack>
                                    <Stack direction="row" justifyContent="space-between">
                                        <Typography variant="body2" color="text.secondary">Principal component</Typography>
                                        <Typography variant="body2">{formatCurrency(selectedRepaymentInsights.principalAllocation)}</Typography>
                                    </Stack>
                                    <Divider flexItem />
                                    {selectedRepaymentInsights.excessOverOutstanding > 0 ? (
                                        <Alert severity="error" variant="outlined">
                                            The amount is higher than the remaining loan balance and cannot be posted.
                                        </Alert>
                                    ) : selectedRepaymentInsights.shortfallAmount > 0 ? (
                                        <Alert severity="warning" variant="outlined">
                                            This is a partial repayment. {formatCurrency(selectedRepaymentInsights.shortfallAmount)} will still remain due after posting.
                                        </Alert>
                                    ) : selectedRepaymentInsights.extraAmount > 0 ? (
                                        <Alert severity="success" variant="outlined">
                                            {formatCurrency(selectedRepaymentInsights.extraAmount)} is above the current due amount and will reduce future principal early.
                                        </Alert>
                                    ) : selectedRepaymentInsights.matchesDueNow && selectedRepaymentInsights.dueNowAmount > 0 ? (
                                        <Alert severity="info" variant="outlined">
                                            This matches the currently due installment amount.
                                        </Alert>
                                    ) : null}
                                </Stack>
                            </Box>
                        ) : null}

                        <TextField
                            label="Reference"
                            fullWidth
                            {...repayForm.register("reference")}
                            helperText="Generated automatically for teller posting."
                        />
                        <TextField label="Description" fullWidth multiline minRows={3} {...repayForm.register("description")} />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowRepayModal(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        type="submit"
                        form="loan-repay-form"
                        disabled={processing || subscriptionInactive || selectedRepaymentInsights.excessOverOutstanding > 0}
                        sx={darkAccentContainedSx}
                    >
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
                            <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Interest component</Typography><Typography variant="body2">{formatCurrency(pendingRepaymentInsights.interestAllocation)}</Typography></Stack>
                            <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Principal component</Typography><Typography variant="body2">{formatCurrency(pendingRepaymentInsights.principalAllocation)}</Typography></Stack>
                            <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Remaining due after posting</Typography><Typography variant="body2">{formatCurrency(pendingRepaymentInsights.shortfallAmount)}</Typography></Stack>
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
