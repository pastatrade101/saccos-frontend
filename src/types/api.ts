export type Role =
    | "platform_admin"
    | "platform_owner"
    | "super_admin"
    | "branch_manager"
    | "loan_officer"
    | "teller"
    | "auditor"
    | "member";

export type SubscriptionStatus = "active" | "past_due" | "cancelled" | "missing";
export type SubscriptionPlan = "starter" | "growth" | "enterprise";
export type MemberStatus = "active" | "suspended" | "exited";
export type LoanStatus = "draft" | "active" | "closed" | "in_arrears" | "written_off";
export type KycStatus = "pending" | "verified" | "rejected" | "waived";
export type MemberApplicationStatus = "draft" | "submitted" | "under_review" | "approved" | "rejected" | "cancelled";

export interface ApiEnvelope<T> {
    data: T;
}

export interface ApiErrorPayload {
    error: {
        code: string;
        message: string;
        details?: unknown;
        requestId?: string;
    };
}

export interface Tenant {
    id: string;
    name: string;
    registration_number: string;
    status: string;
    created_at: string;
    branch_count?: number;
    subscriptions?: Subscription[];
    subscription?: Subscription | null;
}

export interface Subscription {
    id?: string;
    plan_id?: string;
    tenant_id?: string;
    plan: SubscriptionPlan | null;
    plan_name?: string | null;
    status: SubscriptionStatus | "suspended";
    start_at?: string | null;
    expires_at?: string | null;
    grace_period_until?: string | null;
    isUsable?: boolean;
    limits?: Record<string, number>;
    features?: Record<string, boolean | number | string | null>;
}

export interface PlanFeature {
    id?: string;
    plan_id?: string;
    feature_key: string;
    feature_type: "bool" | "int" | "string";
    bool_value?: boolean | null;
    int_value?: number | null;
    string_value?: string | null;
    created_at?: string;
}

export interface Plan {
    id: string;
    code: SubscriptionPlan;
    name: string;
    description?: string | null;
    is_active: boolean;
    created_at: string;
    plan_features?: PlanFeature[];
}

export interface UserProfile {
    user_id: string;
    tenant_id: string;
    branch_id?: string | null;
    member_id?: string | null;
    full_name: string;
    phone: string | null;
    role: Role;
    is_active: boolean;
    must_change_password?: boolean;
    first_login_at?: string | null;
    created_at?: string;
}

export interface StaffAccessUser {
    id: string;
    user_id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    role: Role;
    branch_id: string | null;
    branch_name: string;
    is_active: boolean;
    last_login_at: string | null;
    invited_at?: string | null;
    email_confirmed_at?: string | null;
    created_at?: string;
    branch_ids: string[];
    has_temporary_password?: boolean;
}

export interface StaffAccessTotals {
    total_staff: number;
    active_access: number;
    administrators: number;
    managers: number;
    operators: number;
    inactive_users: number;
    pending_invites: number;
}

export interface StaffRoleCounts {
    super_admin: number;
    branch_manager: number;
    loan_officer: number;
    teller: number;
    auditor: number;
}

export interface StaffConflict {
    user_id: string;
    full_name: string;
    roles: string[];
    reason: string;
}

export interface StaffAccessPayload {
    totals: StaffAccessTotals;
    roleCounts: StaffRoleCounts;
    users: StaffAccessUser[];
    conflicts: StaffConflict[];
}

export interface AuthMe {
    user: {
        id: string;
        email?: string;
        app_metadata?: Record<string, unknown>;
        user_metadata?: Record<string, unknown>;
    };
    profile: UserProfile | null;
    branch_ids: string[];
    tenant?: {
        id: string;
        name: string;
    } | null;
    branches?: Array<{
        id: string;
        name: string;
        code?: string;
    }>;
    subscription: Subscription | null;
}

export interface Branch {
    id: string;
    tenant_id: string;
    name: string;
    code: string;
    address_line1: string;
    address_line2: string | null;
    city: string;
    state: string;
    country: string;
    created_at: string;
}

export interface UserRecord {
    user?: {
        id: string;
        email?: string;
    };
    profile?: UserProfile;
    temporary_password?: string | null;
    invite_delivery?: "email" | "sms_link" | "password";
    destination_hint?: string | null;
}

