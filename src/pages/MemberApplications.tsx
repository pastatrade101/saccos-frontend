import { MotionCard, MotionModal } from "../ui/motion";
import ApprovalRoundedIcon from "@mui/icons-material/ApprovalRounded";
import ChecklistRoundedIcon from "@mui/icons-material/ChecklistRounded";
import DoDisturbRoundedIcon from "@mui/icons-material/DoDisturbRounded";
import FactCheckRoundedIcon from "@mui/icons-material/FactCheckRounded";
import PersonAddAlt1RoundedIcon from "@mui/icons-material/PersonAddAlt1Rounded";
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
    Divider,
    Grid,
    MenuItem,
    Paper,
    Stack,
    TextField,
    Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { DataTable } from "../components/DataTable";
import { SearchableSelect } from "../components/SearchableSelect";
import { useToast } from "../components/Toast";
import { findLocationByName, useTanzaniaLocations } from "../hooks/useTanzaniaLocations";
import { api, getApiErrorMessage } from "../lib/api";
import {
    endpoints,
    type BranchesListResponse,
    type CreateMemberApplicationRequest,
    type MemberApplicationResponse,
    type MemberApplicationsResponse,
    type RejectMemberApplicationRequest,
    type RequestMoreInfoMemberApplicationRequest,
    type ReviewMemberApplicationRequest
} from "../lib/endpoints";
import type { Branch, MemberApplication, MemberApplicationStatus } from "../types/api";
import { memberApplicationStatusLabels } from "../utils/member-application-status";
import { formatCurrency, formatDate } from "../utils/format";
import { formatNextOfKinRelationship } from "../utils/nextOfKin";

type DialogMode = "create" | "review" | "reject" | null;

function statusColor(status: MemberApplication["status"]) {
    if (status === "approved") return "success";
    if (status === "active") return "success";
    if (status === "rejected") return "error";
    if (status === "under_review") return "warning";
    if (status === "submitted") return "info";
    if (status === "approved_pending_payment") return "warning";
    return "default";
}

function displayApplicationValue(value?: string | number | null) {
    if (value === null || value === undefined) {
        return "Not provided";
    }

    const text = String(value).trim();
    return text ? text : "Not provided";
}

function displayBooleanLabel(value?: boolean | null, trueLabel = "Confirmed", falseLabel = "Not provided") {
    return value ? trueLabel : falseLabel;
}

function toNullableText(value?: string | null) {
    const normalized = String(value || "").trim();
    return normalized ? normalized : null;
}

function ApplicationDetailItem({ label, value }: { label: string; value: ReactNode }) {
    return (
        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, alignItems: "flex-start" }}>
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 132 }}>
                {label}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, textAlign: "right", wordBreak: "break-word" }}>
                {value}
            </Typography>
        </Box>
    );
}

