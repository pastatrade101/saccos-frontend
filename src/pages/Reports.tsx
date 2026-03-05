import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { useAuth } from "../auth/AuthProvider";
import { FormField } from "../components/FormField";
import { SearchableSelect } from "../components/SearchableSelect";
import { useToast } from "../components/Toast";
import { api, getApiErrorMessage } from "../lib/api";
import { endpoints } from "../lib/endpoints";
import { supabase } from "../lib/supabase";
import type { MemberAccount } from "../types/api";
import { downloadFile, getFilenameFromDisposition } from "../utils/downloadFile";
import pageStyles from "./Pages.module.css";

const statementSchema = z.object({
    account_id: z.string().uuid("Select an account.").optional().or(z.literal("")),
    from_date: z.string().optional(),
    to_date: z.string().optional()
});

type StatementExportValues = z.infer<typeof statementSchema>;

export function ReportsPage() {
    const { pushToast } = useToast();
    const { selectedTenantId, subscription } = useAuth();
    const [accounts, setAccounts] = useState<MemberAccount[]>([]);
    const [downloading, setDownloading] = useState<string | null>(null);
    const advancedReportsEnabled = Boolean(subscription?.features?.advanced_reports);

    const form = useForm<StatementExportValues>({
        resolver: zodResolver(statementSchema),
        defaultValues: {
            account_id: localStorage.getItem("saccos:selectedAccountId") || "",
            from_date: "",
            to_date: ""
        }
    });

    useEffect(() => {
        if (!selectedTenantId) {
            return;
        }

        void supabase
            .from("member_accounts")
            .select("*")
            .eq("tenant_id", selectedTenantId)
            .is("deleted_at", null)
            .then(({ data }) => setAccounts((data || []) as MemberAccount[]));
    }, [selectedTenantId]);

    const accountOptions = accounts.map((account) => ({
        value: account.id,
        label: account.account_number,
        secondary: account.account_name
    }));

    const runDownload = async (
        key: string,
        url: string,
        params: Record<string, string | undefined>
    ) => {
        setDownloading(key);

        try {
            const response = await api.get(url, {
                params,
                responseType: "blob"
            });

            const filename = getFilenameFromDisposition(
                response.headers["content-disposition"],
                `${key}.csv`
            );

            downloadFile(response.data as Blob, filename);
            pushToast({
                type: "success",
                title: "Download ready",
                message: `${filename} was downloaded successfully.`
            });
        } catch (error) {
            pushToast({
                type: "error",
                title: "Export failed",
                message: getApiErrorMessage(error)
            });
        } finally {
            setDownloading(null);
        }
    };

    const exportStatement = form.handleSubmit(async (values) => {
        await runDownload("member-statements", endpoints.reports.memberStatements(), {
            tenant_id: selectedTenantId || undefined,
            account_id: values.account_id || undefined,
            from_date: values.from_date || undefined,
            to_date: values.to_date || undefined,
            format: "csv"
        });
    });

    return (
        <div className="page-grid">
            <div className={pageStyles.reportGrid}>
                <div className="card">
                    <h3 className={pageStyles.sectionTitle}>7. Trial Balance</h3>
                    <p className={pageStyles.sectionCopy}>Download the tenant trial balance as CSV.</p>
                    <button
                        className="primary-button"
                        disabled={downloading === "trial-balance" || !advancedReportsEnabled}
                        onClick={() =>
                            void runDownload("trial-balance", endpoints.reports.trialBalance(), {
                                tenant_id: selectedTenantId || undefined,
                                format: "csv"
                            })
                        }
                    >
                        {downloading === "trial-balance" ? "Preparing..." : "Download CSV"}
                    </button>
                </div>

                <div className="card">
                    <h3 className={pageStyles.sectionTitle}>Loan Aging</h3>
                    <p className={pageStyles.sectionCopy}>Export aging buckets for the current tenant.</p>
                    <button
                        className="primary-button"
                        disabled={downloading === "loan-aging" || !advancedReportsEnabled}
                        onClick={() =>
                            void runDownload("loan-aging", endpoints.reports.loanAging(), {
                                tenant_id: selectedTenantId || undefined,
                                format: "csv"
                            })
                        }
                    >
                        {downloading === "loan-aging" ? "Preparing..." : "Download CSV"}
                    </button>
                </div>

                <div className="card">
                    <h3 className={pageStyles.sectionTitle}>Portfolio At Risk</h3>
                    <p className={pageStyles.sectionCopy}>Export PAR analysis for delinquency monitoring.</p>
                    <button
                        className="primary-button"
                        disabled={downloading === "par" || !advancedReportsEnabled}
                        onClick={() =>
                            void runDownload("par", endpoints.reports.par(), {
                                tenant_id: selectedTenantId || undefined,
                                format: "csv"
                            })
                        }
                    >
                        {downloading === "par" ? "Preparing..." : "Download CSV"}
                    </button>
                </div>

                <div className="card">
                    <h3 className={pageStyles.sectionTitle}>Member Statement</h3>
                    <form className={pageStyles.form} onSubmit={exportStatement}>
                        <FormField label="Account">
                            <SearchableSelect
                                value={form.watch("account_id") || ""}
                                options={accountOptions}
                                onChange={(value) => form.setValue("account_id", value, { shouldValidate: true })}
                            />
                        </FormField>
                        <div className="grid-2">
                            <FormField label="From date">
                                <input type="date" {...form.register("from_date")} />
                            </FormField>
                            <FormField label="To date">
                                <input type="date" {...form.register("to_date")} />
                            </FormField>
                        </div>
                        <button className="primary-button" disabled={downloading === "member-statements"} type="submit">
                            {downloading === "member-statements" ? "Preparing..." : "Download CSV"}
                        </button>
                    </form>
                </div>
            </div>
            {!advancedReportsEnabled ? (
                <div className="empty-state">
                    Advanced reports are not enabled for the current tenant plan.
                </div>
            ) : null}
        </div>
    );
}
