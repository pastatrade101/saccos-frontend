import type {
    ApiEnvelope,
    AuthMe,
    Branch,
    Plan,
    FinanceResult,
    Loan,
    LoanSchedule,
    LoanTransaction,
    Member,
    StatementRow,
    Tenant,
    UserProfile,
    UserRecord,
    MemberLoginProvisionResult,
    DividendAllocation,
    DividendApproval,
    DividendComponent,
    DividendCycle,
    DividendPayment,
    DividendSnapshot,
    PaginatedResult,
    AuditorSummary,
    AuditorException,
    AuditorJournal,
    AuditorJournalDetail,
    AuditLogEntry,
    MemberApplication,
    ProductBootstrapPayload,
    LoanProduct,
    LoanApplication,
    LoanGuarantor,
    CollateralItem,
    SavingsProduct,
    ShareProduct,
    FeeRule,
    PenaltyRule,
    PostingRule,
    TellerSession,
    ReceiptPolicy,
    TransactionReceipt,
    DailyCashSummary
} from "../types/api";

const routeMap = {
    auth: {
        backendSignIn: "/auth/signin",
        otpSend: "/auth/otp/send",
        otpVerify: "/auth/otp/verify",
        passwordSetupLinkSend: "/auth/password-setup/link/send"
    },
    tenants: {
        create: "/tenants",
        list: "/tenants"
    },
    branches: {
        create: "/branches",
        list: "/branches"
    },
    users: {
        me: "/users/me",
        passwordChanged: "/users/me/password-changed",
        list: "/users",
        create: "/users",
        update: (userId: string) => `/users/${userId}`,
        temporaryCredential: (userId: string) => `/users/${userId}/temporary-credential`,
        setupSuperAdmin: "/users/setup-super-admin"
    },
    cashControl: {
        sessions: "/cash-control/sessions",
        currentSession: "/cash-control/sessions/current",
        openSession: "/cash-control/sessions/open",
        closeSession: (sessionId: string) => `/cash-control/sessions/${sessionId}/close`,
        reviewSession: (sessionId: string) => `/cash-control/sessions/${sessionId}/review`,
        receiptPolicy: "/cash-control/receipt-policy",
        initReceipt: "/cash-control/receipts/init",
        confirmReceipt: (receiptId: string) => `/cash-control/receipts/${receiptId}/confirm`,
        journalReceipts: (journalId: string) => `/cash-control/journals/${journalId}/receipts`,
        receiptDownload: (receiptId: string) => `/cash-control/receipts/${receiptId}/download`,
        dailySummary: "/cash-control/summary/daily",
        dailyCashbookCsv: "/cash-control/reports/daily-cashbook.csv",
        tellerBalancingCsv: "/cash-control/reports/teller-balancing.csv"
    },
    products: {
        bootstrap: "/products/bootstrap",
        loans: "/products/loans",
        savings: "/products/savings",
        shares: "/products/shares",
        fees: "/products/fees",
        penalties: "/products/penalties",
        postingRules: "/products/posting-rules"
    },
    me: {
        subscription: "/me/subscription"
    },
    platform: {
        plans: "/platform/plans",
        planFeatures: (planId: string) => `/platform/plans/${planId}/features`,
        tenants: "/platform/tenants",
        assignSubscription: (tenantId: string) => `/platform/tenants/${tenantId}/subscription`,
        deleteTenant: (tenantId: string) => `/platform/tenants/${tenantId}`
    },
    members: {
        list: "/members",
        accounts: "/members/accounts",
        create: "/members",
        bulkDelete: "/members/bulk-delete",
        update: (memberId: string) => `/members/${memberId}`,
        delete: (memberId: string) => `/members/${memberId}`,
        createLogin: (memberId: string) => `/members/${memberId}/create-login`,
        resetPassword: (memberId: string) => `/members/${memberId}/reset-password`,
        temporaryCredential: (memberId: string) => `/members/${memberId}/temporary-credential`
    },
    memberApplications: {
        list: "/member-applications",
        detail: (applicationId: string) => `/member-applications/${applicationId}`,
        submit: (applicationId: string) => `/member-applications/${applicationId}/submit`,
        review: (applicationId: string) => `/member-applications/${applicationId}/review`,
        approve: (applicationId: string) => `/member-applications/${applicationId}/approve`,
        reject: (applicationId: string) => `/member-applications/${applicationId}/reject`
    },
    loanApplications: {
        list: "/loan-applications",
        detail: (applicationId: string) => `/loan-applications/${applicationId}`,
        submit: (applicationId: string) => `/loan-applications/${applicationId}/submit`,
        appraise: (applicationId: string) => `/loan-applications/${applicationId}/appraise`,
        approve: (applicationId: string) => `/loan-applications/${applicationId}/approve`,
        reject: (applicationId: string) => `/loan-applications/${applicationId}/reject`,
        disburse: (applicationId: string) => `/loan-applications/${applicationId}/disburse`
    },
    imports: {
        members: "/imports/members",
        memberJob: (jobId: string) => `/imports/members/${jobId}`,
        memberJobRows: (jobId: string) => `/imports/members/${jobId}/rows`,
        memberJobFailuresCsv: (jobId: string) => `/imports/members/${jobId}/failures.csv`,
        memberJobCredentials: (jobId: string) => `/imports/members/${jobId}/credentials`
    },
    finance: {
        deposit: "/deposit",
        withdraw: "/withdraw",
        shareContribution: "/share-contribution",
        dividendAllocation: "/dividend-allocation",
        loanPortfolio: "/loan/portfolio",
        loanSchedules: "/loan/schedules",
        loanTransactions: "/loan/transactions",
        loanDisburse: "/loan/disburse",
        loanRepay: "/loan/repay",
        statements: "/statements"
    },
    dividends: {
        options: "/dividends/options",
        cycles: "/dividends/cycles",
        cycle: (cycleId: string) => `/dividends/cycles/${cycleId}`,
        freeze: (cycleId: string) => `/dividends/cycles/${cycleId}/freeze`,
        allocate: (cycleId: string) => `/dividends/cycles/${cycleId}/allocate`,
        submit: (cycleId: string) => `/dividends/cycles/${cycleId}/submit`,
        approve: (cycleId: string) => `/dividends/cycles/${cycleId}/approve`,
        reject: (cycleId: string) => `/dividends/cycles/${cycleId}/reject`,
        pay: (cycleId: string) => `/dividends/cycles/${cycleId}/pay`,
        close: (cycleId: string) => `/dividends/cycles/${cycleId}/close`
    },
    auditor: {
        summary: "/auditor/summary",
        exceptions: "/auditor/exceptions",
        journals: "/auditor/journals",
        journalDetail: (journalId: string) => `/auditor/journals/${journalId}`,
        auditLogs: "/auditor/audit-logs",
        trialBalanceCsv: "/auditor/reports/trial-balance.csv",
        loanAgingCsv: "/auditor/reports/loan-aging.csv",
        parCsv: "/auditor/reports/par.csv",
        dividendsRegisterCsv: "/auditor/reports/dividends-register.csv"
    },
    reports: {
        trialBalance: "/reports/trial-balance/export",
        memberStatements: "/reports/member-statements/export",
        par: "/reports/par/export",
        loanAging: "/reports/loan-aging/export"
    }
} as const;

