import { MotionCard, MotionModal } from "../ui/motion";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import LockOpenRoundedIcon from "@mui/icons-material/LockOpenRounded";
import RocketLaunchRoundedIcon from "@mui/icons-material/RocketLaunchRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import WorkspacePremiumRoundedIcon from "@mui/icons-material/WorkspacePremiumRounded";
import {
    Alert,
    Avatar,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Grid,
    MenuItem,
    Paper,
    Stack,
    TextField,
    Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useEffect, useMemo, useState } from "react";

import { AppLoader } from "../components/AppLoader";
import { DataTable, type Column } from "../components/DataTable";
import { useToast } from "../components/Toast";
import { api, getApiErrorMessage } from "../lib/api";
import {
    endpoints,
    type PlansResponse,
    type UpdatePlanFeaturesRequest
} from "../lib/endpoints";
import type { Plan, PlanFeature } from "../types/api";

type PlanCode = "starter" | "growth" | "enterprise";

const planPresentation: Record<PlanCode, {
    eyebrow: string;
    hero: string;
    icon: typeof RocketLaunchRoundedIcon;
    tint: "primary" | "secondary" | "success";
    accent: string;
}> = {
    starter: {
        eyebrow: "Foundation",
        hero: "For smaller SACCOS formalizing member and cash operations.",
        icon: RocketLaunchRoundedIcon,
        tint: "success",
        accent: "#4caf50"
    },
    growth: {
        eyebrow: "Operational Scale",
        hero: "Balanced tier for lending, dividends, contributions, and stronger reporting.",
        icon: AutoAwesomeRoundedIcon,
        tint: "primary",
        accent: "#1976d2"
    },
    enterprise: {
        eyebrow: "Governance Grade",
        hero: "For larger institutions needing oversight, approvals, and high capacity.",
        icon: WorkspacePremiumRoundedIcon,
        tint: "secondary",
        accent: "#8e24aa"
    }
};

function getFeatureValue(feature: PlanFeature) {
    if (feature.feature_type === "bool") {
        return Boolean(feature.bool_value);
    }

    if (feature.feature_type === "int") {
        return Number(feature.int_value ?? 0);
    }

    return feature.string_value || "";
}

function getFeatureMap(plan: Plan) {
    return Object.fromEntries((plan.plan_features || []).map((feature) => [feature.feature_key, getFeatureValue(feature)]));
}

function displayFeatureValue(feature: PlanFeature) {
    if (feature.feature_type === "bool") {
        return feature.bool_value ? "Enabled" : "Disabled";
    }

    if (feature.feature_type === "int") {
        return String(feature.int_value ?? 0);
    }

    return feature.string_value || "N/A";
}

function FeatureBullet({
    enabled,
    label
}: {
    enabled: boolean;
    label: string;
}) {
    return (
        <Stack direction="row" spacing={1} alignItems="flex-start">
            <CheckCircleRoundedIcon
                sx={{
                    mt: "2px",
                    fontSize: 16,
                    color: enabled ? "success.main" : "text.disabled"
                }}
            />
            <Typography variant="body2" color={enabled ? "text.primary" : "text.secondary"}>
                {label}
            </Typography>
        </Stack>
    );
}

function SummaryStat({
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
        <Paper
            variant="outlined"
            sx={{
                p: 2,
                borderRadius: 2,
                height: "100%",
                bgcolor: "background.paper"
            }}
        >
            <Stack spacing={1.25}>
                <Avatar
                    sx={{
                        width: 40,
                        height: 40,
                        bgcolor: "action.hover",
                        color: "text.primary"
                    }}
                >
                    {icon}
                </Avatar>
                <Typography variant="overline" color="text.secondary">
                    {label}
                </Typography>
                <Typography variant="h5">{value}</Typography>
                <Typography variant="body2" color="text.secondary">
                    {helper}
                </Typography>
            </Stack>
        </Paper>
    );
}

