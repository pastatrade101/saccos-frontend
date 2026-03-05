import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { FormField } from "../components/FormField";
import { useToast } from "../components/Toast";
import { api, getApiErrorMessage } from "../lib/api";
import { endpoints, type CreateBranchRequest, type CreateBranchResponse } from "../lib/endpoints";
import pageStyles from "./Pages.module.css";

const schema = z.object({
    name: z.string().min(2, "Branch name is required."),
    code: z.string().min(2, "Code is required."),
    region: z.string().min(2, "Region is required."),
    district: z.string().min(2, "District is required.")
});

type SetupBranchValues = z.infer<typeof schema>;

export function SetupBranchPage() {
    const navigate = useNavigate();
    const { pushToast } = useToast();
    const { selectedTenantId, selectedTenantName, setSelectedBranchId } = useAuth();
    const [submitting, setSubmitting] = useState(false);

    const form = useForm<SetupBranchValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: "",
            code: "",
            region: "",
            district: ""
        }
    });

    const onSubmit = form.handleSubmit(async (values) => {
        if (!selectedTenantId) {
            pushToast({
                type: "error",
                title: "Tenant required",
                message: "Create or select a tenant before adding a branch."
            });
            return;
        }

        setSubmitting(true);

        try {
            const payload: CreateBranchRequest = {
                tenant_id: selectedTenantId,
                name: values.name,
                code: values.code.toUpperCase(),
                address_line1: `${values.name} Office`,
                address_line2: `${values.district} service desk`,
                city: values.district,
                state: values.region,
                country: "Tanzania"
            };
            const { data } = await api.post<CreateBranchResponse>(endpoints.branches.create(), payload);
            setSelectedBranchId(data.data.id);
            pushToast({
                type: "success",
                title: "Branch created",
                message: `${data.data.name} is now linked to ${selectedTenantName || "the current tenant"}.`
            });
            navigate("/setup/super-admin");
        } catch (error) {
            pushToast({
                type: "error",
                title: "Branch creation failed",
                message: getApiErrorMessage(error)
            });
        } finally {
            setSubmitting(false);
        }
    });

    return (
        <div className="page-grid">
            <div className="card">
                <div className={pageStyles.sectionHeader}>
                    <div>
                        <h3 className={pageStyles.sectionTitle}>2. Create Branch</h3>
                        <p className={pageStyles.sectionCopy}>
                            Region and district are mapped into the backend city and state fields.
                        </p>
                    </div>
                    <div className={pageStyles.status}>Tenant: {selectedTenantName || selectedTenantId || "Not selected"}</div>
                </div>

                <form className={pageStyles.form} onSubmit={onSubmit}>
                    <div className="grid-2">
                        <FormField label="Branch name" error={form.formState.errors.name?.message}>
                            <input {...form.register("name")} placeholder="Main Branch" />
                        </FormField>
                        <FormField label="Branch code" error={form.formState.errors.code?.message}>
                            <input {...form.register("code")} placeholder="HQ" />
                        </FormField>
                    </div>
                    <div className="grid-2">
                        <FormField label="Region" error={form.formState.errors.region?.message}>
                            <input {...form.register("region")} placeholder="Central" />
                        </FormField>
                        <FormField label="District" error={form.formState.errors.district?.message}>
                            <input {...form.register("district")} placeholder="Kinondoni" />
                        </FormField>
                    </div>
                    <button className="primary-button" disabled={submitting || !selectedTenantId} type="submit">
                        {submitting ? "Creating branch..." : "Create Branch"}
                    </button>
                </form>
            </div>
        </div>
    );
}