export const endpoints = {
    auth: {
        backendSignIn: () => routeMap.auth.backendSignIn,
        otpSend: () => routeMap.auth.otpSend,
        otpVerify: () => routeMap.auth.otpVerify,
        passwordSetupLinkSend: () => routeMap.auth.passwordSetupLinkSend
    },
    tenants: {
        create: () => routeMap.tenants.create,
        list: () => routeMap.tenants.list
    },
    branches: {
        create: () => routeMap.branches.create,
        list: () => routeMap.branches.list
    },
    users: {
        me: () => routeMap.users.me,
        passwordChanged: () => routeMap.users.passwordChanged,
        list: () => routeMap.users.list,
        create: () => routeMap.users.create,
        update: (userId: string) => routeMap.users.update(userId),
        temporaryCredential: (userId: string) => routeMap.users.temporaryCredential(userId),
        setupSuperAdmin: () => routeMap.users.setupSuperAdmin
    },
    cashControl: {
        sessions: () => routeMap.cashControl.sessions,
        currentSession: () => routeMap.cashControl.currentSession,
        openSession: () => routeMap.cashControl.openSession,
        closeSession: (sessionId: string) => routeMap.cashControl.closeSession(sessionId),
        reviewSession: (sessionId: string) => routeMap.cashControl.reviewSession(sessionId),
        receiptPolicy: () => routeMap.cashControl.receiptPolicy,
        initReceipt: () => routeMap.cashControl.initReceipt,
        confirmReceipt: (receiptId: string) => routeMap.cashControl.confirmReceipt(receiptId),
        journalReceipts: (journalId: string) => routeMap.cashControl.journalReceipts(journalId),
        receiptDownload: (receiptId: string) => routeMap.cashControl.receiptDownload(receiptId),
        dailySummary: () => routeMap.cashControl.dailySummary,
        dailyCashbookCsv: () => routeMap.cashControl.dailyCashbookCsv,
        tellerBalancingCsv: () => routeMap.cashControl.tellerBalancingCsv
    },
    products: {
        bootstrap: () => routeMap.products.bootstrap,
        loans: () => routeMap.products.loans,
        savings: () => routeMap.products.savings,
        shares: () => routeMap.products.shares,
        fees: () => routeMap.products.fees,
        penalties: () => routeMap.products.penalties,
        postingRules: () => routeMap.products.postingRules
    },
    me: {
        subscription: () => routeMap.me.subscription
    },
    platform: {
        plans: () => routeMap.platform.plans,
        planFeatures: (planId: string) => routeMap.platform.planFeatures(planId),
        tenants: () => routeMap.platform.tenants,
        assignSubscription: (tenantId: string) => routeMap.platform.assignSubscription(tenantId),
        deleteTenant: (tenantId: string) => routeMap.platform.deleteTenant(tenantId)
    },
    members: {
        list: () => routeMap.members.list,
        accounts: () => routeMap.members.accounts,
        create: () => routeMap.members.create,
        bulkDelete: () => routeMap.members.bulkDelete,
        update: (memberId: string) => routeMap.members.update(memberId),
        delete: (memberId: string) => routeMap.members.delete(memberId),
        createLogin: (memberId: string) => routeMap.members.createLogin(memberId),
        resetPassword: (memberId: string) => routeMap.members.resetPassword(memberId),
        temporaryCredential: (memberId: string) => routeMap.members.temporaryCredential(memberId)
    },
    memberApplications: {
        list: () => routeMap.memberApplications.list,
        detail: (applicationId: string) => routeMap.memberApplications.detail(applicationId),
        submit: (applicationId: string) => routeMap.memberApplications.submit(applicationId),
        review: (applicationId: string) => routeMap.memberApplications.review(applicationId),
        approve: (applicationId: string) => routeMap.memberApplications.approve(applicationId),
        reject: (applicationId: string) => routeMap.memberApplications.reject(applicationId)
    },
    loanApplications: {
        list: () => routeMap.loanApplications.list,
        detail: (applicationId: string) => routeMap.loanApplications.detail(applicationId),
        submit: (applicationId: string) => routeMap.loanApplications.submit(applicationId),
        appraise: (applicationId: string) => routeMap.loanApplications.appraise(applicationId),
        approve: (applicationId: string) => routeMap.loanApplications.approve(applicationId),
        reject: (applicationId: string) => routeMap.loanApplications.reject(applicationId),
        disburse: (applicationId: string) => routeMap.loanApplications.disburse(applicationId)
    },
    imports: {
        members: () => routeMap.imports.members,
        memberJob: (jobId: string) => routeMap.imports.memberJob(jobId),
        memberJobRows: (jobId: string) => routeMap.imports.memberJobRows(jobId),
        memberJobFailuresCsv: (jobId: string) => routeMap.imports.memberJobFailuresCsv(jobId),
        memberJobCredentials: (jobId: string) => routeMap.imports.memberJobCredentials(jobId)
    },
    finance: {
        deposit: () => routeMap.finance.deposit,
        withdraw: () => routeMap.finance.withdraw,
        shareContribution: () => routeMap.finance.shareContribution,
        dividendAllocation: () => routeMap.finance.dividendAllocation,
        loanPortfolio: () => routeMap.finance.loanPortfolio,
        loanSchedules: () => routeMap.finance.loanSchedules,
        loanTransactions: () => routeMap.finance.loanTransactions,
        loanDisburse: () => routeMap.finance.loanDisburse,
        loanRepay: () => routeMap.finance.loanRepay,
        statements: () => routeMap.finance.statements
    },
    dividends: {
        options: () => routeMap.dividends.options,
        cycles: () => routeMap.dividends.cycles,
        cycle: (cycleId: string) => routeMap.dividends.cycle(cycleId),
        freeze: (cycleId: string) => routeMap.dividends.freeze(cycleId),
        allocate: (cycleId: string) => routeMap.dividends.allocate(cycleId),
        submit: (cycleId: string) => routeMap.dividends.submit(cycleId),
        approve: (cycleId: string) => routeMap.dividends.approve(cycleId),
        reject: (cycleId: string) => routeMap.dividends.reject(cycleId),
        pay: (cycleId: string) => routeMap.dividends.pay(cycleId),
        close: (cycleId: string) => routeMap.dividends.close(cycleId)
    },
    auditor: {
        summary: () => routeMap.auditor.summary,
        exceptions: () => routeMap.auditor.exceptions,
        journals: () => routeMap.auditor.journals,
        journalDetail: (journalId: string) => routeMap.auditor.journalDetail(journalId),
        auditLogs: () => routeMap.auditor.auditLogs,
        trialBalanceCsv: () => routeMap.auditor.trialBalanceCsv,
        loanAgingCsv: () => routeMap.auditor.loanAgingCsv,
        parCsv: () => routeMap.auditor.parCsv,
        dividendsRegisterCsv: () => routeMap.auditor.dividendsRegisterCsv
    },
    reports: {
        trialBalance: () => routeMap.reports.trialBalance,
        memberStatements: () => routeMap.reports.memberStatements,
        par: () => routeMap.reports.par,
        loanAging: () => routeMap.reports.loanAging
    }
};