export function PlatformPlansPage() {
    const theme = useTheme();
    const { pushToast } = useToast();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
    const [features, setFeatures] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);

    const loadPlans = async () => {
        setLoading(true);
        setError(null);

        try {
            const { data } = await api.get<PlansResponse>(endpoints.platform.plans());
            setPlans(data.data || []);
        } catch (loadError) {
            setError(getApiErrorMessage(loadError));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadPlans();
    }, []);

    const featureRows = useMemo(
        () => editingPlan?.plan_features?.slice().sort((left, right) => left.feature_key.localeCompare(right.feature_key)) || [],
        [editingPlan]
    );

    const summary = useMemo(() => {
        const planMaps = plans.map((plan) => getFeatureMap(plan));

        return {
            totalPlans: plans.length,
            lendingPlans: planMaps.filter((entry) => entry.loans_enabled).length,
            governancePlans: planMaps.filter((entry) => entry.multi_approval_enabled).length,
            averageCapacity:
                plans.length > 0
                    ? Math.round(planMaps.reduce((sum, entry) => sum + Number(entry.max_members || 0), 0) / plans.length)
                    : 0
        };
    }, [plans]);

    const openEditor = (plan: Plan) => {
        setEditingPlan(plan);
        setFeatures(
            Object.fromEntries(
                (plan.plan_features || []).map((feature) => [
                    feature.feature_key,
                    feature.feature_type === "bool"
                        ? String(Boolean(feature.bool_value))
                        : feature.feature_type === "int"
                            ? String(feature.int_value ?? 0)
                            : feature.string_value || ""
                ])
            )
        );
    };

    const handleSave = async () => {
        if (!editingPlan) {
            return;
        }

        setSubmitting(true);

        try {
            const payload: UpdatePlanFeaturesRequest = {
                features: featureRows.map((feature) => ({
                    feature_key: feature.feature_key,
                    feature_type: feature.feature_type,
                    bool_value: feature.feature_type === "bool" ? features[feature.feature_key] === "true" : null,
                    int_value: feature.feature_type === "int" ? Number(features[feature.feature_key] || 0) : null,
                    string_value: feature.feature_type === "string" ? features[feature.feature_key] || "" : null
                }))
            };

            const { data } = await api.patch<PlansResponse>(endpoints.platform.planFeatures(editingPlan.id), payload);
            setPlans(data.data || []);
            pushToast({
                type: "success",
                title: "Plan updated",
                message: `${editingPlan.name} entitlements were saved.`
            });
            setEditingPlan(null);
        } catch (saveError) {
            pushToast({
                type: "error",
                title: "Unable to update plan",
                message: getApiErrorMessage(saveError)
            });
        } finally {
            setSubmitting(false);
        }
    };

    const columns: Column<Plan>[] = [
        {
            key: "plan",
            header: "Plan",
            render: (row) => {
                const presentation = planPresentation[row.code];

                return (
                    <Stack spacing={0.4}>
                        <Typography variant="body2" fontWeight={700}>{row.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{presentation.eyebrow}</Typography>
                    </Stack>
                );
            }
        },
        {
            key: "coverage",
            header: "Coverage",
            render: (row) => {
                const featureMap = getFeatureMap(row);

                return (
                    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                        <Chip size="small" label={`Loans ${featureMap.loans_enabled ? "On" : "Off"}`} />
                        <Chip size="small" label={`Dividends ${featureMap.dividends_enabled ? "On" : "Off"}`} />
                        <Chip size="small" label={`Reports ${featureMap.advanced_reports ? "Advanced" : "Standard"}`} />
                    </Stack>
                );
            }
        },
        {
            key: "capacity",
            header: "Capacity",
            render: (row) => {
                const featureMap = getFeatureMap(row);

                return (
                    <Stack spacing={0.25}>
                        <Typography variant="caption" color="text.secondary">
                            Branches: {String(featureMap.max_branches || 0)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Users: {String(featureMap.max_users || 0)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Members: {String(featureMap.max_members || 0)}
                        </Typography>
                    </Stack>
                );
            }
        },
        {
            key: "edit",
            header: "Edit",
            render: (row) => (
                <Button size="small" startIcon={<EditRoundedIcon />} onClick={() => openEditor(row)}>
                    Edit Features
                </Button>
            )
        }
    ];

    return (
        <Stack spacing={3}>
            <MotionCard
                variant="outlined"
                sx={{
                    overflow: "hidden",
                    borderRadius: 3,
                    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${alpha(theme.palette.background.paper, 0.92)} 55%, ${alpha(theme.palette.secondary.main, 0.08)} 100%)`
                }}
            >
                <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
                    <Grid container spacing={3} alignItems="center">
                        <Grid size={{ xs: 12, lg: 7 }}>
                            <Stack spacing={1.5}>
                                <Chip
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                    label="SaaS Entitlements"
                                    sx={{ alignSelf: "flex-start" }}
                                />
                                <Typography variant="h4">
                                    Manage pricing tiers, entitlements, and operating capacity from one control surface.
                                </Typography>
                                <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 720 }}>
                                    These plans now drive backend feature access and capacity enforcement. Keep the catalog clean,
                                    explicit, and aligned with the commercial model you actually sell.
                                </Typography>
                            </Stack>
                        </Grid>
                        <Grid size={{ xs: 12, lg: 5 }}>
                            <Grid container spacing={1.5}>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                    <SummaryStat
                                        label="Plans"
                                        value={String(summary.totalPlans)}
                                        helper="Active subscription tiers in the catalog."
                                        icon={<HubRoundedIcon fontSize="small" />}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                    <SummaryStat
                                        label="Lending Ready"
                                        value={String(summary.lendingPlans)}
                                        helper="Plans that unlock loans."
                                        icon={<LockOpenRoundedIcon fontSize="small" />}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                    <SummaryStat
                                        label="Governance"
                                        value={String(summary.governancePlans)}
                                        helper="Plans with multi-approval controls."
                                        icon={<ShieldRoundedIcon fontSize="small" />}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                    <SummaryStat
                                        label="Avg Capacity"
                                        value={summary.averageCapacity.toLocaleString()}
                                        helper="Average member ceiling across plans."
                                        icon={<InsightsRoundedIcon fontSize="small" />}
                                    />
                                </Grid>
                            </Grid>
                        </Grid>
                    </Grid>
                </CardContent>
            </MotionCard>

            {error ? <Alert severity="error">{error}</Alert> : null}

            <Grid container spacing={2}>
                {plans.map((plan) => {
                    const presentation = planPresentation[plan.code];
                    const Icon = presentation.icon;
                    const featureMap = getFeatureMap(plan);

                    return (
                        <Grid key={plan.id} size={{ xs: 12, xl: 4 }}>
                            <MotionCard
                                variant="outlined"
                                sx={{
                                    height: "100%",
                                    borderRadius: 3,
                                    position: "relative",
                                    overflow: "hidden",
                                    background: `linear-gradient(180deg, ${alpha(presentation.accent, 0.08)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 42%)`,
                                    borderColor: plan.code === "growth" ? alpha(theme.palette.primary.main, 0.45) : "divider"
                                }}
                            >
                                {plan.code === "growth" ? (
                                    <Chip
                                        label="Recommended"
                                        color="primary"
                                        size="small"
                                        sx={{ position: "absolute", top: 16, right: 16 }}
                                    />
                                ) : null}
                                <CardContent sx={{ p: 3 }}>
                                    <Stack spacing={2.25}>
                                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                            <Stack spacing={0.75}>
                                                <Chip
                                                    size="small"
                                                    variant="outlined"
                                                    color={presentation.tint}
                                                    label={presentation.eyebrow}
                                                    sx={{ alignSelf: "flex-start" }}
                                                />
                                                <Typography variant="h5">{plan.name}</Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {presentation.hero}
                                                </Typography>
                                            </Stack>
                                            <Avatar
                                                sx={{
                                                    bgcolor: alpha(presentation.accent, 0.12),
                                                    color: presentation.accent,
                                                    width: 48,
                                                    height: 48
                                                }}
                                            >
                                                <Icon />
                                            </Avatar>
                                        </Stack>

                                        <Grid container spacing={1.25}>
                                            <Grid size={{ xs: 4 }}>
                                                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                                                    <Typography variant="overline" color="text.secondary">Branches</Typography>
                                                    <Typography variant="h6">{String(featureMap.max_branches || 0)}</Typography>
                                                </Paper>
                                            </Grid>
                                            <Grid size={{ xs: 4 }}>
                                                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                                                    <Typography variant="overline" color="text.secondary">Users</Typography>
                                                    <Typography variant="h6">{String(featureMap.max_users || 0)}</Typography>
                                                </Paper>
                                            </Grid>
                                            <Grid size={{ xs: 4 }}>
                                                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                                                    <Typography variant="overline" color="text.secondary">Members</Typography>
                                                    <Typography variant="h6">{Number(featureMap.max_members || 0).toLocaleString()}</Typography>
                                                </Paper>
                                            </Grid>
                                        </Grid>

                                        <Divider />

                                        <Stack spacing={1}>
                                            <FeatureBullet enabled={Boolean(featureMap.loans_enabled)} label="Loan operations" />
                                            <FeatureBullet enabled={Boolean(featureMap.dividends_enabled)} label="Dividend cycles" />
                                            <FeatureBullet enabled={Boolean(featureMap.contributions_enabled)} label="Share contributions" />
                                            <FeatureBullet enabled={Boolean(featureMap.advanced_reports)} label="Advanced reporting exports" />
                                            <FeatureBullet enabled={Boolean(featureMap.maker_checker_enabled)} label="Maker-checker governance" />
                                            <FeatureBullet enabled={Boolean(featureMap.multi_approval_enabled)} label="Multi-approval control" />
                                        </Stack>

                                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                            <Chip size="small" label={plan.code.toUpperCase()} variant="outlined" />
                                            <Chip
                                                size="small"
                                                color={featureMap.advanced_reports ? "primary" : "default"}
                                                label={featureMap.advanced_reports ? "Advanced Reports" : "Standard Reports"}
                                            />
                                            <Chip
                                                size="small"
                                                color={featureMap.multi_approval_enabled ? "secondary" : "default"}
                                                label={featureMap.multi_approval_enabled ? "Multi Approval" : "Single Approval"}
                                            />
                                        </Stack>

                                        <Button
                                            variant={plan.code === "growth" ? "contained" : "outlined"}
                                            startIcon={<EditRoundedIcon />}
                                            onClick={() => openEditor(plan)}
                                        >
                                            Edit Plan Controls
                                        </Button>
                                    </Stack>
                                </CardContent>
                            </MotionCard>
                        </Grid>
                    );
                })}
            </Grid>

            <MotionCard variant="outlined" sx={{ borderRadius: 3 }}>
                <CardContent sx={{ p: 3 }}>
                    <Stack spacing={1}>
                        <Typography variant="h6">Plan Matrix</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Operational summary across all SaaS plans, useful when reviewing pricing and support scope.
                        </Typography>
                    </Stack>
                    <Box sx={{ mt: 2 }}>
                        {loading ? (
                            <AppLoader fullscreen={false} minHeight={240} message="Loading plans..." />
                        ) : (
                            <DataTable rows={plans} columns={columns} emptyMessage="No plans configured." />
                        )}
                    </Box>
                </CardContent>
            </MotionCard>

            <MotionModal open={Boolean(editingPlan)} onClose={() => setEditingPlan(null)} fullWidth maxWidth="md">
                <DialogTitle>Edit Plan Features</DialogTitle>
                <DialogContent>
                    <Stack spacing={2.5} sx={{ pt: 1 }}>
                        <Box>
                            <Typography variant="subtitle1" fontWeight={700}>
                                {editingPlan?.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Update backend-enforced features and hard limits for this subscription tier.
                            </Typography>
                        </Box>

                        <Grid container spacing={2}>
                            {featureRows.map((feature) => {
                                if (feature.feature_type === "bool") {
                                    return (
                                        <Grid key={feature.feature_key} size={{ xs: 12, md: 6 }}>
                                            <TextField
                                                fullWidth
                                                select
                                                label={feature.feature_key}
                                                value={features[feature.feature_key] ?? "false"}
                                                onChange={(event) => setFeatures((current) => ({
                                                    ...current,
                                                    [feature.feature_key]: event.target.value
                                                }))}
                                            >
                                                <MenuItem value="true">Enabled</MenuItem>
                                                <MenuItem value="false">Disabled</MenuItem>
                                            </TextField>
                                        </Grid>
                                    );
                                }

                                return (
                                    <Grid key={feature.feature_key} size={{ xs: 12, md: 6 }}>
                                        <TextField
                                            fullWidth
                                            label={feature.feature_key}
                                            type={feature.feature_type === "int" ? "number" : "text"}
                                            value={features[feature.feature_key] ?? ""}
                                            onChange={(event) => setFeatures((current) => ({
                                                ...current,
                                                [feature.feature_key]: event.target.value
                                            }))}
                                        />
                                    </Grid>
                                );
                            })}
                        </Grid>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditingPlan(null)}>Cancel</Button>
                    <Button onClick={handleSave} variant="contained" disabled={submitting}>
                        {submitting ? "Saving..." : "Save Changes"}
                    </Button>
                </DialogActions>
            </MotionModal>
        </Stack>
    );
}