export function MemberApplicationsPage() {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === "dark";
    const memberAccent = isDarkMode ? "#D9B273" : "#1FA8E6";
    const memberAccentStrong = isDarkMode ? "#C89B52" : "#0A0573";
    const navigate = useNavigate();
    const { pushToast } = useToast();
    const { profile, selectedTenantId, selectedBranchId } = useAuth();
    const [applications, setApplications] = useState<MemberApplication[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [selected, setSelected] = useState<MemberApplication | null>(null);
    const [dialogMode, setDialogMode] = useState<DialogMode>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);

    const createForm = useForm<CreateMemberApplicationRequest>({
        defaultValues: {
            branch_id: selectedBranchId || "",
            full_name: "",
            phone: "",
            email: "",
            member_no: "",
            national_id: "",
            nida_no: "",
            region_id: "",
            district_id: "",
            ward_id: "",
            village_id: "",
            region: "",
            district: "",
            ward: "",
            street_or_village: "",
            residential_address: "",
            address_line1: "",
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
    const requestMoreInfoForm = useForm<RequestMoreInfoMemberApplicationRequest>({
        defaultValues: {
            reason: ""
        }
    });

    const resetCreateForm = () => {
        createForm.reset({
            branch_id: selectedBranchId || "",
            full_name: "",
            phone: "",
            email: "",
            member_no: "",
            national_id: "",
            nida_no: "",
            region_id: "",
            district_id: "",
            ward_id: "",
            village_id: "",
            region: "",
            district: "",
            ward: "",
            street_or_village: "",
            residential_address: "",
            address_line1: "",
            employer: "",
            notes: "",
            membership_fee_amount: 10000,
            membership_fee_paid: 0,
            kyc_status: "pending"
        });
    };

    const loadApplications = async () => {
        if (!selectedTenantId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const [{ data: appsResponse }, { data: branchResponse }] = await Promise.all([
                api.get<MemberApplicationsResponse>(endpoints.memberApplications.list(), {
                    params: { tenant_id: selectedTenantId, page: 1, limit: 100 }
                }),
                api.get<BranchesListResponse>(endpoints.branches.list(), {
                    params: { tenant_id: selectedTenantId, page: 1, limit: 100 }
                })
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
        approved: applications.filter((item) => ["approved", "active"].includes(item.status)).length,
        rejected: applications.filter((item) => item.status === "rejected").length
    }), [applications]);
    const isSuperAdmin = profile?.role === "super_admin";
    const isBranchManager = profile?.role === "branch_manager";
    const createRegionId = createForm.watch("region_id") || "";
    const createDistrictId = createForm.watch("district_id") || "";
    const createWardId = createForm.watch("ward_id") || "";
    const createRegionName = createForm.watch("region") || "";
    const createDistrictName = createForm.watch("district") || "";
    const createWardName = createForm.watch("ward") || "";
    const createVillageName = createForm.watch("street_or_village") || "";
    const {
        regions,
        districts,
        wards,
        villages,
        loadingRegions,
        loadingDistricts,
        loadingWards,
        loadingVillages
    } = useTanzaniaLocations({
        regionId: createRegionId,
        districtId: createDistrictId,
        wardId: createWardId
    });
    const regionOptions = useMemo(
        () => regions.map((item) => ({ value: item.id, label: item.name })),
        [regions]
    );
    const districtOptions = useMemo(
        () => districts.map((item) => ({ value: item.id, label: item.name })),
        [districts]
    );
    const wardOptions = useMemo(
        () => wards.map((item) => ({ value: item.id, label: item.name })),
        [wards]
    );
    const villageOptions = useMemo(
        () => villages.map((item) => ({ value: item.id, label: item.name })),
        [villages]
    );
    const selectedBranchName = selected ? (branches.find((branch) => branch.id === selected.branch_id)?.name || selected.branch_name || selected.branch_id) : "N/A";
    const selectedAddress = selected
        ? [
            selected.residential_address || selected.address_line1,
            selected.street_or_village || selected.address_line2,
            selected.ward,
            selected.district || selected.city,
            selected.region || selected.state,
            selected.country,
            selected.postal_code
        ].filter((value) => Boolean(String(value || "").trim())).join(", ")
        : "";
    const selectedMembershipBalance = selected
        ? Math.max(0, Number(selected.membership_fee_amount || 0) - Number(selected.membership_fee_paid || 0))
        : 0;
    const selectedAttachments = selected?.attachments || [];
    const selectedDocumentTypes = new Set(selectedAttachments.map((attachment) => attachment.document_type).filter(Boolean));
    const selectedMissingReviewItems = selected ? [
        !selected.phone ? "phone number" : null,
        !selected.nida_no && !selected.national_id ? "identity number" : null,
        !selected.dob ? "date of birth" : null,
        !selected.next_of_kin_name ? "next of kin details" : null,
        !selected.terms_accepted ? "membership terms consent" : null,
        !selected.data_processing_consent ? "data processing consent" : null,
        !selectedDocumentTypes.has("national_id") ? "national ID upload" : null,
        !selectedDocumentTypes.has("passport_photo") ? "passport photo upload" : null
    ].filter(Boolean) as string[] : [];

    useEffect(() => {
        if (dialogMode !== "create" || createRegionId || !regions.length) {
            return;
        }

        const match = findLocationByName(regions, createRegionName);
        if (match) {
            createForm.setValue("region_id", match.id, { shouldValidate: false });
        }
    }, [createForm, createRegionId, createRegionName, dialogMode, regions]);

    useEffect(() => {
        if (dialogMode !== "create" || createDistrictId || !districts.length) {
            return;
        }

        const match = findLocationByName(districts, createDistrictName);
        if (match) {
            createForm.setValue("district_id", match.id, { shouldValidate: false });
        }
    }, [createDistrictId, createDistrictName, createForm, dialogMode, districts]);

    useEffect(() => {
        if (dialogMode !== "create" || createWardId || !wards.length) {
            return;
        }

        const match = findLocationByName(wards, createWardName);
        if (match) {
            createForm.setValue("ward_id", match.id, { shouldValidate: false });
        }
    }, [createForm, createWardId, createWardName, dialogMode, wards]);

    useEffect(() => {
        if (dialogMode !== "create" || createForm.getValues("village_id") || !villages.length) {
            return;
        }

        const match = findLocationByName(villages, createVillageName);
        if (match) {
            createForm.setValue("village_id", match.id, { shouldValidate: false });
        }
    }, [createForm, createVillageName, dialogMode, villages]);

    const openReviewApplication = async (application: MemberApplication) => {
        setDetailLoading(true);
        try {
            const { data } = await api.get<MemberApplicationResponse>(endpoints.memberApplications.detail(application.id));
            const detailed = data.data || application;
            setSelected(detailed);
            reviewForm.reset({
                notes: detailed.notes || "",
                kyc_status: detailed.kyc_status,
                kyc_reason: detailed.kyc_reason || ""
            });
            requestMoreInfoForm.reset({
                reason: detailed.request_more_info_reason || ""
            });
            setDialogMode("review");
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to load application detail",
                message: getApiErrorMessage(error)
            });
        } finally {
            setDetailLoading(false);
        }
    };

    const createApplication = createForm.handleSubmit(async (values) => {
        const locationIds = [values.region_id, values.district_id, values.ward_id, values.village_id].filter(Boolean);
        if (locationIds.length > 0 && locationIds.length < 4) {
            pushToast({
                type: "error",
                title: "Complete the location selection",
                message: "Select region, district, ward, and village or mtaa before saving the application."
            });
            return;
        }

        const payload: CreateMemberApplicationRequest = {
            ...values,
            region_id: toNullableText(values.region_id),
            district_id: toNullableText(values.district_id),
            ward_id: toNullableText(values.ward_id),
            village_id: toNullableText(values.village_id),
            region: toNullableText(values.region),
            district: toNullableText(values.district),
            ward: toNullableText(values.ward),
            street_or_village: toNullableText(values.street_or_village),
            residential_address: toNullableText(values.residential_address),
            address_line1: toNullableText(values.address_line1),
            phone: toNullableText(values.phone),
            email: toNullableText(values.email),
            member_no: toNullableText(values.member_no),
            national_id: toNullableText(values.national_id),
            nida_no: toNullableText(values.nida_no),
            employer: toNullableText(values.employer),
            notes: toNullableText(values.notes)
        };

        setSubmitting(true);
        try {
            if (selected) {
                await api.patch(endpoints.memberApplications.detail(selected.id), payload);
                pushToast({
                    type: "success",
                    title: "Application updated",
                    message: "The rejected application has been reopened and is ready for resubmission."
                });
            } else {
                await api.post(endpoints.memberApplications.list(), payload);
                pushToast({ type: "success", title: "Application created", message: "The membership application is ready for submission." });
            }
            setDialogMode(null);
            setSelected(null);
            resetCreateForm();
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
            region_id: application.region_id || "",
            district_id: application.district_id || "",
            ward_id: application.ward_id || "",
            village_id: application.village_id || "",
            region: application.region || "",
            district: application.district || application.city || "",
            ward: application.ward || "",
            street_or_village: application.street_or_village || application.address_line2 || "",
            residential_address: application.residential_address || "",
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

    const requestMoreInfo = requestMoreInfoForm.handleSubmit(async (values) => {
        if (!selected) return;
        setSubmitting(true);
        try {
            await api.post(endpoints.memberApplications.requestMoreInfo(selected.id), values);
            pushToast({
                type: "success",
                title: "More information requested",
                message: "The clarification request has been recorded. The application remains in review while the missing details are followed up."
            });
            setDialogMode(null);
            await loadApplications();
        } catch (error) {
            pushToast({
                type: "error",
                title: "Unable to request more information",
                message: getApiErrorMessage(error)
            });
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
                sx={{
                    color: "#fff",
                    background: isDarkMode
                        ? `linear-gradient(135deg, ${alpha(memberAccentStrong, 0.9)} 0%, ${alpha(memberAccent, 0.76)} 100%)`
                        : "linear-gradient(135deg, #0A0573 0%, #1FA8E6 100%)"
                }}
            >
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
                                    onClick={() => {
                                        setSelected(null);
                                        resetCreateForm();
                                        setDialogMode("create");
                                    }}
                                    sx={{
                                        bgcolor: "#FFFFFF",
                                        color: memberAccentStrong,
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
                    {
                        key: "application",
                        header: "Application",
                        render: (row) => (
                            <Stack spacing={0.3}>
                                <Typography fontWeight={700}>{row.application_no}</Typography>
                                <Typography variant="body2" color="text.primary">{row.full_name}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {displayApplicationValue(row.phone)} · DOB {row.dob ? formatDate(row.dob) : "Not provided"}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    NIDA {displayApplicationValue(row.nida_no)}
                                </Typography>
                                {row.request_more_info_reason && ["submitted", "under_review"].includes(row.status) ? (
                                    <Chip
                                        size="small"
                                        color="warning"
                                        variant="outlined"
                                        label="More info requested"
                                        sx={{ alignSelf: "flex-start", mt: 0.4 }}
                                    />
                                ) : null}
                            </Stack>
                        )
                    },
                    { key: "branch", header: "Branch", render: (row) => branches.find((branch) => branch.id === row.branch_id)?.name || row.branch_id },
                    { key: "status", header: "Status", render: (row) => <Chip size="small" color={statusColor(row.status)} label={memberApplicationStatusLabels[row.status] || row.status.replace(/_/g, " ")} /> },
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
                                {["submitted", "under_review"].includes(row.status) ? (
                                    <Button size="small" startIcon={<FactCheckRoundedIcon />} onClick={() => void openReviewApplication(row)} disabled={detailLoading}>
                                        {detailLoading && selected?.id === row.id ? "Loading..." : "Review details"}
                                    </Button>
                                ) : null}
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

            <MotionModal open={dialogMode === "create"} onClose={() => { setDialogMode(null); setSelected(null); resetCreateForm(); }} maxWidth="md" fullWidth>
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
                        <Grid size={{ xs: 12 }}>
                            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 0.5 }}>
                                Residential location
                            </Typography>
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <SearchableSelect
                                value={createRegionId}
                                options={regionOptions}
                                label="Region"
                                placeholder={loadingRegions ? "Loading regions..." : "Search region..."}
                                helperText="Select the applicant's region."
                                onChange={(value) => {
                                    const selectedRegion = regions.find((item) => item.id === value);
                                    createForm.setValue("region_id", value, { shouldValidate: true });
                                    createForm.setValue("district_id", "", { shouldValidate: false });
                                    createForm.setValue("ward_id", "", { shouldValidate: false });
                                    createForm.setValue("village_id", "", { shouldValidate: false });
                                    createForm.setValue("region", selectedRegion?.name || "", { shouldValidate: false });
                                    createForm.setValue("district", "", { shouldValidate: false });
                                    createForm.setValue("ward", "", { shouldValidate: false });
                                    createForm.setValue("street_or_village", "", { shouldValidate: false });
                                }}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <SearchableSelect
                                value={createDistrictId}
                                options={districtOptions}
                                label="District"
                                placeholder={createRegionId ? (loadingDistricts ? "Loading districts..." : "Search district...") : "Select a region first"}
                                helperText="Districts are filtered by the selected region."
                                onChange={(value) => {
                                    const selectedDistrict = districts.find((item) => item.id === value);
                                    createForm.setValue("district_id", value, { shouldValidate: true });
                                    createForm.setValue("ward_id", "", { shouldValidate: false });
                                    createForm.setValue("village_id", "", { shouldValidate: false });
                                    createForm.setValue("district", selectedDistrict?.name || "", { shouldValidate: false });
                                    createForm.setValue("ward", "", { shouldValidate: false });
                                    createForm.setValue("street_or_village", "", { shouldValidate: false });
                                }}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <SearchableSelect
                                value={createWardId}
                                options={wardOptions}
                                label="Ward"
                                placeholder={createDistrictId ? (loadingWards ? "Loading wards..." : "Search ward...") : "Select a district first"}
                                helperText="Wards are filtered by the selected district."
                                onChange={(value) => {
                                    const selectedWard = wards.find((item) => item.id === value);
                                    createForm.setValue("ward_id", value, { shouldValidate: true });
                                    createForm.setValue("village_id", "", { shouldValidate: false });
                                    createForm.setValue("ward", selectedWard?.name || "", { shouldValidate: false });
                                    createForm.setValue("street_or_village", "", { shouldValidate: false });
                                }}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <SearchableSelect
                                value={createForm.watch("village_id") || ""}
                                options={villageOptions}
                                label="Village / Mtaa"
                                placeholder={createWardId ? (loadingVillages ? "Loading villages..." : "Search village or mtaa...") : "Select a ward first"}
                                helperText="Choose the official village or mtaa. Code omitted."
                                onChange={(value) => {
                                    const selectedVillage = villages.find((item) => item.id === value);
                                    createForm.setValue("village_id", value, { shouldValidate: true });
                                    createForm.setValue("street_or_village", selectedVillage?.name || "", { shouldValidate: false });
                                    if (!createForm.getValues("residential_address")) {
                                        createForm.setValue("residential_address", selectedVillage?.name || "", { shouldValidate: false });
                                    }
                                }}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextField fullWidth label="Residential address" {...createForm.register("residential_address")} helperText="House, plot, landmark, or building description." />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextField fullWidth label="Address note / plot" {...createForm.register("address_line1")} helperText="Optional internal address note." />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Employer" {...createForm.register("employer")} /></Grid>
                        <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth type="number" label="Membership fee" {...createForm.register("membership_fee_amount", { valueAsNumber: true })} /></Grid>
                        <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth type="number" label="Fee paid" {...createForm.register("membership_fee_paid", { valueAsNumber: true })} /></Grid>
                        <Grid size={{ xs: 12, md: 4 }}><TextField select fullWidth label="KYC status" defaultValue="pending" {...createForm.register("kyc_status")}><MenuItem value="pending">Pending</MenuItem><MenuItem value="verified">Verified</MenuItem><MenuItem value="rejected">Rejected</MenuItem><MenuItem value="waived">Waived</MenuItem></TextField></Grid>
                        <Grid size={{ xs: 12 }}><TextField fullWidth multiline minRows={3} label="Notes" {...createForm.register("notes")} /></Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => { setDialogMode(null); setSelected(null); resetCreateForm(); }}>Cancel</Button>
                    <Button variant="contained" onClick={() => void createApplication()} disabled={submitting}>
                        {selected ? "Save changes" : "Create application"}
                    </Button>
                </DialogActions>
            </MotionModal>

            <MotionModal open={dialogMode === "review"} onClose={() => setDialogMode(null)} maxWidth="lg" fullWidth>
                <DialogTitle>
                    {selected ? `Review ${selected.application_no}` : "Review application"}
                </DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2.25} sx={{ mt: 0.25 }}>
                        <Alert severity="info" variant="outlined">
                            Review the applicant identity and KYC information before recording the branch decision. Final approve or reject still happens through the tenant super admin workflow.
                        </Alert>
                        {selectedMissingReviewItems.length ? (
                            <Alert severity="warning" variant="outlined">
                                <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.35 }}>
                                    Review follow-up items
                                </Typography>
                                <Typography variant="body2">
                                    This application is still missing: {selectedMissingReviewItems.join(", ")}.
                                </Typography>
                            </Alert>
                        ) : (
                            <Alert severity="success" variant="outlined">
                                This application includes the full onboarding package required for identity review, governance checks, and membership activation.
                            </Alert>
                        )}

                        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                            <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
                                <Stack spacing={0.5}>
                                    <Typography variant="overline" color="text.secondary">
                                        Applicant
                                    </Typography>
                                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                        {selected?.full_name || "Applicant"}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {selectedBranchName} · Created {selected?.created_at ? formatDate(selected.created_at) : "N/A"}
                                    </Typography>
                                </Stack>
                                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                    <Chip
                                        size="small"
                                        color={statusColor(selected?.status || "draft")}
                                        label={memberApplicationStatusLabels[selected?.status || "draft"] || String(selected?.status || "draft").replace(/_/g, " ")}
                                    />
                                    <Chip
                                        size="small"
                                        variant="outlined"
                                        label={`KYC ${String(selected?.kyc_status || "pending").replace(/_/g, " ")}`}
                                    />
                                </Stack>
                            </Stack>
                        </Paper>

                        <Grid container spacing={2}>
                            <Grid size={{ xs: 12, md: 7 }}>
                                <Stack spacing={2}>
                                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                                        <Stack spacing={1.2}>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                                Applicant profile
                                            </Typography>
                                            <ApplicationDetailItem label="Application no" value={displayApplicationValue(selected?.application_no)} />
                                            <ApplicationDetailItem label="Phone number" value={displayApplicationValue(selected?.phone)} />
                                            <ApplicationDetailItem label="Email" value={displayApplicationValue(selected?.email)} />
                                            <ApplicationDetailItem label="Date of birth" value={selected?.dob ? formatDate(selected.dob) : "Not provided"} />
                                            <ApplicationDetailItem label="Gender" value={displayApplicationValue(selected?.gender)} />
                                            <ApplicationDetailItem label="Marital status" value={displayApplicationValue(selected?.marital_status)} />
                                            <ApplicationDetailItem label="Occupation" value={displayApplicationValue(selected?.occupation)} />
                                            <ApplicationDetailItem label="Member number" value={displayApplicationValue(selected?.member_no)} />
                                            <ApplicationDetailItem label="Employer" value={displayApplicationValue(selected?.employer)} />
                                            <ApplicationDetailItem label="Created" value={selected?.created_at ? formatDate(selected.created_at) : "Not provided"} />
                                            <ApplicationDetailItem label="Last updated" value={selected?.updated_at ? formatDate(selected.updated_at) : "Not provided"} />
                                        </Stack>
                                    </Paper>

                                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                                        <Stack spacing={1.2}>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                                Identity and address
                                            </Typography>
                                            <ApplicationDetailItem label="National ID" value={displayApplicationValue(selected?.national_id)} />
                                            <ApplicationDetailItem label="NIDA number" value={displayApplicationValue(selected?.nida_no)} />
                                            <ApplicationDetailItem label="TIN number" value={displayApplicationValue(selected?.tin_no)} />
                                            <ApplicationDetailItem label="Region" value={displayApplicationValue(selected?.region)} />
                                            <ApplicationDetailItem label="District" value={displayApplicationValue(selected?.district)} />
                                            <ApplicationDetailItem label="Ward" value={displayApplicationValue(selected?.ward)} />
                                            <ApplicationDetailItem label="Street / village" value={displayApplicationValue(selected?.street_or_village)} />
                                            <ApplicationDetailItem label="Residential address" value={displayApplicationValue(selected?.residential_address)} />
                                            <ApplicationDetailItem label="Legacy address" value={displayApplicationValue(selectedAddress)} />
                                            <ApplicationDetailItem label="Country" value={displayApplicationValue(selected?.country)} />
                                            <ApplicationDetailItem label="Postal code" value={displayApplicationValue(selected?.postal_code)} />
                                        </Stack>
                                    </Paper>

                                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                                        <Stack spacing={1.2}>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                                Next of kin and fee snapshot
                                            </Typography>
                                            <ApplicationDetailItem label="Next of kin" value={displayApplicationValue(selected?.next_of_kin_name)} />
                                            <ApplicationDetailItem label="Kin phone" value={displayApplicationValue(selected?.next_of_kin_phone)} />
                                            <ApplicationDetailItem
                                                label="Relationship"
                                                value={selected?.next_of_kin_relationship ? formatNextOfKinRelationship(selected.next_of_kin_relationship) : "Not provided"}
                                            />
                                            <ApplicationDetailItem label="Kin address" value={displayApplicationValue(selected?.next_of_kin_address)} />
                                            <Divider flexItem sx={{ my: 0.5 }} />
                                            <ApplicationDetailItem label="Membership type" value={displayApplicationValue(selected?.membership_type)} />
                                            <ApplicationDetailItem label="Initial shares" value={formatCurrency(selected?.initial_share_amount || 0)} />
                                            <ApplicationDetailItem label="Monthly savings" value={formatCurrency(selected?.monthly_savings_commitment || 0)} />
                                            <ApplicationDetailItem label="Membership fee" value={formatCurrency(selected?.membership_fee_amount || 0)} />
                                            <ApplicationDetailItem label="Fee paid" value={formatCurrency(selected?.membership_fee_paid || 0)} />
                                            <ApplicationDetailItem label="Balance outstanding" value={formatCurrency(selectedMembershipBalance)} />
                                        </Stack>
                                    </Paper>

                                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                                        <Stack spacing={1.2}>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                                Compliance and activation readiness
                                            </Typography>
                                            <ApplicationDetailItem
                                                label="Terms accepted"
                                                value={
                                                    <Chip
                                                        size="small"
                                                        color={selected?.terms_accepted ? "success" : "warning"}
                                                        variant={selected?.terms_accepted ? "filled" : "outlined"}
                                                        label={displayBooleanLabel(selected?.terms_accepted, "Accepted", "Missing")}
                                                    />
                                                }
                                            />
                                            <ApplicationDetailItem
                                                label="Data consent"
                                                value={
                                                    <Chip
                                                        size="small"
                                                        color={selected?.data_processing_consent ? "success" : "warning"}
                                                        variant={selected?.data_processing_consent ? "filled" : "outlined"}
                                                        label={displayBooleanLabel(selected?.data_processing_consent, "Accepted", "Missing")}
                                                    />
                                                }
                                            />
                                            <ApplicationDetailItem
                                                label="National ID upload"
                                                value={
                                                    <Chip
                                                        size="small"
                                                        color={selectedDocumentTypes.has("national_id") ? "success" : "warning"}
                                                        variant={selectedDocumentTypes.has("national_id") ? "filled" : "outlined"}
                                                        label={selectedDocumentTypes.has("national_id") ? "Received" : "Missing"}
                                                    />
                                                }
                                            />
                                            <ApplicationDetailItem
                                                label="Passport photo"
                                                value={
                                                    <Chip
                                                        size="small"
                                                        color={selectedDocumentTypes.has("passport_photo") ? "success" : "warning"}
                                                        variant={selectedDocumentTypes.has("passport_photo") ? "filled" : "outlined"}
                                                        label={selectedDocumentTypes.has("passport_photo") ? "Received" : "Missing"}
                                                    />
                                                }
                                            />
                                            <ApplicationDetailItem label="Current KYC reason" value={displayApplicationValue(selected?.kyc_reason)} />
                                            <ApplicationDetailItem label="Requested more info" value={displayApplicationValue(selected?.request_more_info_reason)} />
                                        </Stack>
                                    </Paper>

                                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                                        <Stack spacing={1.2}>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                                Identity documents
                                            </Typography>
                                            {selectedAttachments.length ? selectedAttachments.map((attachment) => (
                                                <Stack
                                                    key={attachment.id}
                                                    direction={{ xs: "column", sm: "row" }}
                                                    spacing={1}
                                                    justifyContent="space-between"
                                                    alignItems={{ sm: "center" }}
                                                >
                                                    <Box>
                                                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                                            {attachment.document_type === "national_id" ? "National ID" : attachment.document_type === "passport_photo" ? "Passport photo" : attachment.file_name}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {attachment.file_name} · {attachment.mime_type || "Unknown type"}
                                                        </Typography>
                                                    </Box>
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        component="a"
                                                        href={attachment.download_url || "#"}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        disabled={!attachment.download_url}
                                                    >
                                                        Open document
                                                    </Button>
                                                </Stack>
                                            )) : (
                                                <Typography variant="body2" color="text.secondary">
                                                    No identity documents have been uploaded yet.
                                                </Typography>
                                            )}
                                        </Stack>
                                    </Paper>

                                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                                        <Stack spacing={1}>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                                Applicant notes
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {displayApplicationValue(selected?.notes)}
                                            </Typography>
                                            {selected?.reviewed_at ? (
                                                <Typography variant="caption" color="text.secondary">
                                                    Last review recorded on {formatDate(selected.reviewed_at)}
                                                </Typography>
                                            ) : null}
                                        </Stack>
                                    </Paper>
                                </Stack>
                            </Grid>

                            <Grid size={{ xs: 12, md: 5 }}>
                                <Paper
                                    variant="outlined"
                                    sx={{
                                        p: 2,
                                        borderRadius: 2,
                                        position: { md: "sticky" },
                                        top: { md: 8 }
                                    }}
                                >
                                    <Stack spacing={2}>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                            {isBranchManager ? "Review decision" : "Review summary"}
                                        </Typography>
                                        {selected?.request_more_info_reason ? (
                                            <Alert severity="warning" variant="outlined">
                                                <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                                                    Outstanding clarification request
                                                </Typography>
                                                <Typography variant="body2" sx={{ mb: selected.requested_more_info_at ? 0.5 : 0 }}>
                                                    {selected.request_more_info_reason}
                                                </Typography>
                                                {selected.requested_more_info_at ? (
                                                    <Typography variant="caption" color="text.secondary">
                                                        Requested on {formatDate(selected.requested_more_info_at)}
                                                    </Typography>
                                                ) : null}
                                            </Alert>
                                        ) : null}
                                        <TextField
                                            select
                                            fullWidth
                                            disabled={!isBranchManager}
                                            label="KYC status"
                                            defaultValue={reviewForm.getValues("kyc_status") || "verified"}
                                            {...reviewForm.register("kyc_status")}
                                        >
                                            <MenuItem value="pending">Pending</MenuItem>
                                            <MenuItem value="verified">Verified</MenuItem>
                                            <MenuItem value="rejected">Rejected</MenuItem>
                                            <MenuItem value="waived">Waived</MenuItem>
                                        </TextField>
                                        <TextField fullWidth disabled={!isBranchManager} label="KYC reason" {...reviewForm.register("kyc_reason")} />
                                        <TextField
                                            fullWidth
                                            multiline
                                            minRows={8}
                                            disabled={!isBranchManager}
                                            label="Review notes"
                                            placeholder="Capture branch review observations, document checks, and any follow-up required before approval."
                                            {...reviewForm.register("notes")}
                                        />
                                        {isBranchManager ? (
                                            <>
                                                <Divider flexItem />
                                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                                    Request more information
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    Use this when the application is missing clarification or documents, but should remain open for follow-up.
                                                </Typography>
                                                <TextField
                                                    fullWidth
                                                    multiline
                                                    minRows={4}
                                                    label="Clarification request"
                                                    placeholder="Example: Please confirm your NIDA number and provide a clearer passport photo."
                                                    {...requestMoreInfoForm.register("reason")}
                                                />
                                            </>
                                        ) : null}
                                    </Stack>
                                </Paper>
                            </Grid>
                        </Grid>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogMode(null)}>{isBranchManager ? "Cancel" : "Close"}</Button>
                    {isBranchManager ? (
                        <Button
                            variant="outlined"
                            color="warning"
                            onClick={() => void requestMoreInfo()}
                            disabled={submitting}
                        >
                            Request more info
                        </Button>
                    ) : null}
                    {isBranchManager ? (
                        <Button variant="contained" onClick={() => void reviewApplication()} disabled={submitting}>
                            Save review
                        </Button>
                    ) : null}
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
