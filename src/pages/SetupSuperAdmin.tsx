import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { FormField } from "../components/FormField";
import { useToast } from "../components/Toast";
import { api, getApiErrorMessage } from "../lib/api";
import { endpoints, type SetupSuperAdminRequest, type SetupSuperAdminResponse } from "../lib/endpoints";
import pageStyles from "./Pages.module.css";

const schema = z.object({
    email: z.string().email("Valid email is required."),
    full_name: z.string().min(3, "Full name is required."),
    phone: z.string().min(7, "Phone number is required."),
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

type SetupSuperAdminValues = z.infer<typeof schema>;

export function SetupSuperAdminPage() {
    const navigate = useNavigate();
    const { pushToast } = useToast();
    const {
        profile,
        user,
        selectedTenantId,
        isInternalOps,
    } = useAuth();
    const [submitting, setSubmitting] = useState(false);
    const [createdAdminEmail, setCreatedAdminEmail] = useState<string | null>(null);
    const [createdByInvite, setCreatedByInvite] = useState(true);
    const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);

    const form = useForm<SetupSuperAdminValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            email: "",
            full_name: "",
            phone: "",
            send_invite: true,
            password: ""
        }
    });

    const sendInvite = form.watch("send_invite");

    useEffect(() => {
        const guessedName =
            typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "";
        const guessedPhone =
            typeof user?.user_metadata?.phone === "string" ? user.user_metadata.phone : "";

        form.reset({
            email: "",
            full_name: guessedName,
            phone: guessedPhone,
            send_invite: true,
            password: ""
        });
    }, [form, user]);

    if (createdAdminEmail) {
        return (
            <div className="card">
                <h3 className={pageStyles.sectionTitle}>3. Tenant Super Admin Created</h3>
                <p className={pageStyles.sectionCopy}>
                    A dedicated tenant super admin account has been provisioned for this tenant.
                </p>
                <div className={pageStyles.form}>
                    <FormField label="Admin Email">
                        <input value={createdAdminEmail} disabled />
                    </FormField>
                    <FormField label="Provisioning Mode">
                        <input value={createdByInvite ? "Invite sent" : "Password created"} disabled />
                    </FormField>
                    {!createdByInvite && temporaryPassword ? (
                        <FormField label="One-time temporary password">
                            <input value={temporaryPassword} disabled />
                        </FormField>
                    ) : null}
                </div>
                <button className="primary-button" onClick={() => navigate("/dashboard")}>
                    Back to dashboard
                </button>
            </div>
        );
    }

    const onSubmit = form.handleSubmit(async (values) => {
        if (!selectedTenantId) {
            pushToast({
                type: "error",
                title: "Setup incomplete",
                message: "Create tenant first."
            });
            return;
        }

        setSubmitting(true);

        try {
            const payload: SetupSuperAdminRequest = {
                tenant_id: selectedTenantId,
                email: values.email,
                full_name: values.full_name,
                phone: values.phone,
                send_invite: values.send_invite,
                password: values.send_invite ? null : values.password || null
            };

            const { data } = await api.post<SetupSuperAdminResponse>(endpoints.users.setupSuperAdmin(), payload);
            setCreatedAdminEmail(data.data.user?.email || values.email);
            setCreatedByInvite(values.send_invite);
            setTemporaryPassword(data.data.temporary_password || (!values.send_invite && values.password ? values.password : null));
            pushToast({
                type: "success",
                title: "Tenant super admin created",
                message: values.send_invite
                    ? "Invite sent to the new tenant super admin."
                    : values.password
                        ? "Tenant super admin created with the supplied password."
                        : "Tenant super admin created with a generated temporary password."
            });
        } catch (error) {
            pushToast({
                type: "error",
                title: "Profile setup failed",
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
                        <h3 className={pageStyles.sectionTitle}>3. Create Tenant Super Admin</h3>
                        <p className={pageStyles.sectionCopy}>
                            Create the first real tenant administrator account. The system will create the auth user, assign `super_admin`, and attach the tenant's default branch automatically.
                        </p>
                        {isInternalOps ? (
                            <p className={pageStyles.sectionCopy}>
                                This does not change the current SaaS owner session. It provisions a separate tenant admin login.
                            </p>
                        ) : null}
                    </div>
                </div>

                <form className={pageStyles.form} onSubmit={onSubmit}>
                    <FormField label="Tenant ID">
                        <input value={selectedTenantId || ""} disabled />
                    </FormField>
                    <div className="grid-2">
                        <FormField label="Admin email" error={form.formState.errors.email?.message}>
                            <input {...form.register("email")} placeholder="admin@tenant.co.tz" />
                        </FormField>
                        <FormField label="Full name" error={form.formState.errors.full_name?.message}>
                            <input {...form.register("full_name")} placeholder="Tenant Super Admin" />
                        </FormField>
                    </div>
                    <div className="grid-2">
                        <FormField label="Phone" error={form.formState.errors.phone?.message}>
                            <input {...form.register("phone")} placeholder="+255754000001" />
                        </FormField>
                        <FormField label="Provisioning mode">
                            <select
                                value={sendInvite ? "invite" : "password"}
                                onChange={(event) => {
                                    const nextInvite = event.target.value === "invite";
                                    form.setValue("send_invite", nextInvite, { shouldValidate: true });
                                    if (nextInvite) {
                                        form.setValue("password", "", { shouldValidate: true });
                                    }
                                }}
                            >
                                <option value="invite">Send Invite</option>
                                <option value="password">Create with Temporary Password</option>
                            </select>
                        </FormField>
                    </div>
                    {!sendInvite ? (
                        <FormField label="Initial password" error={form.formState.errors.password?.message}>
                            <input {...form.register("password")} type="password" placeholder="Leave blank to auto-generate" />
                        </FormField>
                    ) : null}
                    <button
                        className="primary-button"
                        disabled={submitting || !selectedTenantId}
                        type="submit"
                    >
                        {submitting ? "Creating admin..." : "Create Tenant Super Admin"}
                    </button>
                </form>
            </div>
        </div>
    );
}
