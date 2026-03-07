import { MotionCard, MotionModal } from "../ui/motion";
import AdminPanelSettingsRoundedIcon from "@mui/icons-material/AdminPanelSettingsRounded";
import ApartmentRoundedIcon from "@mui/icons-material/ApartmentRounded";
import BadgeRoundedIcon from "@mui/icons-material/BadgeRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import MarkEmailReadRoundedIcon from "@mui/icons-material/MarkEmailReadRounded";
import PasswordRoundedIcon from "@mui/icons-material/PasswordRounded";
import PersonAddAlt1RoundedIcon from "@mui/icons-material/PersonAddAlt1Rounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    MenuItem,
    Skeleton,
    Stack,
    TextField,
    Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { AccessHealthPanel } from "../components/AccessHealthPanel";
import { RoleCoverageMatrix } from "../components/RoleCoverageMatrix";
import { RoleDistributionChart } from "../components/RoleDistributionChart";
import { UsersTable } from "../components/UsersTable";
import { ConfirmModal } from "../components/ConfirmModal";
import { useAuth } from "../auth/AuthProvider";
import { useToast } from "../components/Toast";
import { api, getApiErrorMessage } from "../lib/api";
import {
    endpoints,
    type BranchesListResponse,
    type CreateUserRequest,
    type CreateUserResponse,
    type UpdateUserRequest,
    type UsersListResponse
} from "../lib/endpoints";
import type { Branch, StaffAccessPayload, StaffRoleCounts, StaffAccessUser } from "../types/api";
import { brandColors } from "../theme/colors";
import { detectRoleConflicts, roleCoverageLabels } from "../utils/roleRules";

const schema = z.object({
    email: z.string().email("Valid email is required."),
    full_name: z.string().min(3, "Full name is required."),
    phone: z.string().min(7, "Phone is required."),
    role: z.enum(["super_admin", "branch_manager", "loan_officer", "teller", "auditor"]),
    branch_id: z.string().uuid("Select a branch.").optional().or(z.literal("")),
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

    if (["branch_manager", "loan_officer", "teller"].includes(value.role) && !value.branch_id) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Select a branch for this operational role.",
            path: ["branch_id"]
        });
    }
});

type StaffUserValues = z.infer<typeof schema>;
type ProvisionableRole = StaffUserValues["role"];
type StaffRole = StaffUserValues["role"];
interface ProvisionedCredentials {
    email: string;
    full_name: string;
    role: StaffRole;
    temporary_password: string;
}

function MetricCard({
    title,
    value,
    helper,
    icon,
    chips = []
}: {
    title: string;
    value: string;
    helper: string;
    icon: ReactNode;
    chips?: string[];
}) {
    return (
        <MotionCard variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
                <Stack spacing={2}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                        <Box>
                            <Typography variant="overline" color="text.secondary">
                                {title}
                            </Typography>
                            <Typography variant="h4" sx={{ mt: 0.5 }}>
                                {value}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                                {helper}
                            </Typography>
                        </Box>
                        <Box
                            sx={{
                                width: 44,
                                height: 44,
                                borderRadius: 2,
                                display: "grid",
                                placeItems: "center",
                                bgcolor: alpha(brandColors.primary[900], 0.08),
                                color: "primary.main"
                            }}
                        >
                            {icon}
                        </Box>
                    </Stack>
                    {chips.length ? (
                        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                            {chips.map((chip) => (
                                <Chip key={chip} size="small" label={chip} variant="outlined" />
                            ))}
                        </Stack>
                    ) : null}
                </Stack>
            </CardContent>
        </MotionCard>
    );
}

function createEmptyPayload(): StaffAccessPayload {
    return {
        totals: {
            total_staff: 0,
            active_access: 0,
            administrators: 0,
            managers: 0,
            operators: 0,
            inactive_users: 0,
            pending_invites: 0
        },
        roleCounts: {
            super_admin: 0,
            branch_manager: 0,
            loan_officer: 0,
            teller: 0,
            auditor: 0
        },
        users: [],
        conflicts: []
    };
}

