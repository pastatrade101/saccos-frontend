import { MotionCard, MotionModal } from "../ui/motion";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import BadgeRoundedIcon from "@mui/icons-material/BadgeRounded";
import CreditScoreRoundedIcon from "@mui/icons-material/CreditScoreRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import LockPersonRoundedIcon from "@mui/icons-material/LockPersonRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PaidRoundedIcon from "@mui/icons-material/PaidRounded";
import PersonAddAlt1RoundedIcon from "@mui/icons-material/PersonAddAlt1Rounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
    Alert,
    Avatar,
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    Chip,
    Divider,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    InputAdornment,
    MenuItem,
    Pagination,
    Stack,
    TextField,
    Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { AppLoader } from "../components/AppLoader";
import { DataTable, type Column } from "../components/DataTable";
import { useToast } from "../components/Toast";
import { api, getApiErrorMessage } from "../lib/api";
import {
    type BranchesListResponse,
    type BulkDeleteMembersRequest,
    type BulkDeleteMembersResponse,
    endpoints,
    type CreateMemberLoginRequest,
    type CreateMemberLoginResponse,
    type CreateMemberRequest,
    type CreateMemberResponse,
    type MemberAccountsResponse,
    type MembersResponse,
    type ProvisionMemberAccountRequest,
    type ProvisionMemberAccountResponse,
    type ProductBootstrapResponse,
    type ResetMemberPasswordRequest,
    type ResetMemberPasswordResponse,
    type TemporaryCredentialResponse,
    type UpdateMemberRequest,
    type UpdateMemberResponse
} from "../lib/endpoints";
import { supabase } from "../lib/supabase";
import type { Branch, Member, MemberAccount, ProductBootstrapPayload } from "../types/api";
import { formatCurrency, formatDate, formatRole } from "../utils/format";

const schema = z.object({
    first_name: z.string().trim().min(2, "First name is required."),
    last_name: z.string().trim().min(2, "Last name is required."),
    phone: z
        .string()
        .trim()
        .min(1, "Phone is required.")
        .regex(/^(?:\+?255|0)\d{9}$/, "Enter a valid phone (e.g. 0712345678 or +255712345678)."),
    email: z.string().email("Enter a valid email.").optional().or(z.literal("")),
    national_id: z.string().min(5, "National ID is required."),
    branch_id: z.string().uuid("Select a branch."),
    savings_product_id: z.string().uuid("Select a savings product."),
    share_product_id: z.string().uuid("Select a share product."),
    status: z.enum(["active", "suspended", "exited"]).default("active"),
    create_login: z.boolean().default(false),
    send_invite: z.boolean().default(true),
    password: z.string().optional()
}).superRefine((value, ctx) => {
    if (value.create_login && !value.email) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Email is required when creating a member login.",
            path: ["email"]
        });
    }

    if (value.create_login && !value.send_invite && value.password && value.password.length < 8) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Password must be at least 8 characters when provided.",
            path: ["password"]
        });
    }
});

type MemberFormValues = z.infer<typeof schema>;
type MemberWithAccount = Member & { account?: MemberAccount | null };

const provisionAccountSchema = z.object({
    product_type: z.enum(["savings", "shares"]).default("savings"),
    savings_product_id: z.string().optional().or(z.literal("")),
    share_product_id: z.string().optional().or(z.literal("")),
    account_name: z.string().max(120, "Keep the account name under 120 characters.").optional().or(z.literal(""))
}).superRefine((value, ctx) => {
    if (value.product_type === "savings" && !value.savings_product_id) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Select a savings product.",
            path: ["savings_product_id"]
        });
    }

    if (value.product_type === "shares" && !value.share_product_id) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Select a share product.",
            path: ["share_product_id"]
        });
    }
});

type ProvisionAccountValues = z.infer<typeof provisionAccountSchema>;

const updateSchema = z.object({
    full_name: z.string().min(3, "Full name is required."),
    phone: z.string().min(7, "Phone is required."),
    email: z.string().email("Enter a valid email.").optional().or(z.literal("")),
    national_id: z.string().min(5, "National ID is required."),
    branch_id: z.string().uuid("Select a branch."),
    status: z.enum(["active", "suspended", "exited"]).default("active")
});

type UpdateMemberFormValues = z.infer<typeof updateSchema>;

const memberLoginSchema = z.object({
    email: z.string().email("Valid email is required."),
    send_invite: z.boolean().default(true),
    password: z.string().optional()
}).superRefine((value, ctx) => {
    if (!value.send_invite && value.password && value.password.length < 8) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Password must be at least 8 characters when provided.",
            path: ["password"]
        });
    }
});

type MemberLoginValues = z.infer<typeof memberLoginSchema>;
interface MemberCredentialsHandoff {
    full_name: string;
    email: string;
    temporary_password: string;
}

type MemberStatusFilter = "all" | "active" | "suspended" | "exited";
type MemberOperationalFilter = "all" | "ready" | "needs_login" | "needs_account" | "needs_review";

const emptyProductBootstrap: ProductBootstrapPayload = {
    savings_products: [],
    loan_products: [],
    share_products: [],
    fee_rules: [],
    penalty_rules: [],
    posting_rules: [],
    chart_of_accounts: []
};

function composeMemberFullName(firstName: string, lastName: string) {
    return `${firstName.trim()} ${lastName.trim()}`.replace(/\s+/g, " ").trim();
}

function pickPrimaryMemberAccount(accounts: MemberAccount[]) {
    return accounts.find((account) => account.product_type === "savings" && account.status === "active")
        || accounts.find((account) => account.product_type === "shares" && account.status === "active")
        || accounts[0]
        || null;
}

function getMemberAccountProductLabel(
    account: MemberAccount,
    savingsProducts: ProductBootstrapPayload["savings_products"],
    shareProducts: ProductBootstrapPayload["share_products"]
) {
    if (account.product_type === "savings") {
        const product = savingsProducts.find((entry) => entry.id === account.savings_product_id);
        return product ? `${product.name} (${product.code})` : "Savings product";
    }

    if (account.product_type === "shares") {
        const product = shareProducts.find((entry) => entry.id === account.share_product_id);
        return product ? `${product.name} (${product.code})` : "Share product";
    }

    return "Fixed deposit";
}

function isMissingDeletedAtColumnError(error: unknown) {
    const code = typeof error === "object" && error && "code" in error
        ? String((error as { code?: string }).code || "")
        : "";
    const message = typeof error === "object" && error && "message" in error
        ? String((error as { message?: string }).message || "").toLowerCase()
        : "";

    return code === "42703" || message.includes("deleted_at");
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
        <MotionCard
            variant="outlined"
            sx={{
                height: "100%",
                borderRadius: 2,
                borderColor: alpha("#0f172a", 0.08),
                boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)"
            }}
        >
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
                    <Avatar
                        variant="rounded"
                        sx={{
                            width: 42,
                            height: 42,
                            borderRadius: 2,
                            bgcolor: "action.hover",
                            color: "text.primary"
                        }}
                    >
                        {icon}
                    </Avatar>
                </Stack>
            </CardContent>
        </MotionCard>
    );
}