export interface AuthSessionTokens {
    access_token: string;
    refresh_token: string;
}

export interface OtpChallengeResponse {
    challenge_id: string;
    expires_at: string;
    destination_hint: string;
    resend_count: number;
    resend_remaining: number;
}

export interface PasswordSetupLinkSendResponse {
    success: boolean;
    destination_hint?: string;
}

export interface BackendSignInRequest {
    email: string;
    password: string;
    challenge_id?: string | null;
    otp_code?: string | null;
}

export interface BackendSignInResponse {
    session: AuthSessionTokens & Record<string, unknown>;
    user: {
        id: string;
        email?: string;
    };
    profile: UserProfile | null;
}

export interface OtpSendRequest {
    email: string;
    password: string;
    challenge_id?: string | null;
}

export interface OtpVerifyRequest {
    email: string;
    password: string;
    challenge_id: string;
    otp_code: string;
}

export interface CreateTenantRequest {
    name: string;
    registration_number: string;
    status?: "active" | "inactive" | "suspended";
    plan?: "starter" | "growth" | "enterprise";
    subscription_status?: "active" | "past_due" | "suspended" | "cancelled";
}

export type CreateTenantResponse = ApiEnvelope<Tenant>;
export type TenantsListResponse = ApiEnvelope<Tenant[]>;