export function StaffUsersPage() {
    const theme = useTheme();
    const { pushToast } = useToast();
    const { profile, selectedTenantId, selectedTenantName, selectedBranchId } = useAuth();
    const [payload, setPayload] = useState<StaffAccessPayload>(createEmptyPayload);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [showProvisionModal, setShowProvisionModal] = useState(false);
    const [lastProvisionedCredentials, setLastProvisionedCredentials] = useState<ProvisionedCredentials | null>(null);
    const [credentialViewerOpen, setCredentialViewerOpen] = useState(false);
    const [pendingUpdate, setPendingUpdate] = useState<null | {
        userId: string;
        payload: { role: StaffRole; is_active: boolean; branch_ids: string[] };
        label: string;
    }>(null);
    const conflictsRef = useRef<HTMLDivElement | null>(null);

    const form = useForm<StaffUserValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            email: "",
            full_name: "",
            phone: "",
            role: "branch_manager",
            branch_id: selectedBranchId || "",
            send_invite: true,
            password: ""
        }
    });

    const provisioningMode = form.watch("send_invite");
    const selectedRole = form.watch("role");
    const branchRequired = ["branch_manager", "loan_officer", "teller"].includes(selectedRole);
    const provisionableRoles: ProvisionableRole[] = profile?.role === "super_admin"
        ? ["branch_manager"]
        : ["loan_officer", "teller", "auditor"];
    const editable = profile?.role === "super_admin";

    useEffect(() => {
        if (!provisionableRoles.includes(selectedRole)) {
            form.setValue("role", provisionableRoles[0], { shouldValidate: true });
        }
    }, [form, provisionableRoles, selectedRole]);

    const loadUsers = async () => {
        if (!selectedTenantId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setLoadError(null);

        try {
            const [{ data: usersResponse }, { data: branchesResponse }] = await Promise.all([
                api.get<UsersListResponse>(endpoints.users.list()),
                api.get<BranchesListResponse>(endpoints.branches.list(), { params: { tenant_id: selectedTenantId } })
            ]);

            const resolvedPayload = usersResponse.data;
            const computedConflicts = resolvedPayload.conflicts?.length
                ? resolvedPayload.conflicts
                : detectRoleConflicts(resolvedPayload.users);

            setPayload({
                ...resolvedPayload,
                conflicts: computedConflicts
            });
            setBranches((branchesResponse.data || []).filter((branch) => branch.tenant_id === selectedTenantId));
        } catch (error) {
            setLoadError(getApiErrorMessage(error));
            pushToast({
                type: "error",
                title: "Unable to load team access",
                message: getApiErrorMessage(error)
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadUsers();
    }, [selectedTenantId]);

    useEffect(() => {
        if (selectedBranchId) {
            form.setValue("branch_id", selectedBranchId);
        }
    }, [form, selectedBranchId]);

    const onSubmit = form.handleSubmit(async (values) => {
        setSubmitting(true);

        try {
            const payload: CreateUserRequest = {
                tenant_id: selectedTenantId || undefined,
                email: values.email,
                full_name: values.full_name,
                phone: values.phone,
                role: values.role,
                branch_ids: values.branch_id ? [values.branch_id] : [],
                send_invite: values.send_invite,
                password: values.send_invite ? undefined : values.password
            };

            const { data } = await api.post<CreateUserResponse>(endpoints.users.create(), payload);
            const temporaryPassword = data.data.temporary_password || (!values.send_invite && values.password ? values.password : null);

            setLastProvisionedCredentials(
                temporaryPassword
                    ? {
                        email: values.email,
                        full_name: values.full_name,
                        role: values.role,
                        temporary_password: temporaryPassword
                    }
                    : null
            );
            pushToast({
                type: "success",
                title: "Staff user created",
                message: values.send_invite
                    ? "Invite sent and profile provisioned."
                    : values.password
                        ? "Login created with the supplied password."
                        : "Login created with a generated temporary password."
            });
            form.reset({
                email: "",
                full_name: "",
                phone: "",
                role: provisionableRoles[0],
                branch_id: values.branch_id,
                send_invite: true,
                password: ""
            });
            setShowProvisionModal(false);
            await loadUsers();
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to create staff user",
                message: getApiErrorMessage(error)
            });
        } finally {
            setSubmitting(false);
        }
    });

    const handleUserSave = async (userId: string, updatePayload: { role: StaffRole; is_active: boolean; branch_ids: string[] }) => {
        const user = payload.users.find((entry) => entry.user_id === userId);
        if (!user) {
            return;
        }

        setPendingUpdate({
            userId,
            payload: updatePayload,
            label: user.full_name
        });
    };

    const confirmUserSave = async () => {
        if (!pendingUpdate) {
            return;
        }

        try {
            await api.patch(endpoints.users.update(pendingUpdate.userId), pendingUpdate.payload satisfies UpdateUserRequest);
            pushToast({
                type: "success",
                title: "User updated",
                message: `${pendingUpdate.label} was updated successfully.`
            });
            setPendingUpdate(null);
            await loadUsers();
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to update user",
                message: getApiErrorMessage(error)
            });
        }
    };

    const totals = payload.totals;
    const roleCounts = payload.roleCounts;

    const canInviteRole = (role: keyof StaffRoleCounts) => {
        if (profile?.role === "super_admin") {
            return role === "branch_manager";
        }

        if (profile?.role === "branch_manager") {
            return ["loan_officer", "teller", "auditor"].includes(role);
        }

        return false;
    };

    const openProvisionForRole = (role: keyof StaffRoleCounts) => {
        if (!canInviteRole(role)) {
            return;
        }

        form.setValue("role", role as ProvisionableRole, { shouldValidate: true });
        setShowProvisionModal(true);
    };

    const governanceSummary = useMemo(() => ({
        gaps: (Object.keys(roleCounts) as Array<keyof StaffRoleCounts>).filter((role) => roleCounts[role] === 0).length,
        lowCoverage: (Object.keys(roleCounts) as Array<keyof StaffRoleCounts>).filter((role) => roleCounts[role] > 0 && roleCounts[role] < 1).length
    }), [roleCounts]);

    const openStoredCredential = async (user: StaffAccessUser) => {
        try {
            const { data } = await api.get(endpoints.users.temporaryCredential(user.user_id));
            setLastProvisionedCredentials({
                email: data.data.email,
                full_name: user.full_name,
                role: user.role as StaffRole,
                temporary_password: data.data.temporary_password
            });
            setCredentialViewerOpen(true);
        } catch (error) {
            pushToast({
                type: "error",
                title: "Temporary password unavailable",
                message: getApiErrorMessage(error)
            });
        }
    };

    return (
        <Stack spacing={3}>
            <MotionCard
                variant="outlined"
                sx={{
                    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)}, ${alpha(theme.palette.secondary.main, 0.08)} 55%, ${alpha(theme.palette.background.paper, 0.96)})`
                }}
            >
                <CardContent>
                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
                        <Box>
                            <Typography variant="h5">Team Access</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 760 }}>
                                {profile?.role === "super_admin"
                                    ? "Provision branch managers and monitor staffing readiness before tenant operations scale."
                                    : "Read staffing balance, detect coverage gaps, and provision the branch operating team with cleaner governance visibility."}
                            </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                            <Button
                                variant="contained"
                                startIcon={<PersonAddAlt1RoundedIcon />}
                                onClick={() => setShowProvisionModal(true)}
                            >
                                Provision Staff Access
                            </Button>
                            <Chip icon={<ApartmentRoundedIcon />} label={selectedTenantName || "Tenant workspace"} variant="outlined" />
                        </Stack>
                    </Stack>
                </CardContent>
            </MotionCard>

            {loadError ? (
                <Alert
                    severity="error"
                    variant="outlined"
                    action={
                        <Button color="inherit" size="small" onClick={() => void loadUsers()}>
                            Retry
                        </Button>
                    }
                >
                    {loadError}
                </Alert>
            ) : null}

            {loading ? (
                <Grid container spacing={2}>
                    {Array.from({ length: 4 }).map((_, index) => (
                        <Grid key={index} size={{ xs: 12, sm: 6, lg: 3 }}>
                            <Skeleton variant="rounded" height={148} />
                        </Grid>
                    ))}
                </Grid>
            ) : (
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                        <MetricCard
                            title="Total Staff"
                            value={String(totals.total_staff)}
                            helper="Profiles provisioned in this tenant workspace."
                            icon={<BadgeRoundedIcon fontSize="small" />}
                            chips={[`Inactive: ${totals.inactive_users}`, `Pending invites: ${totals.pending_invites}`]}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                        <MetricCard
                            title="Active Access"
                            value={String(totals.active_access)}
                            helper="Users currently active and allowed to sign in."
                            icon={<AdminPanelSettingsRoundedIcon fontSize="small" />}
                            chips={[`${totals.total_staff - totals.active_access} disabled`]}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                        <MetricCard
                            title="Coverage Watch"
                            value={String(governanceSummary.gaps)}
                            helper="Roles currently missing from the recommended minimum."
                            icon={<TimelineRoundedIcon fontSize="small" />}
                            chips={[`${payload.conflicts.length} conflicts`, `${totals.managers} managers`]}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                        <MetricCard
                            title="Operating Roles"
                            value={String(totals.operators)}
                            helper="Execution users covering loans and cash handling."
                            icon={<MarkEmailReadRoundedIcon fontSize="small" />}
                            chips={[`Admins: ${totals.administrators}`, `Managers: ${totals.managers}`]}
                        />
                    </Grid>
                </Grid>
            )}

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, xl: 5 }}>
                    {loading ? (
                        <Skeleton variant="rounded" height={360} />
                    ) : (
                        <RoleDistributionChart roleCounts={roleCounts} />
                    )}
                </Grid>
                <Grid size={{ xs: 12, xl: 7 }}>
                    {loading ? (
                        <Skeleton variant="rounded" height={360} />
                    ) : (
                        <RoleCoverageMatrix
                            roleCounts={roleCounts}
                            canInviteRole={canInviteRole}
                            onInvite={openProvisionForRole}
                            onViewUsers={() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })}
                        />
                    )}
                </Grid>
            </Grid>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, lg: 4 }}>
                    {loading ? (
                        <Skeleton variant="rounded" height={280} />
                    ) : (
                        <AccessHealthPanel
                            roleCounts={roleCounts}
                            conflicts={payload.conflicts}
                            onViewConflicts={() => conflictsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                        />
                    )}
                </Grid>
                <Grid size={{ xs: 12, lg: 8 }}>
                    <MotionCard variant="outlined" ref={conflictsRef}>
                        <CardContent>
                            <Stack spacing={0.5} sx={{ mb: 2 }}>
                                <Typography variant="h6">Governance Flags</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Review separation-of-duties issues and assignment patterns before approving broader access.
                                </Typography>
                            </Stack>

                            {payload.conflicts.length ? (
                                <Stack spacing={1}>
                                    {payload.conflicts.map((conflict) => (
                                        <Box
                                            key={`${conflict.user_id}-${conflict.reason}`}
                                            sx={{
                                                p: 1.5,
                                                border: `1px solid ${alpha(theme.palette.warning.main, 0.25)}`,
                                                borderRadius: 2,
                                                bgcolor: alpha(theme.palette.warning.main, 0.06)
                                            }}
                                        >
                                            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
                                                <Box>
                                                    <Typography variant="subtitle2">{conflict.full_name}</Typography>
                                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
                                                        {conflict.reason}
                                                    </Typography>
                                                </Box>
                                                <Chip size="small" label={conflict.roles.join(", ")} color="warning" variant="outlined" />
                                            </Stack>
                                        </Box>
                                    ))}
                                </Stack>
                            ) : (
                                <Alert severity="success" variant="outlined">
                                    No visible governance conflicts in the current team access profile.
                                </Alert>
                            )}
                        </CardContent>
                    </MotionCard>
                </Grid>
            </Grid>

            {lastProvisionedCredentials ? (
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
                                    <Typography variant="h6">One-time login handoff</Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                        If invite email delivery is unavailable, copy these credentials and send them to the user manually through a secure channel.
                                    </Typography>
                                </Box>
                                <Button size="small" onClick={() => {
                                    setLastProvisionedCredentials(null);
                                    setCredentialViewerOpen(false);
                                }}>
                                    Dismiss
                                </Button>
                            </Stack>

                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                <Chip label={lastProvisionedCredentials.full_name} />
                                <Chip label={lastProvisionedCredentials.email} variant="outlined" />
                                <Chip label={roleCoverageLabels[lastProvisionedCredentials.role]} variant="outlined" />
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
                                <Stack
                                    direction={{ xs: "column", sm: "row" }}
                                    spacing={1.5}
                                    alignItems={{ xs: "flex-start", sm: "center" }}
                                    sx={{ mt: 0.75 }}
                                >
                                    <Typography variant="h6" fontFamily='"Inter", "Segoe UI", sans-serif'>
                                        {lastProvisionedCredentials.temporary_password}
                                    </Typography>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        startIcon={<ContentCopyRoundedIcon />}
                                        onClick={async () => {
                                            await navigator.clipboard.writeText(lastProvisionedCredentials.temporary_password);
                                            pushToast({
                                                type: "success",
                                                title: "Copied",
                                                message: "Temporary password copied to clipboard."
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

            <MotionCard variant="outlined">
                <CardContent>
                    <Stack
                        direction={{ xs: "column", md: "row" }}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", md: "center" }}
                        spacing={1.5}
                        sx={{ mb: 2 }}
                    >
                        <Box>
                            <Typography variant="h6">User Management</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                Search, filter, and review team access with branch context and last-login visibility.
                            </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <Chip label={`${payload.users.length} users`} variant="outlined" />
                            {!editable ? (
                                <Chip label="Role/status editing is restricted to super admin" color="warning" variant="outlined" />
                            ) : null}
                        </Stack>
                    </Stack>

                    {loading ? (
                        <Skeleton variant="rounded" height={420} />
                    ) : (
                        <UsersTable
                            users={payload.users}
                            branches={branches}
                            editable={editable}
                            onSave={handleUserSave}
                            onViewTemporaryPassword={openStoredCredential}
                        />
                    )}
                </CardContent>
            </MotionCard>

            <MotionModal
                open={showProvisionModal}
                onClose={() => !submitting && setShowProvisionModal(false)}
                fullWidth
                maxWidth="md"
            >
                <DialogTitle>Provision Staff Access</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={3} sx={{ pt: 1 }}>
                        <Alert severity={provisioningMode ? "info" : "warning"} variant="outlined">
                            {provisioningMode
                                ? "Invite mode sends the user an onboarding link and provisions the profile immediately."
                                : "Password mode creates an active login instantly. Use only for controlled handover."}
                        </Alert>

                        <Box component="form" id="staff-provision-form" onSubmit={onSubmit} sx={{ display: "grid", gap: 2 }}>
                            <Grid container spacing={2}>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField
                                        label="Email Address"
                                        placeholder="teller@saccos.example"
                                        fullWidth
                                        {...form.register("email")}
                                        error={Boolean(form.formState.errors.email)}
                                        helperText={form.formState.errors.email?.message || "Used for login and invite delivery."}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField
                                        label="Full Name"
                                        placeholder="Main Branch Teller"
                                        fullWidth
                                        {...form.register("full_name")}
                                        error={Boolean(form.formState.errors.full_name)}
                                        helperText={form.formState.errors.full_name?.message || "Shown across audit logs and approvals."}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <TextField
                                        label="Phone"
                                        placeholder="+255754000002"
                                        fullWidth
                                        {...form.register("phone")}
                                        error={Boolean(form.formState.errors.phone)}
                                        helperText={form.formState.errors.phone?.message || "Operational contact number."}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <TextField
                                        select
                                        label="Role"
                                        fullWidth
                                        value={selectedRole}
                                        onChange={(event) => form.setValue("role", event.target.value as StaffUserValues["role"], { shouldValidate: true })}
                                        error={Boolean(form.formState.errors.role)}
                                        helperText={form.formState.errors.role?.message || "Determines allowed screens and actions."}
                                    >
                                        {provisionableRoles.includes("branch_manager") ? <MenuItem value="branch_manager">Branch Manager</MenuItem> : null}
                                        {provisionableRoles.includes("loan_officer") ? <MenuItem value="loan_officer">Loan Officer</MenuItem> : null}
                                        {provisionableRoles.includes("teller") ? <MenuItem value="teller">Teller</MenuItem> : null}
                                        {provisionableRoles.includes("auditor") ? <MenuItem value="auditor">Auditor</MenuItem> : null}
                                    </TextField>
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <TextField
                                        select
                                        label={branchRequired ? "Branch" : "Branch (Optional)"}
                                        fullWidth
                                        value={form.watch("branch_id")}
                                        onChange={(event) => form.setValue("branch_id", event.target.value, { shouldValidate: true })}
                                        error={Boolean(form.formState.errors.branch_id)}
                                        helperText={
                                            form.formState.errors.branch_id?.message ||
                                            (branchRequired
                                                ? "Primary branch assignment for this operational login."
                                                : "Leave blank for tenant-wide roles such as super admin or auditor.")
                                        }
                                    >
                                        {!branchRequired ? <MenuItem value="">No fixed branch</MenuItem> : null}
                                        {branches.map((branch) => (
                                            <MenuItem key={branch.id} value={branch.id}>
                                                {branch.name}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                </Grid>
                            </Grid>

                            <Grid container spacing={2}>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField
                                        select
                                        label="Provisioning Mode"
                                        fullWidth
                                        value={provisioningMode ? "invite" : "password"}
                                        onChange={(event) => {
                                            const sendInvite = event.target.value === "invite";
                                            form.setValue("send_invite", sendInvite, { shouldValidate: true });
                                            if (sendInvite) {
                                                form.setValue("password", "", { shouldValidate: true });
                                            }
                                        }}
                                        helperText="Choose whether the user sets access via invite or receives a managed password."
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
                                        disabled={provisioningMode}
                                        placeholder="ChangeMe123!"
                                        {...form.register("password")}
                                        error={Boolean(form.formState.errors.password)}
                                        helperText={
                                            provisioningMode
                                                ? "Disabled in invite mode."
                                                : form.formState.errors.password?.message || "Optional. Leave blank to auto-generate a secure temporary password."
                                        }
                                    />
                                </Grid>
                            </Grid>
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2, justifyContent: "space-between" }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                            icon={provisioningMode ? <MarkEmailReadRoundedIcon /> : <PasswordRoundedIcon />}
                            label={provisioningMode ? "Invite Flow" : "Password Flow"}
                            color={provisioningMode ? "info" : "warning"}
                            variant="outlined"
                        />
                        <Typography variant="caption" color="text.secondary">
                            Access still remains backend-enforced by tenant, branch scope, and role.
                        </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1.5}>
                        <Button onClick={() => setShowProvisionModal(false)} disabled={submitting}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            form="staff-provision-form"
                            variant="contained"
                            disabled={submitting}
                            sx={{ minWidth: 220 }}
                        >
                            {submitting ? "Provisioning..." : "Create Staff Access"}
                        </Button>
                    </Stack>
                </DialogActions>
            </MotionModal>

            <MotionModal
                open={credentialViewerOpen && Boolean(lastProvisionedCredentials)}
                onClose={() => setCredentialViewerOpen(false)}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle>Temporary Password</DialogTitle>
                <DialogContent dividers>
                    {lastProvisionedCredentials ? (
                        <Stack spacing={2}>
                            <Alert severity="warning" variant="outlined">
                                This password remains available only until the user changes their initial password.
                            </Alert>
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                <Chip label={lastProvisionedCredentials.full_name} />
                                <Chip label={lastProvisionedCredentials.email} variant="outlined" />
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
                                        {lastProvisionedCredentials.temporary_password}
                                    </Typography>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        startIcon={<ContentCopyRoundedIcon />}
                                        onClick={async () => {
                                            await navigator.clipboard.writeText(lastProvisionedCredentials.temporary_password);
                                            pushToast({
                                                type: "success",
                                                title: "Copied",
                                                message: "Temporary password copied to clipboard."
                                            });
                                        }}
                                    >
                                        Copy password
                                    </Button>
                                </Stack>
                            </Box>
                        </Stack>
                    ) : null}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCredentialViewerOpen(false)}>Close</Button>
                </DialogActions>
            </MotionModal>

            <ConfirmModal
                open={Boolean(pendingUpdate)}
                title="Confirm user access update"
                summary={
                    pendingUpdate ? (
                        <Stack spacing={1}>
                            <Typography variant="body2">
                                Save changes for <strong>{pendingUpdate.label}</strong>?
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Role: {roleCoverageLabels[pendingUpdate.payload.role as keyof StaffRoleCounts] || pendingUpdate.payload.role}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Status: {pendingUpdate.payload.is_active ? "Active" : "Inactive"}
                            </Typography>
                        </Stack>
                    ) : null
                }
                confirmLabel="Save changes"
                onCancel={() => setPendingUpdate(null)}
                onConfirm={() => void confirmUserSave()}
            />
        </Stack>
    );
}
