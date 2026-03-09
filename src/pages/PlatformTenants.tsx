import { MotionCard, MotionModal } from "../ui/motion";
import ApartmentRoundedIcon from "@mui/icons-material/ApartmentRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CorporateFareRoundedIcon from "@mui/icons-material/CorporateFareRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import PaidRoundedIcon from "@mui/icons-material/PaidRounded";
import SettingsSuggestRoundedIcon from "@mui/icons-material/SettingsSuggestRounded";
import {
    Alert,
    Avatar,
    Button,
    Card,
    CardContent,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    InputAdornment,
    MenuItem,
    Stack,
    TextField,
    Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { AppLoader } from "../components/AppLoader";
import { ChartPanel } from "../components/ChartPanel";
import { DataTable, type Column } from "../components/DataTable";
import { useToast } from "../components/Toast";
import { api, getApiErrorMessage } from "../lib/api";
import {
    endpoints,
    type AssignTenantSubscriptionRequest,
    type DeleteTenantRequest,
    type PlatformTenantsResponse
} from "../lib/endpoints";
import type { Subscription, Tenant } from "../types/api";
import { formatDate } from "../utils/format";

function MetricCard({
    label,
    value,
    helper,
    icon
}: {
    label: string;
    value: string;
    helper: string;
    icon: React.ReactNode;
}) {
    return (
        <MotionCard variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
                <Stack direction="row" justifyContent="space-between" spacing={2}>
                    <Stack spacing={1}>
                        <Typography variant="overline" color="text.secondary">{label}</Typography>
                        <Typography variant="h4">{value}</Typography>
                        <Typography variant="body2" color="text.secondary">{helper}</Typography>
                    </Stack>
                    <Avatar sx={{ bgcolor: "action.hover", color: "text.primary" }}>
                        {icon}
                    </Avatar>
                </Stack>
            </CardContent>
        </MotionCard>
    );
}

function getTenantSubscription(tenant: Tenant) {
    return tenant.subscription || tenant.subscriptions?.[0] || null;
}

const planOptions = [
    { value: "starter", label: "Starter" },
    { value: "growth", label: "Growth" },
    { value: "enterprise", label: "Enterprise" }
] as const;

const statusOptions = [
    { value: "active", label: "Active" },
    { value: "past_due", label: "Past Due" },
    { value: "suspended", label: "Suspended" },
    { value: "cancelled", label: "Cancelled" }
] as const;

export function PlatformTenantsPage() {
    const theme = useTheme();
    const navigate = useNavigate();
    const { pushToast } = useToast();
    const { refreshProfile, selectedTenantId, setSelectedBranchId, setSelectedTenantId } = useAuth();
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [switchingTenantId, setSwitchingTenantId] = useState<string | null>(null);
    const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
    const [deletingTenant, setDeletingTenant] = useState<Tenant | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState("");
    const [formState, setFormState] = useState<AssignTenantSubscriptionRequest>({
        plan_code: "growth",
        status: "active",
        expires_at: ""
    });

    const loadPlatformData = async () => {
        setLoading(true);
        setError(null);

        try {
            const { data: tenantsResponse } = await api.get<PlatformTenantsResponse>(endpoints.platform.tenants(), {
                params: { page: 1, limit: 100 }
            });
            setTenants(tenantsResponse.data || []);
        } catch (loadError) {
            setError(getApiErrorMessage(loadError));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadPlatformData();
    }, []);

    const metrics = useMemo(() => {
        const subscriptions = tenants.map(getTenantSubscription).filter(Boolean) as Subscription[];

        return {
            totalTenants: tenants.length,
            activeSubscriptions: subscriptions.filter((subscription) => subscription.status === "active").length,
            pastDueSubscriptions: subscriptions.filter((subscription) => subscription.status === "past_due").length,
            totalBranches: tenants.reduce((sum, tenant) => sum + Number(tenant.branch_count || 0), 0),
            enterpriseTenants: subscriptions.filter((subscription) => subscription.plan === "enterprise").length
        };
    }, [tenants]);

    const planBreakdown = useMemo(() => {
        const counts = new Map<string, number>([
            ["starter", 0],
            ["growth", 0],
            ["enterprise", 0]
        ]);

        tenants.forEach((tenant) => {
            const plan = getTenantSubscription(tenant)?.plan || "starter";
            counts.set(plan, (counts.get(plan) || 0) + 1);
        });

        return [...counts.entries()];
    }, [tenants]);

    const growthSeries = useMemo(() => {
        const months = new Map<string, number>();

        tenants.forEach((tenant) => {
            const key = tenant.created_at.slice(0, 7);
            months.set(key, (months.get(key) || 0) + 1);
        });

        return [...months.entries()].sort(([left], [right]) => left.localeCompare(right)).slice(-6);
    }, [tenants]);

    const openEditor = (tenant: Tenant) => {
        const subscription = getTenantSubscription(tenant);

        setEditingTenant(tenant);
        setFormState({
            plan_code: (subscription?.plan || "growth") as AssignTenantSubscriptionRequest["plan_code"],
            status: (subscription?.status || "active") as AssignTenantSubscriptionRequest["status"],
            expires_at: subscription?.expires_at ? subscription.expires_at.slice(0, 10) : ""
        });
    };

    const handleAssignSubscription = async () => {
        if (!editingTenant) {
            return;
        }

        setSubmitting(true);

        try {
            await api.post(
                endpoints.platform.assignSubscription(editingTenant.id),
                {
                    ...formState,
                    start_at: new Date().toISOString(),
                    expires_at: formState.expires_at
                        ? new Date(`${formState.expires_at}T23:59:59.000Z`).toISOString()
                        : undefined
                }
            );

            pushToast({
                type: "success",
                title: "Subscription updated",
                message: `${editingTenant.name} is now on the ${formState.plan_code.toUpperCase()} plan.`
            });
            setEditingTenant(null);
            await loadPlatformData();
        } catch (submitError) {
            pushToast({
                type: "error",
                title: "Subscription update failed",
                message: getApiErrorMessage(submitError)
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteTenant = async () => {
        if (!deletingTenant) {
            return;
        }

        setDeleteSubmitting(true);

        try {
            await api.delete(endpoints.platform.deleteTenant(deletingTenant.id), {
                data: {
                    confirm_name: deleteConfirmation
                } satisfies DeleteTenantRequest
            });

            pushToast({
                type: "success",
                title: "Tenant deleted",
                message: `${deletingTenant.name} and its operational data were removed.`
            });

            if (selectedTenantId === deletingTenant.id) {
                setSelectedTenantId(null);
                setSelectedBranchId(null);
            }

            setDeletingTenant(null);
            setDeleteConfirmation("");
            await loadPlatformData();
        } catch (deleteError) {
            pushToast({
                type: "error",
                title: "Tenant deletion failed",
                message: getApiErrorMessage(deleteError)
            });
        } finally {
            setDeleteSubmitting(false);
        }
    };

    const columns: Column<Tenant>[] = [
        {
            key: "tenant",
            header: "Tenant",
            render: (row) => (
                <Stack spacing={0.25}>
                    <Typography variant="body2" fontWeight={700}>{row.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{row.registration_number}</Typography>
                </Stack>
            )
        },
        {
            key: "branches",
            header: "Branches",
            render: (row) => String(row.branch_count || 0)
        },
        {
            key: "plan",
            header: "Plan",
            render: (row) => {
                const subscription = getTenantSubscription(row);
                return (
                    <Chip
                        size="small"
                        variant="outlined"
                        color={subscription?.plan === "enterprise" ? "secondary" : subscription?.plan === "growth" ? "primary" : "default"}
                        label={(subscription?.plan || "starter").toUpperCase()}
                    />
                );
            }
        },
        {
            key: "status",
            header: "Status",
            render: (row) => {
                const subscription = getTenantSubscription(row);
                return (
                    <Chip
                        size="small"
                        color={subscription?.status === "active" ? "success" : subscription?.status === "past_due" ? "warning" : "default"}
                        label={(subscription?.status || "missing").replace("_", " ")}
                    />
                );
            }
        },
        {
            key: "expiry",
            header: "Expiry",
            render: (row) => formatDate(getTenantSubscription(row)?.expires_at || null)
        },
        {
            key: "actions",
            header: "Actions",
            render: (row) => (
                <Stack direction="row" spacing={1}>
                    <Button
                        size="small"
                        variant={selectedTenantId === row.id ? "contained" : "outlined"}
                        endIcon={<ArrowForwardRoundedIcon fontSize="small" />}
                        disabled={switchingTenantId === row.id}
                        onClick={() => {
                            setSwitchingTenantId(row.id);
                            setSelectedTenantId(row.id, row.name);
                            setSelectedBranchId(null);
                            void refreshProfile(row.id)
                                .then(() => {
                                    navigate("/dashboard");
                                    pushToast({
                                        type: "success",
                                        title: "Workspace switched",
                                        message: `${row.name} is now the active tenant workspace.`
                                    });
                                })
                                .catch((switchError) => {
                                    pushToast({
                                        type: "error",
                                        title: "Unable to switch tenant",
                                        message: getApiErrorMessage(switchError)
                                    });
                                })
                                .finally(() => {
                                    setSwitchingTenantId(null);
                                });
                        }}
                    >
                        {selectedTenantId === row.id ? "Active" : "Open"}
                    </Button>
                    <Button size="small" variant="text" onClick={() => openEditor(row)}>
                        Assign Plan
                    </Button>
                    <Button
                        size="small"
                        color="error"
                        variant="text"
                        startIcon={<DeleteOutlineRoundedIcon fontSize="small" />}
                        onClick={() => {
                            setDeletingTenant(row);
                            setDeleteConfirmation("");
                        }}
                    >
                        Delete
                    </Button>
                </Stack>
            )
        }
    ];

    return (
        <Stack spacing={3}>
            <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 3 }}>
                    <MetricCard
                        label="Total Tenants"
                        value={String(metrics.totalTenants)}
                        helper="All onboarded SACCOS organizations."
                        icon={<ApartmentRoundedIcon />}
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                    <MetricCard
                        label="Active Subscriptions"
                        value={String(metrics.activeSubscriptions)}
                        helper="Tenants inside an active billing window."
                        icon={<PaidRoundedIcon />}
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                    <MetricCard
                        label="Network Branches"
                        value={String(metrics.totalBranches)}
                        helper="Operational branches across the platform."
                        icon={<CorporateFareRoundedIcon />}
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                    <MetricCard
                        label="Enterprise Tenants"
                        value={String(metrics.enterpriseTenants)}
                        helper="Highest-governance subscriptions on the platform."
                        icon={<SettingsSuggestRoundedIcon />}
                    />
                </Grid>
            </Grid>

            {error ? <Alert severity="error">{error}</Alert> : null}

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, lg: 7 }}>
                    <ChartPanel
                        title="Tenant Growth"
                        subtitle="Recent tenant creation trend."
                        type="bar"
                        data={{
                            labels: growthSeries.map(([label]) => label),
                            datasets: [{
                                label: "Tenants",
                                data: growthSeries.map(([, value]) => value),
                                backgroundColor: alpha(theme.palette.primary.main, 0.74)
                            }]
                        }}
                        options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                    />
                </Grid>
                <Grid size={{ xs: 12, lg: 5 }}>
                    <ChartPanel
                        title="Plan Distribution"
                        subtitle="Subscription mix across all tenants."
                        type="doughnut"
                        data={{
                            labels: planBreakdown.map(([label]) => label.toUpperCase()),
                            datasets: [{
                                data: planBreakdown.map(([, value]) => value),
                                backgroundColor: [
                                    alpha(theme.palette.grey[500], 0.85),
                                    theme.palette.primary.main,
                                    theme.palette.secondary.main
                                ]
                            }]
                        }}
                        options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }}
                    />
                </Grid>
            </Grid>

            <MotionCard variant="outlined">
                <CardContent>
                    <Typography variant="h6" gutterBottom>Tenant Inventory</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Assign plans, monitor subscription health, and intentionally switch into a tenant workspace.
                    </Typography>
                    {loading ? (
                        <AppLoader fullscreen={false} minHeight={260} message="Loading platform tenants..." />
                    ) : (
                        <DataTable rows={tenants} columns={columns} emptyMessage="No tenants available on the platform." />
                    )}
                </CardContent>
            </MotionCard>

            <MotionModal open={Boolean(editingTenant)} onClose={() => setEditingTenant(null)} fullWidth maxWidth="sm">
                <DialogTitle>Assign Subscription</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ pt: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                            {editingTenant?.name}
                        </Typography>
                        <TextField
                            select
                            label="Plan"
                            value={formState.plan_code}
                            onChange={(event) => setFormState((current) => ({
                                ...current,
                                plan_code: event.target.value as AssignTenantSubscriptionRequest["plan_code"]
                            }))}
                        >
                            {planOptions.map((option) => (
                                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            select
                            label="Status"
                            value={formState.status}
                            onChange={(event) => setFormState((current) => ({
                                ...current,
                                status: event.target.value as AssignTenantSubscriptionRequest["status"]
                            }))}
                        >
                            {statusOptions.map((option) => (
                                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            type="date"
                            label="Expires At"
                            InputLabelProps={{ shrink: true }}
                            value={formState.expires_at || ""}
                            onChange={(event) => setFormState((current) => ({
                                ...current,
                                expires_at: event.target.value
                            }))}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditingTenant(null)}>Cancel</Button>
                    <Button variant="contained" onClick={handleAssignSubscription} disabled={submitting}>
                        {submitting ? "Saving..." : "Save Subscription"}
                    </Button>
                </DialogActions>
            </MotionModal>

            <MotionModal open={Boolean(deletingTenant)} onClose={deleteSubmitting ? undefined : () => setDeletingTenant(null)} fullWidth maxWidth="sm">
                <DialogTitle>Delete Tenant</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ pt: 1 }}>
                        <Alert severity="warning">
                            This permanently deletes the tenant, users, members, journals, loans, imports, dividends, and operational history for this SACCOS.
                        </Alert>
                        <Typography variant="body2" color="text.secondary">
                            Type <strong>{deletingTenant?.name}</strong> to confirm deletion.
                        </Typography>
                        <TextField
                            label="Confirm tenant name"
                            value={deleteConfirmation}
                            onChange={(event) => setDeleteConfirmation(event.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <DeleteOutlineRoundedIcon color="error" fontSize="small" />
                                    </InputAdornment>
                                )
                            }}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeletingTenant(null)} disabled={deleteSubmitting}>
                        Cancel
                    </Button>
                    <Button
                        color="error"
                        variant="contained"
                        onClick={handleDeleteTenant}
                        disabled={deleteSubmitting || deleteConfirmation.trim() !== deletingTenant?.name}
                    >
                        {deleteSubmitting ? "Deleting..." : "Delete Tenant"}
                    </Button>
                </DialogActions>
            </MotionModal>
        </Stack>
    );
}