export interface CreateBranchRequest {
    tenant_id: string;
    name: string;
    code: string;
    address_line1: string;
    address_line2?: string | null;
    city: string;
    state: string;
    country: string;
}

export type CreateBranchResponse = ApiEnvelope<Branch>;
export type BranchesListResponse = ApiEnvelope<Branch[]>;

export interface SetupSuperAdminRequest {
    tenant_id: string;
    branch_id?: string | null;
    email: string;
    full_name: string;
    phone?: string | null;
    send_invite?: boolean;
    password?: string | null;
}

export type SetupSuperAdminResponse = ApiEnvelope<{
    user?: {
        id: string;
        email?: string;
    };
    profile?: UserProfile;
    branch_id?: string;
    temporary_password?: string | null;
}>;

export interface CreateUserRequest {
    tenant_id?: string;
    email: string;
    full_name: string;
    phone?: string | null;
    role: "super_admin" | "branch_manager" | "loan_officer" | "teller" | "auditor";
    branch_ids: string[];
    send_invite?: boolean;
    password?: string;
}

export type CreateUserResponse = ApiEnvelope<UserRecord>;
export type UsersListResponse = ApiEnvelope<import("../types/api").StaffAccessPayload>;

export interface UpdateUserRequest {
    full_name?: string;
    phone?: string | null;
    role?: "super_admin" | "branch_manager" | "loan_officer" | "teller" | "auditor";
    is_active?: boolean;
    branch_ids?: string[];
}

