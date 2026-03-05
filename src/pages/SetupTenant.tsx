import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import {
    Box,
    Chip,
    Stack,
    Typography
} from "@mui/material";

import { useAuth } from "../auth/AuthProvider";
import { FormField } from "../components/FormField";
import { useToast } from "../components/Toast";
import { api, getApiErrorMessage } from "../lib/api";
import { endpoints, type CreateTenantRequest, type CreateTenantResponse, type PlansResponse } from "../lib/endpoints";
import type { Plan } from "../types/api";
import { getPlanHighlights } from "../utils/plans";
import pageStyles from "./Pages.module.css";

const schema = z.object({
    name: z.string().min(3, "Tenant name is required."),
    registration_number: z.string().min(3, "Registration number is required."),
    plan: z.enum(["starter", "growth", "enterprise"])
});

type SetupTenantValues = z.infer<typeof schema>;

export function SetupTenantPage() {
    const navigate = useNavigate();
    const { pushToast } = useToast();
    const { isInternalOps, refreshProfile, setSelectedBranchId, setSelectedTenantId } = useAuth();
    const [submitting, setSubmitting] = useState(false);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [plansLoading, setPlansLoading] = useState(true);

    const form = useForm<SetupTenantValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: "",
            registration_number: "",
            plan: "growth"
        }
    });
    const selectedPlan = form.watch("plan");
    const planOptions = useMemo(
        () =>
            plans
                .slice()
                .sort((left, right) => {
                    const order = { starter: 1, growth: 2, enterprise: 3 };
                    return order[left.code] - order[right.code];
                })
                .map((plan) => ({
                    value: plan.code,
                    label: plan.name,
                    helper: plan.description || "Configured plan entitlements for this tenant tier.",
                    badge: plan.code === "growth" ? "Recommended" : undefined,
                    benefits: getPlanHighlights(plan)
                })),
        [plans]
    );

    useEffect(() => {
        if (!isInternalOps) {
            return;
        }

        setPlansLoading(true);
        void api.get<PlansResponse>(endpoints.platform.plans())
            .then(({ data }) => {
                setPlans(data.data || []);
            })
            .catch((error) => {
                pushToast({
                    type: "error",
                    title: "Unable to load plans",
                    message: getApiErrorMessage(error)
                });
            })
            .finally(() => {
                setPlansLoading(false);
            });
    }, [isInternalOps, pushToast]);

    const onSubmit = form.handleSubmit(async (values) => {
        setSubmitting(true);

        try {
            const payload: CreateTenantRequest = {
                ...values,
                status: "active",
                subscription_status: "active"
            };
            const { data } = await api.post<CreateTenantResponse>(endpoints.tenants.create(), payload);
            setSelectedTenantId(data.data.id, data.data.name);
            setSelectedBranchId(null);
            await refreshProfile(data.data.id);
            pushToast({
                type: "success",
                title: "Tenant created",
                message: `${data.data.name} is ready on the ${values.plan.toUpperCase()} plan with a default head office branch.`
            });
            navigate("/dashboard");
        } catch (error) {
            pushToast({
                type: "error",
                title: "Tenant creation failed",
                message: getApiErrorMessage(error)
            });
        } finally {
            setSubmitting(false);
        }
    });

    if (!isInternalOps) {
        return (
            <div className="empty-state">
                Only internal operations users can create tenants from this screen.
            </div>
        );
    }

    return (
        <div className="page-grid">
            <div className="card">
                <div className={pageStyles.sectionHeader}>
                    <div>
                        <h3 className={pageStyles.sectionTitle}>1. Create Tenant</h3>
                        <p className={pageStyles.sectionCopy}>
                            Create the SACCOS organization, choose its subscription plan, and provision the default head office branch.
                        </p>
                    </div>
                </div>

                <form className={pageStyles.form} onSubmit={onSubmit}>
                    <div className="grid-2">
                        <FormField label="Tenant name" error={form.formState.errors.name?.message}>
                            <input {...form.register("name")} placeholder="Demo Farmers SACCOS" />
                        </FormField>
                        <FormField
                            label="Registration number"
                            error={form.formState.errors.registration_number?.message}
                        >
                            <input {...form.register("registration_number")} placeholder="SAC-2026-001" />
                        </FormField>
                    </div>

                    <FormField label="Subscription plan" error={form.formState.errors.plan?.message}>
                        <Stack spacing={1.5}>
                            {plansLoading ? (
                                <Box
                                    sx={{
                                        border: "1px dashed",
                                        borderColor: "divider",
                                        borderRadius: 2,
                                        px: 2,
                                        py: 2,
                                        color: "text.secondary"
                                    }}
                                >
                                    Loading configured plan entitlements...
                                </Box>
                            ) : null}
                            {planOptions.map((plan) => {
                                const active = selectedPlan === plan.value;

                                return (
                                    <Box
                                        key={plan.value}
                                        component="button"
                                        type="button"
                                        onClick={() => form.setValue("plan", plan.value, { shouldValidate: true, shouldDirty: true })}
                                        sx={{
                                            width: "100%",
                                            textAlign: "left",
                                            border: active ? "1.5px solid" : "1px solid",
                                            borderColor: active ? "primary.main" : "divider",
                                            bgcolor: active ? "action.selected" : "background.paper",
                                            borderRadius: 2,
                                            px: 2,
                                            py: 1.75,
                                            cursor: "pointer",
                                            transition: "all 120ms ease",
                                            "&:hover": {
                                                borderColor: active ? "primary.main" : "text.secondary",
                                                bgcolor: active ? "action.selected" : "action.hover"
                                            }
                                        }}
                                    >
                                        <Stack spacing={1.25}>
                                            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                                                <Stack direction="row" spacing={1} alignItems="center">
                                                    <Typography variant="subtitle1" fontWeight={700}>
                                                        {plan.label}
                                                    </Typography>
                                                    {plan.badge ? <Chip size="small" color="primary" label={plan.badge} /> : null}
                                                </Stack>
                                                {active ? <CheckCircleRoundedIcon color="primary" fontSize="small" /> : null}
                                            </Stack>
                                            <Typography variant="body2" color="text.secondary">
                                                {plan.helper}
                                            </Typography>
                                            <Stack spacing={0.75}>
                                                {plan.benefits.map((benefit) => (
                                                    <Stack key={benefit} direction="row" spacing={1} alignItems="flex-start">
                                                        <CheckCircleRoundedIcon sx={{ fontSize: 16, mt: "2px", color: active ? "primary.main" : "text.secondary" }} />
                                                        <Typography variant="body2" color="text.secondary">
                                                            {benefit}
                                                        </Typography>
                                                    </Stack>
                                                ))}
                                            </Stack>
                                        </Stack>
                                    </Box>
                                );
                            })}
                        </Stack>
                    </FormField>

                    <Box
                        sx={{
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 2,
                            px: 2,
                            py: 1.5,
                            bgcolor: "background.default"
                        }}
                    >
                        <Typography variant="overline" color="text.secondary">
                            Selected Plan
                        </Typography>
                        <Typography variant="subtitle1" fontWeight={700}>
                            {planOptions.find((plan) => plan.value === selectedPlan)?.label || "Growth"}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            The tenant will be provisioned with the live entitlements currently configured on this plan.
                        </Typography>
                    </Box>

                    <button className="primary-button" disabled={submitting} type="submit">
                        {submitting ? "Creating tenant..." : "Create Tenant"}
                    </button>
                </form>
            </div>
        </div>
    );
}