export function MembersPage() {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === "dark";
    const memberAccent = isDarkMode ? "#D9B273" : theme.palette.primary.main;
    const memberAccentStrong = isDarkMode ? "#C89B52" : theme.palette.primary.main;
    const navigate = useNavigate();
    const { pushToast } = useToast();
    const { profile, selectedTenantId, selectedTenantName, selectedBranchId } = useAuth();
    const [members, setMembers] = useState<MemberWithAccount[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [memberAccountsByMember, setMemberAccountsByMember] = useState<Record<string, MemberAccount[]>>({});
    const [productBootstrap, setProductBootstrap] = useState<ProductBootstrapPayload>(emptyProductBootstrap);
    const [selectedMember, setSelectedMember] = useState<MemberWithAccount | null>(null);
    const [selectedMemberAccounts, setSelectedMemberAccounts] = useState<MemberAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [accountsLoading, setAccountsLoading] = useState(false);
    const [accountsLoaded, setAccountsLoaded] = useState(false);
    const [selectedMemberAccountsLoading, setSelectedMemberAccountsLoading] = useState(false);
    const [productBootstrapLoading, setProductBootstrapLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [updatingMember, setUpdatingMember] = useState(false);
    const [provisioningAccount, setProvisioningAccount] = useState(false);
    const [provisioningLogin, setProvisioningLogin] = useState(false);
    const [resettingMemberPassword, setResettingMemberPassword] = useState(false);
    const [deletingMember, setDeletingMember] = useState(false);
    const [deletingBulkMembers, setDeletingBulkMembers] = useState(false);
    const [showDeleteMemberDialog, setShowDeleteMemberDialog] = useState(false);
    const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
    const [showMemberWorkspaceModal, setShowMemberWorkspaceModal] = useState(false);
    const [showOnboardForm, setShowOnboardForm] = useState(false);
    const [showProvisionAccountDialog, setShowProvisionAccountDialog] = useState(false);
    const [showUpdateMemberForm, setShowUpdateMemberForm] = useState(false);
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
    const [lastMemberCredentials, setLastMemberCredentials] = useState<MemberCredentialsHandoff | null>(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<MemberStatusFilter>("all");
    const [operationalFilter, setOperationalFilter] = useState<MemberOperationalFilter>("all");
    const [branchFilter, setBranchFilter] = useState<string>("all");
    const [page, setPage] = useState(1);
    const [serverTotalMembers, setServerTotalMembers] = useState(0);
    const deferredSearch = useDeferredValue(search);
    const pageSize = 8;

    const canCreateMembers = Boolean(
        profile && ["branch_manager"].includes(profile.role)
    );
    const canCreateMemberLogins = Boolean(
        profile && ["branch_manager"].includes(profile.role)
    );
    const canResetMemberPasswords = Boolean(
        profile && ["super_admin"].includes(profile.role)
    );
    const canViewMemberCredentials = canCreateMemberLogins || canResetMemberPasswords;
    const canUpdateMembers = Boolean(
        profile && ["branch_manager"].includes(profile.role)
    );
    const canDeleteMembers = Boolean(
        profile && ["super_admin", "branch_manager"].includes(profile.role)
    );
    const isTeller = profile?.role === "teller";
    const canOpenCashDesk = profile?.role === "teller";
    const canOpenLoans = profile?.role === "loan_officer";
    const useModalMemberWorkspace = profile?.role === "branch_manager";

    const form = useForm<MemberFormValues>({
        resolver: zodResolver(schema),
        mode: "onChange",
        reValidateMode: "onChange",
        defaultValues: {
            first_name: "",
            last_name: "",
            phone: "",
            email: "",
            national_id: "",
            branch_id: selectedBranchId || "",
            savings_product_id: "",
            share_product_id: "",
            status: "active",
            create_login: false,
            send_invite: true,
            password: ""
        }
    });

    const memberLoginForm = useForm<MemberLoginValues>({
        resolver: zodResolver(memberLoginSchema),
        defaultValues: {
            email: "",
            send_invite: true,
            password: ""
        }
    });

    const updateForm = useForm<UpdateMemberFormValues>({
        resolver: zodResolver(updateSchema),
        defaultValues: {
            full_name: "",
            phone: "",
            email: "",
            national_id: "",
            branch_id: selectedBranchId || "",
            status: "active"
        }
    });

    const provisionAccountForm = useForm<ProvisionAccountValues>({
        resolver: zodResolver(provisionAccountSchema),
        defaultValues: {
            product_type: "savings",
            savings_product_id: "",
            share_product_id: "",
            account_name: ""
        }
    });

    const createLoginNow = form.watch("create_login");
    const onboardingInviteMode = form.watch("send_invite");
    const standaloneInviteMode = memberLoginForm.watch("send_invite");
    const provisionProductType = provisionAccountForm.watch("product_type");
    const activeSavingsProducts = useMemo(
        () => productBootstrap.savings_products.filter((product) => product.status === "active"),
        [productBootstrap.savings_products]
    );
    const activeShareProducts = useMemo(
        () => productBootstrap.share_products.filter((product) => product.status === "active"),
        [productBootstrap.share_products]
    );
    const productCatalogReady = activeSavingsProducts.length > 0 && activeShareProducts.length > 0;
    const selectedMemberActiveSavingsProductIds = useMemo(
        () => new Set(
            selectedMemberAccounts
                .filter((account) => account.product_type === "savings" && account.status === "active" && account.savings_product_id)
                .map((account) => account.savings_product_id as string)
        ),
        [selectedMemberAccounts]
    );
    const availableProvisionSavingsProducts = useMemo(
        () => activeSavingsProducts.filter((product) => !selectedMemberActiveSavingsProductIds.has(product.id)),
        [activeSavingsProducts, selectedMemberActiveSavingsProductIds]
    );
    const selectedMemberHasActiveShareAccount = useMemo(
        () => selectedMemberAccounts.some((account) => account.product_type === "shares" && account.status === "active"),
        [selectedMemberAccounts]
    );

    const loadMemberAccounts = async (options?: { silent?: boolean; force?: boolean; members?: MemberWithAccount[] }) => {
        if (!selectedTenantId) {
            return;
        }

        if (accountsLoading) {
            return;
        }

        if (accountsLoaded && !options?.force) {
            return;
        }

        const scopedMembers = options?.members || members;
        const scopedMemberIds = scopedMembers.map((member) => member.id);
        if (!scopedMemberIds.length) {
            setAccountsLoaded(true);
            return;
        }

        setAccountsLoading(true);

        try {
            const fetchAccounts = async (includeSoftDeleteFilter: boolean) => {
                let query = supabase
                    .from("member_accounts")
                    .select("*")
                    .eq("tenant_id", selectedTenantId)
                    .in("member_id", scopedMemberIds);

                if (includeSoftDeleteFilter) {
                    query = query.is("deleted_at", null);
                }

                const { data, error } = await query;

                if (error && includeSoftDeleteFilter && isMissingDeletedAtColumnError(error)) {
                    return fetchAccounts(false);
                }

                if (error) {
                    throw error;
                }

                return data || [];
            };

            const data = await fetchAccounts(true);

            const accountsByMember = new Map<string, MemberAccount[]>();
            (data || []).forEach((account) => {
                const typedAccount = account as MemberAccount;
                const existing = accountsByMember.get(typedAccount.member_id) || [];
                existing.push(typedAccount);
                accountsByMember.set(typedAccount.member_id, existing);
            });

            const nextAccountsByMember = Object.fromEntries(accountsByMember.entries());
            setMemberAccountsByMember(nextAccountsByMember);

            setMembers((current) => current.map((member) => ({
                ...member,
                account: pickPrimaryMemberAccount(accountsByMember.get(member.id) || [])
            })));
            setSelectedMember((current) => {
                if (!current) {
                    return null;
                }

                return {
                    ...current,
                    account: pickPrimaryMemberAccount(accountsByMember.get(current.id) || [])
                };
            });
            setAccountsLoaded(true);
        } catch (error) {
            setAccountsLoaded(true);
            if (!options?.silent) {
                pushToast({
                    type: "error",
                    title: "Unable to load member accounts",
                    message: getApiErrorMessage(error)
                });
            }
        } finally {
            setAccountsLoading(false);
        }
    };

    const loadProductBootstrap = async () => {
        if (!selectedTenantId) {
            setProductBootstrap(emptyProductBootstrap);
            setProductBootstrapLoading(false);
            return;
        }

        setProductBootstrapLoading(true);

        try {
            const { data } = await api.get<ProductBootstrapResponse>(endpoints.products.bootstrap(), {
                params: { tenant_id: selectedTenantId }
            });
            setProductBootstrap(data.data || emptyProductBootstrap);
        } catch (error) {
            setProductBootstrap(emptyProductBootstrap);
            pushToast({
                type: "error",
                title: "Unable to load product catalog",
                message: getApiErrorMessage(error)
            });
        } finally {
            setProductBootstrapLoading(false);
        }
    };

    const loadSelectedMemberAccounts = async (memberId: string) => {
        if (!selectedTenantId) {
            setSelectedMemberAccounts([]);
            setSelectedMemberAccountsLoading(false);
            return;
        }

        setSelectedMemberAccountsLoading(true);

        try {
            const { data } = await api.get<MemberAccountsResponse>(endpoints.members.accounts(), {
                params: {
                    tenant_id: selectedTenantId,
                    member_id: memberId,
                    page: 1,
                    limit: 100
                }
            });

            const nextAccounts = data.data || [];
            setSelectedMemberAccounts(nextAccounts);
            setMemberAccountsByMember((current) => ({
                ...current,
                [memberId]: nextAccounts
            }));
            setMembers((current) => current.map((member) => (
                member.id === memberId
                    ? {
                        ...member,
                        account: pickPrimaryMemberAccount(nextAccounts)
                    }
                    : member
            )));
            setSelectedMember((current) => (
                current && current.id === memberId
                    ? {
                        ...current,
                        account: pickPrimaryMemberAccount(nextAccounts)
                    }
                    : current
            ));
        } catch (error) {
            setSelectedMemberAccounts([]);
            pushToast({
                type: "error",
                title: "Unable to load member accounts",
                message: getApiErrorMessage(error)
            });
        } finally {
            setSelectedMemberAccountsLoading(false);
        }
    };

    const loadMembers = async () => {
        if (!selectedTenantId) {
            setMembers([]);
            setBranches([]);
            setMemberAccountsByMember({});
            setSelectedMember(null);
            setSelectedMemberAccounts([]);
            setProductBootstrap(emptyProductBootstrap);
            setServerTotalMembers(0);
            setAccountsLoaded(false);
            setAccountsLoading(false);
            setLoading(false);
            return;
        }

        setLoading(true);

        try {
            const [{ data: memberResponse }, { data: branchResponse }] = await Promise.all([
                api.get<MembersResponse>(endpoints.members.list(), {
                    params: {
                        tenant_id: selectedTenantId,
                        page,
                        limit: pageSize,
                        search: deferredSearch.trim() || undefined,
                        status: statusFilter === "all" ? undefined : statusFilter,
                        branch_id: branchFilter === "all" ? undefined : branchFilter
                    }
                }),
                api.get<BranchesListResponse>(endpoints.branches.list(), {
                    params: { tenant_id: selectedTenantId, page: 1, limit: 100 }
                })
            ]);

            const currentAccounts = new Map<string, MemberAccount>();
            members.forEach((member) => {
                if (member.account?.id) {
                    currentAccounts.set(member.id, member.account);
                }
            });

            const nextBranches = (branchResponse.data || []).filter((branch) => branch.tenant_id === selectedTenantId);
            const nextMembers = memberResponse.data.map((member) => ({
                ...member,
                account: currentAccounts.get(member.id) || null
            }));
            const totalMembers =
                Number((memberResponse as unknown as { pagination?: { total?: number } }).pagination?.total || 0) ||
                nextMembers.length;

            setBranches(nextBranches);
            setMembers(nextMembers);
            setServerTotalMembers(totalMembers);
            setSelectedMember((current) => {
                if (!current) {
                    return null;
                }

                return nextMembers.find((member) => member.id === current.id) || null;
            });
            void loadMemberAccounts({ silent: true, force: true, members: nextMembers });
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to load members",
                message: getApiErrorMessage(error)
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setAccountsLoaded(false);
        setAccountsLoading(false);
        void loadMembers();
    }, [branchFilter, deferredSearch, page, selectedTenantId, statusFilter]);

    useEffect(() => {
        void loadProductBootstrap();
    }, [selectedTenantId]);

    useEffect(() => {
        form.setValue("branch_id", selectedBranchId || branches[0]?.id || "");
    }, [branches, form, selectedBranchId]);

    useEffect(() => {
        const savingsId = form.getValues("savings_product_id");
        if (!savingsId || !activeSavingsProducts.some((product) => product.id === savingsId)) {
            form.setValue("savings_product_id", activeSavingsProducts[0]?.id || "", { shouldValidate: Boolean(showOnboardForm) });
        }

        const shareId = form.getValues("share_product_id");
        if (!shareId || !activeShareProducts.some((product) => product.id === shareId)) {
            form.setValue("share_product_id", activeShareProducts[0]?.id || "", { shouldValidate: Boolean(showOnboardForm) });
        }
    }, [activeSavingsProducts, activeShareProducts, form, showOnboardForm]);

    useEffect(() => {
        memberLoginForm.reset({
            email: selectedMember?.email || "",
            send_invite: true,
            password: ""
        });
    }, [memberLoginForm, selectedMember]);

    useEffect(() => {
        updateForm.reset({
            full_name: selectedMember?.full_name || "",
            phone: selectedMember?.phone || "",
            email: selectedMember?.email || "",
            national_id: selectedMember?.national_id || "",
            branch_id: selectedMember?.branch_id || selectedBranchId || branches[0]?.id || "",
            status: selectedMember?.status || "active"
        });
    }, [branches, selectedBranchId, selectedMember, updateForm]);

    useEffect(() => {
        provisionAccountForm.reset({
            product_type: "savings",
            savings_product_id: availableProvisionSavingsProducts[0]?.id || "",
            share_product_id: activeShareProducts[0]?.id || "",
            account_name: ""
        });
    }, [activeShareProducts, availableProvisionSavingsProducts, provisionAccountForm, selectedMember]);

    useEffect(() => {
        if (selectedBranchId && branchFilter === "all") {
            setBranchFilter(selectedBranchId);
        }
    }, [branchFilter, selectedBranchId]);

    useEffect(() => {
        if (!selectedMember?.id) {
            setSelectedMemberAccounts([]);
            setSelectedMemberAccountsLoading(false);
            setShowUpdateMemberForm(false);
            return;
        }

        void loadSelectedMemberAccounts(selectedMember.id);
    }, [selectedMember?.id, selectedTenantId]);

    const filteredMembers = useMemo(() => {
        return members.filter((member) => {
            if (operationalFilter === "ready") {
                if (!accountsLoaded) {
                    return member.status === "active" && Boolean(member.user_id);
                }
                return member.status === "active" && Boolean(member.account?.id);
            }

            if (operationalFilter === "needs_login") {
                return !member.user_id;
            }

            if (operationalFilter === "needs_account") {
                if (!accountsLoaded) {
                    return false;
                }
                return !member.account?.id;
            }

            if (operationalFilter === "needs_review") {
                if (!accountsLoaded) {
                    return member.status !== "active" || !member.user_id;
                }
                return member.status !== "active" || !member.user_id || !member.account?.id;
            }

            return true;
        });
    }, [accountsLoaded, members, operationalFilter]);

    const totalPages = Math.max(1, Math.ceil((serverTotalMembers || 0) / pageSize));
    const paginatedMembers = filteredMembers;
    const selectedMemberIdSet = useMemo(() => new Set(selectedMemberIds), [selectedMemberIds]);
    const selectedMembers = useMemo(
        () => members.filter((member) => selectedMemberIdSet.has(member.id)),
        [members, selectedMemberIdSet]
    );
    const paginatedMemberIds = useMemo(() => paginatedMembers.map((member) => member.id), [paginatedMembers]);
    const allPaginatedMembersSelected = paginatedMemberIds.length > 0 && paginatedMemberIds.every((memberId) => selectedMemberIdSet.has(memberId));
    const somePaginatedMembersSelected = !allPaginatedMembersSelected && paginatedMemberIds.some((memberId) => selectedMemberIdSet.has(memberId));

    useEffect(() => {
        setPage(1);
    }, [branchFilter, deferredSearch, statusFilter]);

    useEffect(() => {
        const memberIds = new Set(members.map((member) => member.id));
        setSelectedMemberIds((current) => current.filter((memberId) => memberIds.has(memberId)));
    }, [members]);

    const onSubmit = form.handleSubmit(async (values) => {
        setSubmitting(true);

        try {
            const fullName = composeMemberFullName(values.first_name, values.last_name);
            const payload: CreateMemberRequest = {
                tenant_id: selectedTenantId || undefined,
                branch_id: values.branch_id,
                savings_product_id: values.savings_product_id,
                share_product_id: values.share_product_id,
                first_name: values.first_name.trim(),
                last_name: values.last_name.trim(),
                full_name: fullName,
                phone: values.phone,
                email: values.email || null,
                national_id: values.national_id,
                status: values.status,
                login: values.create_login
                    ? {
                        create_login: true,
                        send_invite: values.send_invite,
                        password: values.send_invite ? null : values.password
                    }
                    : undefined
            };

            const { data } = await api.post<CreateMemberResponse>(endpoints.members.create(), payload);
            const temporaryPassword = data.data.login?.temporary_password || (!values.send_invite && values.password ? values.password : null);
            setLastMemberCredentials(
                temporaryPassword && (data.data.login?.user.email || values.email)
                    ? {
                        full_name: data.data.member.full_name,
                        email: data.data.login?.user.email || values.email || "",
                        temporary_password: temporaryPassword
                    }
                    : null
            );
            pushToast({
                type: "success",
                title: "Member created",
                message: data.data.login
                    ? values.send_invite
                        ? (data.data.login.destination_hint
                            ? `${data.data.member.full_name} was created, savings and share accounts were provisioned, and an SMS setup link was sent to ${data.data.login.destination_hint}.`
                            : `${data.data.member.full_name} was created, savings and share accounts were provisioned, and an SMS setup link was sent.`)
                        : values.password
                            ? `${data.data.member.full_name} was created with a login plus savings and share accounts provisioned.`
                            : `${data.data.member.full_name} was created with a generated temporary password plus savings and share accounts provisioned.`
                    : `${data.data.member.full_name} was created and savings and share accounts were provisioned.`
            });
            form.reset({
                first_name: "",
                last_name: "",
                phone: "",
                email: "",
                national_id: "",
                branch_id: values.branch_id,
                savings_product_id: activeSavingsProducts[0]?.id || "",
                share_product_id: activeShareProducts[0]?.id || "",
                status: "active",
                create_login: false,
                send_invite: true,
                password: ""
            });
            setShowOnboardForm(false);
            await loadMembers();
        } catch (error) {
            pushToast({
                type: "error",
                title: "Member creation failed",
                message: getApiErrorMessage(error)
            });
        } finally {
            setSubmitting(false);
        }
    });

    const provisionAccount = provisionAccountForm.handleSubmit(async (values) => {
        if (!selectedMember) {
            return;
        }

        setProvisioningAccount(true);

        try {
            const payload: ProvisionMemberAccountRequest = {
                product_type: values.product_type,
                savings_product_id: values.product_type === "savings" ? values.savings_product_id || null : null,
                share_product_id: values.product_type === "shares" ? values.share_product_id || null : null,
                account_name: values.account_name?.trim() || null
            };

            const { data } = await api.post<ProvisionMemberAccountResponse>(
                endpoints.members.provisionAccount(selectedMember.id),
                payload
            );

            pushToast({
                type: "success",
                title: "Account provisioned",
                message: `${data.data.account_name} is now active for ${selectedMember.full_name}.`
            });
            setShowProvisionAccountDialog(false);
            provisionAccountForm.reset({
                product_type: "savings",
                savings_product_id: availableProvisionSavingsProducts[0]?.id || "",
                share_product_id: activeShareProducts[0]?.id || "",
                account_name: ""
            });
            await loadMemberAccounts({ force: true, members });
            await loadSelectedMemberAccounts(selectedMember.id);
        } catch (error) {
            pushToast({
                type: "error",
                title: "Provisioning failed",
                message: getApiErrorMessage(error)
            });
        } finally {
            setProvisioningAccount(false);
        }
    });

    const createLogin = memberLoginForm.handleSubmit(async (values) => {
        if (!selectedMember) {
            return;
        }

        setProvisioningLogin(true);

        try {
            const payload: CreateMemberLoginRequest = {
                email: values.email,
                send_invite: values.send_invite,
                password: values.send_invite ? undefined : values.password
            };

            const { data } = await api.post<CreateMemberLoginResponse>(
                endpoints.members.createLogin(selectedMember.id),
                payload
            );

            const temporaryPassword = data.data.temporary_password || (!values.send_invite && values.password ? values.password : null);
            setLastMemberCredentials(
                temporaryPassword && (data.data.user.email || values.email)
                    ? {
                        full_name: data.data.member.full_name,
                        email: data.data.user.email || values.email,
                        temporary_password: temporaryPassword
                    }
                    : null
            );
            pushToast({
                type: "success",
                title: "Member login created",
                message: values.send_invite
                    ? (data.data.destination_hint
                        ? `SMS setup link sent to ${data.data.destination_hint}.`
                        : "SMS setup link sent to the member phone.")
                    : values.password
                        ? `Login created for ${data.data.user.email || values.email}.`
                        : `Temporary password generated for ${data.data.user.email || values.email}.`
            });
            await loadMembers();
            setSelectedMember((current) =>
                current && current.id === data.data.member.id
                    ? { ...current, ...data.data.member }
                    : current
            );
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to create member login",
                message: getApiErrorMessage(error)
            });
        } finally {
            setProvisioningLogin(false);
        }
    });

    const viewStoredMemberCredential = async () => {
        if (!selectedMember) {
            return;
        }

        try {
            const { data } = await api.get<TemporaryCredentialResponse>(
                endpoints.members.temporaryCredential(selectedMember.id)
            );

            setLastMemberCredentials({
                full_name: selectedMember.full_name,
                email: data.data.email,
                temporary_password: data.data.temporary_password
            });
        } catch (error) {
            pushToast({
                type: "error",
                title: "Temporary password unavailable",
                message: getApiErrorMessage(error)
            });
        }
    };

    const resetMemberPassword = async () => {
        if (!selectedMember) {
            return;
        }

        setResettingMemberPassword(true);

        try {
            const payload: ResetMemberPasswordRequest = {};
            const { data } = await api.post<ResetMemberPasswordResponse>(
                endpoints.members.resetPassword(selectedMember.id),
                payload
            );

            const temporaryPassword = data.data.temporary_password;

            if (temporaryPassword && data.data.user.email) {
                setLastMemberCredentials({
                    full_name: data.data.member.full_name,
                    email: data.data.user.email,
                    temporary_password: temporaryPassword
                });
            }

            pushToast({
                type: "success",
                title: "Password reset complete",
                message: `Temporary password rotated for ${data.data.user.email || selectedMember.full_name}.`
            });
            await loadMembers();
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to reset password",
                message: getApiErrorMessage(error)
            });
        } finally {
            setResettingMemberPassword(false);
        }
    };

    const updateMember = updateForm.handleSubmit(async (values) => {
        if (!selectedMember) {
            return;
        }

        setUpdatingMember(true);

        try {
            const payload: UpdateMemberRequest = {
                full_name: values.full_name,
                phone: values.phone,
                email: values.email || null,
                national_id: values.national_id,
                branch_id: values.branch_id,
                status: values.status
            };

            const { data } = await api.patch<UpdateMemberResponse>(
                endpoints.members.update(selectedMember.id),
                payload
            );

            pushToast({
                type: "success",
                title: "Member updated",
                message: `${data.data.full_name} was updated. Login password settings were left unchanged.`
            });

            await loadMembers();
            setSelectedMember((current) =>
                current && current.id === data.data.id
                    ? { ...current, ...data.data }
                    : current
            );
            setShowUpdateMemberForm(false);
        } catch (error) {
            pushToast({
                type: "error",
                title: "Member update failed",
                message: getApiErrorMessage(error)
            });
        } finally {
            setUpdatingMember(false);
        }
    });

    const deleteSelectedMember = async () => {
        if (!selectedMember) {
            return;
        }

        setDeletingMember(true);

        try {
            await api.delete(endpoints.members.delete(selectedMember.id));
            pushToast({
                type: "success",
                title: "Member deleted",
                message: `${selectedMember.full_name} has been archived from active members.`
            });
            setShowDeleteMemberDialog(false);
            setShowMemberWorkspaceModal(false);
            setSelectedMember(null);
            await loadMembers();
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to delete member",
                message: getApiErrorMessage(error)
            });
        } finally {
            setDeletingMember(false);
        }
    };

    const toggleMemberSelection = (memberId: string, checked: boolean) => {
        setSelectedMemberIds((current) => {
            if (checked) {
                if (current.includes(memberId)) {
                    return current;
                }

                return [...current, memberId];
            }

            return current.filter((id) => id !== memberId);
        });
    };

    const togglePaginatedSelection = (checked: boolean) => {
        setSelectedMemberIds((current) => {
            if (checked) {
                const merged = new Set(current);
                paginatedMemberIds.forEach((memberId) => merged.add(memberId));
                return Array.from(merged);
            }

            const paginatedSet = new Set(paginatedMemberIds);
            return current.filter((memberId) => !paginatedSet.has(memberId));
        });
    };

    const deleteSelectedMembers = async () => {
        if (!selectedMemberIds.length) {
            return;
        }

        setDeletingBulkMembers(true);

        try {
            const payload: BulkDeleteMembersRequest = {
                member_ids: selectedMemberIds
            };
            const { data } = await api.post<BulkDeleteMembersResponse>(
                endpoints.members.bulkDelete(),
                payload
            );
            const deletedIds = new Set(data.data.deleted_members.map((member) => member.id));
            const failedMessage = data.data.failed_count
                ? ` ${data.data.failed_count} failed.${data.data.failed_members[0] ? ` First issue: ${data.data.failed_members[0].message}` : ""}`
                : "";

            pushToast({
                type: "success",
                title: "Bulk delete completed",
                message: `${data.data.deleted_count} of ${data.data.requested} selected member${data.data.requested === 1 ? "" : "s"} archived.${failedMessage}`
            });

            if (selectedMember && deletedIds.has(selectedMember.id)) {
                setSelectedMember(null);
                setShowMemberWorkspaceModal(false);
            }

            setShowBulkDeleteDialog(false);
            setSelectedMemberIds([]);
            await loadMembers();
        } catch (error) {
            pushToast({
                type: "error",
                title: "Bulk delete failed",
                message: getApiErrorMessage(error)
            });
        } finally {
            setDeletingBulkMembers(false);
        }
    };

    const memberCounts = useMemo(() => ({
        total: serverTotalMembers,
        active: members.filter((member) => member.status === "active").length,
        linkedLogins: members.filter((member) => Boolean(member.user_id)).length,
        totalSavings: accountsLoaded
            ? members.reduce((sum, member) => sum + Number(member.account?.available_balance || 0), 0)
            : 0
    }), [accountsLoaded, members, serverTotalMembers]);
    const tellerReadyCount = useMemo(
        () => accountsLoaded
            ? members.filter((member) => member.status === "active" && Boolean(member.account?.id)).length
            : members.filter((member) => member.status === "active").length,
        [accountsLoaded, members]
    );
    const tellerNeedsFollowUpCount = useMemo(
        () => accountsLoaded
            ? members.filter((member) => member.status !== "active" || !member.account?.id).length
            : members.filter((member) => member.status !== "active").length,
        [accountsLoaded, members]
    );
    const branchManagerActionCounts = useMemo(() => ({
        needsReview: members.filter((member) => member.status !== "active" || !member.user_id || (accountsLoaded ? !member.account?.id : false)).length,
        needsLogin: members.filter((member) => !member.user_id).length,
        needsAccount: accountsLoaded ? members.filter((member) => !member.account?.id).length : 0,
        ready: members.filter((member) => member.status === "active" && Boolean(member.user_id) && (accountsLoaded ? Boolean(member.account?.id) : false)).length
    }), [accountsLoaded, members]);
    const hasActiveDirectoryFilters = Boolean(
        deferredSearch.trim() || statusFilter !== "all" || operationalFilter !== "all" || branchFilter !== "all"
    );
    const directoryEmptyMessage = (members.length || serverTotalMembers) && !filteredMembers.length
        ? "No members match the current filters."
        : "No members yet.";
    const visibleResultCount = operationalFilter === "all" ? serverTotalMembers : filteredMembers.length;

    const handleSelectMember = (member: MemberWithAccount) => {
        setSelectedMember(member);
        setShowUpdateMemberForm(false);
        if (useModalMemberWorkspace) {
            setShowMemberWorkspaceModal(true);
        }
    };

    const columns: Column<MemberWithAccount>[] = [
        ...(canDeleteMembers ? [{
            key: "select",
            header: (
                <Checkbox
                    size="small"
                    color="primary"
                    checked={allPaginatedMembersSelected}
                    indeterminate={somePaginatedMembersSelected}
                    onChange={(event) => togglePaginatedSelection(event.target.checked)}
                    inputProps={{ "aria-label": "Select all members on current page" }}
                />
            ),
            render: (row: MemberWithAccount) => (
                <Checkbox
                    size="small"
                    color="primary"
                    checked={selectedMemberIdSet.has(row.id)}
                    onChange={(event) => toggleMemberSelection(row.id, event.target.checked)}
                    inputProps={{ "aria-label": `Select ${row.full_name}` }}
                />
            )
        }] : []),
        {
            key: "member",
            header: "Member",
            render: (row) => (
                <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar
                        sx={{
                            width: 34,
                            height: 34,
                            fontSize: 13,
                            bgcolor: alpha(memberAccent, 0.14),
                            color: memberAccent
                        }}
                    >
                        {row.full_name.slice(0, 1).toUpperCase()}
                    </Avatar>
                    <Box>
                        <Typography variant="body2" fontWeight={700}>
                            {row.full_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {row.phone}
                        </Typography>
                    </Box>
                </Stack>
            )
        },
        {
            key: "branch",
            header: "Branch",
            render: (row) => (
                <Typography variant="body2" color="text.secondary">
                    {branches.find((branch) => branch.id === row.branch_id)?.name || row.branch_id}
                </Typography>
            )
        },
        {
            key: "account",
            header: "Savings Account",
            render: (row) => {
                if (row.account?.account_number) {
                    return row.account.account_number;
                }

                return accountsLoading ? "Syncing..." : "Provisioning...";
            }
        },
        {
            key: "status",
            header: "Status",
            render: (row) => (
                <Chip
                    label={row.status}
                    size="small"
                    color={row.status === "active" ? "success" : row.status === "suspended" ? "warning" : "default"}
                    variant={row.status === "active" ? "filled" : "outlined"}
                />
            )
        },
        {
            key: "balance",
            header: "Available Balance",
            render: (row) => formatCurrency(row.account?.available_balance)
        },
        {
            key: "action",
            header: "Action",
            render: (row) => (
                <Button
                    variant={selectedMember?.id === row.id ? "contained" : "outlined"}
                    size="small"
                    onClick={() => handleSelectMember(row)}
                >
                    {selectedMember?.id === row.id ? "Opened" : "Open"}
                </Button>
            )
        }
    ];

    const selectedBranchName =
        branches.find((branch) => branch.id === selectedMember?.branch_id)?.name || selectedMember?.branch_id || "N/A";

    return (
        <Stack
            spacing={3}
            sx={
                isDarkMode
                    ? {
                        "& .MuiButton-containedPrimary": {
                            bgcolor: memberAccent,
                            color: "#1a1a1a",
                            "&:hover": { bgcolor: memberAccentStrong }
                        },
                        "& .MuiButton-outlinedPrimary": {
                            borderColor: alpha(memberAccent, 0.42),
                            color: memberAccent
                        }
                    }
                    : undefined
            }
        >
            <MotionCard
                variant="outlined"
                sx={{
                    borderRadius: 2,
                    overflow: "hidden",
                    background: isTeller
                        ? `linear-gradient(135deg, ${alpha(memberAccent, isDarkMode ? 0.16 : 0.12)}, ${alpha(theme.palette.success.main, 0.06)} 58%, ${alpha(theme.palette.background.paper, 0.96)})`
                        : `linear-gradient(135deg, ${alpha(memberAccent, isDarkMode ? 0.12 : 0.08)}, ${alpha(theme.palette.background.paper, 0.92)})`
                }}
            >
                <CardContent>
                    <Stack spacing={2.25}>
                        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
                            <Box>
                                <Typography variant="h5">{isTeller ? "Member Service Desk" : "Member Registry"}</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 760 }}>
                                    {isTeller
                                        ? "Search members quickly, confirm savings-account readiness, and move straight into teller operations with the correct account context."
                                        : "Onboard members, monitor savings readiness, and manage member access without leaving the tenant workspace."}
                                </Typography>
                            </Box>
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                                {profile?.role === "branch_manager" ? (
                                    <Button
                                        variant={showOnboardForm ? "outlined" : "contained"}
                                        startIcon={<PersonAddAlt1RoundedIcon />}
                                        onClick={() => setShowOnboardForm((current) => !current)}
                                    >
                                        {showOnboardForm ? "Close Onboarding" : "Onboard Member"}
                                    </Button>
                                ) : null}
                                {profile?.role === "branch_manager" ? (
                                    <Button
                                        variant="outlined"
                                        startIcon={<UploadFileRoundedIcon />}
                                        onClick={() => navigate("/members/import")}
                                    >
                                        Import CSV
                                    </Button>
                                ) : null}
                                {profile?.role === "branch_manager" ? (
                                    <Button
                                        variant="outlined"
                                        startIcon={<UploadFileRoundedIcon />}
                                        onClick={() => navigate("/members/import?mode=update-existing")}
                                    >
                                        Update Existing
                                    </Button>
                                ) : null}
                                {profile?.role === "branch_manager" ? (
                                    <Button
                                        variant="outlined"
                                        startIcon={<BadgeRoundedIcon />}
                                        onClick={() => navigate("/staff-users")}
                                    >
                                        Team Access
                                    </Button>
                                ) : null}
                            </Stack>
                        </Stack>

                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                            <Chip label={selectedTenantName || "Tenant workspace"} variant="outlined" />
                            <Chip label={`Role: ${profile ? formatRole(profile.role) : "Setup"}`} variant="outlined" />
                            {accountsLoading ? <Chip label="Syncing account readiness..." size="small" variant="outlined" /> : null}
                            {isTeller ? <Chip label="Cash Service Mode" color="success" /> : null}
                        </Stack>

                        {profile?.role === "branch_manager" ? (
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                <Chip
                                    label={`Needs review: ${branchManagerActionCounts.needsReview}`}
                                    color={operationalFilter === "needs_review" ? "warning" : "default"}
                                    variant={operationalFilter === "needs_review" ? "filled" : "outlined"}
                                    onClick={() => setOperationalFilter((current) => current === "needs_review" ? "all" : "needs_review")}
                                />
                                <Chip
                                    label={`Missing login: ${branchManagerActionCounts.needsLogin}`}
                                    color={operationalFilter === "needs_login" ? "warning" : "default"}
                                    variant={operationalFilter === "needs_login" ? "filled" : "outlined"}
                                    onClick={() => setOperationalFilter((current) => current === "needs_login" ? "all" : "needs_login")}
                                />
                                <Chip
                                    label={accountsLoaded ? `Missing account: ${branchManagerActionCounts.needsAccount}` : "Missing account: syncing..."}
                                    color={accountsLoaded && operationalFilter === "needs_account" ? "warning" : "default"}
                                    variant={accountsLoaded && operationalFilter === "needs_account" ? "filled" : "outlined"}
                                    onClick={accountsLoaded ? () => setOperationalFilter((current) => current === "needs_account" ? "all" : "needs_account") : undefined}
                                />
                                <Chip
                                    label={accountsLoaded ? `Ready: ${branchManagerActionCounts.ready}` : "Ready: syncing..."}
                                    color={accountsLoaded && operationalFilter === "ready" ? "success" : "default"}
                                    variant={accountsLoaded && operationalFilter === "ready" ? "filled" : "outlined"}
                                    onClick={accountsLoaded ? () => setOperationalFilter((current) => current === "ready" ? "all" : "ready") : undefined}
                                />
                            </Stack>
                        ) : null}
                    </Stack>
                </CardContent>
            </MotionCard>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MetricCard
                        title={isTeller ? "Visible Members" : "Members"}
                        value={String(memberCounts.total)}
                        helper={isTeller ? "Members available for teller lookup." : "Profiles provisioned in this tenant."}
                        icon={<BadgeRoundedIcon fontSize="small" />}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MetricCard
                        title={isTeller ? "Cash Ready" : "Active Profiles"}
                        value={String(isTeller ? tellerReadyCount : memberCounts.active)}
                        helper={isTeller ? "Active members with a provisioned savings account." : "Members currently eligible for service."}
                        icon={isTeller ? <PaidRoundedIcon fontSize="small" /> : <PersonAddAlt1RoundedIcon fontSize="small" />}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MetricCard
                        title={isTeller ? "Needs Follow-up" : "Linked Logins"}
                        value={String(isTeller ? tellerNeedsFollowUpCount : memberCounts.linkedLogins)}
                        helper={isTeller ? "Members needing escalation before cash service." : "Members with self-service access."}
                        icon={isTeller ? <SearchRoundedIcon fontSize="small" /> : <LockPersonRoundedIcon fontSize="small" />}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MetricCard
                        title={isTeller ? "Visible Savings Float" : "Savings Balance"}
                        value={accountsLoaded ? formatCurrency(memberCounts.totalSavings) : "Syncing..."}
                        helper={accountsLoaded
                            ? (isTeller ? "Current visible balances across teller-served accounts." : "Visible savings across primary accounts.")
                            : "Account balances are loading in the background."}
                        icon={<AccountBalanceWalletRoundedIcon fontSize="small" />}
                    />
                </Grid>
            </Grid>

            {lastMemberCredentials ? (
                <MotionCard
                    variant="outlined"
                    sx={{
                        borderColor: alpha(theme.palette.warning.main, 0.24),
                        bgcolor: alpha(theme.palette.warning.main, 0.05)
                    }}
                >
                    <CardContent>
                        <Stack spacing={2}>
                            <Stack
                                direction={{ xs: "column", md: "row" }}
                                justifyContent="space-between"
                                alignItems={{ xs: "flex-start", md: "center" }}
                                spacing={1.5}
                            >
                                <Box>
                                    <Typography variant="h6">One-time member credentials</Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                        Copy this temporary password and send it to the member securely. It is not stored in the database and the member will be forced to change it on first login.
                                    </Typography>
                                </Box>
                                <Button size="small" onClick={() => setLastMemberCredentials(null)}>
                                    Dismiss
                                </Button>
                            </Stack>

                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                <Chip label={lastMemberCredentials.full_name} />
                                <Chip label={lastMemberCredentials.email} variant="outlined" />
                            </Stack>

                            <Box
                                sx={{
                                    p: 2,
                                    borderRadius: 2,
                                    bgcolor: theme.palette.background.paper,
                                    border: `1px solid ${theme.palette.divider}`
                                }}
                            >
                                <Typography variant="overline" color="text.secondary">
                                    Temporary password
                                </Typography>
                                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "flex-start", sm: "center" }} sx={{ mt: 0.75 }}>
                                    <Typography variant="h6" fontFamily='"Inter", "Segoe UI", sans-serif'>
                                        {lastMemberCredentials.temporary_password}
                                    </Typography>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        startIcon={<ContentCopyRoundedIcon />}
                                        onClick={async () => {
                                            await navigator.clipboard.writeText(lastMemberCredentials.temporary_password);
                                            pushToast({
                                                type: "success",
                                                title: "Copied",
                                                message: "Member temporary password copied to clipboard."
                                            });
                                        }}
                                    >
                                        Copy password
                                    </Button>
                                </Stack>
                            </Box>
                        </Stack>
                    </CardContent>
                </MotionCard>
            ) : null}

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, xl: useModalMemberWorkspace ? 12 : 7 }}>
                    {isTeller ? (
                        <MotionCard
                            variant="outlined"
                            sx={{
                                height: "100%",
                                borderRadius: 2,
                                background: `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.98)}, ${alpha(theme.palette.success.main, 0.04)})`
                            }}
                        >
                            <CardContent>
                                <Stack spacing={2}>
                                    <Box>
                                        <Typography variant="h6">Teller Operating Guide</Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                                            This view is optimized for fast member verification. Check status, confirm the savings account, then continue to the cash desk without touching profile administration.
                                        </Typography>
                                    </Box>

                                    <Grid container spacing={1.5}>
                                        {[
                                            ["Primary task", "Verify identity and open the correct savings account"],
                                            ["Cash scope", "Deposits and withdrawals only"],
                                            ["Escalate when", "Profile is suspended or account is missing"],
                                            ["Profile edits", "Handled by branch manager or super admin"]
                                        ].map(([label, value]) => (
                                            <Grid key={label} size={{ xs: 12, sm: 6 }}>
                                                <Box
                                                    sx={{
                                                        p: 1.5,
                                                        border: `1px solid ${theme.palette.divider}`,
                                                        borderRadius: 2,
                                                        bgcolor: alpha(theme.palette.background.default, 0.5),
                                                        minHeight: 108
                                                    }}
                                                >
                                                    <Typography variant="caption" color="text.secondary">
                                                        {label}
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600 }}>
                                                        {value}
                                                    </Typography>
                                                </Box>
                                            </Grid>
                                        ))}
                                    </Grid>
                                </Stack>
                            </CardContent>
                        </MotionCard>
                    ) : canCreateMembers ? (
                        (
                            <MotionCard variant="outlined">
                                <CardContent>
                                    <Stack spacing={2.25}>
                                        <Box>
                                            <Typography variant="h6">Branch Manager Workflow</Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                                                Use this sequence to keep member operations predictable: onboard profile, resolve setup gaps, then open member workspace for profile and access actions.
                                            </Typography>
                                        </Box>

                                        <Grid container spacing={1.5}>
                                            <Grid size={{ xs: 12, md: 4 }}>
                                                <Box
                                                    sx={{
                                                        p: 1.5,
                                                        border: `1px solid ${theme.palette.divider}`,
                                                        borderRadius: 2,
                                                        bgcolor: alpha(theme.palette.background.default, 0.5),
                                                        height: "100%"
                                                    }}
                                                >
                                                    <Typography variant="caption" color="text.secondary">
                                                        1. Onboard
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600 }}>
                                                        Create a new member profile with savings and share accounts.
                                                    </Typography>
                                                    <Button
                                                        size="small"
                                                        variant="contained"
                                                        sx={{ mt: 1.5 }}
                                                        onClick={() => setShowOnboardForm(true)}
                                                    >
                                                        Open Onboarding
                                                    </Button>
                                                </Box>
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 4 }}>
                                                <Box
                                                    sx={{
                                                        p: 1.5,
                                                        border: `1px solid ${theme.palette.divider}`,
                                                        borderRadius: 2,
                                                        bgcolor: alpha(theme.palette.background.default, 0.5),
                                                        height: "100%"
                                                    }}
                                                >
                                                    <Typography variant="caption" color="text.secondary">
                                                        2. Resolve Issues
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600 }}>
                                                        Focus on members missing login or account setup.
                                                    </Typography>
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        sx={{ mt: 1.5 }}
                                                        onClick={() => setOperationalFilter("needs_review")}
                                                    >
                                                        Show Pending Queue
                                                    </Button>
                                                </Box>
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 4 }}>
                                                <Box
                                                    sx={{
                                                        p: 1.5,
                                                        border: `1px solid ${theme.palette.divider}`,
                                                        borderRadius: 2,
                                                        bgcolor: alpha(theme.palette.background.default, 0.5),
                                                        height: "100%"
                                                    }}
                                                >
                                                    <Typography variant="caption" color="text.secondary">
                                                        3. Team Operations
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600 }}>
                                                        Manage staff access and bulk imports without leaving this module.
                                                    </Typography>
                                                    <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                                                        <Button size="small" variant="outlined" onClick={() => navigate("/staff-users")}>
                                                            Staff Access
                                                        </Button>
                                                        <Button size="small" variant="outlined" onClick={() => navigate("/members/import")}>
                                                            Import
                                                        </Button>
                                                        <Button size="small" variant="outlined" onClick={() => navigate("/members/import?mode=update-existing")}>
                                                            Update Existing
                                                        </Button>
                                                    </Stack>
                                                </Box>
                                            </Grid>
                                        </Grid>
                                    </Stack>
                                </CardContent>
                            </MotionCard>
                        )
                    ) : (
                        <MotionCard variant="outlined">
                            <CardContent>
                                <Typography variant="h6">Member Monitoring</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                                    Your current role is read-only here. You can review member balances, onboarding status, and linked access, but not create or edit profiles.
                                </Typography>
                            </CardContent>
                        </MotionCard>
                    )}
                </Grid>

                <Grid
                    size={{ xs: 12, xl: 5 }}
                    sx={
                        useModalMemberWorkspace
                            ? {
                                position: "fixed",
                                inset: 0,
                                zIndex: 1300,
                                display: showMemberWorkspaceModal ? "flex" : "none",
                                alignItems: "center",
                                justifyContent: "center",
                                p: { xs: 1.5, md: 3 },
                                bgcolor: alpha(theme.palette.common.black, 0.48)
                            }
                            : undefined
                    }
                    onClick={useModalMemberWorkspace ? () => setShowMemberWorkspaceModal(false) : undefined}
                >
                    <Box
                        sx={useModalMemberWorkspace ? { width: "min(860px, calc(100vw - 24px))" } : undefined}
                        onClick={useModalMemberWorkspace ? (event) => event.stopPropagation() : undefined}
                    >
                    <MotionCard
                        variant="outlined"
                        sx={{
                            height: useModalMemberWorkspace ? "auto" : "100%",
                            maxHeight: useModalMemberWorkspace ? "86vh" : undefined,
                            overflowY: useModalMemberWorkspace ? "auto" : undefined,
                            borderRadius: useModalMemberWorkspace ? 3 : 2,
                            boxShadow: useModalMemberWorkspace ? theme.shadows[24] : undefined,
                            background: isTeller
                                ? `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.98)}, ${alpha(memberAccent, 0.06)})`
                                : undefined
                        }}
                    >
                        <CardContent>
                            <Stack spacing={2}>
                                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                                    <Box>
                                        <Typography variant="h6">{isTeller ? "Member Service Snapshot" : "Member Detail Workspace"}</Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                            {isTeller
                                                ? "Select a member to confirm service readiness, inspect the primary savings account, and launch directly into the cash desk."
                                                : "Select a member from the registry to review profile data, route to cash or loans, and manage login access."}
                                        </Typography>
                                    </Box>
                                    {useModalMemberWorkspace ? (
                                        <Button
                                            size="small"
                                            color="inherit"
                                            onClick={() => {
                                                setShowUpdateMemberForm(false);
                                                setShowMemberWorkspaceModal(false);
                                            }}
                                        >
                                            Close
                                        </Button>
                                    ) : null}
                                </Stack>

                                {selectedMember ? (
                                    <Stack spacing={2.5}>
                                        <Stack direction="row" spacing={1.5} alignItems="center">
                                            <Avatar
                                                sx={{
                                                    width: 48,
                                                    height: 48,
                                                    bgcolor: alpha(memberAccent, 0.14),
                                                    color: memberAccent,
                                                    borderRadius: isTeller ? 2.25 : undefined
                                                }}
                                            >
                                                {selectedMember.full_name.slice(0, 1).toUpperCase()}
                                            </Avatar>
                                            <Box sx={{ minWidth: 0 }}>
                                                <Typography variant="subtitle1" fontWeight={700}>
                                                    {selectedMember.full_name}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary" noWrap>
                                                    {selectedMember.email || selectedMember.phone}
                                                </Typography>
                                            </Box>
                                        </Stack>

                                        <Grid container spacing={1.5}>
                                            {[
                                                ["Member ID", selectedMember.id],
                                                ["Branch", selectedBranchName],
                                                ["Created", formatDate(selectedMember.created_at)],
                                                ["Account", selectedMember.account?.account_number || "Pending"],
                                                ["Login", selectedMember.user_id ? "Linked" : "Not linked"],
                                                ["Balance", formatCurrency(selectedMember.account?.available_balance)]
                                            ].map(([label, value]) => (
                                                <Grid key={label} size={{ xs: 12, sm: 6 }}>
                                                    <Box
                                                        sx={{
                                                            p: 1.5,
                                                            border: `1px solid ${theme.palette.divider}`,
                                                            borderRadius: 2,
                                                            bgcolor: alpha(theme.palette.background.default, 0.4)
                                                        }}
                                                    >
                                                        <Typography variant="caption" color="text.secondary">
                                                            {label}
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ mt: 0.5, wordBreak: "break-word" }}>
                                                            {value}
                                                        </Typography>
                                                    </Box>
                                                </Grid>
                                            ))}
                                        </Grid>

                                        {!isTeller ? (
                                            <Stack spacing={1.5}>
                                                <Stack
                                                    direction={{ xs: "column", md: "row" }}
                                                    justifyContent="space-between"
                                                    alignItems={{ xs: "stretch", md: "center" }}
                                                    spacing={2}
                                                    sx={{
                                                        p: 2,
                                                        border: `1px solid ${theme.palette.divider}`,
                                                        borderRadius: 2.5,
                                                        bgcolor: alpha(memberAccent, 0.05)
                                                    }}
                                                >
                                                    <Box sx={{ minWidth: 0 }}>
                                                        <Typography variant="subtitle1" fontWeight={700}>Provisioned Accounts</Typography>
                                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                            One active share capital account is allowed. Savings accounts can be added across products, but duplicate active accounts for the same savings product are blocked.
                                                        </Typography>
                                                    </Box>
                                                    {canCreateMembers ? (
                                                        <Button
                                                            variant="contained"
                                                            size="large"
                                                            startIcon={<AccountBalanceWalletRoundedIcon />}
                                                            onClick={() => setShowProvisionAccountDialog(true)}
                                                            disabled={!productCatalogReady}
                                                            sx={{
                                                                minWidth: { xs: "100%", md: 220 },
                                                                alignSelf: { xs: "stretch", md: "center" },
                                                                py: 1.15,
                                                                borderRadius: 2
                                                            }}
                                                        >
                                                            Add New Account
                                                        </Button>
                                                    ) : null}
                                                </Stack>

                                                {selectedMemberAccountsLoading ? (
                                                    <Alert severity="info" variant="outlined">
                                                        Syncing member accounts. Provisioned savings and share accounts will appear here once the background lookup completes.
                                                    </Alert>
                                                ) : selectedMemberAccounts.length ? (
                                                    <Stack
                                                        spacing={0}
                                                        sx={{
                                                            border: `1px solid ${theme.palette.divider}`,
                                                            borderRadius: 2,
                                                            overflow: "hidden"
                                                        }}
                                                    >
                                                        <Box
                                                            sx={{
                                                                display: "grid",
                                                                gridTemplateColumns: { xs: "1.5fr 1.2fr 1fr", md: "1.5fr 1.2fr 1fr 1fr 0.9fr" },
                                                                gap: 2,
                                                                px: 2,
                                                                py: 1.25,
                                                                bgcolor: alpha(memberAccentStrong, 0.08),
                                                                borderBottom: `1px solid ${theme.palette.divider}`
                                                            }}
                                                        >
                                                            <Typography variant="caption" fontWeight={700}>Account</Typography>
                                                            <Typography variant="caption" fontWeight={700}>Product</Typography>
                                                            <Typography variant="caption" fontWeight={700}>Type</Typography>
                                                            <Typography variant="caption" fontWeight={700} sx={{ display: { xs: "none", md: "block" } }}>Balance</Typography>
                                                            <Typography variant="caption" fontWeight={700} sx={{ display: { xs: "none", md: "block" } }}>Status</Typography>
                                                        </Box>
                                                        {selectedMemberAccounts.map((account, index) => (
                                                            <Box
                                                                key={account.id}
                                                                sx={{
                                                                    display: "grid",
                                                                    gridTemplateColumns: { xs: "1.5fr 1.2fr 1fr", md: "1.5fr 1.2fr 1fr 1fr 0.9fr" },
                                                                    gap: 2,
                                                                    px: 2,
                                                                    py: 1.5,
                                                                    bgcolor: index % 2 === 0 ? alpha(theme.palette.background.default, 0.55) : alpha(memberAccent, 0.035),
                                                                    borderTop: index === 0 ? "none" : `1px solid ${theme.palette.divider}`
                                                                }}
                                                            >
                                                                <Box>
                                                                    <Typography variant="body2" fontWeight={700}>
                                                                        {account.account_name}
                                                                    </Typography>
                                                                    <Typography variant="caption" color="text.secondary">
                                                                        {account.account_number}
                                                                    </Typography>
                                                                </Box>
                                                                <Typography variant="body2">
                                                                    {getMemberAccountProductLabel(account, activeSavingsProducts, activeShareProducts)}
                                                                </Typography>
                                                                <Typography variant="body2" sx={{ textTransform: "capitalize" }}>
                                                                    {account.product_type.replace("_", " ")}
                                                                </Typography>
                                                                <Typography variant="body2" sx={{ display: { xs: "none", md: "block" }, fontWeight: 600 }}>
                                                                    {formatCurrency(account.available_balance)}
                                                                </Typography>
                                                                <Box sx={{ display: { xs: "none", md: "block" } }}>
                                                                    <Chip
                                                                        label={account.status}
                                                                        size="small"
                                                                        color={account.status === "active" ? "success" : "default"}
                                                                        variant={account.status === "active" ? "filled" : "outlined"}
                                                                        sx={{ textTransform: "capitalize" }}
                                                                    />
                                                                </Box>
                                                            </Box>
                                                        ))}
                                                    </Stack>
                                                ) : (
                                                    <Alert severity="warning" variant="outlined">
                                                        No member accounts are provisioned yet for this member.
                                                    </Alert>
                                                )}
                                            </Stack>
                                        ) : null}

                                        {isTeller ? (
                                            <Grid container spacing={1.5}>
                                                {[
                                                    ["Service status", selectedMember.status === "active" ? "Ready for teller service" : "Escalation required"],
                                                    ["Savings account", selectedMember.account?.account_number || "Not provisioned"],
                                                    ["Cash action", selectedMember.account ? "Open deposit or withdrawal flow" : "Cannot transact yet"],
                                                    ["Member contact", selectedMember.phone]
                                                ].map(([label, value]) => (
                                                    <Grid key={label} size={{ xs: 12, sm: 6 }}>
                                                        <Box
                                                            sx={{
                                                                p: 1.5,
                                                                border: `1px solid ${theme.palette.divider}`,
                                                                borderRadius: 2,
                                                                bgcolor: alpha(
                                                                    label === "Service status" && selectedMember.status === "active"
                                                                        ? theme.palette.success.main
                                                                        : theme.palette.background.default,
                                                                    label === "Service status" && selectedMember.status === "active" ? 0.08 : 0.45
                                                                ),
                                                                minHeight: 108
                                                            }}
                                                        >
                                                            <Typography variant="caption" color="text.secondary">
                                                                {label}
                                                            </Typography>
                                                            <Typography variant="body2" sx={{ mt: 0.5, wordBreak: "break-word", fontWeight: 600 }}>
                                                                {value}
                                                            </Typography>
                                                        </Box>
                                                    </Grid>
                                                ))}
                                            </Grid>
                                        ) : null}

                                        {canOpenCashDesk || canOpenLoans ? (
                                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                                                {canOpenCashDesk ? (
                                                    <Button
                                                        variant="contained"
                                                        startIcon={<AccountBalanceWalletRoundedIcon />}
                                                        onClick={() => {
                                                            if (selectedMember.account) {
                                                                localStorage.setItem("saccos:selectedAccountId", selectedMember.account.id);
                                                            }
                                                            localStorage.setItem("saccos:selectedMemberId", selectedMember.id);
                                                            navigate("/cash");
                                                        }}
                                                        fullWidth
                                                        sx={{ py: 1.15 }}
                                                    >
                                                        Serve in Cash Desk
                                                    </Button>
                                                ) : null}
                                                {canOpenLoans ? (
                                                    <Button
                                                        variant="outlined"
                                                        startIcon={<CreditScoreRoundedIcon />}
                                                        onClick={() => {
                                                            localStorage.setItem("saccos:selectedMemberId", selectedMember.id);
                                                            navigate("/loans");
                                                        }}
                                                        fullWidth
                                                    >
                                                        Open Loans
                                                    </Button>
                                                ) : null}
                                                {isTeller ? (
                                                    <Button
                                                        variant="outlined"
                                                        startIcon={<OpenInNewRoundedIcon />}
                                                        onClick={() => setSelectedMember(null)}
                                                        fullWidth
                                                        sx={{ py: 1.15 }}
                                                    >
                                                        Clear Selection
                                                    </Button>
                                                ) : null}
                                            </Stack>
                                        ) : null}

                                        {!isTeller ? <Divider /> : null}

                                        {!isTeller ? (
                                        <Stack spacing={2}>
                                            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                                                <Box>
                                                    <Typography variant="subtitle1">Update Member</Typography>
                                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                        Editing a member does not create or change login passwords.
                                                    </Typography>
                                                </Box>
                                                {canUpdateMembers ? (
                                                    <Button
                                                        variant={showUpdateMemberForm ? "outlined" : "contained"}
                                                        onClick={() => setShowUpdateMemberForm((current) => !current)}
                                                    >
                                                        {showUpdateMemberForm ? "Hide Edit Form" : "Edit Member"}
                                                    </Button>
                                                ) : null}
                                            </Stack>

                                            {!canUpdateMembers ? (
                                                <Alert severity="info" variant="outlined">
                                                    Your role can review member details but cannot edit this profile.
                                                </Alert>
                                            ) : !showUpdateMemberForm ? (
                                                <Alert severity="info" variant="outlined">
                                                    The edit form is hidden by default to keep this workspace clean. Use `Edit Member` when you want to change profile details.
                                                </Alert>
                                            ) : (
                                                <Box component="form" onSubmit={updateMember} sx={{ display: "grid", gap: 2 }}>
                                                    <Grid container spacing={2}>
                                                        <Grid size={{ xs: 12, md: 6 }}>
                                                            <TextField
                                                                label="Full Name"
                                                                fullWidth
                                                                {...updateForm.register("full_name")}
                                                                error={Boolean(updateForm.formState.errors.full_name)}
                                                                helperText={updateForm.formState.errors.full_name?.message}
                                                            />
                                                        </Grid>
                                                        <Grid size={{ xs: 12, md: 6 }}>
                                                            <TextField
                                                                label="Phone"
                                                                fullWidth
                                                                {...updateForm.register("phone")}
                                                                error={Boolean(updateForm.formState.errors.phone)}
                                                                helperText={updateForm.formState.errors.phone?.message}
                                                            />
                                                        </Grid>
                                                        <Grid size={{ xs: 12, md: 6 }}>
                                                            <TextField
                                                                label="Email"
                                                                fullWidth
                                                                {...updateForm.register("email")}
                                                                error={Boolean(updateForm.formState.errors.email)}
                                                                helperText={updateForm.formState.errors.email?.message}
                                                            />
                                                        </Grid>
                                                        <Grid size={{ xs: 12, md: 6 }}>
                                                            <TextField
                                                                label="National ID"
                                                                fullWidth
                                                                {...updateForm.register("national_id")}
                                                                error={Boolean(updateForm.formState.errors.national_id)}
                                                                helperText={updateForm.formState.errors.national_id?.message}
                                                            />
                                                        </Grid>
                                                        <Grid size={{ xs: 12, md: 6 }}>
                                                            <TextField
                                                                select
                                                                label="Branch"
                                                                fullWidth
                                                                value={updateForm.watch("branch_id")}
                                                                onChange={(event) => updateForm.setValue("branch_id", event.target.value, { shouldValidate: true })}
                                                                error={Boolean(updateForm.formState.errors.branch_id)}
                                                                helperText={updateForm.formState.errors.branch_id?.message}
                                                            >
                                                                {branches.map((branch) => (
                                                                    <MenuItem key={branch.id} value={branch.id}>
                                                                        {branch.name}
                                                                    </MenuItem>
                                                                ))}
                                                            </TextField>
                                                        </Grid>
                                                        <Grid size={{ xs: 12, md: 6 }}>
                                                            <TextField
                                                                select
                                                                label="Status"
                                                                fullWidth
                                                                value={updateForm.watch("status")}
                                                                onChange={(event) => updateForm.setValue("status", event.target.value as UpdateMemberFormValues["status"], { shouldValidate: true })}
                                                                error={Boolean(updateForm.formState.errors.status)}
                                                                helperText={updateForm.formState.errors.status?.message}
                                                            >
                                                                <MenuItem value="active">Active</MenuItem>
                                                                <MenuItem value="suspended">Suspended</MenuItem>
                                                                <MenuItem value="exited">Exited</MenuItem>
                                                            </TextField>
                                                        </Grid>
                                                    </Grid>
                                                    <Button type="submit" variant="contained" disabled={updatingMember}>
                                                        {updatingMember ? "Updating member..." : "Update Member"}
                                                    </Button>
                                                    {canDeleteMembers ? (
                                                        <Button
                                                            type="button"
                                                            variant="outlined"
                                                            color="error"
                                                            startIcon={<DeleteOutlineRoundedIcon />}
                                                            onClick={() => setShowDeleteMemberDialog(true)}
                                                        >
                                                            Delete Member
                                                        </Button>
                                                    ) : null}
                                                </Box>
                                            )}
                                        </Stack>
                                        ) : null}

                                        {!isTeller ? <Divider /> : null}

                                        {!isTeller ? (
                                        <Box component="form" onSubmit={createLogin} sx={{ display: "grid", gap: 2 }}>
                                            <Box>
                                                <Typography variant="subtitle1">Member Login Access</Typography>
                                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                    Provision self-service access for this member without leaving the registry.
                                                </Typography>
                                            </Box>

                                            {selectedMember.user_id ? (
                                                <Stack spacing={1.5}>
                                                    <Alert severity="success" variant="outlined">
                                                        This member already has a linked login account.
                                                    </Alert>
                                                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                                                        {canViewMemberCredentials ? (
                                                            <Button
                                                                type="button"
                                                                variant="outlined"
                                                                startIcon={<ContentCopyRoundedIcon />}
                                                                onClick={() => void viewStoredMemberCredential()}
                                                            >
                                                                View temp password
                                                            </Button>
                                                        ) : null}
                                                        {canResetMemberPasswords ? (
                                                            <Button
                                                                type="button"
                                                                variant="contained"
                                                                color="warning"
                                                                startIcon={<LockPersonRoundedIcon />}
                                                                onClick={() => void resetMemberPassword()}
                                                                disabled={resettingMemberPassword}
                                                            >
                                                                {resettingMemberPassword ? "Resetting..." : "Reset Password"}
                                                            </Button>
                                                        ) : null}
                                                    </Stack>
                                                </Stack>
                                            ) : !canCreateMemberLogins ? (
                                                <Alert severity="info" variant="outlined">
                                                    Your role can review member details but cannot provision member logins.
                                                </Alert>
                                            ) : (
                                                <>
                                                    <TextField
                                                        label="Email"
                                                        fullWidth
                                                        {...memberLoginForm.register("email")}
                                                        error={Boolean(memberLoginForm.formState.errors.email)}
                                                        helperText={memberLoginForm.formState.errors.email?.message}
                                                    />
                                                    <TextField
                                                        select
                                                        label="Provisioning Mode"
                                                        fullWidth
                                                        value={standaloneInviteMode ? "invite" : "password"}
                                                        onChange={(event) => {
                                                            const sendInvite = event.target.value === "invite";
                                                            memberLoginForm.setValue("send_invite", sendInvite, { shouldValidate: true });
                                                            if (sendInvite) {
                                                                memberLoginForm.setValue("password", "", { shouldValidate: true });
                                                            }
                                                        }}
                                                        helperText="Invite mode sends the first-time password setup link by SMS to the member phone on file."
                                                    >
                                                        <MenuItem value="invite">Send SMS Setup Link</MenuItem>
                                                        <MenuItem value="password">Create with Temporary Password</MenuItem>
                                                    </TextField>
                                                    <TextField
                                                        label="Initial Password"
                                                        type="password"
                                                        fullWidth
                                                        disabled={standaloneInviteMode}
                                                        placeholder="ChangeMe123!"
                                                        {...memberLoginForm.register("password")}
                                                        error={Boolean(memberLoginForm.formState.errors.password)}
                                                        helperText={
                                                            standaloneInviteMode
                                                                ? "Disabled in invite mode."
                                                                : memberLoginForm.formState.errors.password?.message || "Optional. Leave blank to auto-generate a secure temporary password."
                                                        }
                                                    />
                                                    <Button
                                                        type="submit"
                                                        variant="contained"
                                                        color="inherit"
                                                        startIcon={<OpenInNewRoundedIcon />}
                                                        disabled={provisioningLogin}
                                                    >
                                                        {provisioningLogin ? "Creating login..." : "Create Member Login"}
                                                    </Button>
                                                </>
                                            )}
                                        </Box>
                                        ) : null}
                                    </Stack>
                                ) : (
                                    <Alert severity="info" variant="outlined">
                                        {isTeller
                                            ? "Select a member from the registry to verify teller readiness and open the correct savings account in the cash desk."
                                            : "Select a member from the registry to review account details, update the profile, or provision self-service access."}
                                    </Alert>
                                )}
                            </Stack>
                        </CardContent>
                    </MotionCard>
                    </Box>
                </Grid>
            </Grid>

            <MotionCard
                variant="outlined"
                sx={{
                    borderRadius: 2,
                    boxShadow: isTeller ? "0 1px 2px rgba(15, 23, 42, 0.04)" : undefined
                }}
            >
                <CardContent>
                    <Stack
                        direction={{ xs: "column", md: "row" }}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", md: "center" }}
                        spacing={1.5}
                        sx={{ mb: 1.5 }}
                    >
                        <Box>
                            <Typography variant="h6">{isTeller ? "Service Queue" : "Member Directory"}</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                {isTeller
                                    ? "Search by name, phone, or national ID, then open the service snapshot for cash handling."
                                    : "Search and filter by setup readiness, then open the member workspace for profile and access actions."}
                            </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <Chip label={`${visibleResultCount} result${visibleResultCount === 1 ? "" : "s"}`} />
                            {canDeleteMembers ? (
                                <Chip
                                    label={`${selectedMemberIds.length} selected`}
                                    color={selectedMemberIds.length ? "warning" : "default"}
                                    variant={selectedMemberIds.length ? "filled" : "outlined"}
                                />
                            ) : null}
                            {canDeleteMembers ? (
                                <Button
                                    size="small"
                                    color="inherit"
                                    onClick={() => togglePaginatedSelection(!allPaginatedMembersSelected)}
                                    disabled={!paginatedMemberIds.length}
                                >
                                    {allPaginatedMembersSelected ? "Clear page" : "Select page"}
                                </Button>
                            ) : null}
                            {canDeleteMembers && selectedMemberIds.length ? (
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="error"
                                    startIcon={<DeleteOutlineRoundedIcon />}
                                    onClick={() => setShowBulkDeleteDialog(true)}
                                >
                                    Delete selected
                                </Button>
                            ) : null}
                            {hasActiveDirectoryFilters ? (
                                <Button
                                    size="small"
                                    color="inherit"
                                    onClick={() => {
                                        setSearch("");
                                        setStatusFilter("all");
                                        setOperationalFilter("all");
                                        setBranchFilter("all");
                                    }}
                                >
                                    Clear filters
                                </Button>
                            ) : null}
                        </Stack>
                    </Stack>

                    <Stack
                        direction={{ xs: "column", md: "row" }}
                        spacing={1.25}
                        alignItems={{ xs: "stretch", md: "center" }}
                        sx={{ mb: 2 }}
                    >
                        <TextField
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search members..."
                            size="small"
                            sx={{
                                width: { xs: "100%", md: 300 },
                                "& .MuiOutlinedInput-root": {
                                    bgcolor: alpha(theme.palette.background.default, 0.55),
                                    borderRadius: 2
                                }
                            }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchRoundedIcon fontSize="small" />
                                    </InputAdornment>
                                )
                            }}
                        />
                        <TextField
                            select
                            label="Status"
                            size="small"
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value as MemberStatusFilter)}
                            sx={{ minWidth: { xs: "100%", md: 170 } }}
                        >
                            <MenuItem value="all">All status</MenuItem>
                            <MenuItem value="active">Active</MenuItem>
                            <MenuItem value="suspended">Suspended</MenuItem>
                            <MenuItem value="exited">Exited</MenuItem>
                        </TextField>
                        <TextField
                            select
                            label={isTeller ? "Service View" : "Operational View"}
                            size="small"
                            value={operationalFilter}
                            onChange={(event) => setOperationalFilter(event.target.value as MemberOperationalFilter)}
                            sx={{ minWidth: { xs: "100%", md: 220 } }}
                        >
                            <MenuItem value="all">All members</MenuItem>
                            <MenuItem value="ready">Ready for service</MenuItem>
                            <MenuItem value="needs_review">Needs review</MenuItem>
                            <MenuItem value="needs_login">Missing login</MenuItem>
                            <MenuItem value="needs_account">Missing account</MenuItem>
                        </TextField>
                        <TextField
                            select
                            label="Branch"
                            size="small"
                            value={branchFilter}
                            onChange={(event) => setBranchFilter(event.target.value)}
                            sx={{ minWidth: { xs: "100%", md: 220 } }}
                        >
                            <MenuItem value="all">All branches</MenuItem>
                            {branches.map((branch) => (
                                <MenuItem key={branch.id} value={branch.id}>
                                    {branch.name}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Stack>

                    {loading ? (
                        <AppLoader fullscreen={false} minHeight={280} message="Loading members..." />
                    ) : (
                        <Stack spacing={2}>
                            <DataTable rows={paginatedMembers} columns={columns} emptyMessage={directoryEmptyMessage} />
                            {operationalFilter === "all" && serverTotalMembers > pageSize ? (
                                <Stack direction="row" justifyContent="flex-end">
                                    <Pagination
                                        count={totalPages}
                                        page={page}
                                        onChange={(_, value) => setPage(value)}
                                        sx={{
                                            "& .MuiPaginationItem-root.Mui-selected": {
                                                bgcolor: alpha(memberAccentStrong, 0.18),
                                                color: memberAccentStrong
                                            }
                                        }}
                                    />
                                </Stack>
                            ) : null}
                        </Stack>
                    )}
                </CardContent>
            </MotionCard>

            <MotionModal
                open={showOnboardForm}
                onClose={submitting ? undefined : () => setShowOnboardForm(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>Onboard Member</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={3} sx={{ pt: 0.5 }}>
                        <Typography variant="body2" color="text.secondary">
                            Create the member profile, choose the savings and share products for initial provisioning, and the backend will open the linked member accounts against those products.
                        </Typography>

                        <Alert severity={createLoginNow ? "info" : "success"} variant="outlined">
                            {createLoginNow
                                ? onboardingInviteMode
                                    ? "The member will be created with a linked login and receive a first-time password setup link by SMS."
                                    : "The member will be created with a linked login and either your password or a generated temporary password."
                                    : "The member will be created without a login. Access can be provisioned later from the details panel."}
                        </Alert>

                        {!productCatalogReady ? (
                            <Alert severity="warning" variant="outlined">
                                {productBootstrapLoading
                                    ? "Loading active savings and share products for this tenant."
                                    : "Create at least one active savings product and one active share product before onboarding new members."}
                            </Alert>
                        ) : (
                            <Alert severity="info" variant="outlined">
                                Savings and share accounts will be provisioned using the products selected below. This keeps member accounts aligned with the branch catalog and audit trail.
                            </Alert>
                        )}

                        <Box component="form" id="member-onboard-form" onSubmit={onSubmit} sx={{ display: "grid", gap: 2 }}>
                            <Grid container spacing={2}>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField
                                        label="First Name"
                                        placeholder="Jane"
                                        fullWidth
                                        {...form.register("first_name")}
                                        error={Boolean(form.formState.errors.first_name)}
                                        helperText={form.formState.errors.first_name?.message}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField
                                        label="Last Name"
                                        placeholder="Member"
                                        fullWidth
                                        {...form.register("last_name")}
                                        error={Boolean(form.formState.errors.last_name)}
                                        helperText={form.formState.errors.last_name?.message}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField
                                        label="Phone"
                                        placeholder="+255713000010"
                                        fullWidth
                                        {...form.register("phone")}
                                        error={Boolean(form.formState.errors.phone)}
                                        helperText={form.formState.errors.phone?.message || "Use 0712345678 or +255712345678."}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField
                                        label="Email"
                                        placeholder="jane.member@example.com"
                                        fullWidth
                                        {...form.register("email")}
                                        error={Boolean(form.formState.errors.email)}
                                        helperText={form.formState.errors.email?.message || "Optional unless you create login access now. Must be a valid email format."}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField
                                        label="National ID"
                                        placeholder="CM1234567890"
                                        fullWidth
                                        {...form.register("national_id")}
                                        error={Boolean(form.formState.errors.national_id)}
                                        helperText={form.formState.errors.national_id?.message}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField
                                        select
                                        label="Branch"
                                        fullWidth
                                        value={form.watch("branch_id")}
                                        onChange={(event) => form.setValue("branch_id", event.target.value, { shouldValidate: true })}
                                        error={Boolean(form.formState.errors.branch_id)}
                                        helperText={form.formState.errors.branch_id?.message || "Operational home branch for the member."}
                                    >
                                        {branches.map((branch) => (
                                            <MenuItem key={branch.id} value={branch.id}>
                                                {branch.name}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField
                                        select
                                        label="Status"
                                        fullWidth
                                        value={form.watch("status")}
                                        onChange={(event) => form.setValue("status", event.target.value as MemberFormValues["status"], { shouldValidate: true })}
                                        error={Boolean(form.formState.errors.status)}
                                        helperText={form.formState.errors.status?.message || "Active members can transact immediately."}
                                    >
                                        <MenuItem value="active">Active</MenuItem>
                                        <MenuItem value="suspended">Suspended</MenuItem>
                                        <MenuItem value="exited">Exited</MenuItem>
                                    </TextField>
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField
                                        select
                                        label="Savings Product"
                                        fullWidth
                                        value={form.watch("savings_product_id")}
                                        onChange={(event) => form.setValue("savings_product_id", event.target.value, { shouldValidate: true })}
                                        error={Boolean(form.formState.errors.savings_product_id)}
                                        helperText={
                                            form.formState.errors.savings_product_id?.message ||
                                            "Choose which savings product the primary member savings account should use."
                                        }
                                        disabled={productBootstrapLoading || !activeSavingsProducts.length}
                                    >
                                        {activeSavingsProducts.map((product) => (
                                            <MenuItem key={product.id} value={product.id}>
                                                {`${product.name} (${product.code})`}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField
                                        select
                                        label="Share Product"
                                        fullWidth
                                        value={form.watch("share_product_id")}
                                        onChange={(event) => form.setValue("share_product_id", event.target.value, { shouldValidate: true })}
                                        error={Boolean(form.formState.errors.share_product_id)}
                                        helperText={
                                            form.formState.errors.share_product_id?.message ||
                                            "Choose which share product the member share capital account should use."
                                        }
                                        disabled={productBootstrapLoading || !activeShareProducts.length}
                                    >
                                        {activeShareProducts.map((product) => (
                                            <MenuItem key={product.id} value={product.id}>
                                                {`${product.name} (${product.code})`}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                </Grid>
                            </Grid>

                            <Divider />

                            <Stack spacing={2}>
                                <TextField
                                    select
                                    label="Login Provisioning"
                                    fullWidth
                                    value={createLoginNow ? "enabled" : "disabled"}
                                    onChange={(event) => {
                                        const enabled = event.target.value === "enabled";
                                        form.setValue("create_login", enabled, { shouldValidate: true });
                                        if (!enabled) {
                                            form.setValue("send_invite", true, { shouldValidate: true });
                                            form.setValue("password", "", { shouldValidate: true });
                                        }
                                    }}
                                    helperText="Member portal access can be created now or later."
                                >
                                    <MenuItem value="disabled">Create member only</MenuItem>
                                    <MenuItem value="enabled">Create member with login</MenuItem>
                                </TextField>

                                {createLoginNow ? (
                                    <Grid container spacing={2}>
                                        <Grid size={{ xs: 12, md: 6 }}>
                                            <TextField
                                                select
                                                label="Provisioning Mode"
                                                fullWidth
                                                value={onboardingInviteMode ? "invite" : "password"}
                                                onChange={(event) => {
                                                    const sendInvite = event.target.value === "invite";
                                                    form.setValue("send_invite", sendInvite, { shouldValidate: true });
                                                    if (sendInvite) {
                                                        form.setValue("password", "", { shouldValidate: true });
                                                    }
                                                }}
                                                helperText="Invite mode sends the first-time password setup link by SMS to the member phone."
                                            >
                                                <MenuItem value="invite">Send SMS Setup Link</MenuItem>
                                                <MenuItem value="password">Create with Temporary Password</MenuItem>
                                            </TextField>
                                        </Grid>
                                        <Grid size={{ xs: 12, md: 6 }}>
                                            <TextField
                                                label="Initial Password"
                                                type="password"
                                                fullWidth
                                                disabled={onboardingInviteMode}
                                                placeholder="ChangeMe123!"
                                                {...form.register("password")}
                                                error={Boolean(form.formState.errors.password)}
                                                helperText={
                                                    onboardingInviteMode
                                                        ? "Disabled in invite mode."
                                                        : form.formState.errors.password?.message || "Optional. Leave blank to auto-generate a secure temporary password."
                                                }
                                            />
                                        </Grid>
                                    </Grid>
                                ) : null}
                            </Stack>
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setShowOnboardForm(false)} disabled={submitting} color="inherit">
                        Cancel
                    </Button>
                    <Button
                        form="member-onboard-form"
                        type="submit"
                        variant="contained"
                        disabled={submitting || productBootstrapLoading || !productCatalogReady}
                    >
                        {submitting ? "Creating member..." : "Create Member"}
                    </Button>
                </DialogActions>
            </MotionModal>

            <Dialog
                open={showProvisionAccountDialog}
                onClose={provisioningAccount ? undefined : () => setShowProvisionAccountDialog(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Provision Additional Account</DialogTitle>
                <DialogContent dividers>
                    <Stack component="form" id="member-provision-account-form" spacing={2.5} sx={{ pt: 0.5 }} onSubmit={provisionAccount}>
                        <Typography variant="body2" color="text.secondary">
                            Open a new member account against a specific product. Savings allows multiple products, while share capital stays limited to one active account per member.
                        </Typography>

                        {!productCatalogReady ? (
                            <Alert severity="warning" variant="outlined">
                                Active savings and share products must be configured before you can provision new accounts.
                            </Alert>
                        ) : null}

                        <TextField
                            select
                            label="Account Type"
                            fullWidth
                            value={provisionProductType}
                            onChange={(event) => provisionAccountForm.setValue("product_type", event.target.value as ProvisionAccountValues["product_type"], { shouldValidate: true })}
                            helperText={
                                selectedMemberHasActiveShareAccount
                                    ? "This member already has an active share capital account. Savings products without active accounts remain available."
                                    : "Fixed deposit accounts will appear here once a dedicated fixed deposit product catalog is introduced."
                            }
                        >
                            <MenuItem value="savings">Savings</MenuItem>
                            <MenuItem value="shares" disabled={selectedMemberHasActiveShareAccount}>Share Capital</MenuItem>
                        </TextField>

                        {provisionProductType === "savings" ? (
                            <TextField
                                select
                                label="Savings Product"
                                fullWidth
                                value={provisionAccountForm.watch("savings_product_id")}
                                onChange={(event) => provisionAccountForm.setValue("savings_product_id", event.target.value, { shouldValidate: true })}
                                error={Boolean(provisionAccountForm.formState.errors.savings_product_id)}
                                helperText={
                                    provisionAccountForm.formState.errors.savings_product_id?.message
                                    || "Members can hold multiple savings accounts, but only one active account per savings product."
                                }
                                disabled={!availableProvisionSavingsProducts.length}
                            >
                                {availableProvisionSavingsProducts.map((product) => (
                                    <MenuItem key={product.id} value={product.id}>
                                        {`${product.name} (${product.code})`}
                                    </MenuItem>
                                ))}
                            </TextField>
                        ) : (
                            <TextField
                                select
                                label="Share Product"
                                fullWidth
                                value={provisionAccountForm.watch("share_product_id")}
                                onChange={(event) => provisionAccountForm.setValue("share_product_id", event.target.value, { shouldValidate: true })}
                                error={Boolean(provisionAccountForm.formState.errors.share_product_id)}
                                helperText={
                                    provisionAccountForm.formState.errors.share_product_id?.message
                                    || "Only one active share capital account is allowed for a member."
                                }
                                disabled={!activeShareProducts.length}
                            >
                                {activeShareProducts.map((product) => (
                                    <MenuItem key={product.id} value={product.id}>
                                        {`${product.name} (${product.code})`}
                                    </MenuItem>
                                ))}
                            </TextField>
                        )}

                        <TextField
                            label="Account Name Override"
                            fullWidth
                            placeholder={selectedMember ? `${selectedMember.full_name} ${provisionProductType === "shares" ? "Share Capital" : "Savings"}` : ""}
                            {...provisionAccountForm.register("account_name")}
                            error={Boolean(provisionAccountForm.formState.errors.account_name)}
                            helperText={provisionAccountForm.formState.errors.account_name?.message || "Optional. Leave blank to use the standard product-based account name."}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setShowProvisionAccountDialog(false)} disabled={provisioningAccount} color="inherit">
                        Cancel
                    </Button>
                    <Button
                        form="member-provision-account-form"
                        type="submit"
                        variant="contained"
                        disabled={provisioningAccount || !productCatalogReady}
                    >
                        {provisioningAccount ? "Provisioning..." : "Provision Account"}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={showBulkDeleteDialog}
                onClose={deletingBulkMembers ? undefined : () => setShowBulkDeleteDialog(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Delete selected members?</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={1.5}>
                        <Typography variant="body2" color="text.secondary">
                            This will archive {selectedMemberIds.length} selected member{selectedMemberIds.length === 1 ? "" : "s"} and deactivate linked access where allowed.
                            Members with active or in-arrears loans cannot be deleted.
                        </Typography>
                        {selectedMembers.length ? (
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                {selectedMembers.slice(0, 6).map((member) => (
                                    <Chip key={member.id} label={member.full_name} size="small" />
                                ))}
                                {selectedMembers.length > 6 ? (
                                    <Chip label={`+${selectedMembers.length - 6} more`} size="small" variant="outlined" />
                                ) : null}
                            </Stack>
                        ) : null}
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setShowBulkDeleteDialog(false)} disabled={deletingBulkMembers} color="inherit">
                        Cancel
                    </Button>
                    <Button
                        onClick={() => void deleteSelectedMembers()}
                        variant="contained"
                        color="error"
                        disabled={deletingBulkMembers || !selectedMemberIds.length}
                    >
                        {deletingBulkMembers ? "Deleting..." : `Delete ${selectedMemberIds.length}`}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={showDeleteMemberDialog}
                onClose={deletingMember ? undefined : () => setShowDeleteMemberDialog(false)}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle>Delete member?</DialogTitle>
                <DialogContent dividers>
                    <Typography variant="body2" color="text.secondary">
                        This will archive the member profile and deactivate linked access. Active or in-arrears loans block deletion.
                    </Typography>
                    {selectedMember ? (
                        <Typography variant="body2" sx={{ mt: 1.5, fontWeight: 600 }}>
                            {selectedMember.full_name}
                        </Typography>
                    ) : null}
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setShowDeleteMemberDialog(false)} disabled={deletingMember} color="inherit">
                        Cancel
                    </Button>
                    <Button
                        onClick={() => void deleteSelectedMember()}
                        variant="contained"
                        color="error"
                        disabled={deletingMember || !selectedMember}
                    >
                        {deletingMember ? "Deleting..." : "Delete Member"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Stack>
    );
}
