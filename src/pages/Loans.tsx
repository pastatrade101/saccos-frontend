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
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    MenuItem,
    Pagination,
    Stack,
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
            const [{ data: membersResponse }, { data: productsResponse }, { data: applicationsResponse }, { data: loansResponse }, { data: schedulesResponse }, { data: transactionsResponse }] = await Promise.all([
                api.get<MembersResponse>(endpoints.members.list()),
                api.get<LoanProductsResponse>(endpoints.products.loans()),
                api.get<LoanApplicationsResponse>(endpoints.loanApplications.list(), {
                    params: { tenant_id: selectedTenantId }
                }),
                api.get<LoansResponse>(endpoints.finance.loanPortfolio(), {
                    params: { tenant_id: selectedTenantId }
                }),
                api.get<LoanSchedulesResponse>(endpoints.finance.loanSchedules(), {
                    params: { tenant_id: selectedTenantId }
                }),
                api.get<LoanTransactionsResponse>(endpoints.finance.loanTransactions(), {
                    params: { tenant_id: selectedTenantId }
                })
            ]);

            setMembers(membersResponse.data || []);
            setLoanProducts(productsResponse.data || []);
            setApplications(applicationsResponse.data || []);
            setLoans(loansResponse.data || []);
            setSchedules((schedulesResponse.data || []).filter((schedule) => ["pending", "partial", "overdue"].includes(schedule.status)));
            setTransactions(transactionsResponse.data || []);
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

    useEffect(() => {
        void loadWorkspace();
    }, [selectedTenantId]);

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

    const paginatedApplications = useMemo(
        () => applications.slice((applicationPage - 1) * pageSize, applicationPage * pageSize),
        [applications, applicationPage]
    );
    const applicationTotalPages = Math.max(1, Math.ceil(applications.length / pageSize));

    const paginatedLoans = useMemo(
        () => loans.slice((loanPage - 1) * pageSize, loanPage * pageSize),
        [loans, loanPage]
    );
    const loanTotalPages = Math.max(1, Math.ceil(loans.length / pageSize));

    useEffect(() => {
        setApplicationPage(1);
    }, [applications.length]);

    useEffect(() => {
        setLoanPage(1);
    }, [loans.length]);

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
                                ? "info"
                                : "warning";
                const label = row.status === "approved" && row.approval_count < row.required_approval_count
                    ? `awaiting ${row.required_approval_count - row.approval_count} approval(s)`
                    : row.status;

                return <Chip size="small" color={color} variant={row.status === "rejected" ? "outlined" : "filled"} label={label} />;
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
                        startIcon={<VisibilityRoundedIcon />}
                        onClick={() => setReviewTarget(row)}
                    >
                        View Details
                    </Button>
                    {(row.status === "draft" || row.status === "rejected") && canCreateApplications ? (
                        <Button size="small" variant="outlined" onClick={() => void submitDraftApplication(row)}>
                            Submit
                        </Button>
                    ) : null}
                    {row.status === "submitted" && canAppraise ? (
                        <Button size="small" variant="outlined" onClick={() => openAppraisalDialog(row)}>
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
        { key: "created", header: "Date", render: (row) => formatDate(row.created_at) },
        {
            key: "loan",
            header: "Loan",
            render: (row) => loans.find((loan) => loan.id === row.loan_id)?.loan_number || row.loan_id
        },
        {
            key: "type",
            header: "Type",
            render: (row) => row.transaction_type === "loan_repayment" ? "Repayment" : row.transaction_type === "loan_disbursement" ? "Disbursement" : "Interest Accrual"
        },
        { key: "amount", header: "Amount", render: (row) => formatCurrency(row.amount) },
        { key: "principal", header: "Principal", render: (row) => formatCurrency(row.principal_component) },
        { key: "interest", header: "Interest", render: (row) => formatCurrency(row.interest_component) },
        { key: "reference", header: "Reference", render: (row) => row.reference || "N/A" }
    ];

    const pendingRepaymentLoan =
        pendingMoneyAction?.type === "repay"
            ? loans.find((loan) => loan.id === pendingMoneyAction.values.loan_id)
            : null;
    const pendingRepaymentAmount =
        pendingMoneyAction?.type === "repay" ? pendingMoneyAction.values.amount : 0;

    return (
        <Stack spacing={3}>
            <MotionCard
                variant="outlined"
                sx={{
                    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)}, ${alpha(theme.palette.background.paper, 0.92)})`
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
                                    onClick={() => setShowCreateModal(true)}
                                    disabled={subscriptionInactive}
                                    sx={{
                                        flex: { xs: 1, sm: "0 0 auto" },
                                        minWidth: { sm: 220 },
                                        borderRadius: 1.5,
                                        fontWeight: 700
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
                                    onClick={() => setShowRepayModal(true)}
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

            {subscriptionInactive ? (
                <Alert severity="warning" variant="outlined">
                    Loan actions are blocked while the tenant subscription is inactive.
                </Alert>
            ) : null}

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
                                    label={`${applications.length} application(s)`}
                                    color="primary"
                                    variant="outlined"
                                />
                            </Stack>
                            <DataTable rows={paginatedApplications} columns={applicationColumns} emptyMessage={loading ? "Loading applications..." : "No loan applications found."} />
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}>
                                <Typography variant="body2" color="text.secondary">
                                    Showing {applications.length ? (applicationPage - 1) * pageSize + 1 : 0}-{Math.min(applicationPage * pageSize, applications.length)} of {applications.length}
                                </Typography>
                                <Pagination
                                    page={applicationPage}
                                    count={applicationTotalPages}
                                    onChange={(_, value) => setApplicationPage(value)}
                                    color="primary"
                                />
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>
                <Grid size={{ xs: 12, lg: 4 }}>
                    <MotionCard variant="outlined" sx={{ height: "100%" }}>
                        <CardContent>
                            <Typography variant="h6">Workflow Guardrails</Typography>
                            <Stack spacing={1.5} sx={{ mt: 2 }}>
                                <Alert severity="info" variant="outlined">
                                    Members and staff originate applications. Drafts or rejected applications must be submitted before they can be appraised.
                                </Alert>
                                <Alert severity="warning" variant="outlined">
                                    Loan officers appraise. Branch managers approve. The maker cannot approve the same application.
                                </Alert>
                                <Alert severity="success" variant="outlined">
                                    Teller or loan officer disbursement is the only step that triggers the double-entry loan posting procedure.
                                </Alert>
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>
            </Grid>

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
                                <Chip label={`${loans.length} disbursed loan(s)`} variant="outlined" />
                            </Stack>
                            <DataTable rows={paginatedLoans} columns={loanColumns} emptyMessage={loading ? "Loading loan portfolio..." : "No disbursed loans found."} />
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}>
                                <Typography variant="body2" color="text.secondary">
                                    Showing {loans.length ? (loanPage - 1) * pageSize + 1 : 0}-{Math.min(loanPage * pageSize, loans.length)} of {loans.length}
                                </Typography>
                                <Pagination
                                    page={loanPage}
                                    count={loanTotalPages}
                                    onChange={(_, value) => setLoanPage(value)}
                                    color="primary"
                                />
                            </Stack>
                        </CardContent>
                    </MotionCard>
                </Grid>
                <Grid size={{ xs: 12, lg: 4 }}>
                    <MotionCard variant="outlined" sx={{ height: "100%" }}>
                        <CardContent>
                            <Typography variant="h6">Loan Activity</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, mb: 2 }}>
                                Repayments, disbursements, and interest accrual remain traceable after origination.
                            </Typography>
                            <DataTable
                                rows={transactions.slice(0, 8)}
                                columns={transactionColumns}
                                emptyMessage={loading ? "Loading activity..." : "No loan activity found."}
                            />
                        </CardContent>
                    </MotionCard>
                </Grid>
            </Grid>

            <MotionModal open={showCreateModal} onClose={processing ? undefined : () => setShowCreateModal(false)} maxWidth="md" fullWidth>
                <DialogTitle>Create Loan Application</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2} sx={{ pt: 0.5 }}>
                        <Alert severity="info" variant="outlined">
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
                    <Button variant="contained" type="submit" form="loan-application-form" disabled={processing || subscriptionInactive}>
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
                    <Button variant="contained" type="submit" form="loan-appraisal-form" disabled={processing}>
                        {processing ? "Saving..." : "Save Appraisal"}
                    </Button>
                </DialogActions>
            </MotionModal>

            <MotionModal open={Boolean(approvalTarget)} onClose={processing ? undefined : () => setApprovalTarget(null)} maxWidth="sm" fullWidth>
                <DialogTitle>Approve Loan Application</DialogTitle>
                <DialogContent dividers>
                    <Box component="form" id="loan-approve-form" onSubmit={saveApproval} sx={{ display: "grid", gap: 2, pt: 0.5 }}>
                        <Alert severity="info" variant="outlined">
                            Approval records governance consent only. The actual double-entry loan posting will occur later at disbursement.
                        </Alert>
                        <TextField label="Approval Notes" fullWidth multiline minRows={3} {...approveForm.register("notes")} />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setApprovalTarget(null)}>Cancel</Button>
                    <Button variant="contained" type="submit" form="loan-approve-form" disabled={processing}>
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
                    <Button variant="contained" type="submit" form="loan-repay-form" disabled={processing || subscriptionInactive}>
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
