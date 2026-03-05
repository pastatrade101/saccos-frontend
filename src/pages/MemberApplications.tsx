import { MotionCard, MotionModal } from "../ui/motion";
import ApprovalRoundedIcon from "@mui/icons-material/ApprovalRounded";
import ChecklistRoundedIcon from "@mui/icons-material/ChecklistRounded";
import DoDisturbRoundedIcon from "@mui/icons-material/DoDisturbRounded";
import FactCheckRoundedIcon from "@mui/icons-material/FactCheckRounded";
import PersonAddAlt1RoundedIcon from "@mui/icons-material/PersonAddAlt1Rounded";
import {
    Alert,
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
    Stack,
    TextField,
    Typography
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { DataTable } from "../components/DataTable";
import { useToast } from "../components/Toast";
import { api, getApiErrorMessage } from "../lib/api";
import {
    endpoints,
    type BranchesListResponse,
    type CreateMemberApplicationRequest,
    type MemberApplicationsResponse,
    type RejectMemberApplicationRequest,
    type ReviewMemberApplicationRequest
} from "../lib/endpoints";
import type { Branch, MemberApplication } from "../types/api";
import { formatCurrency, formatDate } from "../utils/format";

type DialogMode = "create" | "review" | "reject" | null;

function statusColor(status: MemberApplication["status"]) {
    if (status === "approved") return "success";
    if (status === "rejected") return "error";
    if (status === "under_review") return "warning";
    if (status === "submitted") return "info";
    return "default";
}

export function MemberApplicationsPage() {
    const navigate = useNavigate();
    const { pushToast } = useToast();
    const { profile, selectedTenantId, selectedBranchId } = useAuth();
    const [applications, setApplications] = useState<MemberApplication[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [selected, setSelected] = useState<MemberApplication | null>(null);
    const [dialogMode, setDialogMode] = useState<DialogMode>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const createForm = useForm<CreateMemberApplicationRequest>({
        defaultValues: {
            branch_id: selectedBranchId || "",
            full_name: "",
            phone: "",
            email: "",
            member_no: "",
            national_id: "",
            notes: "",
            membership_fee_amount: 10000,
            membership_fee_paid: 0,
            kyc_status: "pending"
        }
    });

    const reviewForm = useForm<ReviewMemberApplicationRequest>({
        defaultValues: {
            notes: "",
            kyc_status: "verified",
            kyc_reason: ""
        }
    });

    const rejectForm = useForm<RejectMemberApplicationRequest>({
        defaultValues: {
            reason: ""
        }
    });

    const loadApplications = async () => {
        if (!selectedTenantId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const [{ data: appsResponse }, { data: branchResponse }] = await Promise.all([
                api.get<MemberApplicationsResponse>(endpoints.memberApplications.list()),
                api.get<BranchesListResponse>(endpoints.branches.list(), { params: { tenant_id: selectedTenantId } })
            ]);

            setApplications(appsResponse.data || []);
            setBranches(branchResponse.data || []);
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to load applications",
                message: getApiErrorMessage(error)
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadApplications();
    }, [selectedTenantId]);

    const summary = useMemo(() => ({
        draft: applications.filter((item) => item.status === "draft").length,
        review: applications.filter((item) => item.status === "submitted" || item.status === "under_review").length,
        approved: applications.filter((item) => item.status === "approved").length,
        rejected: applications.filter((item) => item.status === "rejected").length
    }), [applications]);
    const isSuperAdmin = profile?.role === "super_admin";
    const isBranchManager = profile?.role === "branch_manager";

    const createApplication = createForm.handleSubmit(async (values) => {
        setSubmitting(true);
        try {
            if (selected) {
                await api.patch(endpoints.memberApplications.detail(selected.id), values);
                pushToast({
                    type: "success",
                    title: "Application updated",
                    message: "The rejected application has been reopened and is ready for resubmission."
                });
            } else {
                await api.post(endpoints.memberApplications.list(), values);
                pushToast({ type: "success", title: "Application created", message: "The membership application is ready for submission." });
            }
            setDialogMode(null);
            setSelected(null);
            createForm.reset({
                branch_id: selectedBranchId || "",
                full_name: "",
                phone: "",
                email: "",
                member_no: "",
                national_id: "",
                nida_no: "",
                address_line1: "",
                employer: "",
                notes: "",
                membership_fee_amount: 10000,
                membership_fee_paid: 0,
                kyc_status: "pending"
            });
            await loadApplications();
        } catch (error) {
            pushToast({ type: "error", title: "Unable to create application", message: getApiErrorMessage(error) });
        } finally {
            setSubmitting(false);
        }
    });

    const openEditApplication = (application: MemberApplication) => {
        setSelected(application);
        createForm.reset({
            branch_id: application.branch_id,
            full_name: application.full_name,
            phone: application.phone || "",
            email: application.email || "",
            member_no: application.member_no || "",
            national_id: application.national_id || "",
            nida_no: application.nida_no || "",
            address_line1: application.address_line1 || "",
            employer: application.employer || "",
            notes: application.notes || "",
            membership_fee_amount: Number(application.membership_fee_amount || 0),
            membership_fee_paid: Number(application.membership_fee_paid || 0),
            kyc_status: application.kyc_status || "pending"
        });
        setDialogMode("create");
    };

    const reviewApplication = reviewForm.handleSubmit(async (values) => {
        if (!selected) return;
        setSubmitting(true);
        try {
            await api.post(endpoints.memberApplications.review(selected.id), values);
            pushToast({ type: "success", title: "Application moved to review", message: "KYC and review notes have been recorded." });
            setDialogMode(null);
            await loadApplications();
        } catch (error) {
            pushToast({ type: "error", title: "Unable to review application", message: getApiErrorMessage(error) });
        } finally {
            setSubmitting(false);
        }
    });

    const rejectApplication = rejectForm.handleSubmit(async (values) => {
        if (!selected) return;
        setSubmitting(true);
        try {
            await api.post(endpoints.memberApplications.reject(selected.id), values);
            pushToast({ type: "success", title: "Application rejected", message: "The applicant record now reflects the rejection reason." });
            setDialogMode(null);
            await loadApplications();
        } catch (error) {
            pushToast({ type: "error", title: "Unable to reject application", message: getApiErrorMessage(error) });
        } finally {
            setSubmitting(false);
        }
    });

    const submitApplication = async (application: MemberApplication) => {
        try {
            await api.post(endpoints.memberApplications.submit(application.id));
            pushToast({ type: "success", title: "Application submitted", message: "The application is now ready for review." });
            await loadApplications();
        } catch (error) {
            pushToast({ type: "error", title: "Unable to submit application", message: getApiErrorMessage(error) });
        }
    };

    const approveApplication = async (application: MemberApplication) => {
        try {
            await api.post(endpoints.memberApplications.approve(application.id));
            pushToast({
                type: "success",
                title: "Application approved",
                message: "Member record and accounts were created. Branch manager can now continue in Members to provision portal login if needed."
            });
            await loadApplications();
        } catch (error) {
            pushToast({ type: "error", title: "Unable to approve application", message: getApiErrorMessage(error) });
        }
    };

    return (
        <Stack spacing={3}>
            <MotionCard sx={{ color: "#fff", background: "linear-gradient(135deg, #0A0573 0%, #1FA8E6 100%)" }}>
                <CardContent>
                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
                        <Stack spacing={1}>
                            <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.72)" }}>
                                Membership workflow
                            </Typography>
                            <Typography variant="h4">Applications, KYC review, and approval</Typography>
                            <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.82)", maxWidth: 760 }}>
                                Capture applicants before they become members, track KYC decisions, and hand off the final approval to the tenant super admin before the record moves into the member master and account structure.
                            </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1.5} alignItems="flex-start">
                            {isBranchManager ? (
                                <Button
                                    variant="contained"
                                    startIcon={<PersonAddAlt1RoundedIcon />}
                                    onClick={() => setDialogMode("create")}
                                    sx={{
                                        bgcolor: "#FFFFFF",
                                        color: "#0A0573",
                                        fontWeight: 700,
                                        "&:hover": {
                                            bgcolor: "rgba(255,255,255,0.92)"
                                        }
                                    }}
                                >
                                    New application
                                </Button>
                            ) : null}
                        </Stack>
                    </Stack>
                </CardContent>
            </MotionCard>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 3 }}><MotionCard variant="outlined"><CardContent><Typography variant="overline">Draft</Typography><Typography variant="h4">{summary.draft}</Typography></CardContent></MotionCard></Grid>
                <Grid size={{ xs: 12, md: 3 }}><MotionCard variant="outlined"><CardContent><Typography variant="overline">In Review</Typography><Typography variant="h4">{summary.review}</Typography></CardContent></MotionCard></Grid>
                <Grid size={{ xs: 12, md: 3 }}><MotionCard variant="outlined"><CardContent><Typography variant="overline">Approved</Typography><Typography variant="h4">{summary.approved}</Typography></CardContent></MotionCard></Grid>
                <Grid size={{ xs: 12, md: 3 }}><MotionCard variant="outlined"><CardContent><Typography variant="overline">Rejected</Typography><Typography variant="h4">{summary.rejected}</Typography></CardContent></MotionCard></Grid>
            </Grid>

            <Alert severity="info">
                Branch managers originate and review applications. Tenant super admins perform the final approve or reject action, which creates the member record, provisions default savings/share accounts, and posts any paid membership fee using the configured posting rule.
            </Alert>

            <DataTable
                rows={applications}
                columns={[
                    { key: "application", header: "Application", render: (row) => <Stack spacing={0.25}><Typography fontWeight={700}>{row.application_no}</Typography><Typography variant="body2" color="text.secondary">{row.full_name}</Typography></Stack> },
                    { key: "branch", header: "Branch", render: (row) => branches.find((branch) => branch.id === row.branch_id)?.name || row.branch_id },
                    { key: "status", header: "Status", render: (row) => <Chip size="small" color={statusColor(row.status)} label={row.status.replace(/_/g, " ")} /> },
                    { key: "kyc", header: "KYC", render: (row) => row.kyc_status },
                    { key: "fee", header: "Fee", render: (row) => `${formatCurrency(row.membership_fee_paid)} / ${formatCurrency(row.membership_fee_amount)}` },
                    { key: "created", header: "Created", render: (row) => formatDate(row.created_at) },
                    {
                        key: "actions",
                        header: "Actions",
                        render: (row) => (
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                {row.status === "draft" ? <Button size="small" startIcon={<ChecklistRoundedIcon />} onClick={() => void submitApplication(row)}>Submit</Button> : null}
                                {isBranchManager && row.status === "rejected" ? (
                                    <Button size="small" onClick={() => openEditApplication(row)}>
                                        Edit & Resubmit
                                    </Button>
                                ) : null}
                                {["submitted", "under_review"].includes(row.status) ? <Button size="small" startIcon={<FactCheckRoundedIcon />} onClick={() => { setSelected(row); reviewForm.reset({ notes: row.notes || "", kyc_status: row.kyc_status, kyc_reason: row.kyc_reason || "" }); setDialogMode("review"); }}>Review</Button> : null}
                                {isSuperAdmin && ["submitted", "under_review"].includes(row.status) ? <Button size="small" color="success" startIcon={<ApprovalRoundedIcon />} onClick={() => void approveApplication(row)}>Approve</Button> : null}
                                {isSuperAdmin && ["draft", "submitted", "under_review"].includes(row.status) ? <Button size="small" color="error" startIcon={<DoDisturbRoundedIcon />} onClick={() => { setSelected(row); rejectForm.reset({ reason: row.rejection_reason || "" }); setDialogMode("reject"); }}>Reject</Button> : null}
                                {isBranchManager && row.status === "approved" ? (
                                    <Button size="small" onClick={() => navigate("/members")}>
                                        Open Members
                                    </Button>
                                ) : null}
                            </Stack>
                        )
                    }
                ]}
                emptyMessage={loading ? "Loading member applications..." : "No member applications recorded yet."}
            />

            <MotionModal open={dialogMode === "create"} onClose={() => { setDialogMode(null); setSelected(null); }} maxWidth="md" fullWidth>
                <DialogTitle>{selected ? "Edit rejected application" : "New member application"}</DialogTitle>
                <DialogContent dividers>
                    <Grid container spacing={2} sx={{ mt: 0.25 }}>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <TextField select fullWidth label="Branch" defaultValue={selectedBranchId || ""} {...createForm.register("branch_id")}>
                                {branches.map((branch) => <MenuItem key={branch.id} value={branch.id}>{branch.name}</MenuItem>)}
                            </TextField>
                        </Grid>
                        <Grid size={{ xs: 12, md: 8 }}><TextField fullWidth label="Full name" {...createForm.register("full_name")} /></Grid>
                        <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Phone" {...createForm.register("phone")} /></Grid>
                        <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Email" {...createForm.register("email")} /></Grid>
                        <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Member no" {...createForm.register("member_no")} /></Grid>
                        <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="National ID" {...createForm.register("national_id")} /></Grid>
                        <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="NIDA number" {...createForm.register("nida_no")} /></Grid>
                        <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Address line 1" {...createForm.register("address_line1")} /></Grid>
                        <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Employer" {...createForm.register("employer")} /></Grid>
                        <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth type="number" label="Membership fee" {...createForm.register("membership_fee_amount", { valueAsNumber: true })} /></Grid>
                        <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth type="number" label="Fee paid" {...createForm.register("membership_fee_paid", { valueAsNumber: true })} /></Grid>
                        <Grid size={{ xs: 12, md: 4 }}><TextField select fullWidth label="KYC status" defaultValue="pending" {...createForm.register("kyc_status")}><MenuItem value="pending">Pending</MenuItem><MenuItem value="verified">Verified</MenuItem><MenuItem value="rejected">Rejected</MenuItem><MenuItem value="waived">Waived</MenuItem></TextField></Grid>
                        <Grid size={{ xs: 12 }}><TextField fullWidth multiline minRows={3} label="Notes" {...createForm.register("notes")} /></Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => { setDialogMode(null); setSelected(null); }}>Cancel</Button>
                    <Button variant="contained" onClick={() => void createApplication()} disabled={submitting}>
                        {selected ? "Save changes" : "Create application"}
                    </Button>
                </DialogActions>
            </MotionModal>

            <MotionModal open={dialogMode === "review"} onClose={() => setDialogMode(null)} maxWidth="sm" fullWidth>
                <DialogTitle>Review application</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2} sx={{ mt: 0.25 }}>
                        <TextField select fullWidth label="KYC status" defaultValue={reviewForm.getValues("kyc_status") || "verified"} {...reviewForm.register("kyc_status")}>
                            <MenuItem value="pending">Pending</MenuItem>
                            <MenuItem value="verified">Verified</MenuItem>
                            <MenuItem value="rejected">Rejected</MenuItem>
                            <MenuItem value="waived">Waived</MenuItem>
                        </TextField>
                        <TextField fullWidth label="KYC reason" {...reviewForm.register("kyc_reason")} />
                        <TextField fullWidth multiline minRows={3} label="Review notes" {...reviewForm.register("notes")} />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogMode(null)}>Cancel</Button>
                    <Button variant="contained" onClick={() => void reviewApplication()} disabled={submitting}>Save review</Button>
                </DialogActions>
            </MotionModal>

            <MotionModal open={dialogMode === "reject"} onClose={() => setDialogMode(null)} maxWidth="sm" fullWidth>
                <DialogTitle>Reject application</DialogTitle>
                <DialogContent dividers>
                    <TextField fullWidth multiline minRows={3} label="Reason" {...rejectForm.register("reason")} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogMode(null)}>Cancel</Button>
                    <Button variant="contained" color="error" onClick={() => void rejectApplication()} disabled={submitting}>Reject application</Button>
                </DialogActions>
            </MotionModal>
        </Stack>
    );
}
