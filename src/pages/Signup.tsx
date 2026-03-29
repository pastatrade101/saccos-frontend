import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Chip,
    Divider,
    FormControlLabel,
    FormHelperText,
    Grid,
    IconButton,
    InputAdornment,
    MenuItem,
    Paper,
    Stack,
    Step,
    StepLabel,
    Stepper,
    TextField,
    Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import { api, getApiErrorMessage } from "../lib/api";
import { SearchableSelect } from "../components/SearchableSelect";
import {
    endpoints,
    type PublicSignupBranch,
    type PublicSignupBranchesResponse,
    type PublicSignupRequest,
    type PublicSignupResponse
} from "../lib/endpoints";
import { useToast } from "../components/Toast";
import { useTanzaniaLocations } from "../hooks/useTanzaniaLocations";
import { useUI } from "../ui/UIProvider";
import { formatCurrency } from "../utils/format";
import { NEXT_OF_KIN_RELATIONSHIP_OPTIONS, NEXT_OF_KIN_RELATIONSHIP_VALUES } from "../utils/nextOfKin";

const NIDA_DIGIT_LENGTH = 20;
const PHONE_DIGIT_LENGTH = 12;
const PASSWORD_SPECIAL_PATTERN = /[^A-Za-z0-9]/;
const SIGNUP_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MIN_INITIAL_SHARE_AMOUNT_TZS = 50000;
const MIN_MONTHLY_SAVINGS_COMMITMENT_TZS = 10000;
const STEP_TITLES = [
    "Personal Information",
    "Address",
    "Next of Kin",
    "Identification Upload",
    "Membership Details",
    "Security & Password",
    "Terms Agreement"
] as const;

function isBrowserFile(value: unknown): value is File {
    return typeof File !== "undefined" && value instanceof File;
}

function getPasswordChecks(password: string, confirmPassword = "") {
    return [
        {
            id: "length",
            label: "At least 8 characters",
            satisfied: password.length >= 8
        },
        {
            id: "uppercase",
            label: "At least 1 uppercase letter",
            satisfied: /[A-Z]/.test(password)
        },
        {
            id: "lowercase",
            label: "At least 1 lowercase letter",
            satisfied: /[a-z]/.test(password)
        },
        {
            id: "number",
            label: "At least 1 number",
            satisfied: /\d/.test(password)
        },
        {
            id: "special",
            label: "At least 1 special character",
            satisfied: PASSWORD_SPECIAL_PATTERN.test(password)
        },
        {
            id: "match",
            label: "Passwords match",
            satisfied: Boolean(confirmPassword) && password === confirmPassword
        }
    ] as const;
}

function normalizeNationalIdDigits(value: string) {
    return value.replace(/\D/g, "").slice(0, NIDA_DIGIT_LENGTH);
}

function formatNationalId(value: string) {
    const digits = normalizeNationalIdDigits(value);
    const segments = [8, 5, 5, 2];
    const parts: string[] = [];
    let cursor = 0;

    for (const size of segments) {
        if (cursor >= digits.length) {
            break;
        }
        parts.push(digits.slice(cursor, cursor + size));
        cursor += size;
    }

    return parts.join("-");
}

function normalizeSignupPhoneDigits(value: string) {
    const digits = value.replace(/\D/g, "");

    if (digits.startsWith("255")) {
        return digits.slice(0, PHONE_DIGIT_LENGTH);
    }

    if (digits.startsWith("0")) {
        return `255${digits.slice(1, 10)}`.slice(0, PHONE_DIGIT_LENGTH);
    }

    if ((digits.startsWith("6") || digits.startsWith("7")) && digits.length <= 9) {
        return `255${digits}`.slice(0, PHONE_DIGIT_LENGTH);
    }

    return digits.slice(0, PHONE_DIGIT_LENGTH);
}

function formatSignupPhone(value: string) {
    const digits = normalizeSignupPhoneDigits(value);
    const segments = [3, 3, 3, 3];
    const parts: string[] = [];
    let cursor = 0;

    for (const size of segments) {
        if (cursor >= digits.length) {
            break;
        }
        parts.push(digits.slice(cursor, cursor + size));
        cursor += size;
    }

    return parts.join(" ");
}

function calculateAge(dateOfBirth: string) {
    if (!dateOfBirth) {
        return 0;
    }

    const dob = new Date(dateOfBirth);
    if (Number.isNaN(dob.getTime())) {
        return 0;
    }

    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDifference = today.getMonth() - dob.getMonth();

    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < dob.getDate())) {
        age -= 1;
    }

    return age;
}