export interface MemberLoginProvisionResult {
    member: Member;
    profile: UserProfile;
    user: {
        id: string;
        email?: string;
    };
    temporary_password?: string | null;
}

export interface TemporaryCredential {
    id?: string;
    user_id: string;
    member_id?: string | null;
    full_name?: string;
    email: string;
    temporary_password: string;
    created_at?: string;
}

export interface Member {
    id: string;
    tenant_id: string;
    branch_id: string;
    user_id?: string | null;
    full_name: string;
    phone: string | null;
    email?: string | null;
    member_no?: string | null;
    national_id: string | null;
    notes?: string | null;
    status: MemberStatus;
    dob?: string | null;
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
    kyc_status?: KycStatus;
    kyc_reason?: string | null;
    created_at: string;
}

export interface MemberApplication {
    id: string;
    tenant_id: string;
    branch_id: string;
    application_no: string;
    status: MemberApplicationStatus;
    kyc_status: KycStatus;
    kyc_reason?: string | null;
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
    membership_fee_amount: number;
    membership_fee_paid: number;
    approved_member_id?: string | null;
    created_by: string;
    reviewed_by?: string | null;
    reviewed_at?: string | null;
    approved_by?: string | null;
    approved_at?: string | null;
    rejected_by?: string | null;
    rejected_at?: string | null;
    rejection_reason?: string | null;
    created_at: string;
    updated_at: string;
}

export interface LoanProduct {
    id: string;
    tenant_id: string;
    code: string;
    name: string;
    description?: string | null;
    interest_method: "reducing_balance" | "flat";
    annual_interest_rate: number;
    min_amount: number;
    max_amount?: number | null;
    min_term_count: number;
    max_term_count?: number | null;
    insurance_rate: number;
    required_guarantors_count: number;
    eligibility_rules_json?: Record<string, unknown>;
    processing_fee_rule_id?: string | null;
    penalty_rule_id?: string | null;
    receivable_account_id: string;
    interest_income_account_id: string;
    fee_income_account_id?: string | null;
    penalty_income_account_id?: string | null;
    is_default: boolean;
    status: "active" | "inactive";
}

export interface LoanGuarantor {
    id?: string;
    application_id?: string;
    tenant_id?: string;
    member_id: string;
    guaranteed_amount: number;
    consent_status?: "pending" | "accepted" | "rejected";
    consented_at?: string | null;
    notes?: string | null;
}

export interface CollateralItem {
    id?: string;
    application_id?: string;
    tenant_id?: string;
    collateral_type: string;
    description: string;
    valuation_amount: number;
    lien_reference?: string | null;
    documents_json?: string[];
}

export interface LoanApproval {
    id: string;
    application_id: string;
    tenant_id: string;
    approver_id: string;
    approval_level: number;
    decision: "approved" | "rejected";
    notes?: string | null;
    created_at: string;
}

export type ApprovalOperationKey = "finance.withdraw" | "finance.loan_disburse";
export type ApprovalRequestStatus = "pending" | "approved" | "rejected" | "executed" | "expired" | "cancelled";

export interface ApprovalPolicy {
    operation_key: ApprovalOperationKey;
    enabled: boolean;
    threshold_amount: number;
    required_checker_count: number;
    allowed_maker_roles: string[];
    allowed_checker_roles: string[];
    sla_minutes: number;
}

export interface ApprovalDecision {
    id: string;
    decision: "approved" | "rejected";
    decided_by: string;
    notes?: string | null;
    created_at: string;
}

export interface ApprovalRequest {
    id: string;
    tenant_id: string;
    branch_id?: string | null;
    operation_key: ApprovalOperationKey;
    entity_type?: string | null;
    entity_id?: string | null;
    status: ApprovalRequestStatus;
    maker_user_id: string;
    payload_json?: Record<string, unknown>;
    policy_snapshot?: Record<string, unknown>;
    requested_amount: number;
    currency: string;
    threshold_amount: number;
    required_checker_count: number;
    approved_count: number;
    rejection_reason?: string | null;
    requested_at: string;
    expires_at?: string | null;
    last_decision_at?: string | null;
    executed_at?: string | null;
    created_at: string;
    updated_at: string;
    awaiting_additional_approvals?: boolean;
    decisions?: ApprovalDecision[];
}

