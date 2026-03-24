import { useEffect, useState } from "react";
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
import { Box, Button, Chip, Divider, Grid, IconButton, InputAdornment, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import { api, getApiErrorMessage } from "../lib/api";
import {
    endpoints,
    type PublicSignupBranchesResponse,
    type PublicSignupRequest,
    type PublicSignupResponse
} from "../lib/endpoints";
import { useToast } from "../components/Toast";
import { useUI } from "../ui/UIProvider";
import type { Branch } from "../types/api";

const NIDA_DIGIT_LENGTH = 20;
const PHONE_DIGIT_LENGTH = 12;
const PASSWORD_SPECIAL_PATTERN = /[^A-Za-z0-9]/;

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

const schema = z
    .object({
        branch_id: z.string().uuid("Select a branch."),
        first_name: z.string().trim().min(1, "First name is required."),
        last_name: z.string().trim().min(1, "Last name is required."),
        phone: z.string().trim().refine(
            (value) => /^255[67]\d{8}$/.test(normalizeSignupPhoneDigits(value)),
            "Enter a valid Tanzania mobile number."
        ),
        email: z.string().trim().email("Enter a valid email address."),
        password: z.string()
            .min(8, "Password must be at least 8 characters.")
            .regex(/[A-Z]/, "Password must include an uppercase letter.")
            .regex(/[a-z]/, "Password must include a lowercase letter.")
            .regex(/\d/, "Password must include a number.")
            .regex(PASSWORD_SPECIAL_PATTERN, "Password must include a special character."),
        confirm_password: z.string().min(8, "Confirm password is required."),
        national_id: z.string().trim().refine(
            (value) => normalizeNationalIdDigits(value).length === NIDA_DIGIT_LENGTH,
            "Enter a valid 20-digit NIDA number."
        ),
        date_of_birth: z.string().refine((value) => {
            if (!value) {
                return false;
            }

            const parsed = new Date(value);
            return !Number.isNaN(parsed.getTime());
        }, "Enter a valid date.")
    })
    .refine((values) => values.password === values.confirm_password, {
        message: "Passwords must match.",
        path: ["confirm_password"]
    });

type SignupValues = z.infer<typeof schema>;

const featurePoints = [
    "Your request arrives directly to the selected branch manager.",
    "Track the application status until approval and activation.",
    "Pay the membership fee through Azam Pay once approved."
] as const;

export function SignupPage() {
    const navigate = useNavigate();
    const muiTheme = useTheme();
    const { pushToast } = useToast();
    const { theme, toggleTheme } = useUI();
    const [branches, setBranches] = useState<Branch[]>([]);
    const [branchesLoading, setBranchesLoading] = useState(true);
    const [branchesError, setBranchesError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const form = useForm<SignupValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            branch_id: "",
            first_name: "",
            last_name: "",
            phone: "",
            email: "",
            password: "",
            confirm_password: "",
            national_id: "",
            date_of_birth: ""
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
                    form.setValue("branch_id", items[0].id, { shouldValidate: true });
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

    const branchHelper = form.formState.errors.branch_id?.message
        || branchesError
        || (!branchesLoading && branches.length === 0 ? "No branches are accepting applications yet." : "Pick the branch you wish to join.");
    const passwordValue = form.watch("password");
    const confirmPasswordValue = form.watch("confirm_password");
    const passwordChecks = getPasswordChecks(passwordValue, confirmPasswordValue);

    const onSubmit = form.handleSubmit(async (values) => {
        const payload: PublicSignupRequest = {
            branch_id: values.branch_id,
            first_name: values.first_name.trim(),
            last_name: values.last_name.trim(),
            phone: normalizeSignupPhoneDigits(values.phone),
            email: values.email.trim().toLowerCase(),
            password: values.password,
            national_id: normalizeNationalIdDigits(values.national_id),
            date_of_birth: values.date_of_birth
        };

        setSubmitting(true);

        try {
            await api.post<PublicSignupResponse>(endpoints.public.signup(), payload);
            pushToast({
                type: "success",
                title: "Application submitted",
                message: "Your membership request has been recorded. You can sign in once the branch approves and collects the fee."
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

    return (
        <Box
            sx={{
                minHeight: "100dvh",
                display: "grid",
                placeItems: "center",
                px: { xs: 1.25, md: 2 },
                py: { xs: 1.25, md: 1 },
                background: muiTheme.palette.mode === "dark"
                    ? `radial-gradient(circle at 14% 16%, ${alpha("#1FA8E6", 0.16)} 0%, transparent 24%),
                        linear-gradient(180deg, ${alpha("#0A1021", 0.98)} 0%, ${alpha("#081122", 1)} 100%)`
                    : `radial-gradient(circle at 10% 12%, ${alpha("#D9E9FF", 0.92)} 0%, transparent 24%),
                        radial-gradient(circle at 88% 8%, ${alpha("#E6F8FF", 0.82)} 0%, transparent 18%),
                        linear-gradient(180deg, ${alpha("#F7FAFF", 1)} 0%, ${alpha("#F3F7FF", 1)} 100%)`
            }}
        >
            <Paper
                elevation={0}
                sx={{
                    width: "min(1040px, 100%)",
                    borderRadius: { xs: 2, md: 2.5 },
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    border: `1px solid ${surfaceBorder}`,
                    maxHeight: { md: "calc(100dvh - 16px)" },
                    bgcolor: muiTheme.palette.mode === "dark" ? alpha("#0F172A", 0.92) : alpha("#FFFFFF", 0.98),
                    boxShadow: muiTheme.palette.mode === "dark"
                        ? `0 30px 90px ${alpha("#020617", 0.42)}`
                        : `0 30px 80px ${alpha("#9DB7E8", 0.22)}`
                }}
            >
                <Box
                    sx={{
                        px: { xs: 2.25, md: 3.5 },
                        py: { xs: 2.25, md: 2.2 },
                        flexShrink: 0,
                        borderBottom: `1px solid ${alpha(surfaceBorder, 0.9)}`,
                        background: muiTheme.palette.mode === "dark"
                            ? alpha("#FFFFFF", 0.02)
                            : `linear-gradient(180deg, ${alpha("#F8FBFF", 0.98)} 0%, ${alpha("#FFFFFF", 0.96)} 100%)`
                    }}
                >
                    <Stack spacing={2.35}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                            <Stack spacing={1.2} sx={{ minWidth: 0 }}>
                                <Stack direction="row" spacing={1.15} alignItems="center">
                                    <Box
                                        component="img"
                                        src="/SACCOSS-LOGO.png"
                                        alt="SMART SACCOS logo"
                                        sx={{ width: { xs: 40, md: 44 }, height: { xs: 40, md: 44 }, objectFit: "contain" }}
                                    />
                                    <Box>
                                        <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: "-0.02em", fontSize: { xs: "1.18rem", md: "1.3rem" } }}>
                                            SMART SACCOS
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: mutedText, fontSize: "0.84rem" }}>
                                            Apply for membership
                                        </Typography>
                                    </Box>
                                </Stack>
                                <Box>
                                    <Typography
                                        variant="overline"
                                        sx={{
                                            color: muiTheme.palette.mode === "dark" ? alpha("#FFFFFF", 0.72) : "#1A0FA3",
                                            letterSpacing: "0.18em",
                                            fontWeight: 700
                                        }}
                                    >
                                        Start your member journey
                                    </Typography>
                                    <Typography
                                        variant="h2"
                                        sx={{
                                            mt: 0.45,
                                            fontSize: { xs: "1.7rem", md: "2.2rem" },
                                            lineHeight: 0.96,
                                            letterSpacing: "-0.05em",
                                            fontWeight: 800
                                        }}
                                    >
                                        Submit your application
                                    </Typography>
                                    <Typography
                                        variant="body1"
                                        sx={{
                                            mt: 0.65,
                                            maxWidth: 720,
                                            color: mutedText,
                                            fontSize: { xs: "0.92rem", md: "0.96rem" },
                                            lineHeight: 1.42
                                        }}
                                    >
                                        Pick your branch, provide your details, and we will keep you posted as the branch reviews and approves your membership.
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
                                            bgcolor: muiTheme.palette.mode === "dark"
                                                ? alpha("#FFFFFF", 0.02)
                                                : alpha("#F8FBFF", 0.96)
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
                        overflowY: { md: "auto" }
                    }}
                >
                    <form onSubmit={onSubmit}>
                        <Grid container columnSpacing={1.35} rowSpacing={1.6}>
                            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                <TextField
                                    fullWidth
                                    label="First name"
                                    size="small"
                                    value={form.watch("first_name")}
                                    onChange={(event) => form.setValue("first_name", event.target.value)}
                                    error={Boolean(form.formState.errors.first_name)}
                                    helperText={form.formState.errors.first_name?.message}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                <TextField
                                    fullWidth
                                    label="Last name"
                                    size="small"
                                    value={form.watch("last_name")}
                                    onChange={(event) => form.setValue("last_name", event.target.value)}
                                    error={Boolean(form.formState.errors.last_name)}
                                    helperText={form.formState.errors.last_name?.message}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                <TextField
                                    fullWidth
                                    label="Email address"
                                    size="small"
                                    type="email"
                                    value={form.watch("email")}
                                    onChange={(event) => form.setValue("email", event.target.value)}
                                    error={Boolean(form.formState.errors.email)}
                                    helperText={form.formState.errors.email?.message}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                <TextField
                                    fullWidth
                                    label="Phone number"
                                    size="small"
                                    type="tel"
                                    value={form.watch("phone")}
                                    onChange={(event) => form.setValue("phone", formatSignupPhone(event.target.value), { shouldValidate: true })}
                                    error={Boolean(form.formState.errors.phone)}
                                    helperText={form.formState.errors.phone?.message || "Format: 255 712 345 678"}
                                    placeholder="255 712 345 678"
                                    inputProps={{
                                        inputMode: "numeric",
                                        maxLength: 15
                                    }}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                <TextField
                                    fullWidth
                                    label="Date of birth"
                                    size="small"
                                    type="date"
                                    InputLabelProps={{ shrink: true }}
                                    value={form.watch("date_of_birth")}
                                    onChange={(event) => form.setValue("date_of_birth", event.target.value)}
                                    error={Boolean(form.formState.errors.date_of_birth)}
                                    helperText={form.formState.errors.date_of_birth?.message}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                <TextField
                                    fullWidth
                                    label="National ID"
                                    size="small"
                                    value={form.watch("national_id")}
                                    onChange={(event) => form.setValue("national_id", formatNationalId(event.target.value), { shouldValidate: true })}
                                    error={Boolean(form.formState.errors.national_id)}
                                    helperText={form.formState.errors.national_id?.message || "Format: 20051702-61305-00103-08"}
                                    placeholder="20051702-61305-00103-08"
                                    inputProps={{
                                        inputMode: "numeric",
                                        maxLength: 23
                                    }}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, md: 4 }}>
                                <TextField
                                    select
                                    fullWidth
                                    label="Branch"
                                    size="small"
                                    value={form.watch("branch_id")}
                                    onChange={(event) => form.setValue("branch_id", event.target.value)}
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
                            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                <TextField
                                    fullWidth
                                    label="Create password"
                                    size="small"
                                    type={showPassword ? "text" : "password"}
                                    value={form.watch("password")}
                                    onChange={(event) => form.setValue("password", event.target.value)}
                                    error={Boolean(form.formState.errors.password)}
                                    helperText={form.formState.errors.password?.message}
                                    InputProps={{
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    edge="end"
                                                    onClick={() => setShowPassword((current) => !current)}
                                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                                >
                                                    {showPassword ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                                                </IconButton>
                                            </InputAdornment>
                                        )
                                    }}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                <TextField
                                    fullWidth
                                    label="Confirm password"
                                    size="small"
                                    type={showConfirmPassword ? "text" : "password"}
                                    value={form.watch("confirm_password")}
                                    onChange={(event) => form.setValue("confirm_password", event.target.value)}
                                    error={Boolean(form.formState.errors.confirm_password)}
                                    helperText={form.formState.errors.confirm_password?.message}
                                    InputProps={{
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    edge="end"
                                                    onClick={() => setShowConfirmPassword((current) => !current)}
                                                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                                                >
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
                                        bgcolor: muiTheme.palette.mode === "dark"
                                            ? alpha("#FFFFFF", 0.02)
                                            : alpha("#F8FBFF", 0.96)
                                    }}
                                >
                                    <Stack spacing={0.9}>
                                        <Stack
                                            direction={{ xs: "column", sm: "row" }}
                                            justifyContent="space-between"
                                            alignItems={{ sm: "center" }}
                                            spacing={0.55}
                                        >
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

                        <Stack
                            direction={{ xs: "column", md: "row" }}
                            justifyContent="space-between"
                            alignItems={{ md: "center" }}
                            spacing={2}
                            sx={{ mt: 1.9 }}
                        >
                            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                <Chip label={branchesLoading ? "Loading branches" : `${branches.length} branch${branches.length === 1 ? "" : "es"} available`} variant="outlined" />
                                <Chip label="Public membership" variant="outlined" />
                            </Stack>
                            <Button
                                type="submit"
                                variant="contained"
                                endIcon={<ArrowForwardRoundedIcon />}
                                sx={{
                                    minWidth: 210,
                                    minHeight: 44,
                                    borderRadius: 2.5,
                                    px: 2.6
                                }}
                                disabled={submitting}
                            >
                                {submitting ? "Submitting..." : "Submit application"}
                            </Button>
                        </Stack>
                    </form>

                    <Divider sx={{ my: 1.9 }} />

                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} spacing={1.75}>
                        <Typography variant="body2" sx={{ color: mutedText }}>
                            Already have an account?
                            {" "}
                            <RouterLink to="/signin">Sign in</RouterLink>
                        </Typography>
                        <Stack direction="row" spacing={1}>
                            <Button
                                component="a"
                                href={import.meta.env.VITE_MARKETING_OWNER_EMAIL ? `mailto:${import.meta.env.VITE_MARKETING_OWNER_EMAIL}` : "/signin"}
                                variant="text"
                            >
                                Talk to us
                            </Button>
                            <Button
                                component={RouterLink}
                                to="/"
                                variant="text"
                                endIcon={<ArrowForwardRoundedIcon />}
                            >
                                Back to home
                            </Button>
                        </Stack>
                    </Stack>
                </Box>
            </Paper>
        </Box>
    );
}