export interface MeQuery {
    tenant_id?: string;
}

export type MeResponse = ApiEnvelope<AuthMe>;
export type MeSubscriptionResponse = ApiEnvelope<import("../types/api").Subscription>;
export type PlansResponse = ApiEnvelope<Plan[]>;
export type PlatformTenantsResponse = ApiEnvelope<Tenant[]>;

export interface UpdatePlanFeaturesRequest {
    features: Array<{
        feature_key: string;
        feature_type: "bool" | "int" | "string";
        bool_value?: boolean | null;
        int_value?: number | null;
        string_value?: string | null;
    }>;
}

export interface AssignTenantSubscriptionRequest {
    plan_code: "starter" | "growth" | "enterprise";
    status: "active" | "past_due" | "suspended" | "cancelled";
    start_at?: string;
    expires_at?: string;
}

export interface DeleteTenantRequest {
    confirm_name: string;
}

export interface CreateMemberRequest {
    tenant_id?: string;
    branch_id: string;
    full_name: string;
    dob?: string | null;
    phone?: string | null;
    email?: string | null;
    member_no?: string | null;
    national_id?: string | null;
    address_line1?: string | null;
    address_line2?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    postal_code?: string | null;
    nida_no?: string | null;
    tin_no?: string | null;
    next_of_kin_name?: string | null;
    next_of_kin_phone?: string | null;
    next_of_kin_relationship?: string | null;
    employer?: string | null;
    kyc_status?: "pending" | "verified" | "rejected" | "waived";
    kyc_reason?: string | null;
    notes?: string | null;
    status?: "active" | "suspended" | "exited";
    login?: {
        create_login: boolean;
        send_invite?: boolean;
        password?: string | null;
    };
}

export type MembersResponse = ApiEnvelope<Member[]>;
export type MemberAccountsResponse = ApiEnvelope<import("../types/api").MemberAccount[]>;
export type CreateMemberResponse = ApiEnvelope<{
    member: Member;
    login: MemberLoginProvisionResult | null;
}>;
export interface UpdateMemberRequest {
    branch_id?: string;
    full_name?: string;
    dob?: string | null;
    phone?: string | null;
    email?: string | null;
    member_no?: string | null;
    national_id?: string | null;
    address_line1?: string | null;
    address_line2?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    postal_code?: string | null;
    nida_no?: string | null;
    tin_no?: string | null;
    next_of_kin_name?: string | null;
    next_of_kin_phone?: string | null;
    next_of_kin_relationship?: string | null;
    employer?: string | null;
    kyc_status?: "pending" | "verified" | "rejected" | "waived";
    kyc_reason?: string | null;
    notes?: string | null;
    status?: "active" | "suspended" | "exited";
}
export type UpdateMemberResponse = ApiEnvelope<Member>;

export interface BulkDeleteMembersRequest {
    member_ids: string[];
}

export type BulkDeleteMembersResponse = ApiEnvelope<{
    requested: number;
    deleted_count: number;
    failed_count: number;
    deleted_members: Array<{ id: string; full_name: string }>;
    failed_members: Array<{ id: string; code: string; message: string }>;
}>;

export interface CreateMemberApplicationRequest {
    branch_id: string;
    full_name: string;
    dob?: string | null;
    phone?: string | null;
    email?: string | null;
    address_line1?: string | null;
    address_line2?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    postal_code?: string | null;
    nida_no?: string | null;
    tin_no?: string | null;
    next_of_kin_name?: string | null;
    next_of_kin_phone?: string | null;
    next_of_kin_relationship?: string | null;
    employer?: string | null;
    member_no?: string | null;
    national_id?: string | null;
    notes?: string | null;
    kyc_status?: "pending" | "verified" | "rejected" | "waived";
    kyc_reason?: string | null;
    membership_fee_amount?: number;
    membership_fee_paid?: number;
}

export interface ReviewMemberApplicationRequest {
    notes?: string | null;
    kyc_status?: "pending" | "verified" | "rejected" | "waived";
    kyc_reason?: string | null;
}

export interface RejectMemberApplicationRequest {
    reason: string;
}