export interface LoanApplication {
    id: string;
    tenant_id: string;
    branch_id: string;
    member_id: string;
    product_id: string;
    external_reference?: string | null;
    purpose: string;
    requested_amount: number;
    requested_term_count: number;
    requested_repayment_frequency: "daily" | "weekly" | "monthly";
    requested_interest_rate?: number | null;
    created_via: "member_portal" | "staff";
    status: "draft" | "submitted" | "appraised" | "approved" | "rejected" | "disbursed" | "cancelled";
    requested_by: string;
    requested_on_behalf_by?: string | null;
    submitted_at?: string | null;
    appraised_by?: string | null;
    appraised_at?: string | null;
    appraisal_notes?: string | null;
    risk_rating?: "low" | "medium" | "high" | string | null;
    recommended_amount?: number | null;
    recommended_term_count?: number | null;
    recommended_interest_rate?: number | null;
    recommended_repayment_frequency?: "daily" | "weekly" | "monthly" | null;
    required_approval_count: number;
    approval_count: number;
    approval_notes?: string | null;
    approved_by?: string | null;
    approved_at?: string | null;
    disbursement_ready_at?: string | null;
    rejected_by?: string | null;
    rejected_at?: string | null;
    rejection_reason?: string | null;
    disbursed_by?: string | null;
    disbursed_at?: string | null;
    loan_id?: string | null;
    created_at: string;
    updated_at: string;
    members?: Pick<Member, "id" | "full_name" | "member_no" | "branch_id" | "user_id" | "phone" | "email">;
    loan_products?: Pick<LoanProduct, "id" | "code" | "name">;
    loan_approvals?: LoanApproval[];
    loan_guarantors?: LoanGuarantor[];
    collateral_items?: CollateralItem[];
}

export interface SavingsProduct {
    id: string;
    tenant_id: string;
    code: string;
    name: string;
    is_compulsory: boolean;
    is_default: boolean;
    min_opening_balance: number;
    min_balance: number;
    withdrawal_notice_days: number;
    allow_withdrawals: boolean;
    status: "active" | "inactive";
    liability_account_id: string;
    fee_income_account_id?: string | null;
}

export interface ShareProduct {
    id: string;
    tenant_id: string;
    code: string;
    name: string;
    is_compulsory: boolean;
    is_default: boolean;
    minimum_shares: number;
    maximum_shares?: number | null;
    allow_refund: boolean;
    status: "active" | "inactive";
    equity_account_id: string;
    fee_income_account_id?: string | null;
}

export interface FeeRule {
    id: string;
    tenant_id: string;
    code: string;
    name: string;
    fee_type: "membership_fee" | "withdrawal_fee" | "loan_processing_fee" | "other";
    calculation_method: "flat" | "percentage" | "percentage_per_period";
    flat_amount: number;
    percentage_value: number;
    is_active: boolean;
    income_account_id: string;
}

export interface PenaltyRule {
    id: string;
    tenant_id: string;
    code: string;
    name: string;
    penalty_type: "late_repayment" | "arrears" | "other";
    calculation_method: "flat" | "percentage" | "percentage_per_period";
    flat_amount: number;
    percentage_value: number;
    is_active: boolean;
    income_account_id: string;
}

export interface PostingRule {
    id: string;
    tenant_id: string;
    operation_code: string;
    scope: "general" | "savings" | "shares" | "loans" | "dividends" | "membership";
    description?: string | null;
    debit_account_id: string;
    credit_account_id: string;
    is_active: boolean;
    metadata?: Record<string, unknown>;
}

export interface ChartOfAccountOption {
    id: string;
    account_code: string;
    account_name: string;
    account_type: "asset" | "liability" | "equity" | "income" | "expense";
    system_tag?: string | null;
}

export interface ProductBootstrapPayload {
    savings_products: SavingsProduct[];
    loan_products: LoanProduct[];
    share_products: ShareProduct[];
    fee_rules: FeeRule[];
    penalty_rules: PenaltyRule[];
    posting_rules: PostingRule[];
    chart_of_accounts: ChartOfAccountOption[];
}

export interface ImportJob {
    id: string;
    tenant_id: string;
    branch_id: string;
    created_by: string;
    kind: string;
    status: "pending" | "processing" | "completed" | "failed";
    total_rows: number;
    success_rows: number;
    failed_rows: number;
    credentials_path?: string | null;
    failures_path?: string | null;
    created_at: string;
    completed_at?: string | null;
}