const schema = z.object({
    branch_id: z.string().uuid("Select a branch."),
    first_name: z.string().trim().min(1, "First name is required."),
    last_name: z.string().trim().min(1, "Last name is required."),
    gender: z.enum(["male", "female", "other"], { message: "Select gender." }),
    marital_status: z.enum(["single", "married", "divorced", "widowed"], { message: "Select marital status." }),
    occupation: z.string().trim().min(2, "Occupation is required."),
    employer_name: z.string().trim().max(160).optional(),
    phone: z.string().trim().refine(
        (value) => /^255[67]\d{8}$/.test(normalizeSignupPhoneDigits(value)),
        "Enter a valid Tanzania mobile number."
    ),
    email: z.string().trim().email("Enter a valid email address."),
    national_id: z.string().trim().refine(
        (value) => normalizeNationalIdDigits(value).length === NIDA_DIGIT_LENGTH,
        "Enter a valid NIDA number in 8-5-5-2 format."
    ),
    date_of_birth: z.string().refine((value) => {
        if (!value) {
            return false;
        }

        const parsed = new Date(value);
        return !Number.isNaN(parsed.getTime());
    }, "Enter a valid date."),
    region_id: z.string().uuid("Select a region."),
    district_id: z.string().uuid("Select a district."),
    ward_id: z.string().uuid("Select a ward."),
    village_id: z.string().uuid().optional().or(z.literal("")),
    region: z.string().trim().max(120).optional().or(z.literal("")),
    district: z.string().trim().max(120).optional().or(z.literal("")),
    ward: z.string().trim().max(120).optional().or(z.literal("")),
    street_or_village: z.string().trim().max(160).optional().or(z.literal("")),
    residential_address: z.string().trim().min(5, "Residential address is required."),
    next_of_kin_name: z.string().trim().min(3, "Next of kin name is required."),
    relationship: z.enum(NEXT_OF_KIN_RELATIONSHIP_VALUES, { message: "Select relationship." }),
    next_of_kin_phone: z.string().trim().refine(
        (value) => /^255[67]\d{8}$/.test(normalizeSignupPhoneDigits(value)),
        "Enter a valid Tanzania mobile number."
    ),
    next_of_kin_address: z.string().trim().min(5, "Next of kin address is required."),
    upload_national_id: z.custom<File | undefined>((value) => isBrowserFile(value), "National ID upload is required.")
        .refine((value) => !isBrowserFile(value) || ["image/jpeg", "image/png", "application/pdf"].includes(value.type), "Only JPG, PNG, or PDF is allowed.")
        .refine((value) => !isBrowserFile(value) || value.size <= SIGNUP_MAX_UPLOAD_BYTES, "File size must be 5MB or less."),
    upload_passport_photo: z.custom<File | undefined>((value) => isBrowserFile(value), "Passport photo upload is required.")
        .refine((value) => !isBrowserFile(value) || ["image/jpeg", "image/png", "application/pdf"].includes(value.type), "Only JPG, PNG, or PDF is allowed.")
        .refine((value) => !isBrowserFile(value) || value.size <= SIGNUP_MAX_UPLOAD_BYTES, "File size must be 5MB or less."),
    membership_type: z.enum(["individual", "group", "company"], { message: "Select membership type." }),
    initial_share_amount: z.coerce.number().min(MIN_INITIAL_SHARE_AMOUNT_TZS, `Minimum initial share amount is ${formatCurrency(MIN_INITIAL_SHARE_AMOUNT_TZS)}.`),
    monthly_savings_commitment: z.coerce.number().min(MIN_MONTHLY_SAVINGS_COMMITMENT_TZS, `Minimum monthly savings commitment is ${formatCurrency(MIN_MONTHLY_SAVINGS_COMMITMENT_TZS)}.`),
    password: z.string()
        .min(8, "Password must be at least 8 characters.")
        .regex(/[A-Z]/, "Password must include an uppercase letter.")
        .regex(/[a-z]/, "Password must include a lowercase letter.")
        .regex(/\d/, "Password must include a number.")
        .regex(PASSWORD_SPECIAL_PATTERN, "Password must include a special character."),
    confirm_password: z.string().min(8, "Confirm password is required."),
    terms_accepted: z.boolean().refine((value) => value, "You must accept the SACCO membership terms and bylaws."),
    data_processing_consent: z.boolean().refine((value) => value, "You must consent to personal data processing.")
}).superRefine((values, ctx) => {
    if (values.password !== values.confirm_password) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Passwords must match.",
            path: ["confirm_password"]
        });
    }

    if (calculateAge(values.date_of_birth) < 18) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Applicant must be at least 18 years old.",
            path: ["date_of_birth"]
        });
    }
});

type SignupValues = z.infer<typeof schema>;

const featurePoints = [
    "Capture compliance-required identity, address, and next-of-kin information before branch review.",
    "Upload the national ID and passport photo as part of the same onboarding flow.",
    "Move directly into branch review, approval, and membership-fee activation without duplicate data entry."
] as const;

function StepShell({
    title,
    description,
    children
}: {
    title: string;
    description: string;
    children: ReactNode;
}) {
    return (
        <Stack spacing={1.4}>
            <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: "-0.03em" }}>
                    {title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {description}
                </Typography>
            </Box>
            {children}
        </Stack>
    );
}

function DocumentUploadCard({
    label,
    hint,
    file,
    error,
    onSelect
}: {
    label: string;
    hint: string;
    file?: File;
    error?: string;
    onSelect: (file?: File) => void;
}) {
    return (
        <Paper
            variant="outlined"
            sx={{
                p: 1.5,
                borderRadius: 2,
                borderColor: error ? "error.main" : undefined
            }}
        >
            <Stack spacing={1}>
                <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {hint}
                    </Typography>
                </Box>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                    <Button component="label" variant="outlined">
                        Choose file
                        <input
                            hidden
                            type="file"
                            accept=".jpg,.jpeg,.png,.pdf"
                            onChange={(event) => onSelect(event.target.files?.[0])}
                        />
                    </Button>
                    <Typography variant="body2" color={file ? "text.primary" : "text.secondary"}>
                        {file ? `${file.name} · ${(file.size / (1024 * 1024)).toFixed(2)} MB` : "No file selected yet"}
                    </Typography>
                </Stack>
                {error ? <FormHelperText error>{error}</FormHelperText> : null}
            </Stack>
        </Paper>
    );
}

