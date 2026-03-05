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
    endpoints,
    type CreateMemberLoginRequest,
    type CreateMemberLoginResponse,
    type CreateMemberRequest,
    type CreateMemberResponse,
    type MembersResponse,
    type ResetMemberPasswordRequest,
    type ResetMemberPasswordResponse,
    type TemporaryCredentialResponse,
    type UpdateMemberRequest,
    type UpdateMemberResponse
} from "../lib/endpoints";
import { supabase } from "../lib/supabase";
import type { Branch, Member, MemberAccount } from "../types/api";
import { formatCurrency, formatDate, formatRole } from "../utils/format";

const schema = z.object({
    full_name: z.string().min(3, "Full name is required."),
    phone: z.string().min(7, "Phone is required."),
    email: z.string().email("Enter a valid email.").optional().or(z.literal("")),
    national_id: z.string().min(5, "National ID is required."),
    branch_id: z.string().uuid("Select a branch."),
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
    const navigate = useNavigate();
    const { pushToast } = useToast();
    const { profile, selectedTenantId, selectedTenantName, selectedBranchId } = useAuth();
    const [members, setMembers] = useState<MemberWithAccount[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [selectedMember, setSelectedMember] = useState<MemberWithAccount | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [updatingMember, setUpdatingMember] = useState(false);
    const [provisioningLogin, setProvisioningLogin] = useState(false);
    const [resettingMemberPassword, setResettingMemberPassword] = useState(false);
    const [deletingMember, setDeletingMember] = useState(false);
    const [showDeleteMemberDialog, setShowDeleteMemberDialog] = useState(false);
    const [showMemberWorkspaceModal, setShowMemberWorkspaceModal] = useState(false);
    const [showOnboardForm, setShowOnboardForm] = useState(false);
    const [lastMemberCredentials, setLastMemberCredentials] = useState<MemberCredentialsHandoff | null>(null);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
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
        defaultValues: {
            full_name: "",
            phone: "",
            email: "",
            national_id: "",
            branch_id: selectedBranchId || "",
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

    const createLoginNow = form.watch("create_login");
    const onboardingInviteMode = form.watch("send_invite");
    const standaloneInviteMode = memberLoginForm.watch("send_invite");

    const loadMembers = async () => {
        if (!selectedTenantId) {
            setMembers([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        try {
            const [{ data: memberResponse }, { data: branchResponse }, accountResponse] = await Promise.all([
                api.get<MembersResponse>(endpoints.members.list()),
                api.get<BranchesListResponse>(endpoints.branches.list(), { params: { tenant_id: selectedTenantId } }),
                supabase
                    .from("member_accounts")
                    .select("*")
                    .eq("tenant_id", selectedTenantId)
                    .is("deleted_at", null)
            ]);

            const accountsByMember = new Map<string, MemberAccount>();

            (accountResponse.data || []).forEach((account) => {
                if (!accountsByMember.has(account.member_id)) {
                    accountsByMember.set(account.member_id, account as MemberAccount);
                }
            });

            const nextBranches = (branchResponse.data || []).filter((branch) => branch.tenant_id === selectedTenantId);
            const nextMembers = memberResponse.data.map((member) => ({
                ...member,
                account: accountsByMember.get(member.id) || null
            }));

            setBranches(nextBranches);
            setMembers(nextMembers);
            setSelectedMember((current) => {
                if (!current) {
                    return null;
                }

                return nextMembers.find((member) => member.id === current.id) || null;
            });
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
        void loadMembers();
    }, [selectedTenantId]);

    useEffect(() => {
        form.setValue("branch_id", selectedBranchId || branches[0]?.id || "");
    }, [branches, form, selectedBranchId]);

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

    const filteredMembers = useMemo(() => {
        const normalized = deferredSearch.trim().toLowerCase();

        if (!normalized) {
            return members;
        }

        return members.filter((member) =>
            [member.full_name, member.phone, member.national_id]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(normalized))
        );
    }, [deferredSearch, members]);

    const totalPages = Math.max(1, Math.ceil(filteredMembers.length / pageSize));
    const paginatedMembers = useMemo(
        () => filteredMembers.slice((page - 1) * pageSize, page * pageSize),
        [filteredMembers, page]
    );

    useEffect(() => {
        setPage(1);
    }, [deferredSearch]);

    const onSubmit = form.handleSubmit(async (values) => {
        setSubmitting(true);

        try {
            const payload: CreateMemberRequest = {
                tenant_id: selectedTenantId || undefined,
                branch_id: values.branch_id,
                full_name: values.full_name,
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
                        ? `${data.data.member.full_name} was created, savings and share accounts were provisioned, and an invite was sent.`
                        : values.password
                            ? `${data.data.member.full_name} was created with a login plus savings and share accounts provisioned.`
                            : `${data.data.member.full_name} was created with a generated temporary password plus savings and share accounts provisioned.`
                    : `${data.data.member.full_name} was created and savings and share accounts were provisioned.`
            });
            form.reset({
                full_name: "",
                phone: "",
                email: "",
                national_id: "",
                branch_id: values.branch_id,
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
                    ? `Invite sent to ${data.data.user.email || values.email}.`
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

    const memberCounts = useMemo(() => ({
        total: members.length,
        active: members.filter((member) => member.status === "active").length,
        linkedLogins: members.filter((member) => Boolean(member.user_id)).length,
        totalSavings: members.reduce((sum, member) => sum + Number(member.account?.available_balance || 0), 0)
    }), [members]);
    const tellerReadyCount = useMemo(
        () => members.filter((member) => member.status === "active" && Boolean(member.account?.id)).length,
        [members]
    );
    const tellerNeedsFollowUpCount = useMemo(
        () => members.filter((member) => member.status !== "active" || !member.account?.id).length,
        [members]
    );

    const handleSelectMember = (member: MemberWithAccount) => {
        setSelectedMember(member);
        if (useModalMemberWorkspace) {
            setShowMemberWorkspaceModal(true);
        }
    };

    const columns: Column<MemberWithAccount>[] = [
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
                            bgcolor: alpha(theme.palette.primary.main, 0.12),
                            color: "primary.main"
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
            render: (row) => row.account?.account_number || "Provisioning..."
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
                <Button variant="outlined" size="small" onClick={() => handleSelectMember(row)}>
                    Open
                </Button>
            )
        }
    ];

    const selectedBranchName =
        branches.find((branch) => branch.id === selectedMember?.branch_id)?.name || selectedMember?.branch_id || "N/A";

    return (
        <Stack spacing={3}>
            <MotionCard
                variant="outlined"
                sx={{
                    borderRadius: 2,
                    overflow: "hidden",
                    background: isTeller
                        ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.12)}, ${alpha(theme.palette.success.main, 0.06)} 58%, ${alpha(theme.palette.background.paper, 0.96)})`
                        : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)}, ${alpha(theme.palette.background.paper, 0.92)})`
                }}
            >
                <CardContent>
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
                                    variant="outlined"
                                    startIcon={<BadgeRoundedIcon />}
                                    onClick={() => navigate("/staff-users")}
                                >
                                    Open Team Access
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
                            {canCreateMembers ? (
                                <Button
                                    variant={showOnboardForm ? "outlined" : "contained"}
                                    startIcon={<PersonAddAlt1RoundedIcon />}
                                    onClick={() => setShowOnboardForm((current) => !current)}
                                >
                                    {showOnboardForm ? "Close Onboarding" : "Onboard Member"}
                                </Button>
                            ) : null}
                            <Chip label={selectedTenantName || "Tenant workspace"} variant="outlined" />
                            <Chip label={`Role: ${profile ? formatRole(profile.role) : "Setup"}`} variant="outlined" />
                            {isTeller ? <Chip label="Cash Service Mode" color="success" /> : null}
                        </Stack>
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
                        value={formatCurrency(memberCounts.totalSavings)}
                        helper={isTeller ? "Current visible balances across teller-served accounts." : "Visible savings across primary accounts."}
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
                                    <Typography variant="h6" fontFamily='"Source Sans 3", "Segoe UI", sans-serif'>
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
                                    <Stack
                                        direction={{ xs: "column", sm: "row" }}
                                        justifyContent="space-between"
                                        spacing={2}
                                        alignItems={{ xs: "flex-start", sm: "center" }}
                                    >
                                        <Box>
                                            <Typography variant="h6">Member Onboarding</Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                                                Use the `Onboard Member` button above to open the onboarding modal. For staff and role provisioning, use Team Access.
                                            </Typography>
                                        </Box>
                                        {profile?.role === "branch_manager" ? (
                                            <Button variant="outlined" onClick={() => navigate("/staff-users")}>
                                                Onboard Operating Roles
                                            </Button>
                                        ) : null}
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
                        sx={useModalMemberWorkspace ? { width: "100%", maxWidth: 980 } : undefined}
                        onClick={useModalMemberWorkspace ? (event) => event.stopPropagation() : undefined}
                    >
                    <MotionCard
                        variant="outlined"
                        sx={{
                            height: "100%",
                            maxHeight: useModalMemberWorkspace ? "92vh" : undefined,
                            overflowY: useModalMemberWorkspace ? "auto" : undefined,
                            borderRadius: 2,
                            background: isTeller
                                ? `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.98)}, ${alpha(theme.palette.primary.main, 0.035)})`
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
                                        <Button size="small" color="inherit" onClick={() => setShowMemberWorkspaceModal(false)}>
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
                                                    bgcolor: alpha(theme.palette.primary.main, 0.12),
                                                    color: "primary.main",
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
                                        <Box component="form" onSubmit={updateMember} sx={{ display: "grid", gap: 2 }}>
                                            <Box>
                                                <Typography variant="subtitle1">Update Member</Typography>
                                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                    Editing a member does not create or change login passwords.
                                                </Typography>
                                            </Box>

                                            {!canUpdateMembers ? (
                                                <Alert severity="info" variant="outlined">
                                                    Your role can review member details but cannot edit this profile.
                                                </Alert>
                                            ) : (
                                                <>
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
                                                </>
                                            )}
                                        </Box>
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
                                                        helperText="Invite mode is preferred for live users."
                                                    >
                                                        <MenuItem value="invite">Send Invite</MenuItem>
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
                        sx={{ mb: 2 }}
                    >
                        <Box>
                            <Typography variant="h6">{isTeller ? "Service Queue" : "Member Directory"}</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                {isTeller
                                    ? "Search by name, phone, or national ID, then open the service snapshot for cash handling."
                                    : "Search by name, phone, or national ID, then open the member workspace for actions."}
                            </Typography>
                        </Box>
                        <TextField
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search members..."
                            size="small"
                            sx={{
                                width: { xs: "100%", md: 320 },
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
                    </Stack>

                    {loading ? (
                        <AppLoader fullscreen={false} minHeight={280} message="Loading members..." />
                    ) : (
                        <Stack spacing={2}>
                            <DataTable rows={paginatedMembers} columns={columns} emptyMessage="No members yet." />
                            {filteredMembers.length > pageSize ? (
                                <Stack direction="row" justifyContent="flex-end">
                                    <Pagination
                                        count={totalPages}
                                        page={page}
                                        onChange={(_, value) => setPage(value)}
                                        color="primary"
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
                            Create the member profile and the backend will automatically provision both the primary savings account and the member share capital account.
                        </Typography>

                        <Alert severity={createLoginNow ? "info" : "success"} variant="outlined">
                            {createLoginNow
                                ? onboardingInviteMode
                                    ? "The member will be created with a linked login and invite flow."
                                    : "The member will be created with a linked login and either your password or a generated temporary password."
                                : "The member will be created without a login. Access can be provisioned later from the details panel."}
                        </Alert>

                        <Box component="form" id="member-onboard-form" onSubmit={onSubmit} sx={{ display: "grid", gap: 2 }}>
                            <Grid container spacing={2}>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField
                                        label="Full Name"
                                        placeholder="Jane Member"
                                        fullWidth
                                        {...form.register("full_name")}
                                        error={Boolean(form.formState.errors.full_name)}
                                        helperText={form.formState.errors.full_name?.message}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField
                                        label="Phone"
                                        placeholder="+255713000010"
                                        fullWidth
                                        {...form.register("phone")}
                                        error={Boolean(form.formState.errors.phone)}
                                        helperText={form.formState.errors.phone?.message}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField
                                        label="Email"
                                        placeholder="jane.member@example.com"
                                        fullWidth
                                        {...form.register("email")}
                                        error={Boolean(form.formState.errors.email)}
                                        helperText={form.formState.errors.email?.message || "Optional unless you create login access now."}
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
                                                helperText="Invite mode is preferred for real users."
                                            >
                                                <MenuItem value="invite">Send Invite</MenuItem>
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
                    <Button form="member-onboard-form" type="submit" variant="contained" disabled={submitting}>
                        {submitting ? "Creating member..." : "Create Member"}
                    </Button>
                </DialogActions>
            </MotionModal>

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