export type MemberApplicationsResponse = ApiEnvelope<MemberApplication[]>;
export type ProductBootstrapResponse = ApiEnvelope<ProductBootstrapPayload>;
export type LoanProductsResponse = ApiEnvelope<LoanProduct[]>;
export type SavingsProductsResponse = ApiEnvelope<SavingsProduct[]>;
export type ShareProductsResponse = ApiEnvelope<ShareProduct[]>;
export type FeeRulesResponse = ApiEnvelope<FeeRule[]>;
export type PenaltyRulesResponse = ApiEnvelope<PenaltyRule[]>;
export type PostingRulesResponse = ApiEnvelope<PostingRule[]>;

export interface CreateMemberLoginRequest {
    email?: string | null;
    send_invite?: boolean;
    password?: string | null;
}

export interface ResetMemberPasswordRequest {
    password?: string | null;
}

export type LoansResponse = ApiEnvelope<Loan[]>;
export type LoanApplicationResponse = ApiEnvelope<LoanApplication>;
export type LoanApplicationsResponse = ApiEnvelope<LoanApplication[]>;
export type LoanSchedulesResponse = ApiEnvelope<LoanSchedule[]>;
export type LoanTransactionsResponse = ApiEnvelope<LoanTransaction[]>;
export type TellerSessionsResponse = ApiEnvelope<TellerSession[]>;
export type TellerSessionResponse = ApiEnvelope<TellerSession | null>;
export type ReceiptPolicyResponse = ApiEnvelope<ReceiptPolicy>;
export type TransactionReceiptsResponse = ApiEnvelope<TransactionReceipt[]>;
export type DailyCashSummaryResponse = ApiEnvelope<DailyCashSummary[]>;

export interface OpenTellerSessionRequest {
    branch_id?: string;
    opening_cash: number;
    notes?: string | null;
}

export interface CreateLoanApplicationRequest {
    tenant_id?: string;
    branch_id?: string;
    member_id?: string;
    product_id: string;
    external_reference?: string | null;
    purpose: string;
    requested_amount: number;
    requested_term_count: number;
    requested_repayment_frequency?: "daily" | "weekly" | "monthly";
    requested_interest_rate?: number | null;
    guarantors?: LoanGuarantor[];
    collateral_items?: CollateralItem[];
}

export type UpdateLoanApplicationRequest = Partial<CreateLoanApplicationRequest>;

export interface AppraiseLoanApplicationRequest {
    recommended_amount: number;
    recommended_term_count: number;
    recommended_interest_rate: number;
    recommended_repayment_frequency: "daily" | "weekly" | "monthly";
    risk_rating: "low" | "medium" | "high";
    appraisal_notes: string;
    guarantors?: LoanGuarantor[];
    collateral_items?: CollateralItem[];
}

export interface ApproveLoanApplicationRequest {
    notes?: string | null;
}

export interface RejectLoanApplicationRequest {
    reason: string;
    notes?: string | null;
}

export interface DisburseApprovedLoanRequest {
    reference?: string | null;
    description?: string | null;
    receipt_ids?: string[];
}

export interface CloseTellerSessionRequest {
    closing_cash: number;
    notes?: string | null;
}

export interface ReviewTellerSessionRequest {
    review_notes?: string | null;
}

export interface UpdateReceiptPolicyRequest {
    branch_id?: string | null;
    receipt_required: boolean;
    required_threshold: number;
    max_receipts_per_tx: number;
    allowed_mime_types: string[];
    max_file_size_mb: number;
    enforce_on_types: Array<"deposit" | "withdraw" | "loan_repay" | "loan_disburse" | "share_contribution">;
}

export interface ReceiptInitRequest {
    branch_id: string;
    member_id?: string | null;
    transaction_type: "deposit" | "withdraw" | "loan_repay" | "loan_disburse" | "share_contribution";
    file_name: string;
    mime_type: string;
    file_size_bytes: number;
}

export interface ReceiptInitResponseData {
    receipt: TransactionReceipt;
    upload: {
        path: string;
        token: string;
        signedUrl: string;
    };
}

export type ReceiptInitResponse = ApiEnvelope<ReceiptInitResponseData>;
export type ReceiptDownloadResponse = ApiEnvelope<{ signed_url: string; receipt: TransactionReceipt }>;

export type CreateMemberLoginResponse = ApiEnvelope<MemberLoginProvisionResult>;
export type ResetMemberPasswordResponse = ApiEnvelope<MemberLoginProvisionResult>;
export type TemporaryCredentialResponse = ApiEnvelope<import("../types/api").TemporaryCredential>;