export interface ImportJobRow {
    id: string;
    job_id: string;
    row_number: number;
    raw: Record<string, string>;
    status: "success" | "failed";
    error?: string | null;
    member_id?: string | null;
    auth_user_id?: string | null;
    created_at: string;
}

export interface MemberAccount {
    id: string;
    tenant_id: string;
    member_id: string;
    branch_id: string;
    account_number: string;
    account_name: string;
    product_type: "savings" | "shares" | "fixed_deposit";
    status: "active" | "dormant" | "closed";
    available_balance: number;
    locked_balance: number;
    created_at: string;
}

export interface StatementRow {
    tenant_id: string;
    transaction_id: string;
    account_id: string;
    account_number: string;
    member_id: string;
    member_name: string;
    transaction_type: string;
    direction: "in" | "out";
    amount: number;
    running_balance: number;
    reference: string | null;
    transaction_date: string;
    created_at: string;
}

export interface Loan {
    id: string;
    tenant_id: string;
    member_id: string;
    branch_id: string;
    loan_number: string;
    principal_amount: number;
    annual_interest_rate: number;
    term_count: number;
    repayment_frequency: "daily" | "weekly" | "monthly";
    status: LoanStatus;
    outstanding_principal: number;
    accrued_interest: number;
    last_interest_accrual_at?: string | null;
    disbursed_at?: string | null;
    created_at: string;
}

export interface LoanSchedule {
    id: string;
    tenant_id: string;
    loan_id: string;
    installment_number: number;
    due_date: string;
    principal_due: number;
    interest_due: number;
    principal_paid: number;
    interest_paid: number;
    status: "pending" | "partial" | "paid" | "overdue";
}

export interface LoanTransaction {
    id: string;
    tenant_id: string;
    loan_account_id: string;
    loan_id: string;
    member_id: string;
    branch_id: string;
    journal_id: string;
    transaction_type: "loan_disbursement" | "loan_repayment" | "interest_accrual" | "adjustment";
    direction: "in" | "out";
    amount: number;
    principal_component: number;
    interest_component: number;
    running_principal_balance: number;
    running_interest_balance: number;
    reference?: string | null;
    created_by: string;
    created_at: string;
}

export interface FinanceResult {
    success: boolean;
    message: string;
    journal_id?: string;
    account_id?: string;
    loan_account_id?: string;
    new_balance?: number;
    loan_id?: string;
    loan_number?: string;
    installment_amount?: number;
    interest_component?: number;
    principal_component?: number;
}

export interface TellerSession {
    id: string;
    tenant_id: string;
    branch_id: string;
    teller_user_id: string;
    opened_by: string;
    opening_cash: number;
    expected_cash: number;
    closing_cash?: number | null;
    variance?: number | null;
    status: "open" | "closed_pending_review" | "reviewed";
    notes?: string | null;
    opened_at: string;
    closed_at?: string | null;
    reviewed_by?: string | null;
    reviewed_at?: string | null;
    review_notes?: string | null;
    created_at: string;
    updated_at: string;
}

export interface ReceiptPolicy {
    id: string;
    tenant_id: string;
    branch_id?: string | null;
    receipt_required: boolean;
    required_threshold: number;
    max_receipts_per_tx: number;
    allowed_mime_types: string[];
    max_file_size_mb: number;
    enforce_on_types: Array<"deposit" | "withdraw" | "loan_repay" | "loan_disburse" | "share_contribution">;
    created_at: string;
    updated_at: string;
}

export interface TransactionReceipt {
    id: string;
    tenant_id: string;
    branch_id: string;
    journal_id?: string | null;
    member_id?: string | null;
    transaction_type: "deposit" | "withdraw" | "loan_repay" | "loan_disburse" | "share_contribution";
    draft_token: string;
    storage_bucket: string;
    storage_path: string;
    file_name: string;
    mime_type: string;
    file_size_bytes: number;
    checksum_sha256?: string | null;
    status: "pending_upload" | "uploaded" | "confirmed" | "rejected";
    uploaded_by: string;
    confirmed_by?: string | null;
    confirmed_at?: string | null;
    expires_at: string;
    created_at: string;
}

export interface DailyCashSummary {
    tenant_id: string;
    branch_id: string;
    teller_user_id: string;
    business_date: string;
    sessions_count: number;
    opening_cash_total: number;
    deposits_total: number;
    withdrawals_total: number;
    net_movement: number;
    expected_cash_total: number;
    closing_cash_total: number;
    variance_total: number;
    has_open_session: boolean;
}