export function SignupPage() {
    const navigate = useNavigate();
    const muiTheme = useTheme();
    const { pushToast } = useToast();
    const { theme, toggleTheme } = useUI();
    const [branches, setBranches] = useState<PublicSignupBranch[]>([]);
    const [branchesLoading, setBranchesLoading] = useState(true);
    const [branchesError, setBranchesError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [activeStep, setActiveStep] = useState(0);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const form = useForm<SignupValues>({
        resolver: zodResolver(schema),
        mode: "onTouched",
        defaultValues: {
            branch_id: "",
            first_name: "",
            last_name: "",
            gender: "male",
            marital_status: "single",
            occupation: "",
            employer_name: "",
            phone: "",
            email: "",
            national_id: "",
            date_of_birth: "",
            region_id: "",
            district_id: "",
            ward_id: "",
            village_id: "",
            region: "",
            district: "",
            ward: "",
            street_or_village: "",
            residential_address: "",
            next_of_kin_name: "",
            relationship: "spouse",
            next_of_kin_phone: "",
            next_of_kin_address: "",
            upload_national_id: undefined,
            upload_passport_photo: undefined,
            membership_type: "individual",
            initial_share_amount: MIN_INITIAL_SHARE_AMOUNT_TZS,
            monthly_savings_commitment: MIN_MONTHLY_SAVINGS_COMMITMENT_TZS,
            password: "",
            confirm_password: "",
            terms_accepted: false,
            data_processing_consent: false
        }
    });

    useEffect(() => {
        let isMounted = true;

        const loadBranches = async () => {
            try {
                const response = await api.get<PublicSignupBranchesResponse>(endpoints.public.branches());
                if (!isMounted) {
                    return;
                }

                const items = response.data.data || [];
                setBranches(items);

                if (!form.getValues("branch_id") && items.length) {
                    const branch = items[0];
                    form.setValue("branch_id", branch.id, { shouldValidate: true });
                    form.setValue("initial_share_amount", Math.max(branch.minimum_initial_share_amount || MIN_INITIAL_SHARE_AMOUNT_TZS, MIN_INITIAL_SHARE_AMOUNT_TZS));
                    form.setValue("monthly_savings_commitment", Math.max(branch.minimum_monthly_savings_commitment || MIN_MONTHLY_SAVINGS_COMMITMENT_TZS, MIN_MONTHLY_SAVINGS_COMMITMENT_TZS));
                }
                setBranchesError(null);
            } catch (error) {
                if (!isMounted) {
                    return;
                }
                setBranchesError(getApiErrorMessage(error, "Unable to load branches."));
            } finally {
                if (isMounted) {
                    setBranchesLoading(false);
                }
            }
        };

        void loadBranches();

        return () => {
            isMounted = false;
        };
    }, [form]);

    const selectedBranchId = form.watch("branch_id");
    const selectedRegionId = form.watch("region_id");
    const selectedDistrictId = form.watch("district_id");
    const selectedWardId = form.watch("ward_id");
    const selectedBranch = useMemo(
        () => branches.find((branch) => branch.id === selectedBranchId) || null,
        [branches, selectedBranchId]
    );
    const {
        regions,
        districts,
        wards,
        villages,
        regionOptions,
        districtOptions,
        wardOptions,
        villageOptions,
        loadingRegions,
        loadingDistricts,
        loadingWards,
        loadingVillages
    } = useTanzaniaLocations({
        regionId: selectedRegionId,
        districtId: selectedDistrictId,
        wardId: selectedWardId
    });

    useEffect(() => {
        if (!selectedBranch) {
            return;
        }

        const minimumShare = Math.max(selectedBranch.minimum_initial_share_amount || MIN_INITIAL_SHARE_AMOUNT_TZS, MIN_INITIAL_SHARE_AMOUNT_TZS);
        const minimumSavings = Math.max(selectedBranch.minimum_monthly_savings_commitment || MIN_MONTHLY_SAVINGS_COMMITMENT_TZS, MIN_MONTHLY_SAVINGS_COMMITMENT_TZS);
        const currentShare = Number(form.getValues("initial_share_amount") || 0);
        const currentSavings = Number(form.getValues("monthly_savings_commitment") || 0);

        if (currentShare < minimumShare) {
            form.setValue("initial_share_amount", minimumShare, { shouldValidate: true });
        }

        if (currentSavings < minimumSavings) {
            form.setValue("monthly_savings_commitment", minimumSavings, { shouldValidate: true });
        }
    }, [form, selectedBranch]);

    const branchHelper = form.formState.errors.branch_id?.message
        || branchesError
        || (!branchesLoading && branches.length === 0 ? "No branches are accepting applications yet." : "Pick the branch you wish to join.");
    const passwordValue = form.watch("password");
    const confirmPasswordValue = form.watch("confirm_password");
    const passwordChecks = getPasswordChecks(passwordValue, confirmPasswordValue);

    const stepFields: Array<Array<keyof SignupValues>> = [
        ["first_name", "last_name", "gender", "marital_status", "occupation", "phone", "email", "national_id", "date_of_birth"],
        ["region_id", "district_id", "ward_id", "residential_address"],
        ["next_of_kin_name", "relationship", "next_of_kin_phone", "next_of_kin_address"],
        ["upload_national_id", "upload_passport_photo"],
        ["branch_id", "membership_type", "initial_share_amount", "monthly_savings_commitment"],
        ["password", "confirm_password"],
        ["terms_accepted", "data_processing_consent"]
    ];

    const handleNextStep = async () => {
        const valid = await form.trigger(stepFields[activeStep], { shouldFocus: true });
        if (!valid) {
            return;
        }
        setActiveStep((current) => Math.min(current + 1, STEP_TITLES.length - 1));
    };

    const onSubmit = form.handleSubmit(async (values) => {
        const minimumShare = Math.max(selectedBranch?.minimum_initial_share_amount || MIN_INITIAL_SHARE_AMOUNT_TZS, MIN_INITIAL_SHARE_AMOUNT_TZS);
        const minimumSavings = Math.max(selectedBranch?.minimum_monthly_savings_commitment || MIN_MONTHLY_SAVINGS_COMMITMENT_TZS, MIN_MONTHLY_SAVINGS_COMMITMENT_TZS);

        if (values.initial_share_amount < minimumShare) {
            form.setError("initial_share_amount", { type: "manual", message: `Minimum initial share amount is ${formatCurrency(minimumShare)}.` });
            setActiveStep(4);
            return;
        }

        if (values.monthly_savings_commitment < minimumSavings) {
            form.setError("monthly_savings_commitment", { type: "manual", message: `Minimum monthly savings commitment is ${formatCurrency(minimumSavings)}.` });
            setActiveStep(4);
            return;
        }

        const payload: PublicSignupRequest = {
            branch_id: values.branch_id,
            first_name: values.first_name.trim(),
            last_name: values.last_name.trim(),
            gender: values.gender,
            marital_status: values.marital_status,
            occupation: values.occupation.trim(),
            employer_name: values.employer_name?.trim() || null,
            phone: normalizeSignupPhoneDigits(values.phone),
            email: values.email.trim().toLowerCase(),
            password: values.password,
            national_id: normalizeNationalIdDigits(values.national_id),
            date_of_birth: values.date_of_birth,
            region_id: values.region_id,
            district_id: values.district_id,
            ward_id: values.ward_id,
            village_id: values.village_id || null,
            region: values.region?.trim() || null,
            district: values.district?.trim() || null,
            ward: values.ward?.trim() || null,
            street_or_village: values.street_or_village?.trim() || null,
            residential_address: values.residential_address.trim(),
            next_of_kin_name: values.next_of_kin_name.trim(),
            relationship: values.relationship,
            next_of_kin_phone: normalizeSignupPhoneDigits(values.next_of_kin_phone),
            next_of_kin_address: values.next_of_kin_address.trim(),
            membership_type: values.membership_type,
            initial_share_amount: Number(values.initial_share_amount),
            monthly_savings_commitment: Number(values.monthly_savings_commitment),
            terms_accepted: true,
            data_processing_consent: true
        };

        const body = new FormData();
        body.append("payload", JSON.stringify(payload));
        body.append("upload_national_id", values.upload_national_id as File);
        body.append("upload_passport_photo", values.upload_passport_photo as File);

        setSubmitting(true);

        try {
            await api.post<PublicSignupResponse>(endpoints.public.signup(), body, {
                headers: {
                    "Content-Type": "multipart/form-data"
                },
                timeout: 60000
            });
            pushToast({
                type: "success",
                title: "Application submitted",
                message: "Your membership request has been recorded with identity documents and is now ready for branch review."
            });
            navigate("/signin");
        } catch (error) {
            pushToast({
                type: "error",
                title: "Signup failed",
                message: getApiErrorMessage(error, "Unable to submit your application.")
            });
        } finally {
            setSubmitting(false);
        }
    });

    const surfaceBorder = muiTheme.palette.mode === "dark"
        ? alpha("#FFFFFF", 0.12)
        : alpha("#AFC7FF", 0.42);
    const mutedText = muiTheme.palette.mode === "dark"
        ? alpha("#FFFFFF", 0.72)
        : "#5B6B85";
    const shellOverlay = muiTheme.palette.mode === "dark"
        ? `linear-gradient(135deg, ${alpha("#06101D", 0.74)} 0%, ${alpha("#091628", 0.62)} 44%, ${alpha("#0E1D32", 0.68)} 100%)`
        : `linear-gradient(135deg, ${alpha("#F5F9FF", 0.72)} 0%, ${alpha("#EEF5FF", 0.54)} 42%, ${alpha("#E5F1FF", 0.6)} 100%)`;
    const cardBackground = muiTheme.palette.mode === "dark"
        ? alpha("#0F172A", 0.68)
        : alpha("#FFFFFF", 0.84);
    const headerBackground = muiTheme.palette.mode === "dark"
        ? `linear-gradient(180deg, ${alpha("#FFFFFF", 0.04)} 0%, ${alpha("#FFFFFF", 0.02)} 100%)`
        : `linear-gradient(180deg, ${alpha("#FFFFFF", 0.72)} 0%, ${alpha("#F7FAFF", 0.58)} 100%)`;
    const sectionBackground = muiTheme.palette.mode === "dark"
        ? alpha("#091221", 0.18)
        : alpha("#FFFFFF", 0.34);
    const footerActionSx = muiTheme.palette.mode === "dark"
        ? {
            color: "#FFFFFF",
            "&:hover": {
                bgcolor: alpha("#FFFFFF", 0.06)
            }
        }
        : undefined;
    const signupFieldSx = muiTheme.palette.mode === "dark"
        ? {
            "& .MuiOutlinedInput-root": {
                bgcolor: alpha("#0B1524", 0.9),
                "& fieldset": {
                    borderColor: alpha("#FFFFFF", 0.16)
                },
                "&:hover fieldset": {
                    borderColor: alpha("#FFFFFF", 0.24)
                },
                "&.Mui-focused fieldset": {
                    borderColor: alpha("#8DD8FF", 0.72)
                }
            },
            "& .MuiInputLabel-root": {
                color: alpha("#FFFFFF", 0.82)
            },
            "& .MuiInputLabel-root.Mui-focused": {
                color: "#FFFFFF"
            },
            "& .MuiInputBase-input": {
                color: "#FFFFFF"
            },
            "& .MuiOutlinedInput-input:-webkit-autofill": {
                WebkitBoxShadow: `0 0 0 100px ${alpha("#0B1524", 0.9)} inset`,
                WebkitTextFillColor: "#FFFFFF",
                caretColor: "#FFFFFF",
                borderRadius: "inherit",
                transition: "background-color 9999s ease-out 0s"
            },
            "& .MuiOutlinedInput-input:-webkit-autofill:hover": {
                WebkitBoxShadow: `0 0 0 100px ${alpha("#0B1524", 0.9)} inset`,
                WebkitTextFillColor: "#FFFFFF"
            },
            "& .MuiOutlinedInput-input:-webkit-autofill:focus": {
                WebkitBoxShadow: `0 0 0 100px ${alpha("#0B1524", 0.9)} inset`,
                WebkitTextFillColor: "#FFFFFF"
            },
            "& .MuiOutlinedInput-input:-webkit-autofill:active": {
                WebkitBoxShadow: `0 0 0 100px ${alpha("#0B1524", 0.9)} inset`,
                WebkitTextFillColor: "#FFFFFF"
            },
            "& .MuiInputBase-input::placeholder": {
                color: alpha("#FFFFFF", 0.54),
                opacity: 1
            },
            "& .MuiFormHelperText-root": {
                color: alpha("#FFFFFF", 0.62)
            },
            "& .MuiSvgIcon-root": {
                color: alpha("#FFFFFF", 0.76)
            }
        }
        : undefined;

    const renderStepContent = () => {
        switch (activeStep) {
            case 0:
                return (
                    <StepShell
                        title="Personal Information"
                        description="Collect the applicant identity profile used for KYC review and cooperative governance."
                    >
                        <Grid container columnSpacing={1.35} rowSpacing={1.6}>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField fullWidth label="First name" size="small" sx={signupFieldSx} {...form.register("first_name")} error={Boolean(form.formState.errors.first_name)} helperText={form.formState.errors.first_name?.message} />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField fullWidth label="Last name" size="small" sx={signupFieldSx} {...form.register("last_name")} error={Boolean(form.formState.errors.last_name)} helperText={form.formState.errors.last_name?.message} />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField select fullWidth label="Gender" size="small" sx={signupFieldSx} value={form.watch("gender")} onChange={(event) => form.setValue("gender", event.target.value as SignupValues["gender"], { shouldValidate: true })} error={Boolean(form.formState.errors.gender)} helperText={form.formState.errors.gender?.message}>
                                    <MenuItem value="male">Male</MenuItem>
                                    <MenuItem value="female">Female</MenuItem>
                                    <MenuItem value="other">Other</MenuItem>
                                </TextField>
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField select fullWidth label="Marital status" size="small" sx={signupFieldSx} value={form.watch("marital_status")} onChange={(event) => form.setValue("marital_status", event.target.value as SignupValues["marital_status"], { shouldValidate: true })} error={Boolean(form.formState.errors.marital_status)} helperText={form.formState.errors.marital_status?.message}>
                                    <MenuItem value="single">Single</MenuItem>
                                    <MenuItem value="married">Married</MenuItem>
                                    <MenuItem value="divorced">Divorced</MenuItem>
                                    <MenuItem value="widowed">Widowed</MenuItem>
                                </TextField>
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField fullWidth label="Occupation" size="small" sx={signupFieldSx} {...form.register("occupation")} error={Boolean(form.formState.errors.occupation)} helperText={form.formState.errors.occupation?.message} />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField fullWidth label="Employer name (optional)" size="small" sx={signupFieldSx} {...form.register("employer_name")} error={Boolean(form.formState.errors.employer_name)} helperText={form.formState.errors.employer_name?.message} />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField
                                    fullWidth
                                    label="Phone number"
                                    size="small"
                                    type="tel"
                                    sx={signupFieldSx}
                                    value={form.watch("phone")}
                                    onChange={(event) => form.setValue("phone", formatSignupPhone(event.target.value), { shouldValidate: true })}
                                    error={Boolean(form.formState.errors.phone)}
                                    helperText={form.formState.errors.phone?.message || "Format: 255 712 345 678"}
                                    placeholder="255 712 345 678"
                                    inputProps={{ inputMode: "numeric", maxLength: 15 }}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField fullWidth label="Email address" size="small" type="email" sx={signupFieldSx} {...form.register("email")} error={Boolean(form.formState.errors.email)} helperText={form.formState.errors.email?.message} />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField
                                    fullWidth
                                    label="National ID / NIDA"
                                    size="small"
                                    sx={signupFieldSx}
                                    value={form.watch("national_id")}
                                    onChange={(event) => form.setValue("national_id", formatNationalId(event.target.value), { shouldValidate: true })}
                                    error={Boolean(form.formState.errors.national_id)}
                                    helperText={form.formState.errors.national_id?.message || "Format: 20051702-61305-00103-08"}
                                    placeholder="20051702-61305-00103-08"
                                    inputProps={{ inputMode: "numeric", maxLength: 23 }}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField fullWidth label="Date of birth" size="small" type="date" sx={signupFieldSx} InputLabelProps={{ shrink: true }} {...form.register("date_of_birth")} error={Boolean(form.formState.errors.date_of_birth)} helperText={form.formState.errors.date_of_birth?.message || "Applicants must be at least 18 years old."} />
                            </Grid>
                        </Grid>
                    </StepShell>
                );
            case 1:
                return (
                    <StepShell
                        title="Address Information"
                        description="Capture the residential location used for branch and compliance verification."
                    >
                        <Grid container columnSpacing={1.35} rowSpacing={1.6}>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <SearchableSelect
                                    value={form.watch("region_id")}
                                    options={regionOptions}
                                    label="Region"
                                    placeholder={loadingRegions ? "Loading regions..." : "Search region..."}
                                    helperText={form.formState.errors.region_id?.message || "Select the member's region."}
                                    error={Boolean(form.formState.errors.region_id)}
                                    onChange={(value) => {
                                        const selectedRegion = regions.find((item) => item.id === value);
                                        form.setValue("region_id", value, { shouldValidate: true });
                                        form.setValue("district_id", "", { shouldValidate: false });
                                        form.setValue("ward_id", "", { shouldValidate: false });
                                        form.setValue("village_id", "", { shouldValidate: false });
                                        form.setValue("region", selectedRegion?.name || "", { shouldValidate: true });
                                        form.setValue("district", "", { shouldValidate: false });
                                        form.setValue("ward", "", { shouldValidate: false });
                                        form.setValue("street_or_village", "", { shouldValidate: false });
                                    }}
                                    size="small"
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <SearchableSelect
                                    value={form.watch("district_id")}
                                    options={districtOptions}
                                    label="District"
                                    placeholder={selectedRegionId ? (loadingDistricts ? "Loading districts..." : "Search district...") : "Select a region first"}
                                    helperText={form.formState.errors.district_id?.message || "Districts are filtered by the selected region."}
                                    error={Boolean(form.formState.errors.district_id)}
                                    onChange={(value) => {
                                        const selectedDistrict = districts.find((item) => item.id === value);
                                        form.setValue("district_id", value, { shouldValidate: true });
                                        form.setValue("ward_id", "", { shouldValidate: false });
                                        form.setValue("village_id", "", { shouldValidate: false });
                                        form.setValue("district", selectedDistrict?.name || "", { shouldValidate: true });
                                        form.setValue("ward", "", { shouldValidate: false });
                                        form.setValue("street_or_village", "", { shouldValidate: false });
                                    }}
                                    size="small"
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <SearchableSelect
                                    value={form.watch("ward_id")}
                                    options={wardOptions}
                                    label="Ward"
                                    placeholder={selectedDistrictId ? (loadingWards ? "Loading wards..." : "Search ward...") : "Select a district first"}
                                    helperText={form.formState.errors.ward_id?.message || "Wards are filtered by the selected district."}
                                    error={Boolean(form.formState.errors.ward_id)}
                                    onChange={(value) => {
                                        const selectedWard = wards.find((item) => item.id === value);
                                        form.setValue("ward_id", value, { shouldValidate: true });
                                        form.setValue("village_id", "", { shouldValidate: false });
                                        form.setValue("ward", selectedWard?.name || "", { shouldValidate: true });
                                        form.setValue("street_or_village", "", { shouldValidate: false });
                                    }}
                                    size="small"
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <SearchableSelect
                                    value={form.watch("village_id") || ""}
                                    options={villageOptions}
                                    label="Village / Mtaa"
                                    placeholder={selectedWardId ? (loadingVillages ? "Loading villages..." : "Search village or mtaa...") : "Select a ward first"}
                                    helperText={
                                        form.formState.errors.village_id?.message
                                        || (selectedWardId
                                            ? (villageOptions.length
                                                ? "Choose the official village or mtaa if available. Code omitted."
                                                : "No preloaded village or mtaa found for this ward. You can continue without selecting one.")
                                            : "Village or mtaa is optional. Select a ward first if you want to choose one.")
                                    }
                                    error={Boolean(form.formState.errors.village_id)}
                                    onChange={(value) => {
                                        const selectedVillage = villages.find((item) => item.id === value);
                                        form.setValue("village_id", value, { shouldValidate: true });
                                        form.setValue("street_or_village", selectedVillage?.name || "", { shouldValidate: true });
                                        if (!form.getValues("residential_address")) {
                                            form.setValue("residential_address", selectedVillage?.name || "", { shouldValidate: true });
                                        }
                                    }}
                                    size="small"
                                />
                            </Grid>
                            <Grid size={{ xs: 12 }}>
                                <TextField
                                    fullWidth
                                    multiline
                                    minRows={2}
                                    maxRows={3}
                                    label="Residential address"
                                    size="small"
                                    sx={signupFieldSx}
                                    {...form.register("residential_address")}
                                    error={Boolean(form.formState.errors.residential_address)}
                                    helperText={form.formState.errors.residential_address?.message || "Add house number, plot, landmark, or extra address detail."}
                                />
                            </Grid>
                        </Grid>
                    </StepShell>
                );
            case 2:
                return (
                    <StepShell
                        title="Next of Kin"
                        description="Record the nominee and emergency contact details required in a SACCO membership file."
                    >
                        <Grid container columnSpacing={1.35} rowSpacing={1.6}>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField fullWidth label="Next of kin name" size="small" sx={signupFieldSx} {...form.register("next_of_kin_name")} error={Boolean(form.formState.errors.next_of_kin_name)} helperText={form.formState.errors.next_of_kin_name?.message} />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField select fullWidth label="Relationship" size="small" sx={signupFieldSx} value={form.watch("relationship")} onChange={(event) => form.setValue("relationship", event.target.value as SignupValues["relationship"], { shouldValidate: true })} error={Boolean(form.formState.errors.relationship)} helperText={form.formState.errors.relationship?.message}>
                                    {NEXT_OF_KIN_RELATIONSHIP_OPTIONS.map((option) => (
                                        <MenuItem key={option.value} value={option.value}>
                                            {option.label}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField
                                    fullWidth
                                    label="Next of kin phone"
                                    size="small"
                                    type="tel"
                                    sx={signupFieldSx}
                                    value={form.watch("next_of_kin_phone")}
                                    onChange={(event) => form.setValue("next_of_kin_phone", formatSignupPhone(event.target.value), { shouldValidate: true })}
                                    error={Boolean(form.formState.errors.next_of_kin_phone)}
                                    helperText={form.formState.errors.next_of_kin_phone?.message || "Format: 255 712 345 678"}
                                    placeholder="255 712 345 678"
                                    inputProps={{ inputMode: "numeric", maxLength: 15 }}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField fullWidth multiline minRows={2} maxRows={3} label="Next of kin address" size="small" sx={signupFieldSx} {...form.register("next_of_kin_address")} error={Boolean(form.formState.errors.next_of_kin_address)} helperText={form.formState.errors.next_of_kin_address?.message} />
                            </Grid>
                        </Grid>
                    </StepShell>
                );
            case 3:
                return (
                    <StepShell
                        title="Identification Upload"
                        description="Attach the identity documents branch managers need to review the application file."
                    >
                        <Alert severity="info" variant="outlined">
                            Allowed formats: JPG, PNG, PDF. Maximum file size: 5MB per document.
                        </Alert>
                        <Grid container spacing={1.5}>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <DocumentUploadCard
                                    label="National ID document"
                                    hint="Upload a clear scan or photo of the NIDA / national ID document."
                                    file={form.watch("upload_national_id")}
                                    error={form.formState.errors.upload_national_id?.message}
                                    onSelect={(file) => form.setValue("upload_national_id", file, { shouldValidate: true })}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <DocumentUploadCard
                                    label="Passport photo"
                                    hint="Upload the applicant passport photo or official face image used for the member file."
                                    file={form.watch("upload_passport_photo")}
                                    error={form.formState.errors.upload_passport_photo?.message}
                                    onSelect={(file) => form.setValue("upload_passport_photo", file, { shouldValidate: true })}
                                />
                            </Grid>
                        </Grid>
                    </StepShell>
                );
            case 4:
                return (
                    <StepShell
                        title="Membership Details"
                        description="Capture the branch, membership category, and SACCO commitment values before submission."
                    >
                        <Alert severity="info" variant="outlined">
                            {selectedBranch
                                ? `Joining ${selectedBranch.name}. Minimum initial shares: ${formatCurrency(selectedBranch.minimum_initial_share_amount)}. Minimum monthly savings commitment: ${formatCurrency(selectedBranch.minimum_monthly_savings_commitment)}. Membership fee after approval: ${formatCurrency(selectedBranch.membership_fee_amount)}.`
                                : "Choose the branch you want to join so we can apply the correct onboarding requirements."}
                        </Alert>
                        <Grid container columnSpacing={1.35} rowSpacing={1.6}>
                            <Grid size={{ xs: 12, md: 4 }}>
                                <TextField
                                    select
                                    fullWidth
                                    label="Branch"
                                    size="small"
                                    sx={signupFieldSx}
                                    value={form.watch("branch_id")}
                                    onChange={(event) => form.setValue("branch_id", event.target.value, { shouldValidate: true })}
                                    error={Boolean(form.formState.errors.branch_id) || Boolean(branchesError)}
                                    helperText={branchHelper}
                                    disabled={branchesLoading || branches.length === 0}
                                >
                                    {branches.map((branch) => (
                                        <MenuItem key={branch.id} value={branch.id}>
                                            {branch.name} ({branch.code})
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Grid>
                            <Grid size={{ xs: 12, md: 4 }}>
                                <TextField select fullWidth label="Membership type" size="small" sx={signupFieldSx} value={form.watch("membership_type")} onChange={(event) => form.setValue("membership_type", event.target.value as SignupValues["membership_type"], { shouldValidate: true })} error={Boolean(form.formState.errors.membership_type)} helperText={form.formState.errors.membership_type?.message}>
                                    <MenuItem value="individual">Individual</MenuItem>
                                    <MenuItem value="group">Group</MenuItem>
                                    <MenuItem value="company">Company</MenuItem>
                                </TextField>
                            </Grid>
                            <Grid size={{ xs: 12, md: 4 }}>
                                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ pt: 0.5 }}>
                                    <Chip label={selectedBranch ? `Fee ${formatCurrency(selectedBranch.membership_fee_amount)}` : "Membership fee after approval"} variant="outlined" />
                                    <Chip label="Status starts as submitted" variant="outlined" />
                                </Stack>
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <TextField fullWidth type="number" label="Initial share amount (TZS)" size="small" sx={signupFieldSx} {...form.register("initial_share_amount", { valueAsNumber: true })} error={Boolean(form.formState.errors.initial_share_amount)} helperText={form.formState.errors.initial_share_amount?.message} inputProps={{ min: selectedBranch?.minimum_initial_share_amount || MIN_INITIAL_SHARE_AMOUNT_TZS }} />
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <TextField fullWidth type="number" label="Monthly savings commitment (TZS)" size="small" sx={signupFieldSx} {...form.register("monthly_savings_commitment", { valueAsNumber: true })} error={Boolean(form.formState.errors.monthly_savings_commitment)} helperText={form.formState.errors.monthly_savings_commitment?.message} inputProps={{ min: selectedBranch?.minimum_monthly_savings_commitment || MIN_MONTHLY_SAVINGS_COMMITMENT_TZS }} />
                            </Grid>
                        </Grid>
                    </StepShell>
                );
            case 5:
                return (
                    <StepShell
                        title="Security & Password"
                        description="Create the portal password the applicant will use after branch approval and activation."
                    >
                        <Grid container columnSpacing={1.35} rowSpacing={1.6}>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <TextField
                                    fullWidth
                                    label="Create password"
                                    size="small"
                                    type={showPassword ? "text" : "password"}
                                    sx={signupFieldSx}
                                    value={form.watch("password")}
                                    onChange={(event) => form.setValue("password", event.target.value, { shouldValidate: true })}
                                    error={Boolean(form.formState.errors.password)}
                                    helperText={form.formState.errors.password?.message}
                                    InputProps={{
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton edge="end" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"}>
                                                    {showPassword ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                                                </IconButton>
                                            </InputAdornment>
                                        )
                                    }}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <TextField
                                    fullWidth
                                    label="Confirm password"
                                    size="small"
                                    type={showConfirmPassword ? "text" : "password"}
                                    sx={signupFieldSx}
                                    value={form.watch("confirm_password")}
                                    onChange={(event) => form.setValue("confirm_password", event.target.value, { shouldValidate: true })}
                                    error={Boolean(form.formState.errors.confirm_password)}
                                    helperText={form.formState.errors.confirm_password?.message}
                                    InputProps={{
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton edge="end" onClick={() => setShowConfirmPassword((current) => !current)} aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}>
                                                    {showConfirmPassword ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                                                </IconButton>
                                            </InputAdornment>
                                        )
                                    }}
                                />
                            </Grid>
                            <Grid size={{ xs: 12 }}>
                                <Paper
                                    variant="outlined"
                                    sx={{
                                        p: 1.3,
                                        borderRadius: 2.25,
                                        borderColor: surfaceBorder,
                                        bgcolor: sectionBackground,
                                        backdropFilter: "blur(6px)"
                                    }}
                                >
                                    <Stack spacing={0.9}>
                                        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={0.55}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                                Password guide
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: mutedText, fontSize: "0.76rem" }}>
                                                Ticks update as you type.
                                            </Typography>
                                        </Stack>
                                        <Grid container spacing={0.75}>
                                            {passwordChecks.map((rule) => (
                                                <Grid key={rule.id} size={{ xs: 12, sm: 6, md: 4 }}>
                                                    <Stack direction="row" spacing={0.55} alignItems="center">
                                                        <CheckCircleRoundedIcon
                                                            sx={{
                                                                fontSize: 14,
                                                                color: rule.satisfied ? "#16A34A" : alpha(muiTheme.palette.text.secondary, 0.38)
                                                            }}
                                                        />
                                                        <Typography
                                                            variant="body2"
                                                            sx={{
                                                                color: rule.satisfied ? (muiTheme.palette.mode === "dark" ? "#86EFAC" : "#15803D") : mutedText,
                                                                fontWeight: rule.satisfied ? 700 : 500,
                                                                fontSize: "0.78rem",
                                                                lineHeight: 1.25
                                                            }}
                                                        >
                                                            {rule.label}
                                                        </Typography>
                                                    </Stack>
                                                </Grid>
                                            ))}
                                        </Grid>
                                    </Stack>
                                </Paper>
                            </Grid>
                        </Grid>
                    </StepShell>
                );
            case 6:
                return (
                    <StepShell
                        title="Terms Agreement"
                        description="Review the final onboarding summary and capture the required legal consent."
                    >
                        <Paper variant="outlined" sx={{ p: 1.6, borderRadius: 2 }}>
                            <Stack spacing={1}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                    Submission summary
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {form.watch("first_name")} {form.watch("last_name")} · {selectedBranch?.name || "Branch not selected"} · {formatCurrency(Number(form.watch("initial_share_amount") || 0))} initial shares · {formatCurrency(Number(form.watch("monthly_savings_commitment") || 0))} monthly savings
                                </Typography>
                            </Stack>
                        </Paper>
                        <Stack spacing={0.6}>
                            <FormControlLabel
                                control={<Checkbox checked={Boolean(form.watch("terms_accepted"))} onChange={(event) => form.setValue("terms_accepted", event.target.checked, { shouldValidate: true })} />}
                                label="I agree to the SACCOS membership terms and bylaws."
                            />
                            {form.formState.errors.terms_accepted ? <FormHelperText error>{form.formState.errors.terms_accepted.message}</FormHelperText> : null}
                            <FormControlLabel
                                control={<Checkbox checked={Boolean(form.watch("data_processing_consent"))} onChange={(event) => form.setValue("data_processing_consent", event.target.checked, { shouldValidate: true })} />}
                                label="I consent to my personal data being stored and processed for membership onboarding and compliance review."
                            />
                            {form.formState.errors.data_processing_consent ? <FormHelperText error>{form.formState.errors.data_processing_consent.message}</FormHelperText> : null}
                        </Stack>
                    </StepShell>
                );
            default:
                return null;
        }
    };

    return (
        <Box
            sx={{
                minHeight: "100dvh",
                display: "grid",
                placeItems: "center",
                px: { xs: 1.25, md: 2 },
                py: { xs: 1.25, md: 1 },
                backgroundImage: `${shellOverlay}, url('/bk.jpg')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                position: "relative",
                "&::before": {
                    content: '""',
                    position: "absolute",
                    inset: 0,
                    background: muiTheme.palette.mode === "dark"
                        ? `radial-gradient(circle at 16% 18%, ${alpha("#1FA8E6", 0.1)} 0%, transparent 22%),
                            radial-gradient(circle at 84% 10%, ${alpha("#7DD3FC", 0.07)} 0%, transparent 18%)`
                        : `radial-gradient(circle at 12% 14%, ${alpha("#D8E9FF", 0.56)} 0%, transparent 24%),
                            radial-gradient(circle at 88% 10%, ${alpha("#E3F5FF", 0.5)} 0%, transparent 18%)`,
                    pointerEvents: "none"
                }
            }}
        >
            <Paper
                elevation={0}
                sx={{
                    width: "min(1120px, 100%)",
                    borderRadius: { xs: 2, md: 2.5 },
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    border: `1px solid ${surfaceBorder}`,
                    maxHeight: { md: "calc(100dvh - 16px)" },
                    bgcolor: cardBackground,
                    backdropFilter: "blur(14px)",
                    boxShadow: muiTheme.palette.mode === "dark"
                        ? `0 30px 90px ${alpha("#020617", 0.42)}`
                        : `0 30px 80px ${alpha("#5E7DAE", 0.18)}`
                }}
            >
                <Box
                    sx={{
                        px: { xs: 2.25, md: 3.5 },
                        py: { xs: 2.25, md: 2.2 },
                        flexShrink: 0,
                        borderBottom: `1px solid ${alpha(surfaceBorder, 0.9)}`,
                        background: headerBackground
                    }}
                >
                    <Stack spacing={2.35}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                            <Stack spacing={1.2} sx={{ minWidth: 0 }}>
                                <Stack direction="row" spacing={1.15} alignItems="center">
                                    <Box component="img" src="/SACCOSS-LOGO.png" alt="SMART SACCOS logo" sx={{ width: { xs: 40, md: 44 }, height: { xs: 40, md: 44 }, objectFit: "contain" }} />
                                    <Box>
                                        <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: "-0.02em", fontSize: { xs: "1.18rem", md: "1.3rem" } }}>
                                            SMART SACCOS
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: mutedText, fontSize: "0.84rem" }}>
                                            Membership onboarding
                                        </Typography>
                                    </Box>
                                </Stack>
                                <Box>
                                    <Typography variant="overline" sx={{ color: muiTheme.palette.mode === "dark" ? alpha("#FFFFFF", 0.72) : "#1A0FA3", letterSpacing: "0.18em", fontWeight: 700 }}>
                                        Production-ready digital onboarding
                                    </Typography>
                                    <Typography variant="h2" sx={{ mt: 0.45, fontSize: { xs: "1.7rem", md: "2.2rem" }, lineHeight: 0.96, letterSpacing: "-0.05em", fontWeight: 800 }}>
                                        Apply for SACCO membership
                                    </Typography>
                                    <Typography variant="body1" sx={{ mt: 0.65, maxWidth: 760, color: mutedText, fontSize: { xs: "0.92rem", md: "0.96rem" }, lineHeight: 1.42 }}>
                                        Complete the full onboarding file once, attach the required identity documents, and move straight into branch review, approval, and membership-fee activation.
                                    </Typography>
                                </Box>
                            </Stack>

                            <IconButton
                                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                                type="button"
                                onClick={toggleTheme}
                                sx={{
                                    width: 42,
                                    height: 42,
                                    border: `1px solid ${surfaceBorder}`,
                                    bgcolor: muiTheme.palette.mode === "dark" ? alpha("#FFFFFF", 0.03) : alpha("#FFFFFF", 0.94)
                                }}
                            >
                                {theme === "dark" ? <LightModeRoundedIcon fontSize="small" /> : <DarkModeRoundedIcon fontSize="small" />}
                            </IconButton>
                        </Stack>

                        <Grid container spacing={1.15}>
                            {featurePoints.map((point) => (
                                <Grid key={point} size={{ xs: 12, md: 4 }}>
                                    <Paper
                                        variant="outlined"
                                        sx={{
                                            p: 1.15,
                                            height: "100%",
                                            borderRadius: 2.25,
                                            borderColor: surfaceBorder,
                                            bgcolor: sectionBackground,
                                            backdropFilter: "blur(6px)"
                                        }}
                                    >
                                        <Stack direction="row" spacing={1.2} alignItems="flex-start">
                                            <Box
                                                sx={{
                                                    width: 24,
                                                    height: 24,
                                                    borderRadius: 1.2,
                                                    display: "grid",
                                                    placeItems: "center",
                                                    bgcolor: alpha("#16A34A", 0.12),
                                                    color: "#16A34A",
                                                    flexShrink: 0
                                                }}
                                            >
                                                <CheckCircleRoundedIcon sx={{ fontSize: 16 }} />
                                            </Box>
                                            <Typography variant="body2" sx={{ color: mutedText, lineHeight: 1.35, fontSize: "0.81rem" }}>
                                                {point}
                                            </Typography>
                                        </Stack>
                                    </Paper>
                                </Grid>
                            ))}
                        </Grid>
                    </Stack>
                </Box>

                <Box
                    sx={{
                        px: { xs: 2.25, md: 3.5 },
                        py: { xs: 2.25, md: 2.2 },
                        overflowY: { md: "auto" },
                        background: muiTheme.palette.mode === "dark" ? alpha("#08111F", 0.08) : alpha("#FFFFFF", 0.12)
                    }}
                >
                    <form onSubmit={onSubmit}>
                        <Stack spacing={2}>
                            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2.25, borderColor: surfaceBorder, bgcolor: sectionBackground }}>
                                <Stack spacing={1.3}>
                                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1}>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                            Step {activeStep + 1} of {STEP_TITLES.length}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {STEP_TITLES[activeStep]}
                                        </Typography>
                                    </Stack>
                                    <Stepper activeStep={activeStep} alternativeLabel sx={{ overflowX: "auto", py: 0.5 }}>
                                        {STEP_TITLES.map((label) => (
                                            <Step key={label}>
                                                <StepLabel>{label}</StepLabel>
                                            </Step>
                                        ))}
                                    </Stepper>
                                </Stack>
                            </Paper>

                            {renderStepContent()}

                            <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} spacing={2} sx={{ mt: 0.5 }}>
                                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                    <Chip label={branchesLoading ? "Loading branches" : `${branches.length} branch${branches.length === 1 ? "" : "es"} available`} variant="outlined" />
                                    <Chip label={selectedBranch ? `${formatCurrency(selectedBranch.membership_fee_amount)} membership fee after approval` : "Membership fee collected after approval"} variant="outlined" />
                                </Stack>
                                <Stack direction="row" spacing={1.2}>
                                    {activeStep > 0 ? (
                                        <Button variant="text" onClick={() => setActiveStep((current) => Math.max(current - 1, 0))}>
                                            Back
                                        </Button>
                                    ) : null}
                                    {activeStep < STEP_TITLES.length - 1 ? (
                                        <Button variant="contained" endIcon={<ArrowForwardRoundedIcon />} onClick={() => void handleNextStep()} sx={{ minWidth: 190, minHeight: 44, borderRadius: 2.5, px: 2.6 }}>
                                            Continue
                                        </Button>
                                    ) : (
                                        <Button type="submit" variant="contained" endIcon={<ArrowForwardRoundedIcon />} sx={{ minWidth: 210, minHeight: 44, borderRadius: 2.5, px: 2.6 }} disabled={submitting}>
                                            {submitting ? "Submitting..." : "Submit application"}
                                        </Button>
                                    )}
                                </Stack>
                            </Stack>
                        </Stack>
                    </form>

                    <Divider sx={{ my: 1.9 }} />

                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} spacing={1.75}>
                        <Typography variant="body2" sx={{ color: mutedText }}>
                            Already have an account?{" "}
                            <RouterLink to="/signin">Sign in</RouterLink>
                        </Typography>
                        <Stack direction="row" spacing={1}>
                            <Button component="a" href={import.meta.env.VITE_MARKETING_OWNER_EMAIL ? `mailto:${import.meta.env.VITE_MARKETING_OWNER_EMAIL}` : "/signin"} variant="text" sx={footerActionSx}>
                                Talk to us
                            </Button>
                            <Button component={RouterLink} to="/" variant="text" endIcon={<ArrowForwardRoundedIcon />} sx={footerActionSx}>
                                Back to home
                            </Button>
                        </Stack>
                    </Stack>
                </Box>
            </Paper>
        </Box>
    );
}