export interface ImportMembersResponseData {
    job_id: string;
    total_rows: number;
    success_rows: number;
    failed_rows: number;
    credentials_download_url?: string | null;
}

export type ImportMembersResponse = ApiEnvelope<ImportMembersResponseData>;
export type ImportJobResponse = ApiEnvelope<import("../types/api").ImportJob>;
export type ImportJobRowsResponse = ApiEnvelope<{
    items: import("../types/api").ImportJobRow[];
    total: number;
    page: number;
    limit: number;
}>;
export type CredentialsLinkResponse = ApiEnvelope<{ signed_url: string }>;

export interface CashRequest {
    tenant_id?: string;
    account_id: string;
    amount: number;
    reference?: string | null;
    description?: string | null;
    receipt_ids?: string[];
}

export type CashResponse = ApiEnvelope<FinanceResult>;
export type ShareContributionRequest = CashRequest;
export type ShareContributionResponse = CashResponse;
export type DividendAllocationRequest = CashRequest;
export type DividendAllocationResponse = CashResponse;

export interface DividendComponentInput {
    type: "share_dividend" | "savings_interest_bonus" | "patronage_refund";
    basis_method:
        | "end_balance"
        | "average_daily_balance"
        | "average_monthly_balance"
        | "minimum_balance"
        | "total_interest_paid"
        | "total_fees_paid"
        | "transaction_volume";
    distribution_mode: "rate" | "fixed_pool";
    rate_percent?: number | null;
    pool_amount?: number | null;
    retained_earnings_account_id: string;
    dividends_payable_account_id: string;
    payout_account_id?: string | null;
    reserve_account_id?: string | null;
    eligibility_rules_json: Record<string, unknown>;
    rounding_rules_json: Record<string, unknown>;
}

export interface CreateDividendCycleRequest {
    tenant_id?: string;
    branch_id?: string | null;
    period_label: string;
    start_date: string;
    end_date: string;
    declaration_date: string;
    record_date?: string | null;
    payment_date?: string | null;
    required_checker_count: number;
    components: DividendComponentInput[];
}

export type UpdateDividendCycleRequest = Partial<CreateDividendCycleRequest>;
export interface DividendApprovalRequest {
    notes?: string | null;
    signature_hash?: string | null;
}

export interface DividendPaymentRequest {
    payment_method: "cash" | "bank" | "mobile_money" | "reinvest_to_shares";
    reference?: string | null;
    description?: string | null;
}

export interface DividendOptionsResponse extends ApiEnvelope<{
    branches: Branch[];
    accounts: Array<{
        id: string;
        account_code: string;
        account_name: string;
        account_type: string;
        system_tag?: string | null;
    }>;
}> {}

export type DividendCyclesResponse = ApiEnvelope<DividendCycle[]>;
export type DividendCycleDetailResponse = ApiEnvelope<{
    cycle: DividendCycle;
    components: DividendComponent[];
    approvals: DividendApproval[];
    allocations: DividendAllocation[];
    snapshots: DividendSnapshot[];
    payments: DividendPayment[];
}>;

export interface LoanDisburseRequest {
    tenant_id?: string;
    member_id: string;
    branch_id: string;
    principal_amount: number;
    annual_interest_rate: number;
    term_count: number;
    repayment_frequency?: "daily" | "weekly" | "monthly";
    reference?: string | null;
    description?: string | null;
}

export interface LoanRepaymentRequest {
    tenant_id?: string;
    loan_id: string;
    amount: number;
    reference?: string | null;
    description?: string | null;
}

export interface StatementQuery {
    tenant_id?: string;
    member_id?: string;
    account_id?: string;
    from_date?: string;
    to_date?: string;
}

export type StatementsResponse = ApiEnvelope<StatementRow[]>;
export type AuditorSummaryResponse = ApiEnvelope<AuditorSummary>;
export type AuditorExceptionsResponse = ApiEnvelope<PaginatedResult<AuditorException>>;
export type AuditorJournalsResponse = ApiEnvelope<PaginatedResult<AuditorJournal>>;
export type AuditorJournalDetailResponse = ApiEnvelope<AuditorJournalDetail>;
export type AuditorAuditLogsResponse = ApiEnvelope<PaginatedResult<AuditLogEntry>>;