export interface PaginatedResult<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
    };
}

export interface AuditorSummary {
    trial_balance_balanced: boolean;
    unposted_journals_count: number;
    backdated_entries_count: number;
    reversals_count: number;
    manual_journals_count: number;
    high_value_tx_count: number;
    out_of_hours_count: number;
}

export interface AuditorException {
    tenant_id: string;
    journal_id: string | null;
    reference: string | null;
    user_id: string | null;
    branch_id: string | null;
    amount: number;
    created_at: string;
    reason_code:
        | "HIGH_VALUE_TX"
        | "BACKDATED_ENTRY"
        | "REVERSAL"
        | "OUT_OF_HOURS_POSTING"
        | "MAKER_CHECKER_VIOLATION"
        | "CASH_VARIANCE"
        | "MANUAL_JOURNAL";
}

export interface AuditorJournal {
    id: string;
    tenant_id: string;
    reference: string;
    description?: string | null;
    entry_date: string;
    posted: boolean;
    posted_at?: string | null;
    source_type: string;
    created_by: string;
    created_at: string;
    is_reversal: boolean;
    reversed_journal_id?: string | null;
    debit_total: number;
    credit_total: number;
    flags: string[];
}

export interface AuditorJournalLine {
    id: string;
    journal_id: string;
    tenant_id: string;
    account_id: string;
    member_account_id?: string | null;
    branch_id?: string | null;
    debit: number;
    credit: number;
    chart_of_accounts?: {
        account_code?: string;
        account_name?: string;
    } | null;
}

export interface AuditorJournalDetail {
    journal: AuditorJournal;
    lines: AuditorJournalLine[];
}

export interface AuditLogEntry {
    id: string;
    tenant_id: string;
    actor_user_id?: string | null;
    user_id?: string | null;
    action: string;
    entity_type: string;
    entity_id?: string | null;
    before_data?: Record<string, unknown> | null;
    after_data?: Record<string, unknown> | null;
    ip?: string | null;
    user_agent?: string | null;
    created_at: string;
}

export interface DividendCycle {
    id: string;
    tenant_id: string;
    branch_id?: string | null;
    period_label: string;
    start_date: string;
    end_date: string;
    declaration_date: string;
    record_date?: string | null;
    payment_date?: string | null;
    status: "draft" | "frozen" | "allocated" | "approved" | "paid" | "closed";
    required_checker_count: number;
    config_json: Record<string, unknown>;
    config_version: number;
    config_hash: string;
    totals_json: Record<string, unknown>;
    declaration_journal_id?: string | null;
    payment_journal_id?: string | null;
    created_by: string;
    approved_by?: string | null;
    approved_at?: string | null;
    submitted_for_approval_at?: string | null;
    submitted_for_approval_by?: string | null;
    created_at: string;
    updated_at?: string;
}

export interface DividendComponent {
    id: string;
    cycle_id: string;
    tenant_id: string;
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
    created_at?: string;
}

export interface DividendApproval {
    id: string;
    cycle_id: string;
    tenant_id: string;
    approved_by: string;
    approved_at: string;
    decision: "approved" | "rejected";
    notes?: string | null;
    signature_hash?: string | null;
}

export interface DividendAllocation {
    id: string;
    cycle_id: string;
    component_id: string;
    tenant_id: string;
    member_id: string;
    basis_value: number;
    payout_amount: number;
    status: "pending" | "paid" | "void";
    payment_ref?: string | null;
    paid_at?: string | null;
    created_at?: string;
}

export interface DividendSnapshot {
    id: string;
    cycle_id: string;
    tenant_id: string;
    member_id: string;
    eligibility_status: boolean;
    eligibility_reason?: string | null;
    snapshot_json: Record<string, unknown>;
    created_at?: string;
}

export interface DividendPayment {
    id: string;
    cycle_id: string;
    tenant_id: string;
    payment_method: "cash" | "bank" | "mobile_money" | "reinvest_to_shares";
    total_amount: number;
    processed_by: string;
    processed_at: string;
    journal_entry_id?: string | null;
    reference?: string | null;
    notes?: string | null;
}

export interface ReportRow {
    [key: string]: string | number | null;
}
